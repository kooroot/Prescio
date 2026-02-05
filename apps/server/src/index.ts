import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import {
  parseEvent,
  createServerEvent,
  Phase,
  type ClientEvent,
} from "@prescio/common";
import {
  gameEngine,
  getGame,
  restoreGames,
} from "./game/index.js";
import { agentManager } from "./agents/manager.js";
import { apiRouter } from "./api/routes.js";
import { requestLogger, corsMiddleware, errorHandler } from "./api/middleware.js";
import { handleClientEvent } from "./ws/handler.js";
import {
  registerClient,
  removeClient,
  sendTo,
  broadcastToGame,
  broadcastToPlayers,
  type ConnectedClient,
} from "./ws/broadcast.js";
import { initOnChain, isOnChainEnabled, stopAllPolling, getOdds } from "./betting/index.js";
import { startOrchestrator, stopOrchestrator } from "./orchestrator.js";
import { processAutoBets, cleanupGame as cleanupAutoBetGame } from "./betting/user-agent.js";

// ============================================
// Express App
// ============================================

const app = express();

// Global middleware
app.use(corsMiddleware(config.corsOrigins));
app.use(express.json());
app.use(requestLogger());

// Disable caching for API responses
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.removeHeader("ETag");
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    env: config.nodeEnv,
  });
});

// REST API routes
app.use("/api", apiRouter);

// Legacy market endpoint
app.get("/api/markets", (_req, res) => {
  res.json({ markets: [] });
});

// Error handler (must be after routes)
app.use(errorHandler);

// ============================================
// HTTP Server
// ============================================

const server = createServer(app);

// ============================================
// WebSocket Server
// ============================================

const wss = new WebSocketServer({ server });

// ============================================
// Agent Manager — Wire up chat broadcast
// ============================================

agentManager.setOnChatMessage((gameId, chatMsg) => {
  broadcastToGame(gameId, createServerEvent("CHAT_MESSAGE", chatMsg));
});

agentManager.setOnVoteCast((gameId, voterId) => {
  broadcastToGame(gameId, createServerEvent("VOTE_CAST", {
    voterId,
    hasVoted: true,
  }));
});

// ============================================
// WebSocket Connection Handling
// ============================================

wss.on("connection", (ws) => {
  const clientId = uuidv4();
  const client: ConnectedClient = { id: clientId, ws, role: "player" };
  registerClient(client);

  console.log(`[WS] Client connected: ${clientId} (total: ${wss.clients.size})`);

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
    const disconnectedClient = removeClient(clientId);
    if (disconnectedClient?.gameId && disconnectedClient.role === "player") {
      broadcastToGame(
        disconnectedClient.gameId,
        createServerEvent("PLAYER_LEFT", { playerId: clientId }),
        clientId,
      );
    }
    console.log(`[WS] Client disconnected: ${clientId} (total: ${wss.clients.size})`);
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
  broadcastToGame(gameId, createServerEvent("PHASE_CHANGE", { phase, round, timeRemaining }));
  console.log(`[Engine] Game ${gameId} → ${phase} (round ${round})`);

  if (game && phase === Phase.REPORT) {
    const lastKill = game.killEvents[game.killEvents.length - 1];
    if (lastKill) {
      broadcastToGame(gameId, createServerEvent("PLAYER_KILLED", {
        playerId: lastKill.targetId,
        round: lastKill.round,
      }));
    }
  }

  // Process auto-bets during discussion phase
  if (game && phase === Phase.DISCUSSION) {
    // Fetch odds and trigger auto-bets asynchronously
    (async () => {
      try {
        const odds = await getOdds(gameId);
        if (odds && odds.length > 0) {
          // Convert bigint[] odds to Record<address, SimpleOdds>
          const oddsRecord: Record<string, { isImpostor: number; isInnocent: number }> = {};
          game.players.forEach((player, index) => {
            if (index < odds.length && odds[index]) {
              // Convert bigint to number (assuming 18 decimals)
              const oddsValue = Number(odds[index]) / 1e18;
              oddsRecord[player.address] = {
                isImpostor: oddsValue > 0 ? oddsValue : 2.0, // Default to 2.0 if invalid
                isInnocent: oddsValue > 0 ? 1 / oddsValue : 0.5,
              };
            }
          });

          await processAutoBets(
            gameId,
            game,
            oddsRecord,
            async (walletAddress, targetPlayer, amount) => {
              // For MVP, just log the decision (actual on-chain betting requires user signature)
              console.log(`[AutoBet] Would bet ${amount} on ${targetPlayer} for ${walletAddress}`);
              return { success: true, txHash: undefined };
            }
          );
        }
      } catch (err) {
        console.error(`[AutoBet] Error processing auto-bets for ${gameId}:`, err);
      }
    })();
  }
});

gameEngine.on("nightKills", (gameId, kills) => {
  for (const kill of kills) {
    broadcastToGame(gameId, createServerEvent("PLAYER_KILLED", {
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
  broadcastToGame(gameId, createServerEvent("VOTE_RESULT", {
    votes: voteCountMap,
    eliminatedId: result.eliminatedId,
    skipped: result.skipped,
  }));
  if (result.eliminatedId) {
    broadcastToGame(gameId, createServerEvent("PLAYER_ELIMINATED", {
      playerId: result.eliminatedId,
      voteCount: result.tally[result.eliminatedId] ?? 0,
    }));
  }
});

gameEngine.on("gameOver", (gameId, winner, game) => {
  const impostors = game.players
    .filter((p) => p.role?.toString() === "IMPOSTOR")
    .map((p) => p.id);
  broadcastToGame(gameId, createServerEvent("GAME_OVER", {
    winner: winner === "IMPOSTOR" ? "IMPOSTOR" : "CREW",
    impostors,
    rounds: game.round,
  }));
  console.log(`[Engine] Game ${gameId} OVER — winner: ${winner}`);

  // Cleanup auto-bet game tracking
  cleanupAutoBetGame(gameId);
});

gameEngine.on("engineError", (gameId, error) => {
  console.error(`[Engine] Error in game ${gameId}:`, error.message);
});

// ============================================
// Initialize On-Chain Betting
// ============================================

// ============================================
// Restore Persisted State
// ============================================
restoreGames();

const bettingEnabled = initOnChain();

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
║  Betting: ${(bettingEnabled ? "ENABLED ✓" : "DISABLED ✗").padEnd(28)}  ║
╚══════════════════════════════════════════╝
  `);

  // Start built-in orchestrator
  startOrchestrator();
});

// ============================================
// Graceful Shutdown
// ============================================

process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received — shutting down...");
  stopOrchestrator();
  stopAllPolling();
  server.close();
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received — shutting down...");
  stopOrchestrator();
  stopAllPolling();
  server.close();
});
