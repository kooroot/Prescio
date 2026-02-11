import type { GameState, Market, Bet, Odds, LobbyInfo, GameLanguage } from "@prescio/common";
import { BetStatus } from "@prescio/common";
import { parseEther } from "viem";

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
      nickname: options.nickname ?? "Host",
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

interface OddsResponse {
  gameId: string;
  bettingEnabled: boolean;
  state?: string;
  totalPool: string;
  odds: Array<{
    playerIndex: number;
    playerNickname: string;
    playerId: string | null;
    decimal: number;
    impliedProbability: number;
    totalStaked: string;
  }>;
}

export interface OddsResult {
  oddsMap: Record<string, Odds[]>;
  bettingEnabled: boolean;
  totalPool: string;
}

export async function fetchOdds(gameId: string): Promise<OddsResult> {
  const res = await request<OddsResponse>(`/games/${gameId}/odds`);
  
  // Convert server response to the expected format
  const odds: Odds[] = res.odds.map((o) => ({
    outcomeId: String(o.playerIndex),
    label: o.playerNickname,
    numerator: Math.round(o.impliedProbability * 100),
    denominator: 100,
    impliedProbability: o.impliedProbability,
    totalStaked: parseEther(o.totalStaked || "0"),
  }));
  
  return { 
    oddsMap: { [gameId]: odds },
    bettingEnabled: res.bettingEnabled,
    totalPool: res.totalPool,
  };
}

interface BetsResponse {
  gameId: string;
  phase: string;
  bettingEnabled: boolean;
  market: {
    state: number;
    playerCount: number;
    totalPool: string;
    outcomeTotals: string[];
    impostorIndex: number;
  } | null;
  userBet: {
    suspectIndex: number;
    amount: string;
    claimed: boolean;
  } | null;
}

export async function fetchBets(gameId: string, address?: string): Promise<Bet[]> {
  const query = address ? `?address=${address}` : "";
  const res = await request<BetsResponse>(`/games/${gameId}/bets${query}`);

  // Convert server response to Bet[] for the frontend
  if (!res.userBet) return [];

  const betAmountWei = BigInt(Math.floor(parseFloat(res.userBet.amount) * 1e18));
  
  // Calculate potential payout - fetch odds data which has accurate staking info
  let potentialPayout = 0n;
  try {
    const oddsRes = await request<OddsResponse>(`/games/${gameId}/odds`);
    if (oddsRes.odds && oddsRes.odds.length > 0) {
      // Calculate totalPool from individual stakes
      const totalPoolWei = oddsRes.odds.reduce((sum, o) => {
        return sum + parseEther(o.totalStaked || "0");
      }, 0n);
      
      const outcomeIndex = res.userBet.suspectIndex;
      const outcomeData = oddsRes.odds[outcomeIndex];
      if (outcomeData && totalPoolWei > 0n) {
        const outcomeTotalWei = parseEther(outcomeData.totalStaked || "0");
        if (outcomeTotalWei > 0n) {
          // payout = (betAmount / outcomeTotal) * totalPool * 0.95 (5% fee)
          potentialPayout = (betAmountWei * totalPoolWei * 95n) / (outcomeTotalWei * 100n);
        }
      }
    }
  } catch {
    // If odds fetch fails, potentialPayout stays 0
  }

  return [
    {
      id: `${gameId}-${address}`,
      marketId: gameId,
      userId: address ?? "",
      userAddress: (address ?? "0x0") as `0x${string}`,
      outcomeId: String(res.userBet.suspectIndex),
      amount: betAmountWei,
      potentialPayout,
      status: res.userBet.claimed ? BetStatus.CLAIMED : BetStatus.OPEN,
      txHash: null,
      createdAt: Date.now(),
      claimedAt: res.userBet.claimed ? Date.now() : null,
    } satisfies Bet,
  ];
}

// ─── Lobby ───────────────────────────────────────────

export function fetchLobby(gameId: string): Promise<LobbyInfo> {
  return request<LobbyInfo>(`/games/${gameId}/lobby`);
}

// ─── My Bets ─────────────────────────────────────────

export interface MyBetGame {
  gameId: string;
  code: string;
  phase: string;
  round: number;
  playerCount: number;
  bet: {
    suspectIndex: number;
    suspectNickname: string;
    amount: string;
    claimed: boolean;
    /** Whether the bet target was actually an impostor (only set for finished games) */
    suspectWasImpostor?: boolean;
  };
  winner: string | null;
  finishedAt: number | null;
}

export interface MyBetsResponse {
  bets: MyBetGame[];
  total: number;
}

export function fetchMyBets(address: string): Promise<MyBetsResponse> {
  return request<MyBetsResponse>(`/my-bets?address=${address}`);
}
