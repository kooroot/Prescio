/**
 * Odds Calculator — Real-time odds computation and broadcast
 *
 * Reads on-chain data and pushes odds updates to spectators via WebSocket.
 */
import { formatEther } from "viem";
import { createServerEvent } from "@prescio/common";
import { getOdds as getMarketOdds, getMarketInfo } from "./market.js";
import { isOnChainEnabled } from "./onchain.js";
import { broadcastToGame } from "../ws/broadcast.js";

// ============================================
// Types
// ============================================

export interface FormattedOdds {
  playerIndex: number;
  /** Decimal odds (e.g., 2.5 means 2.5x payout) */
  decimal: number;
  /** Implied probability (0-1) */
  impliedProbability: number;
  /** Total staked on this outcome in MON */
  totalStaked: string;
}

// ============================================
// Odds Polling
// ============================================

/** Active polling intervals by gameId */
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

/** Default polling interval in ms */
const POLL_INTERVAL = 5_000; // 5 seconds

/**
 * Start polling odds for a game and broadcasting updates.
 */
export function startOddsPolling(gameId: string): void {
  if (!isOnChainEnabled()) return;
  if (pollingIntervals.has(gameId)) return;

  console.log(`[Odds] Starting odds polling for game ${gameId}`);

  const interval = setInterval(async () => {
    try {
      await fetchAndBroadcastOdds(gameId);
    } catch (err) {
      console.error(`[Odds] Polling error for game ${gameId}:`, err instanceof Error ? err.message : err);
    }
  }, POLL_INTERVAL);

  pollingIntervals.set(gameId, interval);

  // Immediately fetch once
  fetchAndBroadcastOdds(gameId).catch((err) => {
    console.error(`[Odds] Initial fetch error for game ${gameId}:`, err instanceof Error ? err.message : err);
  });
}

/**
 * Stop polling odds for a game.
 */
export function stopOddsPolling(gameId: string): void {
  const interval = pollingIntervals.get(gameId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(gameId);
    console.log(`[Odds] Stopped odds polling for game ${gameId}`);
  }
}

/**
 * Fetch odds from chain and broadcast to all clients in the game.
 */
async function fetchAndBroadcastOdds(gameId: string): Promise<void> {
  const market = await getMarketInfo(gameId);
  if (!market || market.state === "RESOLVED") {
    stopOddsPolling(gameId);
    return;
  }

  const odds = await getMarketOdds(gameId);
  if (!odds) return;

  const formatted = formatOdds(odds, market.outcomeTotals, market.totalPool);

  // Build BETTING_UPDATE event
  const oddsPayload = formatted.map((o) => ({
    outcomeId: `player_${o.playerIndex}`,
    label: `Player ${o.playerIndex}`,
    numerator: Math.round(o.decimal * 100),
    denominator: 100,
    impliedProbability: o.impliedProbability,
    totalStaked: BigInt(0), // We use string representation in the event
  }));

  broadcastToGame(
    gameId,
    createServerEvent("BETTING_UPDATE", {
      gameId,
      marketId: gameId,
      odds: oddsPayload,
      totalPool: formatEther(market.totalPool),
      recentBets: [], // Could be populated from event logs
    }),
  );
}

// ============================================
// Odds Calculation
// ============================================

/**
 * Format raw on-chain odds (x10000) into human-readable form.
 */
export function formatOdds(
  rawOdds: bigint[],
  outcomeTotals: bigint[],
  totalPool: bigint,
): FormattedOdds[] {
  return rawOdds.map((rawOdd, index) => {
    const decimal = Number(rawOdd) / 10000;
    const staked = outcomeTotals[index] ?? 0n;

    // Implied probability: 1 / decimal odds
    const impliedProbability = decimal > 0 ? 1 / decimal : 0;

    return {
      playerIndex: index,
      decimal,
      impliedProbability,
      totalStaked: formatEther(staked),
    };
  });
}

/**
 * Calculate odds locally from cached data (without chain call).
 * Useful for quick estimates between polling intervals.
 */
export function calculateLocalOdds(
  outcomeTotals: bigint[],
  totalPool: bigint,
  feeRate: number = 200, // 2% default
): FormattedOdds[] {
  const distributable = totalPool - (totalPool * BigInt(feeRate)) / 10000n;

  return outcomeTotals.map((staked, index) => {
    let decimal = 0;
    let impliedProbability = 0;

    if (staked > 0n && totalPool > 0n) {
      decimal = Number(distributable * 10000n / staked) / 10000;
      impliedProbability = Number(staked) / Number(totalPool);
    }

    return {
      playerIndex: index,
      decimal,
      impliedProbability,
      totalStaked: formatEther(staked),
    };
  });
}

// ============================================
// Cleanup
// ============================================

/**
 * Stop all polling. Called on server shutdown.
 */
export function stopAllPolling(): void {
  for (const [gameId, interval] of pollingIntervals) {
    clearInterval(interval);
    console.log(`[Odds] Stopped polling for game ${gameId}`);
  }
  pollingIntervals.clear();
}
