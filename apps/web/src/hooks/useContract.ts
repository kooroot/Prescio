import { useReadContract } from "wagmi";
import { keccak256, toHex, formatEther } from "viem";
import {
  CONTRACT_ADDRESSES,
  PRESCIO_MARKET_ABI,
  MONAD_TESTNET_CHAIN_ID,
} from "@prescio/common";

/** Convert a gameId string to a bytes32 hash the contract expects */
export function gameIdToBytes32(gameId: string): `0x${string}` {
  return keccak256(toHex(gameId));
}

/** Market state enum matching the contract */
export enum ContractMarketState {
  NONE = 0,
  OPEN = 1,
  CLOSED = 2,
  RESOLVED = 3,
}

export interface MarketInfo {
  playerCount: number;
  state: ContractMarketState;
  totalPool: bigint;
  totalPoolFormatted: string;
  impostorIndex: number;
  protocolFee: bigint;
  outcomeTotals: readonly bigint[];
}

/**
 * Read on-chain market info for a game.
 */
export function useMarketInfo(gameId: string | undefined) {
  const gameIdBytes = gameId ? gameIdToBytes32(gameId) : undefined;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
    abi: PRESCIO_MARKET_ABI,
    functionName: "getMarketInfo",
    args: gameIdBytes ? [gameIdBytes] : undefined,
    chainId: MONAD_TESTNET_CHAIN_ID,
    query: {
      enabled: !!gameIdBytes,
      refetchInterval: 15_000,
    },
  });

  const marketInfo: MarketInfo | undefined = data
    ? {
        playerCount: data[0],
        state: data[1] as ContractMarketState,
        totalPool: data[2],
        totalPoolFormatted: formatEther(data[2]),
        impostorIndex: data[3],
        protocolFee: data[4],
        outcomeTotals: data[5],
      }
    : undefined;

  return { marketInfo, isLoading, error, refetch };
}

/**
 * Read on-chain odds for a game.
 */
export function useOnChainOdds(gameId: string | undefined) {
  const gameIdBytes = gameId ? gameIdToBytes32(gameId) : undefined;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
    abi: PRESCIO_MARKET_ABI,
    functionName: "getOdds",
    args: gameIdBytes ? [gameIdBytes] : undefined,
    chainId: MONAD_TESTNET_CHAIN_ID,
    query: {
      enabled: !!gameIdBytes,
      refetchInterval: 15_000,
    },
  });

  return { odds: data, isLoading, error, refetch };
}

/**
 * Read on-chain user bet info for a game.
 */
export function useOnChainUserBet(
  gameId: string | undefined,
  userAddress: `0x${string}` | undefined,
) {
  const gameIdBytes = gameId ? gameIdToBytes32(gameId) : undefined;

  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.PRESCIO_MARKET,
    abi: PRESCIO_MARKET_ABI,
    functionName: "getUserBets",
    args: gameIdBytes && userAddress ? [gameIdBytes, userAddress] : undefined,
    chainId: MONAD_TESTNET_CHAIN_ID,
    query: {
      enabled: !!gameIdBytes && !!userAddress,
      refetchInterval: 15_000,
    },
  });

  const userBet = data
    ? {
        suspectIndex: data[0],
        amount: data[1],
        amountFormatted: formatEther(data[1]),
        claimed: data[2],
      }
    : undefined;

  return { userBet, isLoading, error, refetch };
}
