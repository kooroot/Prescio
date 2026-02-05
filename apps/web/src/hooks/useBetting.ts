import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWalletClient, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, createPublicClient, http, encodeFunctionData } from "viem";
import {
  CONTRACT_ADDRESSES,
  PRESCIO_MARKET_ABI,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC,
  monadTestnet,
} from "@prescio/common";
import type { Odds, Bet, ServerEvent, ServerPayloads } from "@prescio/common";
import { fetchOdds, fetchBets } from "@/lib/api";
import { wsClient } from "@/lib/ws";
import { gameIdToBytes32 } from "./useContract";

// ─── useOdds ────────────────────────────────────────

export interface OddsData {
  /** marketId -> Odds[] */
  oddsMap: Record<string, Odds[]>;
  totalPool: string;
}

export function useOdds(gameId: string) {
  const queryClient = useQueryClient();
  const [totalPool, setTotalPool] = useState("0");
  const [bettingEnabled, setBettingEnabled] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["odds", gameId],
    queryFn: () => fetchOdds(gameId),
    enabled: !!gameId,
    staleTime: 2_000,
    refetchInterval: 5_000, // Fallback, primary updates via WebSocket
  });

  // Update state from query data
  useEffect(() => {
    if (data) {
      setTotalPool(data.totalPool);
      setBettingEnabled(data.bettingEnabled);
    }
  }, [data]);

  // Subscribe to WS BETTING_UPDATE
  useEffect(() => {
    if (!gameId) return;

    const unsub = wsClient.on((event: ServerEvent) => {
      if (event.type === "BETTING_UPDATE") {
        const payload = event.payload as ServerPayloads["BETTING_UPDATE"];
        if (payload.gameId === gameId) {
          setTotalPool(payload.totalPool);
          // Update odds in query cache
          queryClient.setQueryData(
            ["odds", gameId],
            (prev: any) => {
              if (!prev) return { oddsMap: { [payload.marketId]: payload.odds }, bettingEnabled: true, totalPool: payload.totalPool };
              return { ...prev, oddsMap: { ...prev.oddsMap, [payload.marketId]: payload.odds }, totalPool: payload.totalPool };
            },
          );
        }
      }
    });

    return unsub;
  }, [gameId, queryClient]);

  return {
    oddsMap: data?.oddsMap ?? {},
    bettingEnabled,
    totalPool,
    isLoading,
    error,
  };
}

// ─── usePlaceBet ────────────────────────────────────

const monadPublicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_TESTNET_RPC),
});

export function usePlaceBet() {
  const { data: walletClient } = useWalletClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const reset = useCallback(() => {
    setTxHash(undefined);
    setError(null);
    setIsPending(false);
  }, []);

  const placeBet = useCallback(
    async (gameId: string, suspectIndex: number, amountInEther: string) => {
      if (!walletClient) return;
      setIsPending(true);
      setError(null);
      try {
        const gameIdBytes = gameIdToBytes32(gameId);
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
          abi: PRESCIO_MARKET_ABI,
          functionName: "placeBet",
          args: [gameIdBytes, suspectIndex],
          value: parseEther(amountInEther),
          chain: monadTestnet,
        });
        setTxHash(hash);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsPending(false);
      }
    },
    [walletClient],
  );

  return {
    placeBet,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ─── useClaim ───────────────────────────────────────

export function useClaim(gameId: string) {
  const { data: walletClient } = useWalletClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const reset = useCallback(() => {
    setTxHash(undefined);
    setError(null);
    setIsPending(false);
  }, []);

  const claim = useCallback(async () => {
    if (!walletClient) return;
    setIsPending(true);
    setError(null);
    try {
      const gameIdBytes = gameIdToBytes32(gameId);
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
        abi: PRESCIO_MARKET_ABI,
        functionName: "claim",
        args: [gameIdBytes],
        chain: monadTestnet,
      });
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  }, [gameId, walletClient]);

  return {
    claim,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// ─── useUserBets ────────────────────────────────────

export function useUserBets(gameId: string, address?: `0x${string}`) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["bets", gameId, address],
    queryFn: () => fetchBets(gameId, address),
    enabled: !!gameId && !!address,
    staleTime: 3_000,
    refetchInterval: 10_000, // User bets don't change as often
  });

  return {
    bets: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
