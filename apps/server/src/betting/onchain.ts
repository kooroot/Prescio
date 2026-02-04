/**
 * OnChain — viem-based interaction with PrescioMarket contract on Monad
 *
 * All write functions are owner-only (server wallet).
 * Graceful error handling: failures are logged but don't crash the server.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  keccak256,
  toHex,
  padHex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { monadTestnet } from "@prescio/common";
import { PRESCIO_MARKET_ABI } from "@prescio/common";
import { config } from "../config.js";

// ============================================
// Types
// ============================================

export interface OnChainMarketInfo {
  playerCount: number;
  state: number; // 0=OPEN, 1=CLOSED, 2=RESOLVED
  totalPool: bigint;
  impostorIndex: number;
  protocolFee: bigint;
  outcomeTotals: bigint[];
}

export interface OnChainUserBet {
  suspectIndex: number;
  amount: bigint;
  claimed: boolean;
}

// ============================================
// Client Setup
// ============================================

let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;
let serverAccount: PrivateKeyAccount | null = null;
let contractAddress: Address | null = null;
let initialized = false;

/**
 * Initialize viem clients. Call once at startup.
 * Returns false if required env vars are missing (betting disabled).
 */
export function initOnChain(): boolean {
  const privateKey = process.env.SERVER_PRIVATE_KEY;
  const marketAddress = config.contracts.market;

  if (!privateKey) {
    console.warn("[OnChain] SERVER_PRIVATE_KEY not set — betting disabled");
    return false;
  }

  if (!marketAddress || marketAddress === "0x0000000000000000000000000000000000000000") {
    console.warn("[OnChain] PRESCIO_MARKET_ADDRESS not set — betting disabled");
    return false;
  }

  try {
    serverAccount = privateKeyToAccount(privateKey as `0x${string}`);
    contractAddress = marketAddress;

    publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(config.monad.rpcUrl),
    });

    walletClient = createWalletClient({
      account: serverAccount,
      chain: monadTestnet,
      transport: http(config.monad.rpcUrl),
    });

    initialized = true;
    console.log(`[OnChain] Initialized — server wallet: ${serverAccount.address}`);
    console.log(`[OnChain] Contract: ${contractAddress}`);
    return true;
  } catch (err) {
    console.error("[OnChain] Failed to initialize:", err instanceof Error ? err.message : err);
    return false;
  }
}

export function isOnChainEnabled(): boolean {
  return initialized;
}

// ============================================
// Helpers
// ============================================

/**
 * Convert a game ID string to bytes32 for the contract.
 * Uses keccak256 of the game ID.
 */
export function gameIdToBytes32(gameId: string): `0x${string}` {
  return keccak256(toHex(gameId));
}

function ensureReady(): { pub: PublicClient; wallet: WalletClient; account: PrivateKeyAccount; addr: Address } {
  if (!initialized || !publicClient || !walletClient || !serverAccount || !contractAddress) {
    throw new Error("OnChain not initialized");
  }
  return { pub: publicClient, wallet: walletClient, account: serverAccount, addr: contractAddress };
}

// ============================================
// Write Functions (Owner only)
// ============================================

/**
 * Create a market for a game on-chain.
 */
export async function createMarket(gameId: string, playerCount: number): Promise<Hash | null> {
  try {
    const { pub, wallet, account, addr } = ensureReady();
    const gameIdBytes = gameIdToBytes32(gameId);

    const hash = await wallet.writeContract({
      address: addr,
      abi: PRESCIO_MARKET_ABI,
      functionName: "createMarket",
      args: [gameIdBytes, playerCount],
      account,
      chain: monadTestnet,
    });

    console.log(`[OnChain] createMarket tx sent: ${hash} (game: ${gameId}, players: ${playerCount})`);

    // Wait for receipt (don't block too long)
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    console.log(`[OnChain] createMarket confirmed: block ${receipt.blockNumber}, status: ${receipt.status}`);

    return hash;
  } catch (err) {
    console.error(`[OnChain] createMarket failed for game ${gameId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Close betting for a market (no more bets accepted).
 */
export async function closeMarket(gameId: string): Promise<Hash | null> {
  try {
    const { pub, wallet, account, addr } = ensureReady();
    const gameIdBytes = gameIdToBytes32(gameId);

    const hash = await wallet.writeContract({
      address: addr,
      abi: PRESCIO_MARKET_ABI,
      functionName: "closeMarket",
      args: [gameIdBytes],
      account,
      chain: monadTestnet,
    });

    console.log(`[OnChain] closeMarket tx sent: ${hash} (game: ${gameId})`);

    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    console.log(`[OnChain] closeMarket confirmed: block ${receipt.blockNumber}, status: ${receipt.status}`);

    return hash;
  } catch (err) {
    console.error(`[OnChain] closeMarket failed for game ${gameId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Resolve a market with the impostor index.
 */
export async function resolveMarket(gameId: string, impostorIndex: number): Promise<Hash | null> {
  try {
    const { pub, wallet, account, addr } = ensureReady();
    const gameIdBytes = gameIdToBytes32(gameId);

    const hash = await wallet.writeContract({
      address: addr,
      abi: PRESCIO_MARKET_ABI,
      functionName: "resolve",
      args: [gameIdBytes, impostorIndex],
      account,
      chain: monadTestnet,
    });

    console.log(`[OnChain] resolveMarket tx sent: ${hash} (game: ${gameId}, impostor: ${impostorIndex})`);

    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
    console.log(`[OnChain] resolveMarket confirmed: block ${receipt.blockNumber}, status: ${receipt.status}`);

    return hash;
  } catch (err) {
    console.error(`[OnChain] resolveMarket failed for game ${gameId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================
// Read Functions
// ============================================

/**
 * Get market info from the contract.
 */
export async function getMarketInfo(gameId: string): Promise<OnChainMarketInfo | null> {
  try {
    const { pub, addr } = ensureReady();
    const gameIdBytes = gameIdToBytes32(gameId);

    const result = await pub.readContract({
      address: addr,
      abi: PRESCIO_MARKET_ABI,
      functionName: "getMarketInfo",
      args: [gameIdBytes],
    }) as [number, number, bigint, number, bigint, bigint[]];

    return {
      playerCount: result[0],
      state: result[1],
      totalPool: result[2],
      impostorIndex: result[3],
      protocolFee: result[4],
      outcomeTotals: result[5],
    };
  } catch (err) {
    console.error(`[OnChain] getMarketInfo failed for game ${gameId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get odds for each outcome from the contract.
 * Returns odds multiplied by 10000 (e.g., 20000 = 2.0x).
 */
export async function getOdds(gameId: string): Promise<bigint[] | null> {
  try {
    const { pub, addr } = ensureReady();
    const gameIdBytes = gameIdToBytes32(gameId);

    const result = await pub.readContract({
      address: addr,
      abi: PRESCIO_MARKET_ABI,
      functionName: "getOdds",
      args: [gameIdBytes],
    }) as bigint[];

    return result;
  } catch (err) {
    console.error(`[OnChain] getOdds failed for game ${gameId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get a user's bet for a specific game.
 */
export async function getUserBets(gameId: string, userAddress: Address): Promise<OnChainUserBet | null> {
  try {
    const { pub, addr } = ensureReady();
    const gameIdBytes = gameIdToBytes32(gameId);

    const result = await pub.readContract({
      address: addr,
      abi: PRESCIO_MARKET_ABI,
      functionName: "getUserBets",
      args: [gameIdBytes, userAddress],
    }) as [number, bigint, boolean];

    // If amount is 0, user hasn't bet
    if (result[1] === 0n) return null;

    return {
      suspectIndex: result[0],
      amount: result[1],
      claimed: result[2],
    };
  } catch (err) {
    console.error(`[OnChain] getUserBets failed for game ${gameId}, user ${userAddress}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
