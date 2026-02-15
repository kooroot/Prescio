/**
 * Statistics Aggregator - Core calculation logic for game statistics
 */
import type { FinishedGameRecord } from "../game/persistence.js";
import type {
  AgentStats,
  LeaderboardEntry,
  LeaderboardMetric,
  LeaderboardResponse,
  StatsPeriod,
  SummaryResponse,
  TopPerformer,
} from "./types.js";

/** Time constants */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/**
 * Filter games by period
 */
function filterByPeriod(games: FinishedGameRecord[], period: StatsPeriod): FinishedGameRecord[] {
  if (period === 'all') return games;

  const now = Date.now();
  const cutoff = period === 'daily' ? now - ONE_DAY_MS : now - ONE_WEEK_MS;

  return games.filter(g => g.finishedAt >= cutoff);
}

/**
 * Build agent stats from game records
 * Returns a map of agentName -> AgentStats
 */
export function buildAgentStatsMap(games: FinishedGameRecord[]): Map<string, AgentStats> {
  const statsMap = new Map<string, AgentStats>();

  // Sort games by finishedAt for streak calculation
  const sortedGames = [...games].sort((a, b) => a.finishedAt - b.finishedAt);

  for (const game of sortedGames) {
    for (const player of game.players) {
      const name = player.nickname;

      // Initialize stats if not exists
      if (!statsMap.has(name)) {
        statsMap.set(name, {
          agentName: name,
          gamesPlayed: 0,
          gamesAsImpostor: 0,
          gamesAsCrew: 0,
          wins: { total: 0, asImpostor: 0, asCrew: 0 },
          kills: 0,
          deaths: 0,
          survivalRate: 0,
          kdRatio: null,
          currentStreak: 0,
          bestStreak: 0,
          lastPlayed: 0,
        });
      }

      const stats = statsMap.get(name)!;
      stats.gamesPlayed++;
      stats.lastPlayed = Math.max(stats.lastPlayed, game.finishedAt);

      const isImpostor = player.role === 'IMPOSTOR';

      // Count games by role
      if (isImpostor) {
        stats.gamesAsImpostor++;
      } else {
        stats.gamesAsCrew++;
      }

      // Determine if player won
      const playerWon = (
        (game.winner === 'IMPOSTOR' && isImpostor) ||
        (game.winner === 'CREW' && !isImpostor)
      );

      if (playerWon) {
        stats.wins.total++;
        if (isImpostor) {
          stats.wins.asImpostor++;
        } else {
          stats.wins.asCrew++;
        }
        // Update streak
        stats.currentStreak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      } else {
        // Reset current streak on loss
        stats.currentStreak = 0;
      }

      // Count kills (from killEvents)
      if (game.killEvents) {
        const playerKills = game.killEvents.filter(ke => ke.killerName === name).length;
        stats.kills += playerKills;
      }

      // Count deaths (impostor eliminated by vote)
      if (isImpostor && player.deathCause === 'eliminated') {
        stats.deaths++;
      }

      // Track survival for survival rate
      if (player.isAlive) {
        // Will be calculated after all games processed
      }
    }
  }

  // Calculate derived stats (survival rate, K/D ratio)
  for (const stats of statsMap.values()) {
    // Calculate survival rate
    let survivedCount = 0;
    for (const game of sortedGames) {
      const player = game.players.find(p => p.nickname === stats.agentName);
      if (player?.isAlive) survivedCount++;
    }
    stats.survivalRate = stats.gamesPlayed > 0
      ? survivedCount / stats.gamesPlayed
      : 0;

    // Calculate K/D ratio
    stats.kdRatio = stats.deaths > 0
      ? stats.kills / stats.deaths
      : (stats.kills > 0 ? null : null); // null if no deaths or no kills
  }

  return statsMap;
}

/**
 * Generate leaderboard from agent stats
 */
export function generateLeaderboard(
  games: FinishedGameRecord[],
  metric: LeaderboardMetric,
  period: StatsPeriod,
  limit: number
): LeaderboardResponse {
  const filteredGames = filterByPeriod(games, period);
  const statsMap = buildAgentStatsMap(filteredGames);

  // Convert to array and sort by metric
  const entries = Array.from(statsMap.values());

  entries.sort((a, b) => {
    switch (metric) {
      case 'wins':
        return b.wins.total - a.wins.total;
      case 'kills':
        return b.kills - a.kills;
      case 'survival':
        return b.survivalRate - a.survivalRate;
      case 'kd':
        // Handle null K/D ratios
        const aKd = a.kdRatio ?? -1;
        const bKd = b.kdRatio ?? -1;
        return bKd - aKd;
      default:
        return b.wins.total - a.wins.total;
    }
  });

  // Build leaderboard
  const leaderboard: LeaderboardEntry[] = entries.slice(0, limit).map((stats, index) => ({
    rank: index + 1,
    agentName: stats.agentName,
    value: getMetricValue(stats, metric),
    gamesPlayed: stats.gamesPlayed,
    lastPlayed: stats.lastPlayed,
  }));

  return {
    metric,
    period,
    leaderboard,
    totalGames: filteredGames.length,
    generatedAt: Date.now(),
  };
}

/**
 * Get metric value from stats
 */
function getMetricValue(stats: AgentStats, metric: LeaderboardMetric): number {
  switch (metric) {
    case 'wins':
      return stats.wins.total;
    case 'kills':
      return stats.kills;
    case 'survival':
      return Math.round(stats.survivalRate * 100); // Return as percentage
    case 'kd':
      return stats.kdRatio !== null ? Math.round(stats.kdRatio * 100) / 100 : 0;
    default:
      return stats.wins.total;
  }
}

/**
 * Generate summary statistics
 */
export function generateSummary(games: FinishedGameRecord[]): SummaryResponse {
  if (games.length === 0) {
    return {
      totalGames: 0,
      totalPlayers: 0,
      topWinner: null,
      topKiller: null,
      mostSurvived: null,
      impostorWinRate: 0,
      avgGameDuration: null,
      period: {
        start: Date.now(),
        end: Date.now(),
      },
      generatedAt: Date.now(),
    };
  }

  const statsMap = buildAgentStatsMap(games);
  const allStats = Array.from(statsMap.values());

  // Find top performers
  let topWinner: TopPerformer | null = null;
  let topKiller: TopPerformer | null = null;
  let mostSurvived: TopPerformer | null = null;

  let maxWins = 0;
  let maxKills = 0;
  let maxSurvivalRate = 0;

  for (const stats of allStats) {
    if (stats.wins.total > maxWins) {
      maxWins = stats.wins.total;
      topWinner = { name: stats.agentName, wins: stats.wins.total };
    }
    if (stats.kills > maxKills) {
      maxKills = stats.kills;
      topKiller = { name: stats.agentName, kills: stats.kills };
    }
    if (stats.survivalRate > maxSurvivalRate && stats.gamesPlayed >= 3) {
      // Require at least 3 games for survival rate
      maxSurvivalRate = stats.survivalRate;
      mostSurvived = { name: stats.agentName, rate: Math.round(stats.survivalRate * 100) / 100 };
    }
  }

  // Calculate impostor win rate
  const impostorWins = games.filter(g => g.winner === 'IMPOSTOR').length;
  const impostorWinRate = games.length > 0 ? impostorWins / games.length : 0;

  // Get period
  const timestamps = games.map(g => g.finishedAt);
  const start = Math.min(...timestamps);
  const end = Math.max(...timestamps);

  return {
    totalGames: games.length,
    totalPlayers: allStats.length,
    topWinner,
    topKiller,
    mostSurvived,
    impostorWinRate: Math.round(impostorWinRate * 100) / 100,
    avgGameDuration: null, // Not tracked yet
    period: { start, end },
    generatedAt: Date.now(),
  };
}

/**
 * Get detailed stats for a specific agent
 */
export function getAgentStats(games: FinishedGameRecord[], agentName: string): AgentStats | null {
  const statsMap = buildAgentStatsMap(games);
  return statsMap.get(agentName) ?? null;
}

/**
 * Get recent games for an agent
 */
export function getAgentRecentGames(
  games: FinishedGameRecord[],
  agentName: string,
  limit: number = 10
) {
  const agentGames = games
    .filter(g => g.players.some(p => p.nickname === agentName))
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, limit);

  return agentGames.map(game => {
    const player = game.players.find(p => p.nickname === agentName)!;
    const isImpostor = player.role === 'IMPOSTOR';
    const won = (
      (game.winner === 'IMPOSTOR' && isImpostor) ||
      (game.winner === 'CREW' && !isImpostor)
    );

    // Count kills in this game
    const kills = game.killEvents?.filter(ke => ke.killerName === agentName).length ?? 0;

    return {
      gameId: game.id,
      role: player.role ?? 'UNKNOWN',
      result: won ? 'WIN' as const : 'LOSS' as const,
      kills,
      survived: player.isAlive,
      finishedAt: game.finishedAt,
    };
  });
}
