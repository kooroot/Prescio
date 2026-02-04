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
  updateGame,
  getActiveGames,
  gameEngine,
  LobbyError,
} from "../game/index.js";
import { agentManager } from "../agents/manager.js";
import { asyncHandler } from "./middleware.js";
import {
  getMarketInfo,
  getOdds,
  getUserBets,
  isBettingEnabled,
  isOnChainEnabled,
} from "../betting/index.js";
import { formatOdds } from "../betting/odds.js";
import { formatEther, type Address } from "viem";

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
// Finished Games Store (persisted to disk)
// ============================================
import { loadFinishedGames, appendFinishedGame, type FinishedGameRecord } from "../game/persistence.js";

const finishedGames: FinishedGameRecord[] = loadFinishedGames();
console.log(`[Persistence] Loaded ${finishedGames.length} finished games from disk`);

// Listen for game-over events to archive
gameEngine.on("gameOver", (gameId, winner, game) => {
  const record: FinishedGameRecord = {
    id: game.id,
    code: game.code,
    winner: winner.toString(),
    rounds: game.round,
    playerCount: game.players.length,
    players: game.players.map((p: any) => ({
      nickname: p.nickname,
      role: p.role ?? null,
      isAlive: p.isAlive,
    })),
    finishedAt: Date.now(),
  };
  finishedGames.push(record);
  appendFinishedGame(record);
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
      botCount = 6,
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
    // Ensure minPlayers allows bot-only games (host is spectator, not player)
    const totalPlayers = safeBotCount;
    settingsOverride.minPlayers = Math.min(totalPlayers, 2);

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

    // Remove host from players (spectator-only mode)
    // Host created the game but doesn't participate as a player
    const gameState = getGame(game.id);
    if (gameState) {
      gameState.players = gameState.players.filter((p) => p.id !== hostId);
      updateGame(gameState);
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
      address: p.address,
      isAlive: p.isAlive,
      isConnected: p.isConnected,
      avatar: p.avatar,
      role: game.winner ? p.role : null,
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
      votes: game.votes,
      chatMessages: game.chatMessages,
      killEvents: game.killEvents.map((ke) => ({
        killerId: "", // Don't expose killer to spectators
        targetId: ke.targetId,
        round: ke.round,
        timestamp: ke.timestamp,
      })),
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

      // Initialize AI agents with personalities
      agentManager.initializeAgents(startedGame);

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
// GET /api/games/:id/bets — On-chain betting status
// ------------------------------------------
apiRouter.get(
  "/games/:id/bets",
  asyncHandler(async (req, res) => {
    const gameId = String(req.params.id);
    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: { code: "GAME_NOT_FOUND", message: "Game not found" } });
      return;
    }

    if (!isOnChainEnabled()) {
      res.json({
        gameId: game.id,
        phase: game.phase,
        bettingEnabled: false,
        market: null,
        totalPool: "0",
        message: "On-chain betting not configured",
      });
      return;
    }

    const market = await getMarketInfo(gameId);
    const userAddress = req.query.address as string | undefined;
    let userBet = null;

    if (userAddress && market) {
      userBet = await getUserBets(gameId, userAddress as Address);
    }

    res.json({
      gameId: game.id,
      phase: game.phase,
      bettingEnabled: isBettingEnabled(gameId),
      market: market
        ? {
            state: market.state,
            playerCount: market.playerCount,
            totalPool: formatEther(market.totalPool),
            outcomeTotals: market.outcomeTotals.map((t) => formatEther(t)),
            impostorIndex: market.impostorIndex,
          }
        : null,
      userBet: userBet
        ? {
            suspectIndex: userBet.suspectIndex,
            amount: formatEther(userBet.amount),
            claimed: userBet.claimed,
          }
        : null,
    });
  })
);

// ------------------------------------------
// GET /api/games/:id/odds — Current betting odds
// ------------------------------------------
apiRouter.get(
  "/games/:id/odds",
  asyncHandler(async (req, res) => {
    const gameId = String(req.params.id);
    const game = getGame(gameId);
    if (!game) {
      res.status(404).json({ error: { code: "GAME_NOT_FOUND", message: "Game not found" } });
      return;
    }

    if (!isOnChainEnabled()) {
      res.json({
        gameId: game.id,
        bettingEnabled: false,
        odds: [],
        message: "On-chain betting not configured",
      });
      return;
    }

    const market = await getMarketInfo(gameId);
    const rawOdds = await getOdds(gameId);

    if (!market || !rawOdds) {
      res.json({
        gameId: game.id,
        bettingEnabled: false,
        odds: [],
        totalPool: "0",
      });
      return;
    }

    const formatted = formatOdds(rawOdds, market.outcomeTotals, market.totalPool);

    // Map odds to player names
    const oddsWithPlayers = formatted.map((o) => {
      const player = game.players[o.playerIndex];
      return {
        playerIndex: o.playerIndex,
        playerNickname: player?.nickname ?? `Player ${o.playerIndex}`,
        playerId: player?.id ?? null,
        decimal: o.decimal,
        impliedProbability: o.impliedProbability,
        totalStaked: o.totalStaked,
      };
    });

    res.json({
      gameId: game.id,
      bettingEnabled: isBettingEnabled(gameId),
      state: market.state,
      totalPool: formatEther(market.totalPool),
      odds: oddsWithPlayers,
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
