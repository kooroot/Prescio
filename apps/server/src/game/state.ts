/**
 * GameState Store — In-memory game state management with disk persistence
 */
import type { GameState } from "@prescio/common";
import { saveActiveGames, loadActiveGames } from "./persistence.js";

/** In-memory store for all active games */
const games = new Map<string, GameState>();

/** Index: game code → game id */
const codeIndex = new Map<string, string>();

/** Debounced save timer */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveActiveGames(games);
  }, 2000); // Save at most every 2 seconds
}

/** Load persisted games on startup */
export function restoreGames(): number {
  const saved = loadActiveGames();
  for (const game of saved) {
    games.set(game.id, game);
    codeIndex.set(game.code, game.id);
  }
  if (saved.length > 0) {
    console.log(`[Persistence] Restored ${saved.length} active games from disk`);
  }
  return saved.length;
}

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
  scheduleSave();
}

/** Delete a game */
export function deleteGame(gameId: string): boolean {
  const game = games.get(gameId);
  if (!game) return false;
  codeIndex.delete(game.code);
  games.delete(gameId);
  scheduleSave();
  return true;
}

/** Get all active games (excludes finished games) */
export function getActiveGames(): GameState[] {
  return Array.from(games.values()).filter((g) => !g.winner);
}

/** Get count of active games */
export function getGameCount(): number {
  return games.size;
}
