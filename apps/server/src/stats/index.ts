/**
 * Statistics Module - Cache and exports
 */
import type { FinishedGameRecord } from "../game/persistence.js";
import {
  generateLeaderboard,
  generateSummary,
  getAgentStats,
  getAgentRecentGames,
} from "./aggregator.js";
import type {
  LeaderboardMetric,
  StatsPeriod,
  LeaderboardResponse,
  SummaryResponse,
  AgentDetailResponse,
} from "./types.js";

// Re-export types
export * from "./types.js";

/** Cache entry with TTL */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/** In-memory cache */
const cache = {
  leaderboard: new Map<string, CacheEntry<LeaderboardResponse>>(),
  summary: null as CacheEntry<SummaryResponse> | null,
  agentDetail: new Map<string, CacheEntry<AgentDetailResponse>>(),
};

/**
 * Generate cache key for leaderboard
 */
function leaderboardCacheKey(metric: LeaderboardMetric, period: StatsPeriod, limit: number): string {
  return `${metric}:${period}:${limit}`;
}

/**
 * Clear all caches - call on game end
 */
export function invalidateStatsCache(): void {
  cache.leaderboard.clear();
  cache.summary = null;
  cache.agentDetail.clear();
}

/**
 * Get leaderboard with caching
 */
export function getCachedLeaderboard(
  games: FinishedGameRecord[],
  metric: LeaderboardMetric,
  period: StatsPeriod,
  limit: number
): LeaderboardResponse {
  const key = leaderboardCacheKey(metric, period, limit);
  const cached = cache.leaderboard.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = generateLeaderboard(games, metric, period, limit);
  cache.leaderboard.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return data;
}

/**
 * Get summary with caching
 */
export function getCachedSummary(games: FinishedGameRecord[]): SummaryResponse {
  if (cache.summary && cache.summary.expiresAt > Date.now()) {
    return cache.summary.data;
  }

  const data = generateSummary(games);
  cache.summary = {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  };

  return data;
}

/**
 * Get agent detail with caching
 */
export function getCachedAgentDetail(
  games: FinishedGameRecord[],
  agentName: string
): AgentDetailResponse | null {
  const cached = cache.agentDetail.get(agentName);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const stats = getAgentStats(games, agentName);
  if (!stats) return null;

  const recentGames = getAgentRecentGames(games, agentName, 10);

  const data: AgentDetailResponse = {
    agentName,
    stats,
    recentGames,
  };

  cache.agentDetail.set(agentName, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return data;
}

/** Valid agent names (from BOT_NAMES in routes.ts) */
export const VALID_AGENT_NAMES = [
  "Agent-Alpha",
  "Agent-Bravo",
  "Agent-Charlie",
  "Agent-Delta",
  "Agent-Echo",
  "Agent-Foxtrot",
  "Agent-Golf",
  "Agent-Hotel",
  "Agent-India",
  "Agent-Juliet",
  "Agent-Kilo",
  "Agent-Lima",
  "Agent-Mike",
  "Agent-November",
  "Agent-Oscar",
  "Agent-Papa",
  "Agent-Quebec",
  "Agent-Romeo",
  "Agent-Sierra",
  "Agent-Tango",
];

/**
 * Validate agent name against whitelist
 */
export function isValidAgentName(name: string): boolean {
  return VALID_AGENT_NAMES.includes(name);
}

/**
 * Validate metric parameter
 */
export function isValidMetric(metric: string): metric is LeaderboardMetric {
  return ['wins', 'kills', 'survival', 'kd'].includes(metric);
}

/**
 * Validate period parameter
 */
export function isValidPeriod(period: string): period is StatsPeriod {
  return ['all', 'daily', 'weekly'].includes(period);
}

/**
 * Parse and validate limit parameter
 */
export function parseLimit(limitParam: unknown, defaultValue = 10, maxValue = 50): number {
  const parsed = Number(limitParam);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(1, Math.min(parsed, maxValue));
}
