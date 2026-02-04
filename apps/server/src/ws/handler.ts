/**
 * WebSocket Event Handler
 *
 * Routes incoming client events to the appropriate game logic.
 * Separates player vs spectator concerns.
 */
import { v4 as uuidv4 } from "uuid";
import {
  parseEvent,
  createServerEvent,
  Phase,
  type ClientEvent,
  type ClientPayloads,
  type ServerEvent,
  type LobbyInfo,
} from "@prescio/common";
import {
  gameEngine,
  createGame,
  addPlayer,
  removePlayer,
  startGame as startGameLobby,
  getRoleAssignment,
  castVote,
  executeKill,
  reportBody,
  getGame,
  LobbyError,
  RoundError,
  VoteError,
} from "../game/index.js";
import { agentManager } from "../agents/manager.js";
import {
  sendTo,
  broadcastToGame,
  broadcastToPlayers,
  broadcastToSpectators,
  broadcastSpectatorCount,
  getClient,
  addPlayerToGame,
  addSpectator,
  removeSpectator,
  removePlayerFromGame,
  getSpectatorCount,
  type ConnectedClient,
} from "./broadcast.js";

// ============================================
// Helper: Build LobbyInfo from GameState
// ============================================

function toLobbyInfo(game: ReturnType<typeof getGame>): LobbyInfo | null {
  if (!game) return null;
  return {
    id: game.id,
    code: game.code,
    hostId: game.hostId,
    playerCount: game.players.length,
    maxPlayers: game.settings.maxPlayers,
    phase: game.phase,
    players: game.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isConnected: p.isConnected,
      avatar: p.avatar,
    })),
  };
}

// ============================================
// Main Event Router
// ============================================

export function handleClientEvent(clientId: string, event: ClientEvent): void {
  console.log(`[WS] Event from ${clientId}: ${event.type}`);

  switch (event.type) {
    case "PING":
      handlePing(clientId);
      break;
    case "CREATE_GAME":
      handleCreateGame(clientId, event.payload);
      break;
    case "JOIN_GAME":
      handleJoinGame(clientId, event.payload);
      break;
    case "START_GAME":
      handleStartGame(clientId, event.payload);
      break;
    case "CAST_VOTE":
      handleCastVote(clientId, event.payload);
      break;
    case "SEND_CHAT":
      handleSendChat(clientId, event.payload);
      break;
    case "KILL_PLAYER":
      handleKillPlayer(clientId, event.payload);
      break;
    case "REPORT_BODY":
      handleReportBody(clientId, event.payload);
      break;
    case "PLACE_BET":
      handlePlaceBet(clientId, event.payload);
      break;
    case "LEAVE_GAME":
      handleLeaveGame(clientId, event.payload);
      break;
    case "JOIN_SPECTATE":
      handleJoinSpectate(clientId, event.payload);
      break;
    case "LEAVE_SPECTATE":
      handleLeaveSpectate(clientId, event.payload);
      break;
    default: {
      const _exhaustive: never = event;
      sendTo(clientId, createServerEvent("ERROR", {
        code: "UNKNOWN_EVENT",
        message: "Unknown event type",
      }));
    }
  }
}

// ============================================
// Individual Handlers
// ============================================

function handlePing(clientId: string): void {
  sendTo(clientId, createServerEvent("PONG", { timestamp: Date.now() }));
}

function handleCreateGame(
  clientId: string,
  payload: ClientPayloads["CREATE_GAME"],
): void {
  try {
    const game = createGame(
      clientId,
      payload.nickname,
      payload.address,
      payload.settings,
    );
    const client = getClient(clientId);
    if (client) {
      client.address = payload.address;
      client.nickname = payload.nickname;
      addPlayerToGame(clientId, game.id);
    }
    const lobby = toLobbyInfo(game);
    if (lobby) sendTo(clientId, createServerEvent("LOBBY_UPDATE", lobby));
    console.log(`[Game] Created game ${game.code} by ${payload.nickname}`);
  } catch (err) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: err instanceof LobbyError ? err.code : "CREATE_FAILED",
      message: err instanceof Error ? err.message : "Failed to create game",
    }));
  }
}

function handleJoinGame(
  clientId: string,
  payload: ClientPayloads["JOIN_GAME"],
): void {
  try {
    const game = addPlayer(
      payload.gameCode,
      clientId,
      payload.nickname,
      payload.address,
    );
    const client = getClient(clientId);
    if (client) {
      client.address = payload.address;
      client.nickname = payload.nickname;
      addPlayerToGame(clientId, game.id);
    }
    const lobby = toLobbyInfo(game);
    if (lobby) {
      broadcastToGame(game.id, createServerEvent("LOBBY_UPDATE", lobby));
    }
    broadcastToPlayers(game.id, createServerEvent("PLAYER_JOINED", {
      id: clientId,
      nickname: payload.nickname,
    }), clientId);
    // Also notify spectators
    broadcastToSpectators(game.id, createServerEvent("PLAYER_JOINED", {
      id: clientId,
      nickname: payload.nickname,
    }));
    console.log(`[Game] ${payload.nickname} joined game ${game.code}`);
  } catch (err) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: err instanceof LobbyError ? err.code : "JOIN_FAILED",
      message: err instanceof Error ? err.message : "Failed to join game",
    }));
  }
}

function handleStartGame(
  clientId: string,
  payload: { gameId: string },
): void {
  try {
    const game = startGameLobby(payload.gameId, clientId);
    for (const player of game.players) {
      const assignment = getRoleAssignment(game, player.id);
      if (assignment) {
        sendTo(player.id, createServerEvent("ROLE_ASSIGNED", {
          role: assignment.role as "IMPOSTOR" | "CREW",
          teammates: assignment.teammates,
        }));
      }
    }
    agentManager.initializeAgents(game);
    gameEngine.startLoop(game.id);
    console.log(`[Game] Game ${game.code} started! Round 1`);
  } catch (err) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: err instanceof LobbyError ? err.code : "START_FAILED",
      message: err instanceof Error ? err.message : "Failed to start game",
    }));
  }
}

function handleCastVote(
  clientId: string,
  payload: { gameId: string; targetId: string | null },
): void {
  try {
    castVote(payload.gameId, clientId, payload.targetId);
    broadcastToGame(payload.gameId, createServerEvent("VOTE_CAST", {
      voterId: clientId,
      hasVoted: true,
    }));
    gameEngine.onVoteCast(payload.gameId);
  } catch (err) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: err instanceof VoteError ? err.code : "VOTE_FAILED",
      message: err instanceof Error ? err.message : "Failed to cast vote",
    }));
  }
}

function handleSendChat(
  clientId: string,
  payload: { gameId: string; content: string },
): void {
  const client = getClient(clientId);
  const game = client?.gameId ? getGame(client.gameId) : null;
  if (!game) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: "NOT_IN_GAME",
      message: "You are not in a game",
    }));
    return;
  }

  // Spectators cannot send chat
  if (client?.role === "spectator") {
    sendTo(clientId, createServerEvent("ERROR", {
      code: "SPECTATOR_NO_CHAT",
      message: "Spectators cannot send chat messages",
    }));
    return;
  }

  if (game.phase !== Phase.DISCUSSION && game.phase !== Phase.LOBBY) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: "CHAT_DISABLED",
      message: "Chat is only available during discussion",
    }));
    return;
  }

  const chatMsg = {
    id: uuidv4(),
    playerId: clientId,
    playerNickname: client?.nickname ?? "Unknown",
    content: payload.content.slice(0, 200),
    timestamp: Date.now(),
    phase: game.phase,
    isSystem: false,
  };
  game.chatMessages.push(chatMsg);
  // Send to everyone (players + spectators)
  broadcastToGame(game.id, createServerEvent("CHAT_MESSAGE", chatMsg));
}

function handleKillPlayer(
  clientId: string,
  payload: { gameId: string; targetId: string },
): void {
  try {
    const { killEvent } = executeKill(payload.gameId, clientId, payload.targetId);
    console.log(`[Game] Kill: ${killEvent.killerId} → ${killEvent.targetId}`);
  } catch (err) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: err instanceof RoundError ? err.code : "KILL_FAILED",
      message: err instanceof Error ? err.message : "Failed to kill",
    }));
  }
}

function handleReportBody(
  clientId: string,
  payload: { gameId: string; bodyId: string },
): void {
  try {
    reportBody(payload.gameId, clientId, payload.bodyId);
  } catch (err) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: err instanceof RoundError ? err.code : "REPORT_FAILED",
      message: err instanceof Error ? err.message : "Failed to report body",
    }));
  }
}

function handlePlaceBet(
  clientId: string,
  payload: { marketId: string; outcomeId: string; amount: string },
): void {
  // TODO: Implement bet placement logic (Step 3 — blockchain integration)
  console.log(`[Bet] Place bet on market ${payload.marketId}`);
}

function handleLeaveGame(
  clientId: string,
  payload: { gameId: string },
): void {
  const client = getClient(clientId);
  const game = removePlayer(payload.gameId, clientId);
  if (game) {
    broadcastToGame(game.id, createServerEvent("PLAYER_LEFT", { playerId: clientId }));
    const lobby = toLobbyInfo(game);
    if (lobby && game.phase === Phase.LOBBY) {
      broadcastToGame(game.id, createServerEvent("LOBBY_UPDATE", lobby));
    }
    if (game.players.length === 0) {
      gameEngine.destroyGame(game.id);
    }
  }
  if (client) {
    removePlayerFromGame(clientId, payload.gameId);
    client.gameId = undefined;
  }
}

// ============================================
// Spectator Handlers
// ============================================

function handleJoinSpectate(
  clientId: string,
  payload: { gameId: string },
): void {
  const game = getGame(payload.gameId);
  if (!game) {
    sendTo(clientId, createServerEvent("ERROR", {
      code: "GAME_NOT_FOUND",
      message: "Game not found",
    }));
    return;
  }

  const client = getClient(clientId);
  if (!client) return;

  // If already in a game as player, reject
  if (client.gameId && client.role === "player") {
    sendTo(clientId, createServerEvent("ERROR", {
      code: "ALREADY_IN_GAME",
      message: "Leave your current game before spectating",
    }));
    return;
  }

  // If already spectating another game, leave that first
  if (client.gameId && client.role === "spectator") {
    removeSpectator(clientId, client.gameId);
    broadcastSpectatorCount(client.gameId);
  }

  addSpectator(clientId, game.id);

  // Send current game state to spectator
  const lobby = toLobbyInfo(game);
  if (lobby) {
    sendTo(clientId, createServerEvent("LOBBY_UPDATE", lobby));
  }

  sendTo(clientId, createServerEvent("GAME_STATE", {
    gameId: game.id,
    phase: game.phase,
    round: game.round,
    players: game.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isAlive: p.isAlive,
      isConnected: p.isConnected,
      avatar: p.avatar,
    })),
    alivePlayers: game.players.filter((p) => p.isAlive).map((p) => p.id),
    timeRemaining: gameEngine.getTimeRemaining(game.id),
    settings: game.settings,
  }));

  // Notify everyone about updated spectator count
  broadcastSpectatorCount(game.id);
  console.log(`[WS] ${clientId} spectating game ${game.code} (${getSpectatorCount(game.id)} spectators)`);
}

function handleLeaveSpectate(
  clientId: string,
  payload: { gameId: string },
): void {
  const client = getClient(clientId);
  if (!client || client.role !== "spectator") return;

  removeSpectator(clientId, payload.gameId);
  client.gameId = undefined;

  broadcastSpectatorCount(payload.gameId);
  console.log(`[WS] ${clientId} stopped spectating game ${payload.gameId}`);
}
