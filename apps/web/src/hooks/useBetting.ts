import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  CONTRACT_ADDRESSES,
  PRESCIO_MARKET_ABI,
  MONAD_TESTNET_CHAIN_ID,
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["odds", gameId],
    queryFn: () => fetchOdds(gameId),
    enabled: !!gameId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // Subscribe to WS BETTING_UPDATE
  useEffect(() => {
    if (!gameId) return;

    const unsub = wsClient.on((event: ServerEvent) => {
      if (event.type === "BETTING_UPDATE") {
        const payload = event.payload as ServerPayloads["BETTING_UPDATE"];
        if (payload.gameId === gameId) {
          setTotalPool(payload.totalPool);
          // Update odds in query cache
          queryClient.setQueryData<Record<string, Odds[]>>(
            ["odds", gameId],
            (prev) => {
              if (!prev) return { [payload.marketId]: payload.odds };
              return { ...prev, [payload.marketId]: payload.odds };
            },
          );
        }
      }
    });

    return unsub;
  }, [gameId, queryClient]);

  return {
    oddsMap: data ?? {},
    totalPool,
    isLoading,
    error,
  };
}

// ─── usePlaceBet ────────────────────────────────────

export function usePlaceBet() {
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const placeBet = useCallback(
    (gameId: string, suspectIndex: number, amountInEther: string) => {
      const gameIdBytes = gameIdToBytes32(gameId);
      writeContract({
        address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
        abi: PRESCIO_MARKET_ABI,
        functionName: "placeBet",
        args: [gameIdBytes, suspectIndex],
        value: parseEther(amountInEther),
        chainId: MONAD_TESTNET_CHAIN_ID,
      });
    },
    [writeContract],
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
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const claim = useCallback(() => {
    const gameIdBytes = gameIdToBytes32(gameId);
    writeContract({
      address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
      abi: PRESCIO_MARKET_ABI,
      functionName: "claim",
      args: [gameIdBytes],
      chainId: MONAD_TESTNET_CHAIN_ID,
    });
  }, [gameId, writeContract]);

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
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  return {
    bets: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
