import type { GameState, Market, Bet, Odds, LobbyInfo } from "@prescio/common";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json();
}

// ─── Games ───────────────────────────────────────────

export interface GameListItem {
  id: string;
  code: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  createdAt: number;
}

export function fetchGames(): Promise<GameListItem[]> {
  return request<GameListItem[]>("/games");
}

export function fetchGame(id: string): Promise<GameState> {
  return request<GameState>(`/games/${id}`);
}

export function createGame(nickname: string): Promise<{ gameId: string; code: string }> {
  return request("/games", {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

export function startGame(gameId: string): Promise<{ success: boolean }> {
  return request(`/games/${gameId}/start`, {
    method: "POST",
  });
}

// ─── Betting ─────────────────────────────────────────

export function fetchMarkets(gameId: string): Promise<Market[]> {
  return request<Market[]>(`/games/${gameId}/markets`);
}

export function fetchOdds(gameId: string): Promise<Record<string, Odds[]>> {
  return request<Record<string, Odds[]>>(`/games/${gameId}/odds`);
}

export function fetchBets(gameId: string, address?: string): Promise<Bet[]> {
  const query = address ? `?address=${address}` : "";
  return request<Bet[]>(`/games/${gameId}/bets${query}`);
}

// ─── Lobby ───────────────────────────────────────────

export function fetchLobby(gameId: string): Promise<LobbyInfo> {
  return request<LobbyInfo>(`/games/${gameId}/lobby`);
}
