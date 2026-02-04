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
  type ClientEvent,
  type ServerEvent,
} from "@prescio/common";

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

// API routes placeholder
app.get("/api/games", (_req, res) => {
  res.json({ games: [] });
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
      // TODO: Implement game creation logic
      console.log(`[Game] Create game requested by ${event.payload.nickname}`);
      break;
    }

    case "JOIN_GAME": {
      // TODO: Implement join game logic
      console.log(`[Game] Join game ${event.payload.gameCode} by ${event.payload.nickname}`);
      break;
    }

    case "START_GAME": {
      // TODO: Implement start game logic
      console.log(`[Game] Start game ${event.payload.gameId}`);
      break;
    }

    case "CAST_VOTE": {
      // TODO: Implement vote logic
      console.log(`[Game] Vote in ${event.payload.gameId}: target ${event.payload.targetId}`);
      break;
    }

    case "SEND_CHAT": {
      // TODO: Implement chat logic
      console.log(`[Game] Chat in ${event.payload.gameId}: ${event.payload.content}`);
      break;
    }

    case "KILL_PLAYER": {
      // TODO: Implement kill logic
      console.log(`[Game] Kill in ${event.payload.gameId}: target ${event.payload.targetId}`);
      break;
    }

    case "REPORT_BODY": {
      // TODO: Implement report logic
      console.log(`[Game] Report in ${event.payload.gameId}: body ${event.payload.bodyId}`);
      break;
    }

    case "PLACE_BET": {
      // TODO: Implement bet placement logic
      console.log(`[Bet] Place bet on market ${event.payload.marketId}`);
      break;
    }

    case "LEAVE_GAME": {
      // TODO: Implement leave logic
      console.log(`[Game] Leave game ${event.payload.gameId}`);
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
