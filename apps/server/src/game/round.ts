/**
 * Round Logic — Night kills, body reports, death processing
 */
import {
  Phase,
  Role,
  checkWinCondition,
  type GameState,
  type KillEvent,
} from "@prescio/common";
import { getGame, updateGame } from "./state.js";

// ============================================
// Errors
// ============================================

export class RoundError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoundError";
  }
}

// ============================================
// Night Phase — Kill Execution
// ============================================

/**
 * Execute a kill during the night phase.
 * Returns the kill event if successful.
 */
export function executeKill(
  gameId: string,
  killerId: string,
  targetId: string,
): { game: GameState; killEvent: KillEvent } {
  const game = getGame(gameId);
  if (!game) {
    throw new RoundError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.phase !== Phase.NIGHT) {
    throw new RoundError("WRONG_PHASE", "Kills can only happen during NIGHT phase");
  }

  // Validate killer
  const killer = game.players.find((p) => p.id === killerId);
  if (!killer) {
    throw new RoundError("PLAYER_NOT_FOUND", "Killer not found in game");
  }
  if (!killer.isAlive) {
    throw new RoundError("KILLER_DEAD", "Dead players cannot kill");
  }
  if (killer.role !== Role.IMPOSTOR) {
    throw new RoundError("NOT_IMPOSTOR", "Only impostors can kill");
  }

  // Check if this impostor already killed this round
  const alreadyKilled = game.killEvents.some(
    (ke) => ke.killerId === killerId && ke.round === game.round,
  );
  if (alreadyKilled) {
    throw new RoundError("ALREADY_KILLED", "You already killed someone this round");
  }

  // Validate target
  const target = game.players.find((p) => p.id === targetId);
  if (!target) {
    throw new RoundError("TARGET_NOT_FOUND", "Target not found in game");
  }
  if (!target.isAlive) {
    throw new RoundError("TARGET_DEAD", "Target is already dead");
  }
  if (target.role === Role.IMPOSTOR) {
    throw new RoundError("CANNOT_KILL_IMPOSTOR", "Impostors cannot kill other impostors");
  }

  // Execute the kill
  const killEvent: KillEvent = {
    killerId,
    targetId,
    round: game.round,
    timestamp: Date.now(),
  };

  target.isAlive = false;
  game.alivePlayers = game.alivePlayers.filter((id) => id !== targetId);
  game.eliminatedPlayers.push(targetId);
  game.killEvents.push(killEvent);

  updateGame(game);
  return { game, killEvent };
}

// ============================================
// Auto Night — Let all impostors pick targets
// ============================================

/**
 * For bot-driven games: automatically execute the night phase.
 * Each living impostor kills a random living crew member.
 * Returns all kill events from this night.
 */
export function executeNightAuto(gameId: string): {
  game: GameState;
  kills: KillEvent[];
} {
  const game = getGame(gameId);
  if (!game) {
    throw new RoundError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.phase !== Phase.NIGHT) {
    throw new RoundError("WRONG_PHASE", "Not in NIGHT phase");
  }

  const aliveImpostors = game.players.filter(
    (p) => p.isAlive && p.role === Role.IMPOSTOR,
  );
  const aliveCrew = game.players.filter(
    (p) => p.isAlive && p.role === Role.CREW,
  );

  const kills: KillEvent[] = [];
  const killedThisNight = new Set<string>();

  for (const impostor of aliveImpostors) {
    // Filter out already-killed targets this night
    const availableTargets = aliveCrew.filter(
      (c) => !killedThisNight.has(c.id),
    );
    if (availableTargets.length === 0) break;

    // Random target selection
    const target =
      availableTargets[Math.floor(Math.random() * availableTargets.length)];

    const killEvent: KillEvent = {
      killerId: impostor.id,
      targetId: target.id,
      round: game.round,
      timestamp: Date.now(),
    };

    target.isAlive = false;
    game.alivePlayers = game.alivePlayers.filter((id) => id !== target.id);
    game.eliminatedPlayers.push(target.id);
    game.killEvents.push(killEvent);
    killedThisNight.add(target.id);
    kills.push(killEvent);
  }

  updateGame(game);
  return { game, kills };
}

// ============================================
// Report Body — Transition to DISCUSSION
// ============================================

/**
 * Report a dead body. Transitions from NIGHT/REPORT to DISCUSSION.
 */
export function reportBody(
  gameId: string,
  reporterId: string,
  bodyId: string,
): GameState {
  const game = getGame(gameId);
  if (!game) {
    throw new RoundError("GAME_NOT_FOUND", "Game not found");
  }

  // Can only report after night (REPORT is the brief "body found" display phase)
  if (game.phase !== Phase.NIGHT && game.phase !== Phase.REPORT) {
    throw new RoundError("WRONG_PHASE", "Cannot report body in current phase");
  }

  const reporter = game.players.find((p) => p.id === reporterId);
  if (!reporter || !reporter.isAlive) {
    throw new RoundError("INVALID_REPORTER", "Reporter must be alive");
  }

  const body = game.players.find((p) => p.id === bodyId);
  if (!body) {
    throw new RoundError("BODY_NOT_FOUND", "Body not found");
  }
  if (body.isAlive) {
    throw new RoundError("NOT_DEAD", "That player is still alive");
  }

  // Transition to REPORT (brief display), then engine will move to DISCUSSION
  game.phase = Phase.REPORT;
  updateGame(game);
  return game;
}

// ============================================
// Win Condition Check
// ============================================

/**
 * Check if the game has ended.
 * Returns the winning role or null if game continues.
 */
export function checkGameOver(game: GameState): Role | null {
  const aliveImpostors = game.players.filter(
    (p) => p.isAlive && p.role === Role.IMPOSTOR,
  ).length;
  const aliveCrew = game.players.filter(
    (p) => p.isAlive && p.role === Role.CREW,
  ).length;

  const result = checkWinCondition(aliveImpostors, aliveCrew);
  if (result === "IMPOSTOR") return Role.IMPOSTOR;
  if (result === "CREW") return Role.CREW;
  return null;
}
