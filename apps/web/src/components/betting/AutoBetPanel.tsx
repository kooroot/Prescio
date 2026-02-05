/**
 * Auto-Bet Strategy Panel
 * 
 * Allows users to configure and enable auto-betting strategies.
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
import { api } from "../../lib/api";

interface AutoBetPanelProps {
  gameId: string;
  onStatusChange?: (enabled: boolean) => void;
}

export function AutoBetPanel({ gameId, onStatusChange }: AutoBetPanelProps) {
  const { address, isConnected } = useAccount();
  const { t, language } = useI18n();

  const [status, setStatus] = useState<AutoBetStatus | null>(null);
  const [strategy, setStrategy] = useState<AutoBetStrategyType>("balanced");
  const [maxBet, setMaxBet] = useState("1"); // in MON
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  // Fetch current status
  useEffect(() => {
    if (!address) return;

    const fetchStatus = async () => {
      try {
        const res = await api.get<AutoBetStatus>(`/auto-bet/status?address=${address}`);
        setStatus(res);
        if (res.config) {
          setStrategy(res.config.strategy);
          setMaxBet(formatEther(BigInt(res.config.maxBetPerRound)));
        }
        setIsJoined(res.currentGameId === gameId);
      } catch (err) {
        console.error("Failed to fetch auto-bet status:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [address, gameId]);

  const handleConfigure = async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);

    try {
      const maxBetWei = parseEther(maxBet).toString();
      const res = await api.post<{ success: boolean; config: AutoBetConfig }>("/auto-bet/configure", {
        address,
        strategy,
        maxBetPerRound: maxBetWei,
        enabled: true,
      });

      if (res.success) {
        setStatus((prev) => prev ? { ...prev, config: res.config } : null);
        onStatusChange?.(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to configure");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);

    try {
      await api.post("/auto-bet/join", { address, gameId });
      setIsJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      await api.post("/auto-bet/leave", { address, gameId });
      setIsJoined(false);
    } catch (err) {
      console.error("Failed to leave:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      await api.post("/auto-bet/disable", { address });
      setStatus((prev) => prev ? { ...prev, config: prev.config ? { ...prev.config, enabled: false } : null } : null);
      setIsJoined(false);
      onStatusChange?.(false);
    } catch (err) {
      console.error("Failed to disable:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-2">🤖 Auto-Bet</h3>
        <p className="text-slate-400 text-sm">{t("connectWallet")}</p>
      </div>
    );
  }

  const isConfigured = status?.config?.enabled;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🤖 Auto-Bet</h3>
        {isConfigured && (
          <span className={`px-2 py-1 rounded text-xs font-medium ${isJoined ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
            {isJoined ? "Active" : "Standby"}
          </span>
        )}
      </div>

      {/* Strategy Selection */}
      <div className="space-y-3 mb-4">
        <label className="block text-sm text-slate-400">
          {language === "ko" ? "전략 선택" : "Select Strategy"}
        </label>
        <div className="grid grid-cols-1 gap-2">
          {(Object.keys(STRATEGY_DESCRIPTIONS) as AutoBetStrategyType[]).map((key) => {
            const desc = STRATEGY_DESCRIPTIONS[key];
            const isSelected = strategy === key;
            return (
              <button
                key={key}
                onClick={() => setStrategy(key)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{desc.icon}</span>
                  <span className="font-medium text-white">
                    {language === "ko" ? desc.nameKo : desc.name}
                  </span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                    desc.riskLevel === "low" ? "bg-green-500/20 text-green-400" :
                    desc.riskLevel === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {desc.riskLevel === "low" ? "Low Risk" :
                     desc.riskLevel === "medium" ? "Medium" : "High Risk"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {language === "ko" ? desc.descriptionKo : desc.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Max Bet Input */}
      <div className="mb-4">
        <label className="block text-sm text-slate-400 mb-2">
          {language === "ko" ? "라운드당 최대 베팅" : "Max Bet per Round"}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={maxBet}
            onChange={(e) => setMaxBet(e.target.value)}
            min="0.1"
            step="0.1"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          />
          <span className="text-slate-400">MON</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {!isConfigured ? (
          <button
            onClick={handleConfigure}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            {isLoading ? "..." : language === "ko" ? "자동 베팅 활성화" : "Enable Auto-Bet"}
          </button>
        ) : (
          <>
            {!isJoined ? (
              <button
                onClick={handleJoinGame}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? "..." : language === "ko" ? "이 게임 참여" : "Join This Game"}
              </button>
            ) : (
              <button
                onClick={handleLeaveGame}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? "..." : language === "ko" ? "게임에서 나가기" : "Leave Game"}
              </button>
            )}
            <button
              onClick={handleConfigure}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg font-medium transition-colors"
            >
              {language === "ko" ? "설정 업데이트" : "Update Settings"}
            </button>
            <button
              onClick={handleDisable}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors"
            >
              {language === "ko" ? "비활성화" : "Disable"}
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      {status && status.totalBets > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <h4 className="text-sm font-medium text-slate-400 mb-2">
            {language === "ko" ? "통계" : "Stats"}
          </h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-white">{status.totalBets}</div>
              <div className="text-xs text-slate-400">Bets</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">{status.totalWins}</div>
              <div className="text-xs text-slate-400">Wins</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${BigInt(status.profitLoss) >= 0n ? "text-green-400" : "text-red-400"}`}>
                {formatEther(BigInt(status.profitLoss))} MON
              </div>
              <div className="text-xs text-slate-400">P/L</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
