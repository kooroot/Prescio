import { useQuery } from "@tanstack/react-query";
import { fetchGames, fetchHistory, fetchMyBets } from "@/lib/api";
import type { GameListItem, HistoryGame, MyBetGame } from "@/lib/api";

/**
 * Fetch active games with 5-second polling
 */
export function useActiveGames() {
  return useQuery({
    queryKey: ["games", "active"],
    queryFn: async (): Promise<GameListItem[]> => {
      const res = await fetchGames();
      return res.games;
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

/**
 * Fetch finished games with 10-second polling
 */
export function useFinishedGames() {
  return useQuery({
    queryKey: ["games", "history"],
    queryFn: async (): Promise<{ games: HistoryGame[]; total: number }> => {
      const res = await fetchHistory(50);
      return { games: res.games, total: res.total };
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

/**
 * Fetch games where the user has placed bets
 */
export function useMyBets(address?: string) {
  return useQuery({
    queryKey: ["games", "my-bets", address],
    queryFn: async (): Promise<{ bets: MyBetGame[]; total: number }> => {
      if (!address) return { bets: [], total: 0 };
      const res = await fetchMyBets(address);
      return { bets: res.bets, total: res.total };
    },
    enabled: !!address,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
