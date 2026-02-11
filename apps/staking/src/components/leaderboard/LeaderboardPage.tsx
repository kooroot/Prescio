import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { AlertCircle, RefreshCw } from "lucide-react";
import { LeaderboardStats } from "./LeaderboardStats";
import { MyRankCard } from "./MyRankCard";
import { TopRankerShowcase } from "./TopRankerShowcase";
import { LeaderboardTable } from "./LeaderboardTable";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useMyRank } from "@/hooks/useMyRank";
import { TierLevel } from "@/lib/leaderboard/types";
import { EPOCH_DURATION_SECONDS, TOP_RANKER_COUNT } from "@/lib/leaderboard/constants";
import { Button } from "@/components/ui/button";

export function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const [currentPage, setCurrentPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<TierLevel | null>(null);
  
  // Single leaderboard data source - includes allStakers for Top 3 and search
  const {
    stakers,
    allStakers,
    totalStakers,
    totalPages,
    totalStaked,
    totalWeight,
    epochInfo,
    isLoading: isLoadingLeaderboard,
    isFetching,
    error: leaderboardError,
    hasPartialFailure,
    failedCount,
    refetch,
  } = useLeaderboard({
    page: currentPage,
    pageSize: 50,
    tierFilter,
  });
  
  // Fetch current user's rank
  const {
    myRank,
    fomoMessage,
    nextTierProgress,
    isLoading: isLoadingMyRank,
    error: myRankError,
  } = useMyRank(address);
  
  // Top 3 stakers from allStakers (no additional fetch)
  const topStakers = useMemo(() => 
    allStakers.slice(0, TOP_RANKER_COUNT), 
    [allStakers]
  );
  
  const epochEndTime = useMemo(() => {
    if (!epochInfo?.startTime) return 0n;
    return epochInfo.startTime + EPOCH_DURATION_SECONDS;
  }, [epochInfo]);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  
  const handleTierFilter = (tier: TierLevel | null) => {
    setTierFilter(tier);
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Combined error state
  const error = leaderboardError || myRankError;

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-400 text-sm">
                Failed to load leaderboard data. Please try again.
              </p>
              {hasPartialFailure && (
                <p className="text-red-400/70 text-xs mt-1">
                  {failedCount} item(s) failed to load
                </p>
              )}
            </div>
            <Button 
              onClick={refetch} 
              variant="ghost" 
              size="sm" 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Partial failure warning */}
      {hasPartialFailure && !error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <p className="text-yellow-400 text-xs">
              Some data may be incomplete ({failedCount} item(s) failed)
            </p>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <LeaderboardStats
        totalStakers={totalStakers}
        totalStaked={totalStaked}
        epochNumber={epochInfo?.epochNumber ?? 0n}
        epochMonRewards={epochInfo?.monRewards ?? 0n}
        epochPrescioRewards={epochInfo?.prescioRewards ?? 0n}
        epochEndTime={epochEndTime}
        isLoading={isLoadingLeaderboard}
      />
      
      {/* Top Section: My Rank + Top 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MyRankCard
          myRank={myRank}
          fomoMessage={fomoMessage}
          nextTierProgress={nextTierProgress}
          isLoading={isLoadingMyRank}
          isConnected={isConnected}
        />
        
        <TopRankerShowcase
          topStakers={topStakers}
          isLoading={isLoadingLeaderboard}
          currentUserAddress={address}
        />
      </div>
      
      {/* Full Leaderboard Table - pass allStakers for search */}
      <LeaderboardTable
        stakers={stakers}
        allStakers={allStakers}
        totalStakers={totalStakers}
        currentPage={currentPage}
        totalPages={totalPages}
        isLoading={isLoadingLeaderboard}
        currentUserAddress={address}
        onPageChange={handlePageChange}
        onTierFilter={handleTierFilter}
        selectedTier={tierFilter}
      />
      
      {/* Loading indicator for background refresh */}
      {isFetching && !isLoadingLeaderboard && (
        <div className="fixed bottom-4 right-4 bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-[#A1A1AA]">Refreshing...</span>
        </div>
      )}
    </div>
  );
}
