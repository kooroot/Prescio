/**
 * REST API Routes — Lobby system + game management
 */
import { Router, type Router as RouterType } from "express";
import { v4 as uuidv4 } from "uuid";
import { Phase } from "@prescio/common";
import {
  createGame,
  addPlayer,
  startGame as startGameLobby,
  getRoleAssignment,
  getGame,
  getActiveGames,
  gameEngine,
  LobbyError,
} from "../game/index.js";
import { asyncHandler } from "./middleware.js";

// ============================================
// Bot Name Pool
// ============================================

const BOT_NAMES = [
  "Agent-Alpha",
  "Agent-Bravo",
  "Agent-Charlie",
  "Agent-Delta",
  "Agent-Echo",
  "Agent-Foxtrot",
  "Agent-Golf",
  "Agent-Hotel",
  "Agent-India",
  "Agent-Juliet",
  "Agent-Kilo",
  "Agent-Lima",
  "Agent-Mike",
  "Agent-November",
  "Agent-Oscar",
  "Agent-Papa",
  "Agent-Quebec",
  "Agent-Romeo",
  "Agent-Sierra",
  "Agent-Tango",
];

/** Generate a deterministic bot wallet address */
function botAddress(index: number): `0x${string}` {
  const hex = index.toString(16).padStart(40, "0");
  return `0x${hex}` as `0x${string}`;
}

// ============================================
// Finished Games Store (in-memory)
// ============================================

const finishedGames: Array<{
  id: string;
  code: string;
  winner: string | null;
  rounds: number;
  playerCount: number;
  finishedAt: number;
}> = [];

// Listen for game-over events to archive
gameEngine.on("gameOver", (gameId, winner, game) => {
  finishedGames.push({
    id: game.id,
    code: game.code,
    winner: winner.toString(),
    rounds: game.round,
    playerCount: game.players.length,
    finishedAt: Date.now(),
  });
});

// ============================================
// Router
// ============================================

export const apiRouter: RouterType = Router();

// ------------------------------------------
// POST /api/games — Create a new game + bots
// ------------------------------------------
apiRouter.post(
  "/games",
  asyncHandler(async (req, res) => {
    const {
      nickname = "Host",
      address,
      botCount = 5,
      impostorCount,
      settings,
    } = req.body as {
      nickname?: string;
      address?: string;
      botCount?: number;
      impostorCount?: number;
      settings?: Record<string, unknown>;
    };

    // Validate
    const hostAddress = (address ?? `0x${uuidv4().replace(/-/g, "").slice(0, 40)}`) as `0x${string}`;
    const safeBotCount = Math.max(0, Math.min(botCount, BOT_NAMES.length));

    // Build settings override
    const settingsOverride: Record<string, unknown> = { ...settings };
    if (impostorCount !== undefined) {
      settingsOverride.impostorCount = impostorCount;
    }
    // Ensure minPlayers allows bot-only games
    const totalPlayers = 1 + safeBotCount;
    if (totalPlayers < 4) {
      settingsOverride.minPlayers = Math.max(totalPlayers, 2);
    }

    // Create game with a virtual host
    const hostId = uuidv4();
    let game;
    try {
      game = createGame(hostId, nickname, hostAddress, settingsOverride as any);
    } catch (err) {
      if (err instanceof LobbyError) {
        res.status(400).json({ error: { code: err.code, message: err.message } });
        return;
      }
      throw err;
    }

    // Auto-add bots
    const bots: Array<{ id: string; nickname: string }> = [];
    for (let i = 0; i < safeBotCount; i++) {
      const botId = uuidv4();
      const botNickname = BOT_NAMES[i];
      const botAddr = botAddress(i + 1);
      try {
        addPlayer(game.code, botId, botNickname, botAddr);
        bots.push({ id: botId, nickname: botNickname });
      } catch (err) {
        // If game full or other error, stop adding bots
        console.warn(`[API] Failed to add bot ${botNickname}:`, err instanceof Error ? err.message : err);
        break;
      }
    }

    // Re-fetch to get updated player list
    const updatedGame = getGame(game.id);

    res.status(201).json({
      id: game.id,
      code: game.code,
      hostId,
      playerCount: updatedGame?.players.length ?? 1,
      bots,
      phase: updatedGame?.phase ?? Phase.LOBBY,
      settings: updatedGame?.settings,
    });
  })
);

// ------------------------------------------
// GET /api/games — List active games
// ------------------------------------------
apiRouter.get(
  "/games",
  asyncHandler(async (_req, res) => {
    const games = getActiveGames().map((g) => ({
      id: g.id,
      code: g.code,
      hostId: g.hostId,
      playerCount: g.players.length,
      maxPlayers: g.settings.maxPlayers,
      phase: g.phase,
      round: g.round,
      createdAt: g.createdAt,
    }));

    res.json({ games, count: games.length });
  })
);

// ------------------------------------------
// GET /api/games/:id — Game detail
// ------------------------------------------
apiRouter.get(
  "/games/:id",
  asyncHandler(async (req, res) => {
    const game = getGame(String(req.params.id));
    if (!game) {
      res.status(404).json({ error: { code: "GAME_NOT_FOUND", message: "Game not found" } });
      return;
    }

    // Don't expose roles unless game is over
    const players = game.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isAlive: p.isAlive,
      isConnected: p.isConnected,
      avatar: p.avatar,
      ...(game.winner ? { role: p.role } : {}),
    }));

    res.json({
      id: game.id,
      code: game.code,
      hostId: game.hostId,
      phase: game.phase,
      round: game.round,
      players,
      playerCount: game.players.length,
      alivePlayers: game.alivePlayers,
      eliminatedPlayers: game.eliminatedPlayers,
      winner: game.winner,
      settings: game.settings,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    });
  })
);

// ------------------------------------------
// POST /api/games/:id/start — Start the game
// ------------------------------------------
apiRouter.post(
  "/games/:id/start",
  asyncHandler(async (req, res) => {
    const gameId = String(req.params.id);
    const { hostId } = req.body as { hostId?: string };

    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: { code: "GAME_NOT_FOUND", message: "Game not found" } });
      return;
    }

    // Use provided hostId or default to the game's host
    const requesterId = hostId ?? game.hostId;

    try {
      const startedGame = startGameLobby(gameId, requesterId);

      // Start the engine loop
      gameEngine.startLoop(startedGame.id);

      // Collect role assignments (for API response — normally sent via WS)
      const roles = startedGame.players.map((p) => {
        const assignment = getRoleAssignment(startedGame, p.id);
        return {
          id: p.id,
          nickname: p.nickname,
          role: assignment?.role ?? null,
        };
      });

      res.json({
        id: startedGame.id,
        phase: startedGame.phase,
        round: startedGame.round,
        players: roles,
        message: "Game started!",
      });
    } catch (err) {
      if (err instanceof LobbyError) {
        res.status(400).json({ error: { code: err.code, message: err.message } });
        return;
      }
      throw err;
    }
  })
);

// ------------------------------------------
// GET /api/games/:id/bets — Betting status (placeholder)
// ------------------------------------------
apiRouter.get(
  "/games/:id/bets",
  asyncHandler(async (req, res) => {
    const game = getGame(String(req.params.id));
    if (!game) {
      res.status(404).json({ error: { code: "GAME_NOT_FOUND", message: "Game not found" } });
      return;
    }

    // Placeholder — will be implemented with blockchain integration
    res.json({
      gameId: game.id,
      phase: game.phase,
      markets: [],
      totalPool: "0",
      message: "Betting system coming soon",
    });
  })
);

// ------------------------------------------
// GET /api/history — Finished games
// ------------------------------------------
apiRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(String(req.query.limit)) || 50, 100);
    const offset = Number(String(req.query.offset)) || 0;

    const slice = finishedGames
      .slice()
      .reverse()
      .slice(offset, offset + limit);

    res.json({
      games: slice,
      total: finishedGames.length,
      limit,
      offset,
    });
  })
);
