/**
 * Vote System — Cast votes, tally, eliminate
 */
import {
  Phase,
  Role,
  type GameState,
  type Vote,
} from "@prescio/common";
import { getGame, updateGame } from "./state.js";

// ============================================
// Errors
// ============================================

export class VoteError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "VoteError";
  }
}

// ============================================
// Start Vote Phase
// ============================================

/**
 * Transition from DISCUSSION to VOTE phase.
 * Clears previous votes.
 */
export function startVote(gameId: string): GameState {
  const game = getGame(gameId);
  if (!game) {
    throw new VoteError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.phase !== Phase.DISCUSSION) {
    throw new VoteError("WRONG_PHASE", "Can only start voting from DISCUSSION phase");
  }

  game.phase = Phase.VOTE;
  game.votes = []; // Clear votes for this round
  updateGame(game);
  return game;
}

// ============================================
// Cast Vote
// ============================================

/**
 * A player casts a vote.
 * targetId = null means "skip" (vote to not eliminate anyone).
 */
export function castVote(
  gameId: string,
  voterId: string,
  targetId: string | null,
): GameState {
  const game = getGame(gameId);
  if (!game) {
    throw new VoteError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.phase !== Phase.VOTE) {
    throw new VoteError("WRONG_PHASE", "Voting is not active");
  }

  // Validate voter
  const voter = game.players.find((p) => p.id === voterId);
  if (!voter) {
    throw new VoteError("PLAYER_NOT_FOUND", "Voter not found");
  }
  if (!voter.isAlive) {
    throw new VoteError("VOTER_DEAD", "Dead players cannot vote");
  }

  // Check for duplicate vote
  const alreadyVoted = game.votes.some((v) => v.voterId === voterId);
  if (alreadyVoted) {
    throw new VoteError("ALREADY_VOTED", "You have already voted this round");
  }

  // Validate target (if not skip)
  if (targetId !== null) {
    const target = game.players.find((p) => p.id === targetId);
    if (!target) {
      throw new VoteError("TARGET_NOT_FOUND", "Vote target not found");
    }
    if (!target.isAlive) {
      throw new VoteError("TARGET_DEAD", "Cannot vote for a dead player");
    }
    if (targetId === voterId) {
      throw new VoteError("SELF_VOTE", "Cannot vote for yourself");
    }
  }

  const vote: Vote = {
    voterId,
    targetId,
    timestamp: Date.now(),
  };

  game.votes.push(vote);
  updateGame(game);
  return game;
}

// ============================================
// Check if all alive players have voted
// ============================================

export function allVotesCast(game: GameState): boolean {
  const aliveCount = game.players.filter((p) => p.isAlive).length;
  return game.votes.length >= aliveCount;
}

// ============================================
// Tally Votes & Eliminate
// ============================================

export interface VoteResult {
  /** targetId → vote count */
  tally: Record<string, number>;
  /** The player eliminated (null if tie or all skipped) */
  eliminatedId: string | null;
  /** True if the vote was skipped (majority skip or tie) */
  skipped: boolean;
  /** The eliminated player's role (for reveal), null if nobody eliminated */
  eliminatedRole: Role | null;
}

/**
 * Tally all votes and determine the result.
 * - Highest vote count wins (player gets eliminated)
 * - Ties result in no elimination (skip)
 * - Skip votes (targetId=null) are counted under "skip"
 */
export function tallyVotes(gameId: string): { game: GameState; result: VoteResult } {
  const game = getGame(gameId);
  if (!game) {
    throw new VoteError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.phase !== Phase.VOTE) {
    throw new VoteError("WRONG_PHASE", "Not in VOTE phase");
  }

  // Count votes per target
  const tally: Record<string, number> = {};
  let skipCount = 0;

  for (const vote of game.votes) {
    if (vote.targetId === null) {
      skipCount++;
    } else {
      tally[vote.targetId] = (tally[vote.targetId] ?? 0) + 1;
    }
  }

  // Find the max vote count
  const voteCounts = Object.values(tally);
  const maxVotes = voteCounts.length > 0 ? Math.max(...voteCounts) : 0;

  // Check for skip majority
  if (skipCount > maxVotes) {
    updateGame(game);
    return {
      game,
      result: { tally, eliminatedId: null, skipped: true, eliminatedRole: null },
    };
  }

  // Check for ties
  const topVoted = Object.entries(tally).filter(([, count]) => count === maxVotes);
  if (topVoted.length !== 1 || maxVotes === 0) {
    // Tie or no votes → no elimination
    updateGame(game);
    return {
      game,
      result: { tally, eliminatedId: null, skipped: true, eliminatedRole: null },
    };
  }

  // Eliminate the player with the most votes
  const [eliminatedId] = topVoted[0];
  const eliminated = game.players.find((p) => p.id === eliminatedId);

  if (eliminated) {
    eliminated.isAlive = false;
    game.alivePlayers = game.alivePlayers.filter((id) => id !== eliminatedId);
    game.eliminatedPlayers.push(eliminatedId);
  }

  updateGame(game);
  return {
    game,
    result: {
      tally,
      eliminatedId,
      skipped: false,
      eliminatedRole: eliminated?.role ?? null,
    },
  };
}
