import { useQuery } from "@tanstack/react-query";
import { fetchGames, fetchHistory } from "@/lib/api";
import type { GameListItem, HistoryGame } from "@/lib/api";

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
    queryFn: async (): Promise<HistoryGame[]> => {
      const res = await fetchHistory(50);
      return res.games;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
