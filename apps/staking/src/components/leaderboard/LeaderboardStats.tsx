import { memo } from "react";
import { Loader2, Users, Coins, Trophy, Clock } from "lucide-react";
import { formatFullNumber } from "@/lib/leaderboard/utils";
import { formatEther } from "viem";

interface LeaderboardStatsProps {
  totalStakers: number;
  totalStaked: bigint;
  epochNumber: bigint;
  epochMonRewards: bigint;
  epochPrescioRewards: bigint;
  epochEndTime: bigint;
  isLoading: boolean;
}

// Memoized EpochCountdown to prevent unnecessary re-renders
const EpochCountdown = memo(function EpochCountdown({ 
  epochEndTime 
}: { 
  epochEndTime: bigint 
}) {
  const now = Math.floor(Date.now() / 1000);
  const endTime = Number(epochEndTime);
  const remaining = endTime - now;

  if (remaining <= 0) {
    return <span className="text-green-400">Finalizing...</span>;
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  let timeStr = "";
  if (days > 0) {
    timeStr = `${days}d ${hours}h`;
  } else if (hours > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else {
    timeStr = `${minutes}m`;
  }

  return <span className="text-yellow-400">{timeStr}</span>;
});

EpochCountdown.displayName = 'EpochCountdown';

export function LeaderboardStats({
  totalStakers,
  totalStaked,
  epochNumber,
  epochMonRewards,
  epochPrescioRewards,
  epochEndTime,
  isLoading,
}: LeaderboardStatsProps) {
  if (isLoading) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#6E54FF]" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-[#6E54FF]" />
        <h2 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide">
          Leaderboard Stats
        </h2>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Stakers */}
        <div className="bg-[#0E100F] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[#6E54FF]" />
            <span className="text-xs text-[#71717A]">Total Stakers</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {totalStakers.toLocaleString()}
          </p>
        </div>
        
        {/* Total Staked */}
        <div className="bg-[#0E100F] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-[#6E54FF]" />
            <span className="text-xs text-[#71717A]">Total Staked</span>
          </div>
          <p className="text-lg font-semibold text-white">
            {formatFullNumber(totalStaked)}
          </p>
          <p className="text-[10px] text-[#71717A]">PRESCIO</p>
        </div>
        
        {/* Epoch Rewards */}
        <div className="bg-[#0E100F] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-[#71717A]">Epoch #{epochNumber.toString()} Rewards</span>
          </div>
          <p className="text-sm font-semibold text-white">
            {parseFloat(formatEther(epochMonRewards)).toFixed(2)} MON
          </p>
          <p className="text-xs text-[#71717A]">
            + {formatFullNumber(epochPrescioRewards)} PRESCIO
          </p>
        </div>
        
        {/* Time Left */}
        <div className="bg-[#0E100F] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-[#6E54FF]" />
            <span className="text-xs text-[#71717A]">Epoch Ends In</span>
          </div>
          <p className="text-lg font-semibold">
            {epochEndTime > 0n ? (
              <EpochCountdown epochEndTime={epochEndTime} />
            ) : (
              <span className="text-[#71717A]">-</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
