/** Player roles in the game */
export enum Role {
  IMPOSTOR = "IMPOSTOR",
  CREW = "CREW",
}

/** Game phases */
export enum Phase {
  LOBBY = "LOBBY",
  NIGHT = "NIGHT",
  REPORT = "REPORT",
  DISCUSSION = "DISCUSSION",
  VOTE = "VOTE",
  RESULT = "RESULT",
}

/** A player in the game */
export interface Player {
  id: string;
  address: `0x${string}`;
  nickname: string;
  role: Role | null;
  isAlive: boolean;
  isConnected: boolean;
  avatar?: string;
}

/** Vote cast by a player */
export interface Vote {
  voterId: string;
  targetId: string | null; // null = skip
  timestamp: number;
}

/** Chat message in the game */
export interface ChatMessage {
  id: string;
  playerId: string;
  playerNickname: string;
  content: string;
  timestamp: number;
  phase: Phase;
  isSystem: boolean;
}

/** Kill event during night phase */
export interface KillEvent {
  killerId: string;
  targetId: string;
  round: number;
  timestamp: number;
}

/** Full game state */
export interface GameState {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  round: number;
  /** Seconds remaining in current phase */
  timeRemaining?: number;
  votes: Vote[];
  chatMessages: ChatMessage[];
  killEvents: KillEvent[];
  alivePlayers: string[];
  eliminatedPlayers: string[];
  winner: Role | null;
  createdAt: number;
  updatedAt: number;
  settings: GameSettings;
  /** Map state (locations, tasks) — undefined for legacy games */
  map?: import("./map.js").MapState;
}

/** Supported game languages */
export type GameLanguage = "en" | "ko" | "ja" | "zh";

/** Configurable game settings */
export interface GameSettings {
  maxPlayers: number;
  minPlayers: number;
  impostorCount: number;
  discussionTime: number;
  voteTime: number;
  nightTime: number;
  anonymousVoting: boolean;
  /** Language for in-game chat and system messages (default: "en") */
  language: GameLanguage;
}

/** Lobby info (public, no roles exposed) */
export interface LobbyInfo {
  id: string;
  code: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  phase: Phase;
  players: Pick<Player, "id" | "nickname" | "isConnected" | "avatar">[];
}
