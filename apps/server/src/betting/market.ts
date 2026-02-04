/**
 * BettingMarketManager — Orchestrates the betting lifecycle
 *
 * - Creates on-chain markets when games start
 * - Closes markets when voting begins
 * - Resolves markets when games end
 * - Caches on-chain data to reduce RPC calls
 */
import { type Address, formatEther } from "viem";
import {
  isOnChainEnabled,
  createMarket as onChainCreateMarket,
  closeMarket as onChainCloseMarket,
  resolveMarket as onChainResolveMarket,
  getMarketInfo as onChainGetMarketInfo,
  getOdds as onChainGetOdds,
  getUserBets as onChainGetUserBets,
  type OnChainMarketInfo,
} from "./onchain.js";

// ============================================
// Types
// ============================================

export interface CachedMarket {
  gameId: string;
  playerCount: number;
  state: "OPEN" | "CLOSED" | "RESOLVED";
  totalPool: bigint;
  outcomeTotals: bigint[];
  odds: bigint[];
  impostorIndex: number | null;
  txHash: string | null;
  createdAt: number;
  lastUpdated: number;
  bettingEnabled: boolean;
}

// ============================================
// In-Memory Cache
// ============================================

const marketCache = new Map<string, CachedMarket>();

/** Cache TTL in ms — how often we re-fetch from chain */
const CACHE_TTL = 10_000; // 10 seconds

// ============================================
// Lifecycle Functions
// ============================================

/**
 * Create a betting market for a game.
 * Called when the game loop starts (NIGHT phase).
 */
export async function handleGameStart(gameId: string, playerCount: number): Promise<boolean> {
  if (!isOnChainEnabled()) {
    console.log(`[BettingMarket] On-chain disabled — skipping market creation for game ${gameId}`);
    return false;
  }

  try {
    const txHash = await onChainCreateMarket(gameId, playerCount);
    if (!txHash) {
      console.error(`[BettingMarket] Failed to create market for game ${gameId}`);
      return false;
    }

    // Initialize cache
    const cached: CachedMarket = {
      gameId,
      playerCount,
      state: "OPEN",
      totalPool: 0n,
      outcomeTotals: new Array(playerCount).fill(0n),
      odds: new Array(playerCount).fill(0n),
      impostorIndex: null,
      txHash,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      bettingEnabled: true,
    };
    marketCache.set(gameId, cached);

    console.log(`[BettingMarket] Market created for game ${gameId} (players: ${playerCount})`);
    return true;
  } catch (err) {
    console.error(`[BettingMarket] handleGameStart error:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Close the betting market (no more bets accepted).
 * Called when transitioning from DISCUSSION to VOTE.
 */
export async function handleBettingClose(gameId: string): Promise<boolean> {
  if (!isOnChainEnabled()) return false;

  const cached = marketCache.get(gameId);
  if (!cached || cached.state !== "OPEN") {
    console.log(`[BettingMarket] No open market to close for game ${gameId}`);
    return false;
  }

  try {
    const txHash = await onChainCloseMarket(gameId);
    if (!txHash) {
      console.error(`[BettingMarket] Failed to close market for game ${gameId}`);
      return false;
    }

    cached.state = "CLOSED";
    cached.lastUpdated = Date.now();
    cached.bettingEnabled = false;

    console.log(`[BettingMarket] Market closed for game ${gameId}`);
    return true;
  } catch (err) {
    console.error(`[BettingMarket] handleBettingClose error:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Resolve the market with the impostor result.
 * Called when the game ends (gameOver event).
 */
export async function handleGameEnd(gameId: string, impostorIndex: number): Promise<boolean> {
  if (!isOnChainEnabled()) return false;

  const cached = marketCache.get(gameId);
  if (!cached) {
    console.log(`[BettingMarket] No market found for game ${gameId}`);
    return false;
  }

  // If market is still OPEN (e.g., game ended before vote), close first
  if (cached.state === "OPEN") {
    await handleBettingClose(gameId);
  }

  if (cached.state !== "CLOSED") {
    console.log(`[BettingMarket] Market not in CLOSED state for game ${gameId}, state: ${cached.state}`);
    return false;
  }

  try {
    const txHash = await onChainResolveMarket(gameId, impostorIndex);
    if (!txHash) {
      console.error(`[BettingMarket] Failed to resolve market for game ${gameId}`);
      return false;
    }

    cached.state = "RESOLVED";
    cached.impostorIndex = impostorIndex;
    cached.lastUpdated = Date.now();

    console.log(`[BettingMarket] Market resolved for game ${gameId} (impostor: ${impostorIndex})`);
    return true;
  } catch (err) {
    console.error(`[BettingMarket] handleGameEnd error:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// ============================================
// Query Functions (with caching)
// ============================================

/**
 * Get cached market info, refreshing from chain if stale.
 */
export async function getMarketInfo(gameId: string): Promise<CachedMarket | null> {
  const cached = marketCache.get(gameId);

  // If cache is fresh enough, return it
  if (cached && (Date.now() - cached.lastUpdated) < CACHE_TTL) {
    return cached;
  }

  // Fetch from chain
  if (!isOnChainEnabled()) return cached ?? null;

  try {
    const onChainInfo = await onChainGetMarketInfo(gameId);
    if (!onChainInfo || onChainInfo.playerCount === 0) return cached ?? null;

    const stateMap = ["OPEN", "CLOSED", "RESOLVED"] as const;

    if (cached) {
      cached.playerCount = onChainInfo.playerCount;
      cached.state = stateMap[onChainInfo.state] ?? "OPEN";
      cached.totalPool = onChainInfo.totalPool;
      cached.outcomeTotals = onChainInfo.outcomeTotals;
      cached.impostorIndex = onChainInfo.state === 2 ? onChainInfo.impostorIndex : null;
      cached.lastUpdated = Date.now();
      return cached;
    }

    // Create new cache entry from chain data
    const newCached: CachedMarket = {
      gameId,
      playerCount: onChainInfo.playerCount,
      state: stateMap[onChainInfo.state] ?? "OPEN",
      totalPool: onChainInfo.totalPool,
      outcomeTotals: onChainInfo.outcomeTotals,
      odds: new Array(onChainInfo.playerCount).fill(0n),
      impostorIndex: onChainInfo.state === 2 ? onChainInfo.impostorIndex : null,
      txHash: null,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      bettingEnabled: onChainInfo.state === 0,
    };
    marketCache.set(gameId, newCached);
    return newCached;
  } catch (err) {
    console.error(`[BettingMarket] getMarketInfo refresh error:`, err instanceof Error ? err.message : err);
    return cached ?? null;
  }
}

/**
 * Get current odds for all outcomes.
 */
export async function getOdds(gameId: string): Promise<bigint[] | null> {
  if (!isOnChainEnabled()) return null;

  try {
    const odds = await onChainGetOdds(gameId);
    if (odds) {
      const cached = marketCache.get(gameId);
      if (cached) {
        cached.odds = odds;
        cached.lastUpdated = Date.now();
      }
    }
    return odds;
  } catch (err) {
    console.error(`[BettingMarket] getOdds error:`, err instanceof Error ? err.message : err);
    // Return cached odds if available
    return marketCache.get(gameId)?.odds ?? null;
  }
}

/**
 * Get a user's bet info.
 */
export async function getUserBets(gameId: string, userAddress: Address) {
  if (!isOnChainEnabled()) return null;
  return onChainGetUserBets(gameId, userAddress);
}

/**
 * Check if betting is currently enabled for a game.
 */
export function isBettingEnabled(gameId: string): boolean {
  if (!isOnChainEnabled()) return false;
  const cached = marketCache.get(gameId);
  return cached?.bettingEnabled ?? false;
}

/**
 * Clean up cache for a game.
 */
export function cleanupMarket(gameId: string): void {
  marketCache.delete(gameId);
}

/**
 * Get all active markets (for monitoring).
 */
export function getActiveMarkets(): CachedMarket[] {
  return Array.from(marketCache.values()).filter((m) => m.state !== "RESOLVED");
}
