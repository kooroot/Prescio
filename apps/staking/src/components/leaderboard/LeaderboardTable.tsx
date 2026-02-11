import { useState, useMemo } from "react";
import { Loader2, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { TierBadge } from "./TierBadge";
import { formatFullNumber, formatMONReward, maskAddress } from "@/lib/leaderboard/utils";
import { StakerInfo, TierLevel } from "@/lib/leaderboard/types";
import { TIERS } from "@/lib/leaderboard/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LeaderboardTableProps {
  stakers: StakerInfo[];
  allStakers: StakerInfo[]; // Full data for search
  totalStakers: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  currentUserAddress?: string;
  onPageChange: (page: number) => void;
  onTierFilter: (tier: TierLevel | null) => void;
  selectedTier: TierLevel | null;
}

export function LeaderboardTable({
  stakers,
  allStakers,
  totalStakers,
  currentPage,
  totalPages,
  isLoading,
  currentUserAddress,
  onPageChange,
  onTierFilter,
  selectedTier,
}: LeaderboardTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Search across ALL stakers, not just paginated
  const filteredStakers = useMemo(() => {
    if (!searchQuery) return stakers;
    
    // Search in full dataset
    return allStakers.filter((s) =>
      s.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stakers, allStakers, searchQuery]);

  // When searching, show search results; otherwise show paginated results
  const displayStakers = searchQuery ? filteredStakers : stakers;
  const isSearching = searchQuery.length > 0;

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#27272A]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide">
            📋 All Stakers ({totalStakers.toLocaleString()})
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-[#A1A1AA] hover:text-white"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 mb-3">
            {/* Tier Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onTierFilter(null)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedTier === null
                    ? "bg-[#6E54FF] text-white"
                    : "bg-[#0E100F] text-[#A1A1AA] hover:bg-[#27272A]"
                }`}
              >
                All Tiers
              </button>
              {TIERS.map((tier) => (
                <button
                  key={tier.level}
                  onClick={() => onTierFilter(tier.level)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    selectedTier === tier.level
                      ? `${tier.badgeClass}`
                      : "bg-[#0E100F] text-[#A1A1AA] hover:bg-[#27272A]"
                  }`}
                >
                  {tier.icon} {tier.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
          <Input
            type="text"
            placeholder="Search by address (0x...) - searches all stakers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0E100F] border-[#27272A] text-white placeholder:text-[#71717A]"
          />
          {isSearching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#71717A]">
              {filteredStakers.length} found
            </span>
          )}
        </div>
      </div>
      
      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#6E54FF]" />
        </div>
      ) : displayStakers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#71717A]">
            {isSearching ? "No stakers found matching your search" : "No stakers found"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table 
              className="w-full" 
              role="table" 
              aria-label="Staking Leaderboard"
            >
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0E100F]/50" role="row">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-[#71717A]">#</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-[#71717A]">Address</th>
                  <th scope="col" className="text-left py-3 px-4 text-xs font-medium text-[#71717A]">Tier</th>
                  <th scope="col" className="text-right py-3 px-4 text-xs font-medium text-[#71717A]">Staked</th>
                  <th scope="col" className="text-right py-3 px-4 text-xs font-medium text-[#71717A]">Est. MON</th>
                  <th scope="col" className="text-right py-3 px-4 text-xs font-medium text-[#71717A]">Est. PRESCIO</th>
                </tr>
              </thead>
              <tbody>
                {displayStakers.map((staker) => {
                  const isCurrentUser =
                    currentUserAddress?.toLowerCase() === staker.address.toLowerCase();
                  
                  return (
                    <tr
                      key={staker.address}
                      className={`
                        border-b border-[#27272A]/50 hover:bg-[#27272A]/30 transition-colors
                        ${isCurrentUser ? "bg-[#6E54FF]/10 hover:bg-[#6E54FF]/20" : ""}
                      `}
                    >
                      <td className="py-3 px-4">
                        <span className={`font-mono text-sm ${isCurrentUser ? "text-[#6E54FF] font-bold" : "text-white"}`}>
                          {staker.rank}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-white">
                            {maskAddress(staker.address)}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[10px] bg-[#6E54FF]/20 text-[#6E54FF] px-1.5 py-0.5 rounded font-medium">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <TierBadge tier={staker.tier} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm text-white">
                          {formatFullNumber(staker.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm text-purple-400">
                          ≈{formatMONReward(staker.estimatedMON)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm text-blue-400">
                          {formatFullNumber(staker.estimatedPRESCIO)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-[#27272A]">
            {displayStakers.map((staker) => {
              const isCurrentUser =
                currentUserAddress?.toLowerCase() === staker.address.toLowerCase();
              
              return (
                <div
                  key={staker.address}
                  className={`p-4 active:scale-[0.99] transition-transform ${isCurrentUser ? "bg-[#6E54FF]/10" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-lg font-bold ${isCurrentUser ? "text-[#6E54FF]" : "text-white"}`}>
                        #{staker.rank}
                      </span>
                      <TierBadge tier={staker.tier} size="sm" />
                      {isCurrentUser && (
                        <span className="text-[10px] bg-[#6E54FF]/20 text-[#6E54FF] px-1.5 py-0.5 rounded font-medium">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="font-mono text-xs text-[#71717A] mb-2">
                    {maskAddress(staker.address)}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {formatFullNumber(staker.amount)}
                      </p>
                      <p className="text-xs text-[#71717A]">PRESCIO</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-purple-400">
                        ≈{formatMONReward(staker.estimatedMON)} MON
                      </p>
                      <p className="text-xs text-blue-400">
                        +{formatFullNumber(staker.estimatedPRESCIO)} PRESCIO
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      
      {/* Pagination - hide when searching */}
      {totalPages > 1 && !isSearching && (
        <div className="flex items-center justify-center gap-4 p-4 border-t border-[#27272A]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-[#A1A1AA] hover:text-white disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </Button>
          
          <span className="text-sm text-[#71717A]">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="text-[#A1A1AA] hover:text-white disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
