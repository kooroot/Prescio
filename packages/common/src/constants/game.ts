import type { GameSettings } from "../types/game.js";

/** Minimum number of players to start a game */
export const MIN_PLAYERS = 5;

/** Maximum number of players in a game */
export const MAX_PLAYERS = 7;

/** Duration of discussion phase in seconds */
export const DISCUSSION_TIME = 60;

/** Duration of voting phase in seconds */
export const VOTE_TIME = 30;

/** Duration of night phase in seconds */
export const NIGHT_TIME = 20;

/** Duration of report phase (body found) in seconds */
export const REPORT_TIME = 10;

/** Duration of result display in seconds */
export const RESULT_TIME = 15;

/** Game code length */
export const GAME_CODE_LENGTH = 6;

/** Max chat message length */
export const MAX_CHAT_LENGTH = 200;

/** Max nickname length */
export const MAX_NICKNAME_LENGTH = 16;

/** Min nickname length */
export const MIN_NICKNAME_LENGTH = 2;

/** Impostor count based on player count */
export const IMPOSTOR_COUNT_MAP: Record<number, number> = {
  5: 1,
  6: 1,
  7: 1,
  8: 1,
};

/** Default game settings */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  maxPlayers: MAX_PLAYERS,
  minPlayers: MIN_PLAYERS,
  impostorCount: 1,
  discussionTime: DISCUSSION_TIME,
  voteTime: VOTE_TIME,
  nightTime: NIGHT_TIME,
  anonymousVoting: false,
  language: "en",
};

/** Generate a random game code */
export function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars (I/1/O/0)
  let code = "";
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Get impostor count for a given player count */
export function getImpostorCount(playerCount: number): number {
  return IMPOSTOR_COUNT_MAP[playerCount] ?? 1;
}

/** Check win conditions */
export function checkWinCondition(
  aliveImpostors: number,
  aliveCrew: number
): "IMPOSTOR" | "CREW" | null {
  if (aliveImpostors === 0) return "CREW";
  if (aliveImpostors >= aliveCrew) return "IMPOSTOR";
  return null;
}
