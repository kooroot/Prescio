/**
 * Discussion System — Chat messages during discussion phase
 */
import { v4 as uuidv4 } from "uuid";
import { Phase, type ChatMessage, type GameState } from "@prescio/common";
import { getGame, updateGame } from "./state.js";

// ============================================
// Errors
// ============================================

export class DiscussionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DiscussionError";
  }
}

// ============================================
// Add Player Message
// ============================================

/**
 * Add a chat message from a player during the discussion phase.
 */
export function addMessage(
  gameId: string,
  playerId: string,
  content: string,
): { game: GameState; message: ChatMessage } {
  const game = getGame(gameId);
  if (!game) {
    throw new DiscussionError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.phase !== Phase.DISCUSSION && game.phase !== Phase.LOBBY) {
    throw new DiscussionError("WRONG_PHASE", "Chat is only available during discussion");
  }

  const player = game.players.find((p) => p.id === playerId);
  if (!player) {
    throw new DiscussionError("PLAYER_NOT_FOUND", "Player not found in game");
  }

  if (!player.isAlive) {
    throw new DiscussionError("PLAYER_DEAD", "Dead players cannot speak");
  }

  const chatMsg: ChatMessage = {
    id: uuidv4(),
    playerId,
    playerNickname: player.nickname,
    content: content.slice(0, 200),
    timestamp: Date.now(),
    phase: game.phase,
    isSystem: false,
  };

  game.chatMessages.push(chatMsg);
  updateGame(game);
  return { game, message: chatMsg };
}

// ============================================
// Add System Message
// ============================================

/**
 * Add a system message (body discovered, vote result, etc.)
 */
export function addSystemMessage(
  gameId: string,
  content: string,
): { game: GameState; message: ChatMessage } {
  const game = getGame(gameId);
  if (!game) {
    throw new DiscussionError("GAME_NOT_FOUND", "Game not found");
  }

  const chatMsg: ChatMessage = {
    id: uuidv4(),
    playerId: "SYSTEM",
    playerNickname: "시스템",
    content,
    timestamp: Date.now(),
    phase: game.phase,
    isSystem: true,
  };

  game.chatMessages.push(chatMsg);
  updateGame(game);
  return { game, message: chatMsg };
}

// ============================================
// Get Messages
// ============================================

/**
 * Get chat messages for a game, optionally filtered by round.
 */
export function getMessages(gameId: string, round?: number): ChatMessage[] {
  const game = getGame(gameId);
  if (!game) return [];

  if (round === undefined) {
    return game.chatMessages;
  }

  // Filter messages by round — approximate by looking at phase changes
  // Messages belong to a round if they were sent during that round's DISCUSSION/VOTE phases
  // Since we don't store round on messages, we use round-based kill events to determine time ranges
  const roundKills = game.killEvents.filter((ke) => ke.round === round);
  const nextRoundKills = game.killEvents.filter((ke) => ke.round === round + 1);

  const roundStart = roundKills.length > 0 ? Math.min(...roundKills.map((k) => k.timestamp)) : 0;
  const roundEnd = nextRoundKills.length > 0
    ? Math.min(...nextRoundKills.map((k) => k.timestamp))
    : Date.now();

  return game.chatMessages.filter(
    (msg) => msg.timestamp >= roundStart && msg.timestamp <= roundEnd,
  );
}

/**
 * Get recent messages for AI context (last N messages).
 */
export function getRecentMessages(gameId: string, limit: number = 30): ChatMessage[] {
  const game = getGame(gameId);
  if (!game) return [];
  return game.chatMessages.slice(-limit);
}
