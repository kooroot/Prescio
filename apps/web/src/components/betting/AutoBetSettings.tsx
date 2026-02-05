/**
 * Auto-Bet Settings Card (for Main Page)
 * 
 * Global auto-bet configuration for premium/staker users.
 */

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  STRATEGY_DESCRIPTIONS,
  type AutoBetStrategyType,
  type AutoBetConfig,
  type AutoBetStatus,
} from "@prescio/common";
import { useI18n } from "../../i18n/context";
import { Bot, Settings, Zap, Shield, TrendingUp } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const strategyIcons: Record<AutoBetStrategyType, React.ReactNode> = {
  conservative: <Shield className="h-5 w-5" />,
  balanced: <Settings className="h-5 w-5" />,
  aggressive: <TrendingUp className="h-5 w-5" />,
};

export function AutoBetSettings() {
  const { address, isConnected } = useAccount();
  const { t, lang } = useI18n();

  const [status, setStatus] = useState<AutoBetStatus | null>(null);
  const [strategy, setStrategy] = useState<AutoBetStrategyType>("balanced");
  const [maxBet, setMaxBet] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const fetchStatus = async () => {
      try {
        const res = await apiGet<AutoBetStatus>(`/auto-bet/status?address=${address}`);
        setStatus(res);
        if (res.config) {
          setStrategy(res.config.strategy);
          setMaxBet(formatEther(BigInt(res.config.maxBetPerRound)));
          setIsExpanded(true);
        }
      } catch (err) {
        console.error("Failed to fetch auto-bet status:", err);
      }
    };

    fetchStatus();
  }, [address]);

  const handleSave = async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);

    try {
      const maxBetWei = parseEther(maxBet).toString();
      const res = await apiPost<{ success: boolean; config: AutoBetConfig }>("/auto-bet/configure", {
        address,
        strategy,
        maxBetPerRound: maxBetWei,
        enabled: true,
      });

      if (res.success) {
        setStatus((prev) => prev ? { ...prev, config: res.config } : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      await apiPost("/auto-bet/disable", { address });
      setStatus((prev) => prev ? { ...prev, config: prev.config ? { ...prev.config, enabled: false } : null } : null);
    } catch (err) {
      console.error("Failed to disable:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="w-full mb-8 rounded-xl border border-monad-border bg-gradient-to-br from-monad-card/60 to-monad-card/30 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-monad-purple/10">
            <Bot className="h-6 w-6 text-monad-purple" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Auto-Bet Agent</h3>
            <p className="text-sm text-gray-400">
              {lang === "ko" ? "프리미엄 기능 — 지갑을 연결하세요" : "Premium Feature — Connect wallet to enable"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isConfigured = status?.config?.enabled;

  return (
    <div className="w-full mb-8 rounded-xl border border-monad-border bg-gradient-to-br from-monad-card/60 to-monad-card/30 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConfigured ? "bg-green-500/10" : "bg-monad-purple/10"}`}>
            <Bot className={`h-6 w-6 ${isConfigured ? "text-green-400" : "text-monad-purple"}`} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              Auto-Bet Agent
              {isConfigured && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                  {lang === "ko" ? "활성" : "Active"}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-400">
              {isConfigured
                ? `${STRATEGY_DESCRIPTIONS[status!.config!.strategy][lang === "ko" ? "nameKo" : "name"]} • ${formatEther(BigInt(status!.config!.maxBetPerRound))} MON/round`
                : lang === "ko" ? "AI가 자동으로 베팅합니다" : "Let AI bet for you automatically"
              }
            </p>
          </div>
        </div>
        <Zap className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""} text-gray-400`} />
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-monad-border/50">
          <div className="pt-4 space-y-4">
            {/* Strategy Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {lang === "ko" ? "전략 선택" : "Select Strategy"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(STRATEGY_DESCRIPTIONS) as AutoBetStrategyType[]).map((key) => {
                  const desc = STRATEGY_DESCRIPTIONS[key];
                  const isSelected = strategy === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setStrategy(key)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        isSelected
                          ? "border-monad-purple bg-monad-purple/10"
                          : "border-monad-border bg-monad-dark/50 hover:border-monad-border/80"
                      }`}
                    >
                      <div className={`mx-auto mb-1 ${isSelected ? "text-monad-purple" : "text-gray-400"}`}>
                        {strategyIcons[key]}
                      </div>
                      <div className={`text-sm font-medium ${isSelected ? "text-white" : "text-gray-300"}`}>
                        {lang === "ko" ? desc.nameKo : desc.name}
                      </div>
                      <div className={`text-xs mt-0.5 ${
                        desc.riskLevel === "low" ? "text-green-400" :
                        desc.riskLevel === "medium" ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {desc.riskLevel === "low" ? "Low Risk" :
                         desc.riskLevel === "medium" ? "Medium" : "High Risk"}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {lang === "ko" 
                  ? STRATEGY_DESCRIPTIONS[strategy].descriptionKo 
                  : STRATEGY_DESCRIPTIONS[strategy].description}
              </p>
            </div>

            {/* Max Bet Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {lang === "ko" ? "라운드당 최대 베팅" : "Max Bet per Round"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={maxBet}
                  onChange={(e) => setMaxBet(e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="flex-1 bg-monad-dark border border-monad-border rounded-lg px-3 py-2 text-white focus:border-monad-purple focus:outline-none"
                />
                <span className="text-gray-400 font-medium">MON</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? "..." : isConfigured 
                  ? (lang === "ko" ? "설정 저장" : "Save Settings")
                  : (lang === "ko" ? "활성화" : "Enable")}
              </button>
              {isConfigured && (
                <button
                  onClick={handleDisable}
                  disabled={isLoading}
                  className="py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors"
                >
                  {lang === "ko" ? "비활성화" : "Disable"}
                </button>
              )}
            </div>

            {/* Stats */}
            {status && status.totalBets > 0 && (
              <div className="pt-4 border-t border-monad-border/50">
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  {lang === "ko" ? "통계" : "Stats"}
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-monad-dark/50">
                    <div className="text-lg font-bold text-white">{status.totalBets}</div>
                    <div className="text-xs text-gray-400">Bets</div>
                  </div>
                  <div className="p-2 rounded-lg bg-monad-dark/50">
                    <div className="text-lg font-bold text-green-400">{status.totalWins}</div>
                    <div className="text-xs text-gray-400">Wins</div>
                  </div>
                  <div className="p-2 rounded-lg bg-monad-dark/50">
                    <div className="text-lg font-bold text-red-400">{status.totalLosses}</div>
                    <div className="text-xs text-gray-400">Losses</div>
                  </div>
                  <div className="p-2 rounded-lg bg-monad-dark/50">
                    <div className={`text-lg font-bold ${BigInt(status.profitLoss) >= 0n ? "text-green-400" : "text-red-400"}`}>
                      {Number(formatEther(BigInt(status.profitLoss))).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">P/L (MON)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Premium Notice */}
            <div className="pt-2 text-center">
              <p className="text-xs text-gray-500">
                {lang === "ko" 
                  ? "🔐 스테이커 및 프리미엄 구독자 전용 기능" 
                  : "🔐 Available for Stakers & Premium Subscribers"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
