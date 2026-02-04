import type { GameState, Market, Bet, Odds, LobbyInfo, GameLanguage } from "@prescio/common";

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
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  round: number;
  createdAt: number;
}

export interface GamesResponse {
  games: GameListItem[];
  count: number;
}

export interface HistoryGame {
  id: string;
  code: string;
  winner: string | null;
  rounds: number;
  playerCount: number;
  finishedAt: number;
}

export interface HistoryResponse {
  games: HistoryGame[];
  total: number;
  limit: number;
  offset: number;
}

export function fetchGames(): Promise<GamesResponse> {
  return request<GamesResponse>("/games");
}

export function fetchHistory(limit = 50, offset = 0): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/history?limit=${limit}&offset=${offset}`);
}

export function fetchGame(id: string): Promise<GameState> {
  return request<GameState>(`/games/${id}`);
}

export interface CreateGameOptions {
  nickname?: string;
  botCount?: number;
  impostorCount?: number;
  language?: GameLanguage;
}

export interface CreateGameResponse {
  id: string;
  code: string;
  hostId: string;
  playerCount: number;
  bots: Array<{ id: string; nickname: string }>;
  phase: string;
  settings: Record<string, unknown>;
}

export function createGame(options: CreateGameOptions = {}): Promise<CreateGameResponse> {
  return request<CreateGameResponse>("/games", {
    method: "POST",
    body: JSON.stringify({
      nickname: options.nickname ?? "Spectator",
      botCount: options.botCount ?? 5,
      impostorCount: options.impostorCount ?? 1,
      settings: options.language ? { language: options.language } : undefined,
    }),
  });
}

export function startGame(gameId: string, hostId?: string): Promise<{ id: string; phase: string; round: number }> {
  return request(`/games/${gameId}/start`, {
    method: "POST",
    body: JSON.stringify({ hostId }),
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
