/**
 * GameState Store — In-memory game state management
 */
import type { GameState } from "@prescio/common";

/** In-memory store for all active games */
const games = new Map<string, GameState>();

/** Index: game code → game id */
const codeIndex = new Map<string, string>();

/** Get a game by ID */
export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

/** Get a game by its join code */
export function getGameByCode(code: string): GameState | undefined {
  const gameId = codeIndex.get(code.toUpperCase());
  if (!gameId) return undefined;
  return games.get(gameId);
}

/** Store or update a game */
export function updateGame(game: GameState): void {
  game.updatedAt = Date.now();
  games.set(game.id, game);
  codeIndex.set(game.code, game.id);
}

/** Delete a game */
export function deleteGame(gameId: string): boolean {
  const game = games.get(gameId);
  if (!game) return false;
  codeIndex.delete(game.code);
  games.delete(gameId);
  return true;
}

/** Get all active games (in LOBBY phase, for listing) */
export function getActiveGames(): GameState[] {
  return Array.from(games.values());
}

/** Get count of active games */
export function getGameCount(): number {
  return games.size;
}
