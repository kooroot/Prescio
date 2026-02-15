/**
 * Statistics Types for Prescio Game Analytics
 */

/** Valid metrics for leaderboard sorting */
export type LeaderboardMetric = 'wins' | 'kills' | 'survival' | 'kd';

/** Period filter for statistics */
export type StatsPeriod = 'all' | 'daily' | 'weekly';

/** Individual agent statistics */
export interface AgentStats {
  agentName: string;
  gamesPlayed: number;
  gamesAsImpostor: number;
  gamesAsCrew: number;
  wins: {
    total: number;
    asImpostor: number;
    asCrew: number;
  };
  kills: number;
  deaths: number; // Deaths while impostor (eliminated by vote)
  survivalRate: number; // 0-1
  kdRatio: number | null; // null if no deaths
  currentStreak: number;
  bestStreak: number;
  lastPlayed: number; // timestamp
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  rank: number;
  agentName: string;
  value: number;
  gamesPlayed: number;
  lastPlayed: number;
}

/** Leaderboard response */
export interface LeaderboardResponse {
  metric: LeaderboardMetric;
  period: StatsPeriod;
  leaderboard: LeaderboardEntry[];
  totalGames: number;
  generatedAt: number;
}

/** Top performer in a category */
export interface TopPerformer {
  name: string;
  wins?: number;
  kills?: number;
  rate?: number;
}

/** Summary statistics response */
export interface SummaryResponse {
  totalGames: number;
  totalPlayers: number;
  topWinner: TopPerformer | null;
  topKiller: TopPerformer | null;
  mostSurvived: TopPerformer | null;
  impostorWinRate: number;
  avgGameDuration: number | null; // We don't track duration yet, so null
  period: {
    start: number;
    end: number;
  };
  generatedAt: number;
}

/** Recent game info for agent detail */
export interface RecentGame {
  gameId: string;
  role: string;
  result: 'WIN' | 'LOSS';
  kills: number;
  survived: boolean;
  finishedAt: number;
}

/** Agent detail response */
export interface AgentDetailResponse {
  agentName: string;
  stats: AgentStats;
  recentGames: RecentGame[];
}

/** Error response format */
export interface StatsErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/** Valid error codes */
export type StatsErrorCode =
  | 'INVALID_METRIC'
  | 'INVALID_PERIOD'
  | 'INVALID_LIMIT'
  | 'INVALID_AGENT_NAME'
  | 'AGENT_NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_DISABLED'
  | 'SERVICE_UNAVAILABLE';
