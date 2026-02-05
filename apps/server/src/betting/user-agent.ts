/**
 * User Auto-Bet Agent Manager
 * 
 * Manages auto-betting configurations and executes bets for users.
 */

import type {
  AutoBetConfig,
  AutoBetStatus,
  AutoBetStrategyType,
  GameState,
} from "@prescio/common";
import { getStrategyDecision } from "./auto-strategy.js";

/** Simple odds for auto-bet strategy */
interface SimpleOdds {
  isImpostor: number;
  isInnocent: number;
}
// Note: WebSocket events for auto-bet would need to be added to common/types/events.ts
// For MVP, we just log decisions and execute silently

// In-memory storage (can be persisted to file later)
const userConfigs: Map<string, AutoBetConfig> = new Map();
const userStats: Map<string, {
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  profitLoss: bigint;
  currentGameId: string | null;
}> = new Map();

// Track which games users are auto-betting in
const activeGameUsers: Map<string, Set<string>> = new Map(); // gameId -> Set<walletAddress>

/**
 * Configure auto-bet for a user
 */
export function configureAutoBet(
  walletAddress: string,
  strategy: AutoBetStrategyType,
  maxBetPerRound: string,
  enabled: boolean
): AutoBetConfig {
  const normalizedAddress = walletAddress.toLowerCase();
  const now = Date.now();

  const existing = userConfigs.get(normalizedAddress);
  const config: AutoBetConfig = {
    odometer: normalizedAddress,
    strategy,
    maxBetPerRound,
    enabled,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  userConfigs.set(normalizedAddress, config);

  // Initialize stats if not exists
  if (!userStats.has(normalizedAddress)) {
    userStats.set(normalizedAddress, {
      totalBets: 0,
      totalWins: 0,
      totalLosses: 0,
      profitLoss: 0n,
      currentGameId: null,
    });
  }

  console.log(`[AutoBet] Configured for ${normalizedAddress}: ${strategy}, max=${maxBetPerRound}, enabled=${enabled}`);

  return config;
}

/**
 * Get auto-bet status for a user
 */
export function getAutoBetStatus(walletAddress: string): AutoBetStatus {
  const normalizedAddress = walletAddress.toLowerCase();
  const config = userConfigs.get(normalizedAddress) || null;
  const stats = userStats.get(normalizedAddress);

  return {
    config,
    currentGameId: stats?.currentGameId || null,
    totalBets: stats?.totalBets || 0,
    totalWins: stats?.totalWins || 0,
    totalLosses: stats?.totalLosses || 0,
    profitLoss: stats?.profitLoss?.toString() || "0",
  };
}

/**
 * Disable auto-bet for a user
 */
export function disableAutoBet(walletAddress: string): void {
  const normalizedAddress = walletAddress.toLowerCase();
  const config = userConfigs.get(normalizedAddress);
  if (config) {
    config.enabled = false;
    config.updatedAt = Date.now();
    userConfigs.set(normalizedAddress, config);
  }
}

/**
 * Join a game for auto-betting
 */
export function joinGameAutoBet(walletAddress: string, gameId: string): boolean {
  const normalizedAddress = walletAddress.toLowerCase();
  const config = userConfigs.get(normalizedAddress);

  if (!config || !config.enabled) {
    return false;
  }

  // Add to active game users
  let gameUsers = activeGameUsers.get(gameId);
  if (!gameUsers) {
    gameUsers = new Set();
    activeGameUsers.set(gameId, gameUsers);
  }
  gameUsers.add(normalizedAddress);

  // Update stats
  const stats = userStats.get(normalizedAddress);
  if (stats) {
    stats.currentGameId = gameId;
  }

  console.log(`[AutoBet] ${normalizedAddress} joined game ${gameId}`);
  return true;
}

/**
 * Leave a game
 */
export function leaveGameAutoBet(walletAddress: string, gameId: string): void {
  const normalizedAddress = walletAddress.toLowerCase();
  const gameUsers = activeGameUsers.get(gameId);
  if (gameUsers) {
    gameUsers.delete(normalizedAddress);
    if (gameUsers.size === 0) {
      activeGameUsers.delete(gameId);
    }
  }

  const stats = userStats.get(normalizedAddress);
  if (stats && stats.currentGameId === gameId) {
    stats.currentGameId = null;
  }
}

/**
 * Process auto-bets for a game phase change
 * Called when game enters DISCUSSION or VOTING phase
 */
export async function processAutoBets(
  gameId: string,
  gameState: GameState,
  odds: Record<string, SimpleOdds>,
  placeBetCallback: (walletAddress: string, targetPlayer: string, amount: string) => Promise<{ success: boolean; txHash?: string; error?: string }>
): Promise<void> {
  const gameUsers = activeGameUsers.get(gameId);
  if (!gameUsers || gameUsers.size === 0) {
    return;
  }

  console.log(`[AutoBet] Processing ${gameUsers.size} auto-bettors for game ${gameId}`);

  for (const walletAddress of gameUsers) {
    const config = userConfigs.get(walletAddress);
    if (!config || !config.enabled) {
      continue;
    }

    try {
      // Get decision from strategy
      const decision = getStrategyDecision(config.strategy, {
        gameState,
        odds,
        maxBet: BigInt(config.maxBetPerRound),
        walletBalance: BigInt(config.maxBetPerRound) * 10n, // TODO: fetch real balance
      });

      if (!decision.shouldBet || !decision.targetPlayer) {
        console.log(`[AutoBet] ${walletAddress} skipping: ${decision.reasoning}`);
        continue;
      }

      console.log(`[AutoBet] ${walletAddress} betting ${decision.betAmount} on ${decision.targetPlayer}`);

      // Execute bet
      const result = await placeBetCallback(
        walletAddress,
        decision.targetPlayer,
        decision.betAmount
      );

      // Update stats
      const stats = userStats.get(walletAddress);
      if (stats && result.success) {
        stats.totalBets++;
      }

      console.log(`[AutoBet] ${walletAddress} executed: ${result.success ? "success" : "failed"}`);
    } catch (error) {
      console.error(`[AutoBet] Error processing ${walletAddress}:`, error);
    }
  }
}

/**
 * Record bet result (win/loss)
 */
export function recordBetResult(
  walletAddress: string,
  won: boolean,
  profitLoss: bigint
): void {
  const normalizedAddress = walletAddress.toLowerCase();
  const stats = userStats.get(normalizedAddress);
  if (!stats) return;

  if (won) {
    stats.totalWins++;
  } else {
    stats.totalLosses++;
  }
  stats.profitLoss += profitLoss;
}

/**
 * Get all active auto-bettors for a game
 */
export function getGameAutoBettors(gameId: string): string[] {
  const gameUsers = activeGameUsers.get(gameId);
  return gameUsers ? Array.from(gameUsers) : [];
}

/**
 * Clean up when game ends
 */
export function cleanupGame(gameId: string): void {
  const gameUsers = activeGameUsers.get(gameId);
  if (gameUsers) {
    for (const walletAddress of gameUsers) {
      const stats = userStats.get(walletAddress);
      if (stats && stats.currentGameId === gameId) {
        stats.currentGameId = null;
      }
    }
    activeGameUsers.delete(gameId);
  }
}
