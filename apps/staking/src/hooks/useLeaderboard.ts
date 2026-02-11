import { useCallback, useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { type Address } from "viem";
import {
  STAKING_CONTRACT_ADDRESS,
  LEADERBOARD_REFRESH_INTERVAL,
  DEFAULT_PAGE_SIZE,
  CHAIN_ID,
} from "@/lib/leaderboard/constants";
import { StakerInfo, TierLevel } from "@/lib/leaderboard/types";

// Staking ABI (minimal for leaderboard)
const STAKING_ABI = [
  {
    inputs: [],
    name: "getStakerCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "stakers",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "stakes",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockEnd", type: "uint256" },
      { internalType: "uint8", name: "lockType", type: "uint8" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "uint256", name: "lastClaimEpoch", type: "uint256" },
      { internalType: "uint256", name: "lastPrescioClaimEpoch", type: "uint256" },
      { internalType: "uint256", name: "firstEligibleEpoch", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getTier",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getUserWeight",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalWeight",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalStaked",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentEpochInfo",
    outputs: [
      { internalType: "uint256", name: "epochNumber", type: "uint256" },
      { internalType: "uint256", name: "monRewards", type: "uint256" },
      { internalType: "uint256", name: "prescioRewards", type: "uint256" },
      { internalType: "uint256", name: "weight", type: "uint256" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "bool", name: "finalized", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface UseLeaderboardOptions {
  page?: number;
  pageSize?: number;
  tierFilter?: TierLevel | null;
  sortBy?: "amount" | "weight";
  refreshInterval?: number;
  includeAllStakers?: boolean; // Include unfiltered data for Top 3 / search
}

interface UseLeaderboardResult {
  stakers: StakerInfo[];
  allStakers: StakerInfo[]; // Full unfiltered, sorted list
  totalStakers: number;
  totalPages: number;
  currentPage: number;
  totalStaked: bigint;
  totalWeight: bigint;
  epochInfo: {
    epochNumber: bigint;
    monRewards: bigint;
    prescioRewards: bigint;
    totalWeight: bigint;
    startTime: bigint;
    finalized: boolean;
  } | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  hasPartialFailure: boolean;
  failedCount: number;
  refetch: () => void;
}

export function useLeaderboard(options: UseLeaderboardOptions = {}): UseLeaderboardResult {
  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    tierFilter = null,
    sortBy = "amount",
    refreshInterval = LEADERBOARD_REFRESH_INTERVAL,
  } = options;

  const queryClient = useQueryClient();

  // ========================================
  // Stage 1: Get base contract data (cached)
  // ========================================
  
  // Get staker count (cached with longer staleTime)
  const { 
    data: stakerCount, 
    isLoading: isLoadingCount,
    error: stakerCountError,
  } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getStakerCount",
    chainId: CHAIN_ID,
    query: {
      staleTime: refreshInterval,
    },
  });

  // Get total staked
  const { data: totalStaked, error: totalStakedError } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    chainId: CHAIN_ID,
    query: {
      staleTime: refreshInterval,
    },
  });

  // Get total weight
  const { data: totalWeight, error: totalWeightError } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "totalWeight",
    chainId: CHAIN_ID,
    query: {
      staleTime: refreshInterval,
    },
  });

  // Get epoch info (cached with longer staleTime)
  const { data: epochInfoData, error: epochError } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getCurrentEpochInfo",
    chainId: CHAIN_ID,
    query: {
      staleTime: refreshInterval,
    },
  });

  const epochInfo = useMemo(() => {
    if (!epochInfoData) return null;
    return {
      epochNumber: epochInfoData[0],
      monRewards: epochInfoData[1],
      prescioRewards: epochInfoData[2],
      totalWeight: epochInfoData[3],
      startTime: epochInfoData[4],
      finalized: epochInfoData[5],
    };
  }, [epochInfoData]);

  // ========================================
  // Stage 2: Get all staker addresses
  // ========================================
  
  const stakerAddressCalls = useMemo(() => {
    if (!stakerCount) return [];
    const count = Number(stakerCount);
    return Array.from({ length: count }, (_, i) => ({
      address: STAKING_CONTRACT_ADDRESS,
      abi: STAKING_ABI,
      functionName: "stakers" as const,
      args: [BigInt(i)] as const,
      chainId: CHAIN_ID,
    }));
  }, [stakerCount]);

  const { 
    data: stakerAddresses, 
    isLoading: isLoadingAddresses,
    error: stakerAddressError,
  } = useReadContracts({
    contracts: stakerAddressCalls,
    query: {
      enabled: stakerAddressCalls.length > 0,
      refetchInterval: refreshInterval,
      staleTime: refreshInterval / 2,
    },
  });

  // ========================================
  // Stage 3: Fetch stake data (optimized - combined call)
  // stakes + getTier + getUserWeight in single multicall
  // ========================================
  
  const stakeDataCalls = useMemo(() => {
    if (!stakerAddresses) return [];
    
    const calls: Array<{
      address: typeof STAKING_CONTRACT_ADDRESS;
      abi: typeof STAKING_ABI;
      functionName: "stakes" | "getTier" | "getUserWeight";
      args: [Address];
      chainId: typeof CHAIN_ID;
    }> = [];
    
    for (const result of stakerAddresses) {
      if (result.status === "success" && result.result) {
        const addr = result.result as Address;
        calls.push({
          address: STAKING_CONTRACT_ADDRESS,
          abi: STAKING_ABI,
          functionName: "stakes",
          args: [addr],
          chainId: CHAIN_ID,
        });
        calls.push({
          address: STAKING_CONTRACT_ADDRESS,
          abi: STAKING_ABI,
          functionName: "getTier",
          args: [addr],
          chainId: CHAIN_ID,
        });
        calls.push({
          address: STAKING_CONTRACT_ADDRESS,
          abi: STAKING_ABI,
          functionName: "getUserWeight",
          args: [addr],
          chainId: CHAIN_ID,
        });
      }
    }
    
    return calls;
  }, [stakerAddresses]);

  const { 
    data: stakeDataResults, 
    isLoading: isLoadingStakeData, 
    isFetching,
    error: stakeDataError,
  } = useReadContracts({
    contracts: stakeDataCalls,
    query: {
      enabled: stakeDataCalls.length > 0,
      refetchInterval: refreshInterval,
      staleTime: refreshInterval / 2,
    },
  });

  // ========================================
  // Collect errors
  // ========================================
  
  const error = useMemo(() => {
    if (stakerCountError) return stakerCountError;
    if (totalStakedError) return totalStakedError;
    if (totalWeightError) return totalWeightError;
    if (epochError) return epochError;
    if (stakerAddressError) return stakerAddressError;
    if (stakeDataError) return stakeDataError;
    return null;
  }, [stakerCountError, totalStakedError, totalWeightError, epochError, stakerAddressError, stakeDataError]);

  // Check for partial failures in multicall results
  const { hasPartialFailure, failedCount } = useMemo(() => {
    if (!stakeDataResults) return { hasPartialFailure: false, failedCount: 0 };
    const failed = stakeDataResults.filter(r => r.status === 'failure').length;
    return {
      hasPartialFailure: failed > 0,
      failedCount: failed,
    };
  }, [stakeDataResults]);

  // ========================================
  // Process and build staker list
  // ========================================
  
  const processedStakers = useMemo(() => {
    if (!stakerAddresses || !stakeDataResults || !epochInfo) return [];
    
    const stakers: StakerInfo[] = [];
    const validAddresses = stakerAddresses
      .filter((r) => r.status === "success" && r.result)
      .map((r) => r.result as Address);
    
    for (let i = 0; i < validAddresses.length; i++) {
      const stakeIdx = i * 3;
      const tierIdx = i * 3 + 1;
      const weightIdx = i * 3 + 2;
      
      const stakeResult = stakeDataResults[stakeIdx];
      const tierResult = stakeDataResults[tierIdx];
      const weightResult = stakeDataResults[weightIdx];
      
      if (
        stakeResult?.status === "success" &&
        tierResult?.status === "success" &&
        weightResult?.status === "success"
      ) {
        const stakeData = stakeResult.result as readonly [bigint, bigint, number, bigint, bigint, bigint, bigint, boolean];
        const amount = stakeData[0];
        const tier = tierResult.result as number;
        const weight = weightResult.result as bigint;
        
        // Skip zero stakes
        if (amount === 0n) continue;
        
        // Calculate estimated rewards
        const totalEpochWeight = epochInfo.totalWeight;
        const estimatedMON = totalEpochWeight > 0n 
          ? (epochInfo.monRewards * weight) / totalEpochWeight 
          : 0n;
        const estimatedPRESCIO = totalEpochWeight > 0n
          ? (epochInfo.prescioRewards * weight) / totalEpochWeight
          : 0n;
        
        stakers.push({
          address: validAddresses[i],
          amount,
          tier: tier as TierLevel,
          weight,
          rank: 0, // Will be set after sorting
          estimatedMON,
          estimatedPRESCIO,
        });
      }
    }
    
    // Sort by amount or weight
    stakers.sort((a, b) => {
      const valueA = sortBy === "weight" ? a.weight : a.amount;
      const valueB = sortBy === "weight" ? b.weight : b.amount;
      if (valueB > valueA) return 1;
      if (valueB < valueA) return -1;
      return 0;
    });
    
    // Assign ranks
    stakers.forEach((staker, index) => {
      staker.rank = index + 1;
    });
    
    return stakers;
  }, [stakerAddresses, stakeDataResults, epochInfo, sortBy]);

  // Apply tier filter
  const filteredStakers = useMemo(() => {
    if (tierFilter === null) return processedStakers;
    return processedStakers.filter((s) => s.tier === tierFilter);
  }, [processedStakers, tierFilter]);

  // Paginate
  const paginatedStakers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStakers.slice(start, start + pageSize);
  }, [filteredStakers, page, pageSize]);

  const totalPages = Math.ceil(filteredStakers.length / pageSize);

  const isLoading = isLoadingCount || isLoadingAddresses || isLoadingStakeData;

  const refetch = useCallback(() => {
    // Invalidate all leaderboard-related queries
    queryClient.invalidateQueries({ queryKey: ['readContract'] });
    queryClient.invalidateQueries({ queryKey: ['readContracts'] });
  }, [queryClient]);

  return {
    stakers: paginatedStakers,
    allStakers: processedStakers, // Full unfiltered list for search/Top3
    totalStakers: Number(stakerCount ?? 0),
    totalPages,
    currentPage: page,
    totalStaked: totalStaked ?? 0n,
    totalWeight: totalWeight ?? 0n,
    epochInfo,
    isLoading,
    isFetching,
    error,
    hasPartialFailure,
    failedCount,
    refetch,
  };
}

// ========================================
// Shared hook for MyRank - uses same data structure
// Returns just the sorted staker list for rank lookup
// ========================================
export function useAllStakersData() {
  const { 
    allStakers, 
    totalStakers, 
    epochInfo,
    isLoading, 
    error 
  } = useLeaderboard({ pageSize: 1000 }); // Large page to get all
  
  return { 
    sortedStakers: allStakers, 
    totalStakers, 
    epochInfo,
    isLoading, 
    error 
  };
}
