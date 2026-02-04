import type { Phase, Player, ChatMessage, Vote, GameSettings, LobbyInfo } from "./game.js";
import type { Market, Bet, Odds } from "./betting.js";

// ============================================
// Server → Client Events
// ============================================

export type ServerEvent =
  | { type: "GAME_STATE"; payload: ServerPayloads["GAME_STATE"] }
  | { type: "LOBBY_UPDATE"; payload: ServerPayloads["LOBBY_UPDATE"] }
  | { type: "PHASE_CHANGE"; payload: ServerPayloads["PHASE_CHANGE"] }
  | { type: "PLAYER_JOINED"; payload: ServerPayloads["PLAYER_JOINED"] }
  | { type: "PLAYER_LEFT"; payload: ServerPayloads["PLAYER_LEFT"] }
  | { type: "PLAYER_KILLED"; payload: ServerPayloads["PLAYER_KILLED"] }
  | { type: "PLAYER_ELIMINATED"; payload: ServerPayloads["PLAYER_ELIMINATED"] }
  | { type: "VOTE_CAST"; payload: ServerPayloads["VOTE_CAST"] }
  | { type: "VOTE_RESULT"; payload: ServerPayloads["VOTE_RESULT"] }
  | { type: "CHAT_MESSAGE"; payload: ServerPayloads["CHAT_MESSAGE"] }
  | { type: "GAME_OVER"; payload: ServerPayloads["GAME_OVER"] }
  | { type: "ROLE_ASSIGNED"; payload: ServerPayloads["ROLE_ASSIGNED"] }
  | { type: "MARKET_OPENED"; payload: ServerPayloads["MARKET_OPENED"] }
  | { type: "MARKET_UPDATED"; payload: ServerPayloads["MARKET_UPDATED"] }
  | { type: "MARKET_RESOLVED"; payload: ServerPayloads["MARKET_RESOLVED"] }
  | { type: "BET_CONFIRMED"; payload: ServerPayloads["BET_CONFIRMED"] }
  | { type: "BETTING_UPDATE"; payload: ServerPayloads["BETTING_UPDATE"] }
  | { type: "SPECTATOR_COUNT"; payload: ServerPayloads["SPECTATOR_COUNT"] }
  | { type: "ERROR"; payload: ServerPayloads["ERROR"] }
  | { type: "PONG"; payload: ServerPayloads["PONG"] };

export interface ServerPayloads {
  GAME_STATE: {
    gameId: string;
    phase: Phase;
    round: number;
    players: Pick<Player, "id" | "nickname" | "isAlive" | "isConnected" | "avatar">[];
    alivePlayers: string[];
    timeRemaining: number;
    settings: GameSettings;
  };
  LOBBY_UPDATE: LobbyInfo;
  PHASE_CHANGE: {
    phase: Phase;
    round: number;
    timeRemaining: number;
  };
  PLAYER_JOINED: Pick<Player, "id" | "nickname" | "avatar">;
  PLAYER_LEFT: { playerId: string };
  PLAYER_KILLED: { playerId: string; round: number };
  PLAYER_ELIMINATED: { playerId: string; voteCount: number };
  VOTE_CAST: { voterId: string; hasVoted: true };
  VOTE_RESULT: {
    votes: Record<string, number>; // targetId → count
    eliminatedId: string | null;
    skipped: boolean;
  };
  CHAT_MESSAGE: ChatMessage;
  GAME_OVER: {
    winner: "IMPOSTOR" | "CREW";
    impostors: string[];
    rounds: number;
  };
  ROLE_ASSIGNED: {
    role: "IMPOSTOR" | "CREW";
    teammates?: string[]; // other impostors if impostor
  };
  MARKET_OPENED: Market;
  MARKET_UPDATED: {
    marketId: string;
    odds: Odds[];
    totalPool: string;
  };
  MARKET_RESOLVED: {
    marketId: string;
    resolvedOutcomeId: string;
  };
  BET_CONFIRMED: Bet;
  BETTING_UPDATE: {
    gameId: string;
    marketId: string;
    odds: Odds[];
    totalPool: string;
    recentBets: Array<{
      address: string;
      outcomeId: string;
      amount: string;
      timestamp: number;
    }>;
  };
  SPECTATOR_COUNT: {
    gameId: string;
    count: number;
  };
  ERROR: {
    code: string;
    message: string;
  };
  PONG: {
    timestamp: number;
  };
}

// ============================================
// Client → Server Events
// ============================================

export type ClientEvent =
  | { type: "CREATE_GAME"; payload: ClientPayloads["CREATE_GAME"] }
  | { type: "JOIN_GAME"; payload: ClientPayloads["JOIN_GAME"] }
  | { type: "LEAVE_GAME"; payload: ClientPayloads["LEAVE_GAME"] }
  | { type: "START_GAME"; payload: ClientPayloads["START_GAME"] }
  | { type: "CAST_VOTE"; payload: ClientPayloads["CAST_VOTE"] }
  | { type: "SEND_CHAT"; payload: ClientPayloads["SEND_CHAT"] }
  | { type: "KILL_PLAYER"; payload: ClientPayloads["KILL_PLAYER"] }
  | { type: "REPORT_BODY"; payload: ClientPayloads["REPORT_BODY"] }
  | { type: "PLACE_BET"; payload: ClientPayloads["PLACE_BET"] }
  | { type: "JOIN_SPECTATE"; payload: ClientPayloads["JOIN_SPECTATE"] }
  | { type: "LEAVE_SPECTATE"; payload: ClientPayloads["LEAVE_SPECTATE"] }
  | { type: "PING"; payload: ClientPayloads["PING"] };

export interface ClientPayloads {
  CREATE_GAME: {
    nickname: string;
    address: `0x${string}`;
    settings?: Partial<GameSettings>;
  };
  JOIN_GAME: {
    gameCode: string;
    nickname: string;
    address: `0x${string}`;
  };
  LEAVE_GAME: {
    gameId: string;
  };
  START_GAME: {
    gameId: string;
  };
  CAST_VOTE: {
    gameId: string;
    targetId: string | null; // null = skip
  };
  SEND_CHAT: {
    gameId: string;
    content: string;
  };
  KILL_PLAYER: {
    gameId: string;
    targetId: string;
  };
  REPORT_BODY: {
    gameId: string;
    bodyId: string;
  };
  PLACE_BET: {
    marketId: string;
    outcomeId: string;
    amount: string;
  };
  JOIN_SPECTATE: {
    gameId: string;
  };
  LEAVE_SPECTATE: {
    gameId: string;
  };
  PING: {
    timestamp: number;
  };
}

/** Helper to create typed server events */
export function createServerEvent<T extends ServerEvent["type"]>(
  type: T,
  payload: Extract<ServerEvent, { type: T }>["payload"]
): Extract<ServerEvent, { type: T }> {
  return { type, payload } as Extract<ServerEvent, { type: T }>;
}

/** Helper to create typed client events */
export function createClientEvent<T extends ClientEvent["type"]>(
  type: T,
  payload: Extract<ClientEvent, { type: T }>["payload"]
): Extract<ClientEvent, { type: T }> {
  return { type, payload } as Extract<ClientEvent, { type: T }>;
}

/** Parse a raw WebSocket message into a typed event */
export function parseEvent<T extends ServerEvent | ClientEvent>(raw: string): T | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === "string" && parsed.payload !== undefined) {
      return parsed as T;
    }
    return null;
  } catch {
    return null;
  }
}

/** Serialize an event for WebSocket transmission */
export function serializeEvent(event: ServerEvent | ClientEvent): string {
  return JSON.stringify(event);
}
