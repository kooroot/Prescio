/**
 * Lobby Management — Create, join, start games
 */
import { v4 as uuidv4 } from "uuid";
import {
  Phase,
  Role,
  generateGameCode,
  getImpostorCount,
  DEFAULT_GAME_SETTINGS,
  type GameState,
  type GameSettings,
  type Player,
} from "@prescio/common";
import { getGame, getGameByCode, updateGame } from "./state.js";

// ============================================
// Errors
// ============================================

export class LobbyError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "LobbyError";
  }
}

// ============================================
// Create Game
// ============================================

export function createGame(
  hostId: string,
  nickname: string,
  address: `0x${string}`,
  settingsOverride?: Partial<GameSettings>,
): GameState {
  const gameId = uuidv4();
  let code = generateGameCode();

  // Ensure code uniqueness
  let attempts = 0;
  while (getGameByCode(code) && attempts < 10) {
    code = generateGameCode();
    attempts++;
  }
  if (getGameByCode(code)) {
    throw new LobbyError("CODE_COLLISION", "Failed to generate unique game code");
  }

  const settings: GameSettings = {
    ...DEFAULT_GAME_SETTINGS,
    ...settingsOverride,
  };

  const host: Player = {
    id: hostId,
    address,
    nickname,
    role: null,
    isAlive: true,
    isConnected: true,
  };

  const now = Date.now();
  const game: GameState = {
    id: gameId,
    code,
    hostId,
    players: [host],
    phase: Phase.LOBBY,
    round: 0,
    votes: [],
    chatMessages: [],
    killEvents: [],
    alivePlayers: [hostId],
    eliminatedPlayers: [],
    winner: null,
    createdAt: now,
    updatedAt: now,
    settings,
  };

  updateGame(game);
  return game;
}

// ============================================
// Add Player (Join)
// ============================================

export function addPlayer(
  gameCode: string,
  playerId: string,
  nickname: string,
  address: `0x${string}`,
): GameState {
  const game = getGameByCode(gameCode);
  if (!game) {
    throw new LobbyError("GAME_NOT_FOUND", `No game with code ${gameCode}`);
  }

  if (game.phase !== Phase.LOBBY) {
    throw new LobbyError("GAME_STARTED", "Game has already started");
  }

  if (game.players.length >= game.settings.maxPlayers) {
    throw new LobbyError("GAME_FULL", "Game is full");
  }

  // Check duplicate address
  if (game.players.some((p) => p.address === address)) {
    throw new LobbyError("ALREADY_JOINED", "This address has already joined");
  }

  // Check duplicate nickname in this game
  if (game.players.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
    throw new LobbyError("NICKNAME_TAKEN", "Nickname is already taken in this game");
  }

  const player: Player = {
    id: playerId,
    address,
    nickname,
    role: null,
    isAlive: true,
    isConnected: true,
  };

  game.players.push(player);
  game.alivePlayers.push(playerId);
  updateGame(game);
  return game;
}

// ============================================
// Remove Player (Leave)
// ============================================

export function removePlayer(gameId: string, playerId: string): GameState | null {
  const game = getGame(gameId);
  if (!game) return null;

  const playerIndex = game.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return game;

  if (game.phase === Phase.LOBBY) {
    // In lobby, fully remove the player
    game.players.splice(playerIndex, 1);
    game.alivePlayers = game.alivePlayers.filter((id) => id !== playerId);

    // Transfer host if the host left
    if (game.hostId === playerId && game.players.length > 0) {
      game.hostId = game.players[0].id;
    }
  } else {
    // During game, mark as disconnected
    game.players[playerIndex].isConnected = false;
  }

  updateGame(game);
  return game;
}

// ============================================
// Start Game — Assign Roles
// ============================================

export function startGame(gameId: string, requesterId: string): GameState {
  const game = getGame(gameId);
  if (!game) {
    throw new LobbyError("GAME_NOT_FOUND", "Game not found");
  }

  if (game.hostId !== requesterId) {
    throw new LobbyError("NOT_HOST", "Only the host can start the game");
  }

  if (game.phase !== Phase.LOBBY) {
    throw new LobbyError("ALREADY_STARTED", "Game has already started");
  }

  if (game.players.length < game.settings.minPlayers) {
    throw new LobbyError(
      "NOT_ENOUGH_PLAYERS",
      `Need at least ${game.settings.minPlayers} players (have ${game.players.length})`,
    );
  }

  // Determine impostor count based on player count
  const impostorCount = getImpostorCount(game.players.length);
  game.settings.impostorCount = impostorCount;

  // Shuffle and assign roles
  const shuffled = [...game.players].sort(() => Math.random() - 0.5);
  const impostorIds = new Set(shuffled.slice(0, impostorCount).map((p) => p.id));

  for (const player of game.players) {
    player.role = impostorIds.has(player.id) ? Role.IMPOSTOR : Role.CREW;
  }

  // Transition to NIGHT phase
  game.phase = Phase.NIGHT;
  game.round = 1;

  updateGame(game);
  return game;
}

// ============================================
// Get role assignments (for emitting to each player)
// ============================================

export function getRoleAssignment(
  game: GameState,
  playerId: string,
): { role: Role; teammates?: string[] } | null {
  const player = game.players.find((p) => p.id === playerId);
  if (!player || !player.role) return null;

  if (player.role === Role.IMPOSTOR) {
    const teammates = game.players
      .filter((p) => p.role === Role.IMPOSTOR && p.id !== playerId)
      .map((p) => p.id);
    return { role: player.role, teammates };
  }

  return { role: player.role };
}
