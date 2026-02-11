import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { type Address } from "viem";
import { useAllStakersData } from "./useLeaderboard";
import {
  STAKING_CONTRACT_ADDRESS,
  TIER_MAP,
  CHAIN_ID,
} from "@/lib/leaderboard/constants";
import { getTierProgress, getFOMOMessage, getPercentile } from "@/lib/leaderboard/utils";
import { MyRankInfo, NextTierProgress, TierLevel } from "@/lib/leaderboard/types";

// Staking ABI (minimal for my rank)
const STAKING_ABI = [
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
] as const;

interface UseMyRankResult {
  myRank: MyRankInfo | null;
  fomoMessage: string | null;
  nextTierProgress: NextTierProgress | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMyRank(address: Address | undefined): UseMyRankResult {
  // Use shared data source to avoid duplicate fetching
  const { 
    sortedStakers, 
    totalStakers, 
    epochInfo, 
    isLoading: isLoadingStakers, 
    error: stakersError 
  } = useAllStakersData();
  
  // Get user's stake data
  const { 
    data: stakeData, 
    isLoading: isLoadingStake,
    error: stakeError,
  } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "stakes",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // Get user's tier from contract (source of truth)
  const { 
    data: contractTier, 
    isLoading: isLoadingTier,
    error: tierError,
  } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getTier",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // Get user's weight
  const { 
    data: weightData, 
    isLoading: isLoadingWeight,
    error: weightError,
  } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getUserWeight",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // Collect errors
  const error = useMemo(() => {
    if (stakersError) return stakersError;
    if (stakeError) return stakeError;
    if (tierError) return tierError;
    if (weightError) return weightError;
    return null;
  }, [stakersError, stakeError, tierError, weightError]);

  // Calculate my rank
  const myRank = useMemo((): MyRankInfo | null => {
    if (!address || !stakeData || !sortedStakers.length) return null;
    
    const amount = stakeData[0];
    if (amount === 0n) return null;
    
    // Find rank in sorted list
    const rankIndex = sortedStakers.findIndex(
      (s) => s.address.toLowerCase() === address.toLowerCase()
    );
    
    if (rankIndex === -1) return null;
    
    const rank = rankIndex + 1;
    // Use contract tier as source of truth
    const tier = (contractTier ?? 0) as TierLevel;
    const weight = weightData ?? 0n;
    const stakersAbove = rank - 1;
    
    // Calculate estimated rewards using shared epoch info
    let estimatedMON = 0n;
    let estimatedPRESCIO = 0n;
    
    if (epochInfo) {
      const totalWeight = epochInfo.totalWeight;
      if (totalWeight > 0n && weight > 0n) {
        estimatedMON = (epochInfo.monRewards * weight) / totalWeight;
        estimatedPRESCIO = (epochInfo.prescioRewards * weight) / totalWeight;
      }
    }
    
    return {
      address,
      rank,
      totalStakers: sortedStakers.length,
      amount,
      tier,
      weight,
      estimatedMON,
      estimatedPRESCIO,
      stakersAbove,
      percentile: getPercentile(rank, sortedStakers.length),
    };
  }, [address, stakeData, contractTier, weightData, epochInfo, sortedStakers]);

  // Generate FOMO message
  const fomoMessage = useMemo(() => {
    if (!myRank) return null;
    return getFOMOMessage(myRank.rank);
  }, [myRank]);

  // Calculate next tier progress
  // Use contract tier as primary source, client calculation as fallback
  const nextTierProgress = useMemo((): NextTierProgress | null => {
    if (!myRank) return null;
    
    // Get tier progress, passing contract tier for validation
    const progress = getTierProgress(myRank.amount, contractTier as TierLevel | undefined);
    
    return {
      currentTier: progress.currentTier,
      nextTier: progress.nextTier,
      amountNeeded: progress.amountNeeded,
      progress: progress.progress,
    };
  }, [myRank, contractTier]);

  const isLoading = isLoadingStakers || isLoadingStake || isLoadingTier || isLoadingWeight;

  return {
    myRank,
    fomoMessage,
    nextTierProgress,
    isLoading,
    error,
  };
}
