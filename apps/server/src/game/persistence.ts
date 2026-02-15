/**
 * Game State Persistence — JSON file-based storage
 * Saves active games and finished games to disk so data survives server restarts.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { GameState } from "@prescio/common";

const DATA_DIR = join(process.cwd(), ".data");
const ACTIVE_FILE = join(DATA_DIR, "active-games.json");
const FINISHED_FILE = join(DATA_DIR, "finished-games.json");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/** Kill event record for statistics */
export interface KillEventRecord {
  killerId: string;
  killerName: string;
  targetId: string;
  targetName: string;
  round: number;
}

/** Death cause for statistics - how a player died or survived */
export type DeathCause = 'killed' | 'eliminated' | 'survived';

/** Player record with optional deathCause for backwards compatibility */
export interface PlayerRecord {
  nickname: string;
  role: string | null;
  isAlive: boolean;
  deathCause?: DeathCause; // Optional for backwards compatibility
}

export interface FinishedGameRecord {
  id: string;
  code: string;
  winner: string | null;
  rounds: number;
  playerCount: number;
  players: Array<PlayerRecord>;
  killEvents?: KillEventRecord[]; // Optional for backwards compatibility
  finishedAt: number;
}

/** Save active games to disk */
export function saveActiveGames(games: Map<string, GameState>): void {
  try {
    const data = Array.from(games.values());
    writeFileSync(ACTIVE_FILE, JSON.stringify(data, bigIntReplacer, 2));
  } catch (err) {
    console.error("[Persistence] Failed to save active games:", err);
  }
}

/** Load active games from disk */
export function loadActiveGames(): GameState[] {
  try {
    if (!existsSync(ACTIVE_FILE)) return [];
    const raw = readFileSync(ACTIVE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Persistence] Failed to load active games:", err);
    return [];
  }
}

/** Append a finished game record */
export function appendFinishedGame(record: FinishedGameRecord): void {
  try {
    const existing = loadFinishedGames();
    existing.push(record);
    // Keep last 500 games
    const trimmed = existing.slice(-500);
    writeFileSync(FINISHED_FILE, JSON.stringify(trimmed, null, 2));
  } catch (err) {
    console.error("[Persistence] Failed to save finished game:", err);
  }
}

/** Load finished games from disk */
export function loadFinishedGames(): FinishedGameRecord[] {
  try {
    if (!existsSync(FINISHED_FILE)) return [];
    const raw = readFileSync(FINISHED_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Persistence] Failed to load finished games:", err);
    return [];
  }
}

/** BigInt-safe JSON replacer */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}
