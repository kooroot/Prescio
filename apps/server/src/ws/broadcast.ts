/**
 * WebSocket Broadcast Utilities
 *
 * Manages connections per game (players + spectators) and provides
 * targeted broadcast functions.
 */
import { WebSocket } from "ws";
import {
  serializeEvent,
  createServerEvent,
  type ServerEvent,
} from "@prescio/common";

// ============================================
// Connection Types
// ============================================

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  address?: `0x${string}`;
  gameId?: string;
  nickname?: string;
  role: "player" | "spectator";
}

// ============================================
// Connection Registry
// ============================================

/** All connected clients by clientId */
const clients = new Map<string, ConnectedClient>();

/** Game → player client IDs */
const gamePlayers = new Map<string, Set<string>>();

/** Game → spectator client IDs */
const gameSpectators = new Map<string, Set<string>>();

// ============================================
// Registry Operations
// ============================================

export function registerClient(client: ConnectedClient): void {
  clients.set(client.id, client);
}

export function getClient(clientId: string): ConnectedClient | undefined {
  return clients.get(clientId);
}

export function getAllClients(): Map<string, ConnectedClient> {
  return clients;
}

export function removeClient(clientId: string): ConnectedClient | undefined {
  const client = clients.get(clientId);
  if (!client) return undefined;

  // Clean up from game tracking
  if (client.gameId) {
    if (client.role === "spectator") {
      removeSpectator(clientId, client.gameId);
    } else {
      removePlayerFromGame(clientId, client.gameId);
    }
  }

  clients.delete(clientId);
  return client;
}

// ============================================
// Player Management
// ============================================

export function addPlayerToGame(clientId: string, gameId: string): void {
  const client = clients.get(clientId);
  if (!client) return;

  client.gameId = gameId;
  client.role = "player";

  if (!gamePlayers.has(gameId)) {
    gamePlayers.set(gameId, new Set());
  }
  gamePlayers.get(gameId)!.add(clientId);
}

export function removePlayerFromGame(clientId: string, gameId: string): void {
  gamePlayers.get(gameId)?.delete(clientId);
  if (gamePlayers.get(gameId)?.size === 0) {
    gamePlayers.delete(gameId);
  }
}

// ============================================
// Spectator Management
// ============================================

export function addSpectator(clientId: string, gameId: string): void {
  const client = clients.get(clientId);
  if (!client) return;

  client.gameId = gameId;
  client.role = "spectator";

  if (!gameSpectators.has(gameId)) {
    gameSpectators.set(gameId, new Set());
  }
  gameSpectators.get(gameId)!.add(clientId);
}

export function removeSpectator(clientId: string, gameId: string): void {
  gameSpectators.get(gameId)?.delete(clientId);
  if (gameSpectators.get(gameId)?.size === 0) {
    gameSpectators.delete(gameId);
  }
}

export function getSpectatorCount(gameId: string): number {
  return gameSpectators.get(gameId)?.size ?? 0;
}

// ============================================
// Broadcast Functions
// ============================================

/** Send to a single client */
export function sendTo(clientId: string, event: ServerEvent): void {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(serializeEvent(event));
  }
}

/** Broadcast to ALL connections in a game (players + spectators) */
export function broadcastToGame(
  gameId: string,
  event: ServerEvent,
  excludeId?: string,
): void {
  const message = serializeEvent(event);

  const playerIds = gamePlayers.get(gameId);
  if (playerIds) {
    for (const id of playerIds) {
      if (id === excludeId) continue;
      const client = clients.get(id);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  const spectatorIds = gameSpectators.get(gameId);
  if (spectatorIds) {
    for (const id of spectatorIds) {
      if (id === excludeId) continue;
      const client = clients.get(id);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }
}

/** Broadcast to PLAYERS only in a game */
export function broadcastToPlayers(
  gameId: string,
  event: ServerEvent,
  excludeId?: string,
): void {
  const message = serializeEvent(event);
  const playerIds = gamePlayers.get(gameId);
  if (!playerIds) return;

  for (const id of playerIds) {
    if (id === excludeId) continue;
    const client = clients.get(id);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

/** Broadcast to SPECTATORS only in a game */
export function broadcastToSpectators(
  gameId: string,
  event: ServerEvent,
  excludeId?: string,
): void {
  const message = serializeEvent(event);
  const spectatorIds = gameSpectators.get(gameId);
  if (!spectatorIds) return;

  for (const id of spectatorIds) {
    if (id === excludeId) continue;
    const client = clients.get(id);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

/** Broadcast spectator count update to everyone in a game */
export function broadcastSpectatorCount(gameId: string): void {
  broadcastToGame(
    gameId,
    createServerEvent("SPECTATOR_COUNT", {
      gameId,
      count: getSpectatorCount(gameId),
    }),
  );
}

// ============================================
// Cleanup
// ============================================

/** Remove all connections for a game (when game is destroyed) */
export function cleanupGame(gameId: string): void {
  const playerIds = gamePlayers.get(gameId);
  if (playerIds) {
    for (const id of playerIds) {
      const client = clients.get(id);
      if (client) client.gameId = undefined;
    }
    gamePlayers.delete(gameId);
  }

  const spectatorIds = gameSpectators.get(gameId);
  if (spectatorIds) {
    for (const id of spectatorIds) {
      const client = clients.get(id);
      if (client) client.gameId = undefined;
    }
    gameSpectators.delete(gameId);
  }
}
