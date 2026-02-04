/** Types of bets available */
export enum BetType {
  /** Bet on which team wins (Impostor vs Crew) */
  WINNER = "WINNER",
  /** Bet on who gets eliminated next */
  NEXT_ELIMINATION = "NEXT_ELIMINATION",
  /** Bet on whether a specific player survives the round */
  PLAYER_SURVIVAL = "PLAYER_SURVIVAL",
  /** Bet on the total number of rounds */
  TOTAL_ROUNDS = "TOTAL_ROUNDS",
  /** Bet on who the impostor is */
  IMPOSTOR_IDENTITY = "IMPOSTOR_IDENTITY",
}

/** Status of a bet */
export enum BetStatus {
  OPEN = "OPEN",
  LOCKED = "LOCKED",
  RESOLVED_WIN = "RESOLVED_WIN",
  RESOLVED_LOSS = "RESOLVED_LOSS",
  CANCELLED = "CANCELLED",
  CLAIMED = "CLAIMED",
}

/** Market status */
export enum MarketStatus {
  OPEN = "OPEN",
  LOCKED = "LOCKED",
  RESOLVED = "RESOLVED",
  CANCELLED = "CANCELLED",
}

/** Odds for a specific outcome */
export interface Odds {
  outcomeId: string;
  label: string;
  numerator: number;
  denominator: number;
  impliedProbability: number;
  totalStaked: bigint;
}

/** A betting market for a game event */
export interface Market {
  id: string;
  gameId: string;
  betType: BetType;
  question: string;
  description: string;
  outcomes: Odds[];
  status: MarketStatus;
  totalPool: bigint;
  resolvedOutcomeId: string | null;
  createdAt: number;
  resolvedAt: number | null;
  round: number | null;
  onChainId: bigint | null;
}

/** A user's bet */
export interface Bet {
  id: string;
  marketId: string;
  userId: string;
  userAddress: `0x${string}`;
  outcomeId: string;
  amount: bigint;
  potentialPayout: bigint;
  status: BetStatus;
  txHash: `0x${string}` | null;
  createdAt: number;
  claimedAt: number | null;
}

/** Bet placement request */
export interface PlaceBetRequest {
  marketId: string;
  outcomeId: string;
  amount: string; // String to avoid bigint serialization issues
}

/** User's betting portfolio summary */
export interface BettingPortfolio {
  address: `0x${string}`;
  totalBets: number;
  totalStaked: bigint;
  totalWinnings: bigint;
  totalLosses: bigint;
  activeBets: Bet[];
  history: Bet[];
}
