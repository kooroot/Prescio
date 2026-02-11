import { parseEther } from "viem";
import { TierInfo, TierLevel } from "./types";
import { MONAD_MAINNET_CHAIN_ID } from "@/lib/wagmi";

// Chain ID constant with literal type for wagmi compatibility
export const CHAIN_ID = MONAD_MAINNET_CHAIN_ID as 143;
export type MonadChainId = typeof CHAIN_ID;

// Epoch duration constant
export const EPOCH_DURATION_SECONDS = 7n * 24n * 60n * 60n; // 7 days in seconds

// Max epochs for claiming
export const MAX_CLAIM_EPOCHS = 52n;

// Top ranker count
export const TOP_RANKER_COUNT = 3;

// Tier configurations matching contract
export const TIERS: TierInfo[] = [
  {
    level: TierLevel.BRONZE,
    name: "Bronze",
    minStake: parseEther("5000000"),
    bettingBoost: 1.1,
    rewardMultiplier: 1.0,
    colorClass: "text-amber-600",
    bgClass: "bg-gradient-to-r from-amber-600/10 to-transparent",
    borderClass: "border-amber-600/30",
    badgeClass: "bg-amber-600/20 text-amber-500",
    icon: "🥉",
  },
  {
    level: TierLevel.SILVER,
    name: "Silver",
    minStake: parseEther("20000000"),
    bettingBoost: 1.25,
    rewardMultiplier: 1.25,
    colorClass: "text-gray-400",
    bgClass: "bg-gradient-to-r from-gray-400/10 to-transparent",
    borderClass: "border-gray-400/30",
    badgeClass: "bg-gray-400/20 text-gray-300",
    icon: "🥈",
  },
  {
    level: TierLevel.GOLD,
    name: "Gold",
    minStake: parseEther("50000000"),
    bettingBoost: 1.5,
    rewardMultiplier: 1.5,
    colorClass: "text-yellow-400",
    bgClass: "bg-gradient-to-r from-yellow-400/10 to-transparent",
    borderClass: "border-yellow-400/30",
    badgeClass: "bg-yellow-400/20 text-yellow-400",
    icon: "🥇",
  },
  {
    level: TierLevel.DIAMOND,
    name: "Diamond",
    minStake: parseEther("150000000"),
    bettingBoost: 2.0,
    rewardMultiplier: 2.0,
    colorClass: "text-cyan-400",
    bgClass: "bg-gradient-to-r from-cyan-400/10 to-transparent",
    borderClass: "border-cyan-400/30",
    badgeClass: "bg-cyan-400/20 text-cyan-400",
    icon: "💎",
  },
];

// Tier enum to info mapping
export const TIER_MAP: Record<TierLevel, TierInfo | null> = {
  [TierLevel.NONE]: null,
  [TierLevel.BRONZE]: TIERS[0],
  [TierLevel.SILVER]: TIERS[1],
  [TierLevel.GOLD]: TIERS[2],
  [TierLevel.DIAMOND]: TIERS[3],
};

// Get tier info from amount
export function getTierFromAmount(amount: bigint): TierInfo | null {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (amount >= TIERS[i].minStake) {
      return TIERS[i];
    }
  }
  return null;
}

// Get next tier from current amount
export function getNextTier(amount: bigint): TierInfo | null {
  for (const tier of TIERS) {
    if (amount < tier.minStake) {
      return tier;
    }
  }
  return null;
}

// Contract addresses
export const STAKING_CONTRACT_ADDRESS = "0xa0742ffb1762FF3EA001793aCBA202f82244D983" as const;
export const PRESCIO_TOKEN_ADDRESS = "0xffC86Ab0C36B0728BbF52164f6319762DA867777" as const;

// Leaderboard pagination defaults
export const DEFAULT_PAGE_SIZE = 50;
export const LEADERBOARD_REFRESH_INTERVAL = 30000; // 30 seconds

// Top ranker positions
export const TOP_RANKER_POSITIONS = [
  { rank: 1, icon: "🥇", colorClass: "text-yellow-400", bgClass: "bg-yellow-400/10", borderClass: "border-yellow-400/30" },
  { rank: 2, icon: "🥈", colorClass: "text-gray-300", bgClass: "bg-gray-400/10", borderClass: "border-gray-400/30" },
  { rank: 3, icon: "🥉", colorClass: "text-amber-600", bgClass: "bg-amber-600/10", borderClass: "border-amber-600/30" },
];
