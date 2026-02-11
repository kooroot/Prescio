import { Loader2 } from "lucide-react";
import { TierBadge } from "./TierBadge";
import { formatFullNumber, formatMONReward, maskAddress } from "@/lib/leaderboard/utils";
import { StakerInfo } from "@/lib/leaderboard/types";
import { TOP_RANKER_POSITIONS } from "@/lib/leaderboard/constants";

interface TopRankerShowcaseProps {
  topStakers: StakerInfo[];
  isLoading: boolean;
  currentUserAddress?: string;
}

export function TopRankerShowcase({
  topStakers,
  isLoading,
  currentUserAddress,
}: TopRankerShowcaseProps) {
  if (isLoading) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">
          🏅 TOP 3 Rankers
        </h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#6E54FF]" />
        </div>
      </div>
    );
  }

  if (topStakers.length === 0) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">
          🏅 TOP 3 Rankers
        </h3>
        <div className="text-center py-6">
          <p className="text-[#71717A] text-sm">No stakers yet</p>
        </div>
      </div>
    );
  }

  const top3 = topStakers.slice(0, 3);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
      <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">
        🏅 TOP 3 Rankers
      </h3>
      
      <div className="space-y-3">
        {top3.map((staker, index) => {
          const position = TOP_RANKER_POSITIONS[index];
          const isCurrentUser = currentUserAddress?.toLowerCase() === staker.address.toLowerCase();
          
          return (
            <div
              key={staker.address}
              className={`
                ${position.bgClass} border ${position.borderClass} rounded-lg p-4
                ${isCurrentUser ? 'ring-2 ring-[#6E54FF]' : ''}
                transition-all hover:scale-[1.02]
              `}
            >
              <div className="flex items-center justify-between">
                {/* Left: Rank & Address */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{position.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm ${position.colorClass}`}>
                        {maskAddress(staker.address)}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] bg-[#6E54FF]/20 text-[#6E54FF] px-1.5 py-0.5 rounded">
                          YOU
                        </span>
                      )}
                    </div>
                    <TierBadge tier={staker.tier} size="sm" />
                  </div>
                </div>
                
                {/* Right: Amount & Rewards */}
                <div className="text-right">
                  <p className="text-lg font-semibold text-white">
                    {formatFullNumber(staker.amount)}
                  </p>
                  <p className="text-xs text-[#71717A]">PRESCIO</p>
                  <p className="text-xs text-purple-400 mt-1">
                    ≈{formatMONReward(staker.estimatedMON)} MON
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Motivational message */}
      {currentUserAddress && !top3.some(s => s.address.toLowerCase() === currentUserAddress.toLowerCase()) && (
        <div className="mt-4 p-3 bg-[#6E54FF]/5 border border-[#6E54FF]/10 rounded-lg">
          <p className="text-xs text-center text-[#A1A1AA]">
            💪 Stake more to climb the ranks and earn bigger rewards!
          </p>
        </div>
      )}
    </div>
  );
}
