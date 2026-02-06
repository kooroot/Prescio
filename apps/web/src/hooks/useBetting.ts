import { useCallback, useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWalletClient, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, createPublicClient, http } from "viem";
import {
  PRESCIO_MARKET_ABI,
  monadMainnet,
  monadTestnet,
  MONAD_MAINNET_RPC,
  MONAD_TESTNET_RPC,
} from "@prescio/common";
import type { Odds, Bet, ServerEvent, ServerPayloads } from "@prescio/common";
import { fetchOdds, fetchBets } from "@/lib/api";
import { wsClient } from "@/lib/ws";
import { gameIdToBytes32 } from "./useContract";
import { useNetwork, getNetworkConfig } from "./useNetwork";

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
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (data) {
      setTotalPool(data.totalPool);
      setBettingEnabled(data.bettingEnabled);
    }
  }, [data]);

  useEffect(() => {
    if (!gameId) return;

    const unsub = wsClient.on((event: ServerEvent) => {
      if (event.type === "BETTING_UPDATE") {
        const payload = event.payload as ServerPayloads["BETTING_UPDATE"];
        if (payload.gameId === gameId) {
          setTotalPool(payload.totalPool);
          queryClient.setQueryData(
            ["odds", gameId],
            (prev: any) => {
              if (!prev) return { oddsMap: { [payload.marketId]: payload.odds }, bettingEnabled: true, totalPool: payload.totalPool };
              return { ...prev, oddsMap: { ...prev.oddsMap, [payload.marketId]: payload.odds }, totalPool: payload.totalPool };
            },
          );
        }
      }

      if (event.type === "PHASE_CHANGE") {
        queryClient.invalidateQueries({ queryKey: ["odds", gameId] });
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

export function usePlaceBet() {
  const { data: walletClient } = useWalletClient();
  const { contracts, isMainnet, chainId } = useNetwork();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const chain = isMainnet ? monadMainnet : monadTestnet;

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
          address: contracts.PRESCIO_MARKET,
          abi: PRESCIO_MARKET_ABI,
          functionName: "placeBet",
          args: [gameIdBytes, suspectIndex],
          value: parseEther(amountInEther),
          chain,
        });
        setTxHash(hash);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsPending(false);
      }
    },
    [walletClient, contracts, chain],
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
  const { contracts, isMainnet } = useNetwork();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const chain = isMainnet ? monadMainnet : monadTestnet;

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
        address: contracts.PRESCIO_MARKET,
        abi: PRESCIO_MARKET_ABI,
        functionName: "claim",
        args: [gameIdBytes],
        chain,
      });
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  }, [gameId, walletClient, contracts, chain]);

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
    refetchInterval: 10_000,
  });

  return {
    bets: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
