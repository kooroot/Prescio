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
  const oddsPayload = formatted.map((o, i) => ({
    outcomeId: `player_${o.playerIndex}`,
    label: `Player ${o.playerIndex}`,
    numerator: Math.round(o.decimal * 100),
    denominator: 100,
    impliedProbability: o.impliedProbability,
    totalStaked: market.outcomeTotals?.[i] ?? 0n,
  }));

  // Serialize with BigInt→string replacer to avoid JSON.stringify crash
  const eventData = {
    gameId,
    marketId: gameId,
    odds: oddsPayload,
    totalPool: formatEther(market.totalPool),
    recentBets: [],
  };

  broadcastToGame(
    gameId,
    createServerEvent("BETTING_UPDATE", JSON.parse(
      JSON.stringify(eventData, (_k, v) => typeof v === "bigint" ? v.toString() : v),
    )),
  );
}

// ============================================
// Odds Calculation
// ============================================

/**
 * Format pool totals into human-readable odds.
 * Note: The contract's getOdds() returns pool totals per outcome, not actual odds.
 * We calculate odds from these totals using parimutuel formula.
 */
export function formatOdds(
  poolTotals: bigint[],    // Pool amount per outcome (from contract getOdds)
  _outcomeTotals: bigint[], // Same as poolTotals (kept for compatibility)
  totalPool: bigint,
  feeRate: number = 500,   // 5% fee (500/10000)
): FormattedOdds[] {
  const distributable = totalPool - (totalPool * BigInt(feeRate)) / 10000n;

  return poolTotals.map((staked, index) => {
    let decimal = 0;
    let impliedProbability = 0;

    if (staked > 0n && totalPool > 0n) {
      // Decimal odds = payout ratio = distributable / staked
      decimal = Number(distributable * 10000n / staked) / 10000;
      // Implied probability = staked / totalPool
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
