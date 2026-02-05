/**
 * Auto-Bet Floating Widget
 * 
 * Floating button in bottom-right that expands to show auto-bet settings.
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
import { Bot, X, Shield, Settings, TrendingUp, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";

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
  conservative: <Shield className="h-4 w-4" />,
  balanced: <Settings className="h-4 w-4" />,
  aggressive: <TrendingUp className="h-4 w-4" />,
};

export function AutoBetWidget() {
  const { address, isConnected } = useAccount();
  const { lang } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AutoBetStatus | null>(null);
  const [strategy, setStrategy] = useState<AutoBetStrategyType>("balanced");
  const [maxBet, setMaxBet] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
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
        }
      } catch (err) {
        console.error("Failed to fetch auto-bet status:", err);
      }
    };

    fetchStatus();
  }, [address]);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);

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
        setSaveSuccess(true);
        toast.success(lang === "ko" ? "✅ 자동 베팅 설정 저장됨" : "✅ Auto-bet settings saved", {
          description: `${STRATEGY_DESCRIPTIONS[strategy][lang === "ko" ? "nameKo" : "name"]} • ${maxBet} MON/round`,
        });
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast.error(lang === "ko" ? "❌ 저장 실패" : "❌ Failed to save");
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
      toast.success(lang === "ko" ? "🔴 자동 베팅 비활성화됨" : "🔴 Auto-bet disabled");
    } catch (err) {
      console.error("Failed to disable:", err);
      toast.error(lang === "ko" ? "❌ 비활성화 실패" : "❌ Failed to disable");
    } finally {
      setIsLoading(false);
    }
  };

  const isConfigured = status?.config?.enabled;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 rounded-2xl border border-monad-border bg-monad-card shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-monad-border/50 bg-gradient-to-r from-monad-purple/10 to-transparent">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-monad-purple" />
              <span className="font-semibold text-white">Auto-Bet Agent</span>
              {isConfigured && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">
                  ON
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {!isConnected ? (
              <div className="text-center py-6">
                <Bot className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  {lang === "ko" ? "지갑을 연결하세요" : "Connect wallet to enable"}
                </p>
              </div>
            ) : (
              <>
                {/* Strategy Selection */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
                    {lang === "ko" ? "전략" : "Strategy"}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(STRATEGY_DESCRIPTIONS) as AutoBetStrategyType[]).map((key) => {
                      const desc = STRATEGY_DESCRIPTIONS[key];
                      const isSelected = strategy === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setStrategy(key)}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            isSelected
                              ? "border-monad-purple bg-monad-purple/20"
                              : "border-monad-border/50 bg-monad-dark/30 hover:border-monad-border"
                          }`}
                        >
                          <div className={`mx-auto mb-0.5 ${isSelected ? "text-monad-purple" : "text-gray-500"}`}>
                            {strategyIcons[key]}
                          </div>
                          <div className={`text-xs font-medium ${isSelected ? "text-white" : "text-gray-400"}`}>
                            {lang === "ko" ? desc.nameKo : desc.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                    {lang === "ko" 
                      ? STRATEGY_DESCRIPTIONS[strategy].descriptionKo 
                      : STRATEGY_DESCRIPTIONS[strategy].description}
                  </p>
                </div>

                {/* Max Bet */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
                    {lang === "ko" ? "라운드당 최대" : "Max per Round"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={maxBet}
                      onChange={(e) => setMaxBet(e.target.value)}
                      min="0.1"
                      step="0.1"
                      className="flex-1 bg-monad-dark/50 border border-monad-border/50 rounded-lg px-3 py-2 text-white text-sm focus:border-monad-purple focus:outline-none"
                    />
                    <span className="text-gray-400 text-sm font-medium">MON</span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                      saveSuccess 
                        ? "bg-green-500 text-white" 
                        : "bg-monad-purple hover:bg-monad-purple/80 disabled:bg-gray-600 text-white"
                    }`}
                  >
                    {isLoading ? "..." : saveSuccess ? (
                      <>
                        <Check className="h-4 w-4" />
                        {lang === "ko" ? "저장됨" : "Saved"}
                      </>
                    ) : isConfigured 
                      ? (lang === "ko" ? "저장" : "Save")
                      : (lang === "ko" ? "활성화" : "Enable")}
                  </button>
                  {isConfigured && (
                    <button
                      onClick={handleDisable}
                      disabled={isLoading}
                      className="py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      {lang === "ko" ? "끄기" : "Off"}
                    </button>
                  )}
                </div>

                {/* Stats (if any) */}
                {status && status.totalBets > 0 && (
                  <div className="pt-3 border-t border-monad-border/30">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-sm font-bold text-white">{status.totalBets}</div>
                        <div className="text-[10px] text-gray-500">Bets</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-green-400">{status.totalWins}</div>
                        <div className="text-[10px] text-gray-500">Wins</div>
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${BigInt(status.profitLoss) >= 0n ? "text-green-400" : "text-red-400"}`}>
                          {Number(formatEther(BigInt(status.profitLoss))).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-500">P/L</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Premium Badge */}
                <div className="text-center pt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                    🔐 {lang === "ko" ? "프리미엄 기능" : "Premium Feature"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-4 rounded-full shadow-lg transition-all duration-200 ${
          isOpen 
            ? "bg-monad-dark border border-monad-border" 
            : isConfigured
              ? "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500"
              : "bg-gradient-to-br from-monad-purple to-[#7C3AED] hover:from-[#9B87FF] hover:to-monad-purple"
        } hover:scale-105`}
      >
        {isOpen ? (
          <ChevronUp className="h-6 w-6 text-gray-400" />
        ) : (
          <>
            <Bot className="h-6 w-6 text-white" />
            {isConfigured && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-monad-dark animate-pulse" />
            )}
          </>
        )}
      </button>
    </div>
  );
}
