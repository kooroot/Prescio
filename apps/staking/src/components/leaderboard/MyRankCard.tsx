import { Loader2, TrendingUp } from "lucide-react";
import { TierBadge } from "./TierBadge";
import { formatFullNumber, formatMONReward } from "@/lib/leaderboard/utils";
import { MyRankInfo, NextTierProgress } from "@/lib/leaderboard/types";
import { formatEther } from "viem";

interface MyRankCardProps {
  myRank: MyRankInfo | null;
  fomoMessage: string | null;
  nextTierProgress: NextTierProgress | null;
  isLoading: boolean;
  isConnected: boolean;
}

export function MyRankCard({
  myRank,
  fomoMessage,
  nextTierProgress,
  isLoading,
  isConnected,
}: MyRankCardProps) {
  if (!isConnected) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">
          🎯 My Rank
        </h3>
        <div className="text-center py-6">
          <p className="text-[#71717A] text-sm">Connect wallet to see your rank</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">
          🎯 My Rank
        </h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#6E54FF]" />
        </div>
      </div>
    );
  }

  if (!myRank) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">
          🎯 My Rank
        </h3>
        <div className="text-center py-6">
          <p className="text-[#71717A] text-sm mb-2">You haven't staked yet</p>
          <p className="text-xs text-[#6E54FF]">Stake PRESCIO to appear on the leaderboard!</p>
        </div>
      </div>
    );
  }

  const tierInfo = nextTierProgress?.currentTier;
  const bgClass = tierInfo?.bgClass || "bg-[#18181B]";
  const borderClass = tierInfo?.borderClass || "border-[#27272A]";

  return (
    <div className={`${bgClass} border ${borderClass} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide">
          🎯 My Rank
        </h3>
        <TierBadge tier={myRank.tier} size="md" />
      </div>
      
      {/* Rank Display */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-bold text-white">#{myRank.rank}</span>
        <span className="text-lg text-[#71717A]">/ {myRank.totalStakers.toLocaleString()}</span>
      </div>
      
      {/* Staked Amount */}
      <div className="mb-4">
        <p className="text-2xl font-semibold text-white">
          {formatFullNumber(myRank.amount)}
        </p>
        <p className="text-sm text-[#71717A]">PRESCIO Staked</p>
      </div>
      
      {/* Estimated Rewards */}
      <div className="bg-[#0E100F]/50 rounded-lg p-3 mb-4">
        <p className="text-xs text-[#71717A] mb-2">Estimated Rewards This Epoch</p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-purple-400">
            ≈{formatMONReward(myRank.estimatedMON)} MON
          </span>
          <span className="text-[#71717A]">+</span>
          <span className="text-sm font-medium text-blue-400">
            {formatFullNumber(myRank.estimatedPRESCIO)} PRESCIO
          </span>
        </div>
      </div>
      
      {/* FOMO Message */}
      {fomoMessage && (
        <div className="bg-[#6E54FF]/10 border border-[#6E54FF]/20 rounded-lg p-3 mb-4">
          <p className="text-sm text-[#6E54FF] font-medium">{fomoMessage}</p>
        </div>
      )}
      
      {/* Tier Progress */}
      {nextTierProgress?.nextTier && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#71717A]">
              Progress to {nextTierProgress.nextTier.name}
            </span>
            <span className={nextTierProgress.nextTier.colorClass}>
              {formatFullNumber(nextTierProgress.amountNeeded)} more
            </span>
          </div>
          <div className="h-2 bg-[#0E100F] rounded-full overflow-hidden">
            <div
              className={`h-full ${nextTierProgress.currentTier?.colorClass.replace('text-', 'bg-') || 'bg-[#6E54FF]'} rounded-full transition-all duration-500`}
              style={{ width: `${nextTierProgress.progress}%` }}
            />
          </div>
          
          {/* FOMO for near tier upgrade */}
          {nextTierProgress.progress >= 80 && (
            <div className="mt-3 p-2 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-lg animate-pulse">
              <p className="text-xs text-center font-medium text-white">
                🔥 {nextTierProgress.nextTier.name}까지 단 {formatFullNumber(nextTierProgress.amountNeeded)} PRESCIO!
              </p>
            </div>
          )}
        </div>
      )}
      
      {!nextTierProgress?.nextTier && (
        <div className="mt-4 p-3 bg-cyan-400/10 border border-cyan-400/20 rounded-lg">
          <p className="text-sm text-cyan-400 font-medium text-center">
            🎉 최고 티어 달성!
          </p>
        </div>
      )}
    </div>
  );
}
