// Leaderboard types

export enum TierLevel {
  NONE = 0,
  BRONZE = 1,
  SILVER = 2,
  GOLD = 3,
  DIAMOND = 4,
}

export interface TierInfo {
  level: TierLevel;
  name: string;
  minStake: bigint;
  bettingBoost: number;
  rewardMultiplier: number;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  icon: string;
}

export interface StakerInfo {
  address: `0x${string}`;
  amount: bigint;
  tier: TierLevel;
  weight: bigint;
  rank: number;
  estimatedMON: bigint;
  estimatedPRESCIO: bigint;
}

export interface LeaderboardData {
  stakers: StakerInfo[];
  totalStakers: number;
  totalStaked: bigint;
  totalWeight: bigint;
  lastUpdated: Date;
}

export interface EpochInfo {
  epochNumber: bigint;
  monRewards: bigint;
  prescioRewards: bigint;
  totalWeight: bigint;
  startTime: bigint;
  endTime: bigint;
  finalized: boolean;
}

export interface MyRankInfo {
  address: `0x${string}`;
  rank: number;
  totalStakers: number;
  amount: bigint;
  tier: TierLevel;
  weight: bigint;
  estimatedMON: bigint;
  estimatedPRESCIO: bigint;
  stakersAbove: number;
  percentile: number;
}

export interface NextTierProgress {
  currentTier: TierInfo | null;
  nextTier: TierInfo | null;
  amountNeeded: bigint;
  progress: number; // 0-100
}
