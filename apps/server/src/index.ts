import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import {
  parseEvent,
  serializeEvent,
  createServerEvent,
  Phase,
  type ClientEvent,
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
  getActiveGames,
  LobbyError,
  RoundError,
  VoteError,
} from "./game/index.js";

// ============================================
// Express App
// ============================================

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    env: config.nodeEnv,
  });
});

// API routes
app.get("/api/games", (_req, res) => {
  const games = getActiveGames().map((g) => ({
    id: g.id,
    code: g.code,
    playerCount: g.players.length,
    maxPlayers: g.settings.maxPlayers,
    phase: g.phase,
  }));
  res.json({ games });
});

app.get("/api/markets", (_req, res) => {
  res.json({ markets: [] });
});

// ============================================
// HTTP Server
// ============================================

const server = createServer(app);

// ============================================
// WebSocket Server
// ============================================

const wss = new WebSocketServer({ server });

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  address?: `0x${string}`;
  gameId?: string;
  nickname?: string;
}

const clients = new Map<string, ConnectedClient>();

function broadcast(gameId: string, event: ServerEvent, excludeId?: string): void {
  const message = serializeEvent(event);
  for (const [id, client] of clients) {
    if (client.gameId === gameId && id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function sendTo(clientId: string, event: ServerEvent): void {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(serializeEvent(event));
  }
}

wss.on("connection", (ws) => {
  const clientId = uuidv4();
  const client: ConnectedClient = { id: clientId, ws };
  clients.set(clientId, client);

  console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

  ws.on("message", (data) => {
    try {
      const raw = data.toString();
      const event = parseEvent<ClientEvent>(raw);

      if (!event) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: "INVALID_EVENT",
          message: "Invalid event format",
        }));
        return;
      }

      handleClientEvent(clientId, event);
    } catch (err) {
      console.error(`[WS] Error processing message from ${clientId}:`, err);
      sendTo(clientId, createServerEvent("ERROR", {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      }));
    }
  });

  ws.on("close", () => {
    const disconnectedClient = clients.get(clientId);
    if (disconnectedClient?.gameId) {
      broadcast(
        disconnectedClient.gameId,
        createServerEvent("PLAYER_LEFT", { playerId: clientId }),
        clientId
      );
    }
    clients.delete(clientId);
    console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Error from ${clientId}:`, err);
  });
});

// ============================================
// Game Engine Events → Broadcast to Clients
// ============================================

gameEngine.on("phaseChange", (gameId, phase, round) => {
  const game = getGame(gameId);
  const timeRemaining = gameEngine.getTimeRemaining(gameId);
  broadcast(gameId, createServerEvent("PHASE_CHANGE", { phase, round, timeRemaining }));
  console.log(`[Engine] Game ${gameId} → ${phase} (round ${round})`);

  // If entering DISCUSSION, also broadcast updated game state
  if (game && phase === Phase.REPORT) {
    const lastKill = game.killEvents[game.killEvents.length - 1];
    if (lastKill) {
      broadcast(gameId, createServerEvent("PLAYER_KILLED", {
        playerId: lastKill.targetId,
        round: lastKill.round,
      }));
    }
  }
});

gameEngine.on("nightKills", (gameId, kills) => {
  for (const kill of kills) {
    broadcast(gameId, createServerEvent("PLAYER_KILLED", {
      playerId: kill.targetId,
      round: kill.round,
    }));
  }
});

gameEngine.on("voteResult", (gameId, result) => {
  const voteCountMap: Record<string, number> = {};
  for (const [targetId, count] of Object.entries(result.tally)) {
    voteCountMap[targetId] = count;
  }
  broadcast(gameId, createServerEvent("VOTE_RESULT", {
    votes: voteCountMap,
    eliminatedId: result.eliminatedId,
    skipped: result.skipped,
  }));
  if (result.eliminatedId) {
    broadcast(gameId, createServerEvent("PLAYER_ELIMINATED", {
      playerId: result.eliminatedId,
      voteCount: result.tally[result.eliminatedId] ?? 0,
    }));
  }
});

gameEngine.on("gameOver", (gameId, winner, game) => {
  const impostors = game.players
    .filter((p) => p.role?.toString() === "IMPOSTOR")
    .map((p) => p.id);
  broadcast(gameId, createServerEvent("GAME_OVER", {
    winner: winner === "IMPOSTOR" ? "IMPOSTOR" : "CREW",
    impostors,
    rounds: game.round,
  }));
  console.log(`[Engine] Game ${gameId} OVER — winner: ${winner}`);
});

gameEngine.on("engineError", (gameId, error) => {
  console.error(`[Engine] Error in game ${gameId}:`, error.message);
});

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
// Event Handlers
// ============================================

function handleClientEvent(clientId: string, event: ClientEvent): void {
  console.log(`[WS] Event from ${clientId}: ${event.type}`);

  switch (event.type) {
    case "PING": {
      sendTo(clientId, createServerEvent("PONG", { timestamp: Date.now() }));
      break;
    }

    case "CREATE_GAME": {
      try {
        const game = createGame(
          clientId,
          event.payload.nickname,
          event.payload.address,
          event.payload.settings,
        );
        const client = clients.get(clientId);
        if (client) {
          client.gameId = game.id;
          client.address = event.payload.address;
          client.nickname = event.payload.nickname;
        }
        const lobby = toLobbyInfo(game);
        if (lobby) sendTo(clientId, createServerEvent("LOBBY_UPDATE", lobby));
        console.log(`[Game] Created game ${game.code} by ${event.payload.nickname}`);
      } catch (err) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: err instanceof LobbyError ? err.code : "CREATE_FAILED",
          message: err instanceof Error ? err.message : "Failed to create game",
        }));
      }
      break;
    }

    case "JOIN_GAME": {
      try {
        const game = addPlayer(
          event.payload.gameCode,
          clientId,
          event.payload.nickname,
          event.payload.address,
        );
        const client = clients.get(clientId);
        if (client) {
          client.gameId = game.id;
          client.address = event.payload.address;
          client.nickname = event.payload.nickname;
        }
        // Notify everyone in the lobby
        const lobby = toLobbyInfo(game);
        if (lobby) {
          broadcast(game.id, createServerEvent("LOBBY_UPDATE", lobby));
        }
        broadcast(game.id, createServerEvent("PLAYER_JOINED", {
          id: clientId,
          nickname: event.payload.nickname,
        }), clientId);
        console.log(`[Game] ${event.payload.nickname} joined game ${game.code}`);
      } catch (err) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: err instanceof LobbyError ? err.code : "JOIN_FAILED",
          message: err instanceof Error ? err.message : "Failed to join game",
        }));
      }
      break;
    }

    case "START_GAME": {
      try {
        const game = startGameLobby(event.payload.gameId, clientId);
        // Send role assignments to each player individually
        for (const player of game.players) {
          const assignment = getRoleAssignment(game, player.id);
          if (assignment) {
            sendTo(player.id, createServerEvent("ROLE_ASSIGNED", {
              role: assignment.role as "IMPOSTOR" | "CREW",
              teammates: assignment.teammates,
            }));
          }
        }
        // Start the game engine loop
        gameEngine.startLoop(game.id);
        console.log(`[Game] Game ${game.code} started! Round 1`);
      } catch (err) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: err instanceof LobbyError ? err.code : "START_FAILED",
          message: err instanceof Error ? err.message : "Failed to start game",
        }));
      }
      break;
    }

    case "CAST_VOTE": {
      try {
        castVote(event.payload.gameId, clientId, event.payload.targetId);
        // Broadcast anonymous vote notification
        broadcast(event.payload.gameId, createServerEvent("VOTE_CAST", {
          voterId: clientId,
          hasVoted: true,
        }));
        // Check if all votes are in → early tally
        gameEngine.onVoteCast(event.payload.gameId);
      } catch (err) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: err instanceof VoteError ? err.code : "VOTE_FAILED",
          message: err instanceof Error ? err.message : "Failed to cast vote",
        }));
      }
      break;
    }

    case "SEND_CHAT": {
      const client = clients.get(clientId);
      const game = client?.gameId ? getGame(client.gameId) : null;
      if (!game) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: "NOT_IN_GAME",
          message: "You are not in a game",
        }));
        break;
      }
      // Only allow chat during DISCUSSION phase
      if (game.phase !== Phase.DISCUSSION && game.phase !== Phase.LOBBY) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: "CHAT_DISABLED",
          message: "Chat is only available during discussion",
        }));
        break;
      }
      const chatMsg = {
        id: uuidv4(),
        playerId: clientId,
        playerNickname: client?.nickname ?? "Unknown",
        content: event.payload.content.slice(0, 200),
        timestamp: Date.now(),
        phase: game.phase,
        isSystem: false,
      };
      game.chatMessages.push(chatMsg);
      broadcast(game.id, createServerEvent("CHAT_MESSAGE", chatMsg));
      break;
    }

    case "KILL_PLAYER": {
      try {
        const { killEvent } = executeKill(
          event.payload.gameId,
          clientId,
          event.payload.targetId,
        );
        // Kill is silent during night — only the killer sees confirmation
        // The engine will reveal deaths when night ends
        console.log(`[Game] Kill: ${killEvent.killerId} → ${killEvent.targetId}`);
      } catch (err) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: err instanceof RoundError ? err.code : "KILL_FAILED",
          message: err instanceof Error ? err.message : "Failed to kill",
        }));
      }
      break;
    }

    case "REPORT_BODY": {
      try {
        reportBody(event.payload.gameId, clientId, event.payload.bodyId);
        // Engine will handle phase transition via REPORT → DISCUSSION
      } catch (err) {
        sendTo(clientId, createServerEvent("ERROR", {
          code: err instanceof RoundError ? err.code : "REPORT_FAILED",
          message: err instanceof Error ? err.message : "Failed to report body",
        }));
      }
      break;
    }

    case "PLACE_BET": {
      // TODO: Implement bet placement logic (Step 3 — blockchain integration)
      console.log(`[Bet] Place bet on market ${event.payload.marketId}`);
      break;
    }

    case "LEAVE_GAME": {
      const client = clients.get(clientId);
      const game = removePlayer(event.payload.gameId, clientId);
      if (game) {
        broadcast(game.id, createServerEvent("PLAYER_LEFT", { playerId: clientId }));
        const lobby = toLobbyInfo(game);
        if (lobby && game.phase === Phase.LOBBY) {
          broadcast(game.id, createServerEvent("LOBBY_UPDATE", lobby));
        }
        // If no players left, destroy the game
        if (game.players.length === 0) {
          gameEngine.destroyGame(game.id);
        }
      }
      if (client) {
        client.gameId = undefined;
      }
      break;
    }

    default: {
      const _exhaustive: never = event;
      sendTo(clientId, createServerEvent("ERROR", {
        code: "UNKNOWN_EVENT",
        message: `Unknown event type`,
      }));
    }
  }
}

// ============================================
// Start Server
// ============================================

server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════╗
║           Prescio Game Server            ║
╠══════════════════════════════════════════╣
║  HTTP:  http://localhost:${config.port}            ║
║  WS:    ws://localhost:${config.port}              ║
║  ENV:   ${config.nodeEnv.padEnd(30)}  ║
╚══════════════════════════════════════════╝
  `);
});
