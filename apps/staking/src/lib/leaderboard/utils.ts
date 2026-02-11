import { formatEther } from "viem";
import { TierLevel } from "./types";
import { TIERS, getNextTier } from "./constants";

// Format bigint to full number string with commas (no abbreviation)
export function formatFullNumber(value: bigint): string {
  const num = Math.floor(parseFloat(formatEther(value)));
  return num.toLocaleString();
}

// Mask wallet address for display
export function maskAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format MON rewards (up to 4 decimal places)
export function formatMONReward(value: bigint): string {
  const num = parseFloat(formatEther(value));
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(4);
}

// Calculate estimated rewards
export function calculateEstimatedRewards(
  userWeight: bigint,
  totalWeight: bigint,
  epochMonRewards: bigint,
  epochPrescioRewards: bigint
): { monRewards: bigint; prescioRewards: bigint } {
  if (totalWeight === 0n || userWeight === 0n) {
    return { monRewards: 0n, prescioRewards: 0n };
  }
  
  return {
    monRewards: (epochMonRewards * userWeight) / totalWeight,
    prescioRewards: (epochPrescioRewards * userWeight) / totalWeight,
  };
}

// Generate FOMO message based on rank
export function getFOMOMessage(rank: number): string {
  if (rank === 1) {
    return "🏆 You're #1!";
  }
  const stakersAbove = rank - 1;
  return `📊 ${stakersAbove.toLocaleString()} stakers ahead of you`;
}

// Generate tier progress message
export function getTierProgressMessage(currentAmount: bigint): string | null {
  const nextTier = getNextTier(currentAmount);
  
  if (!nextTier) {
    return "🎉 Max tier reached!";
  }
  
  const amountNeeded = nextTier.minStake - currentAmount;
  return `💎 ${formatFullNumber(amountNeeded)} PRESCIO to ${nextTier.name}`;
}

import { TIER_MAP } from "./constants";

// Calculate tier progress percentage
// contractTier: Use contract's getTier() result as source of truth when available
export function getTierProgress(
  currentAmount: bigint,
  contractTier?: TierLevel
): {
  currentTier: typeof TIERS[number] | null;
  nextTier: typeof TIERS[number] | null;
  progress: number;
  amountNeeded: bigint;
} {
  let currentTier: typeof TIERS[number] | null = null;
  let nextTier: typeof TIERS[number] | null = null;
  
  // Use contract tier as source of truth if provided
  if (contractTier !== undefined && contractTier !== TierLevel.NONE) {
    currentTier = TIER_MAP[contractTier];
    // Find next tier
    const currentIdx = TIERS.findIndex(t => t.level === contractTier);
    nextTier = currentIdx >= 0 && currentIdx < TIERS.length - 1 
      ? TIERS[currentIdx + 1] 
      : null;
  } else {
    // Fallback to client calculation
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (currentAmount >= TIERS[i].minStake) {
        currentTier = TIERS[i];
        nextTier = i < TIERS.length - 1 ? TIERS[i + 1] : null;
        break;
      }
    }
    
    if (!currentTier) {
      nextTier = TIERS[0];
    }
  }
  
  if (!nextTier) {
    return { currentTier, nextTier: null, progress: 100, amountNeeded: 0n };
  }
  
  const amountNeeded = nextTier.minStake - currentAmount;
  const progress = Number((currentAmount * 100n) / nextTier.minStake);
  
  return { currentTier, nextTier, progress: Math.min(progress, 100), amountNeeded };
}

// Sort stakers by amount (descending)
export function sortStakersByAmount<T extends { amount: bigint }>(stakers: T[]): T[] {
  return [...stakers].sort((a, b) => {
    if (b.amount > a.amount) return 1;
    if (b.amount < a.amount) return -1;
    return 0;
  });
}

// Get percentile rank
export function getPercentile(rank: number, total: number): number {
  if (total === 0) return 0;
  return Math.round(((total - rank + 1) / total) * 100);
}
