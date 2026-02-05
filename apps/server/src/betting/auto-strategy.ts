/**
 * Auto-Bet Strategy Logic
 * 
 * Analyzes game state and makes betting decisions based on strategy type.
 */

import type {
  AutoBetStrategyType,
  StrategyDecision,
  GameState,
  Player,
} from "@prescio/common";
import { Phase } from "@prescio/common";

/** Simple odds for auto-bet strategy */
interface SimpleOdds {
  isImpostor: number;
  isInnocent: number;
}

interface StrategyContext {
  gameState: GameState;
  odds: Record<string, SimpleOdds>;
  maxBet: bigint;
  walletBalance: bigint;
}

/**
 * Get betting decision based on strategy
 */
export function getStrategyDecision(
  strategy: AutoBetStrategyType,
  context: StrategyContext
): StrategyDecision {
  const { gameState, odds, maxBet, walletBalance } = context;

  // Only bet during discussion/voting phases
  if (gameState.phase !== Phase.DISCUSSION && gameState.phase !== Phase.VOTE) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0,
      reasoning: "Not in betting phase",
    };
  }

  const alivePlayers = gameState.players.filter((p) => p.isAlive);
  if (alivePlayers.length === 0) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0,
      reasoning: "No alive players",
    };
  }

  switch (strategy) {
    case "conservative":
      return conservativeStrategy(context, alivePlayers);
    case "balanced":
      return balancedStrategy(context, alivePlayers);
    case "aggressive":
      return aggressiveStrategy(context, alivePlayers);
    default:
      return {
        shouldBet: false,
        targetPlayer: null,
        betAmount: "0",
        confidence: 0,
        reasoning: "Unknown strategy",
      };
  }
}

/**
 * Conservative: Follow majority, small bets
 */
function conservativeStrategy(
  context: StrategyContext,
  alivePlayers: Player[]
): StrategyDecision {
  const { odds, maxBet, walletBalance } = context;

  // Find player with lowest odds (most likely impostor according to crowd)
  let bestTarget: Player | null = null;
  let lowestOdds = Infinity;

  for (const player of alivePlayers) {
    const playerOdds = odds[player.address];
    if (playerOdds && playerOdds.isImpostor < lowestOdds) {
      lowestOdds = playerOdds.isImpostor;
      bestTarget = player;
    }
  }

  if (!bestTarget || lowestOdds === Infinity) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0,
      reasoning: "No clear favorite",
    };
  }

  // Conservative: bet 10% of max, only if odds are favorable (< 3.0)
  if (lowestOdds > 3.0) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0.3,
      reasoning: "Odds too risky for conservative strategy",
    };
  }

  const betAmount = minBigInt(maxBet / 10n, walletBalance / 20n);
  if (betAmount === 0n) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0.5,
      reasoning: "Insufficient balance",
    };
  }

  const confidence = Math.max(0, Math.min(1, 1 - lowestOdds / 5));

  return {
    shouldBet: true,
    targetPlayer: bestTarget.address,
    betAmount: betAmount.toString(),
    confidence,
    reasoning: `Following crowd favorite ${bestTarget.nickname} (odds: ${lowestOdds.toFixed(2)})`,
  };
}

/**
 * Balanced: Analyze patterns, medium bets
 */
function balancedStrategy(
  context: StrategyContext,
  alivePlayers: Player[]
): StrategyDecision {
  const { gameState, odds, maxBet, walletBalance } = context;

  // Analyze voting patterns and suspicion levels
  const suspicionScores: Map<string, number> = new Map();

  for (const player of alivePlayers) {
    let score = 0;
    const playerOdds = odds[player.address];

    // Factor 1: Current odds
    if (playerOdds) {
      score += (1 / playerOdds.isImpostor) * 30;
    }

    // Factor 2: Vote history - who's been voted against?
    const votesAgainst = gameState.votes?.filter((v) => v.targetId === player.address).length || 0;
    score += votesAgainst * 15;

    // Factor 3: Chat activity (suspicious if too quiet or too defensive)
    const messages = gameState.chatMessages?.filter((m) => m.playerId === player.address).length || 0;
    if (messages === 0) score += 10; // Silent is suspicious
    if (messages > 5) score += 5; // Too defensive

    suspicionScores.set(player.address, score);
  }

  // Find most suspicious
  let bestTarget: Player | null = null;
  let highestScore = 0;

  for (const player of alivePlayers) {
    const score = suspicionScores.get(player.address) || 0;
    if (score > highestScore) {
      highestScore = score;
      bestTarget = player;
    }
  }

  if (!bestTarget || highestScore < 20) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0.3,
      reasoning: "No clear suspect identified",
    };
  }

  // Balanced: bet 30% of max
  const betAmount = minBigInt(maxBet * 3n / 10n, walletBalance / 10n);
  if (betAmount === 0n) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0.5,
      reasoning: "Insufficient balance",
    };
  }

  const confidence = Math.min(1, highestScore / 100);

  return {
    shouldBet: true,
    targetPlayer: bestTarget.address,
    betAmount: betAmount.toString(),
    confidence,
    reasoning: `Pattern analysis suggests ${bestTarget.nickname} (score: ${highestScore})`,
  };
}

/**
 * Aggressive: Contrarian high-odds bets
 */
function aggressiveStrategy(
  context: StrategyContext,
  alivePlayers: Player[]
): StrategyDecision {
  const { odds, maxBet, walletBalance } = context;

  // Find underdog - player with highest odds (least suspected)
  let bestTarget: Player | null = null;
  let highestOdds = 0;

  for (const player of alivePlayers) {
    const playerOdds = odds[player.address];
    if (playerOdds && playerOdds.isImpostor > highestOdds) {
      highestOdds = playerOdds.isImpostor;
      bestTarget = player;
    }
  }

  if (!bestTarget || highestOdds < 2.0) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0.3,
      reasoning: "No high-odds target available",
    };
  }

  // Aggressive: bet 70% of max on high odds
  const betAmount = minBigInt(maxBet * 7n / 10n, walletBalance / 5n);
  if (betAmount === 0n) {
    return {
      shouldBet: false,
      targetPlayer: null,
      betAmount: "0",
      confidence: 0.5,
      reasoning: "Insufficient balance",
    };
  }

  // Higher odds = higher confidence for aggressive
  const confidence = Math.min(1, highestOdds / 10);

  return {
    shouldBet: true,
    targetPlayer: bestTarget.address,
    betAmount: betAmount.toString(),
    confidence,
    reasoning: `Contrarian bet on ${bestTarget.nickname} (odds: ${highestOdds.toFixed(2)}x)`,
  };
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
