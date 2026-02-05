#!/usr/bin/env npx tsx
/**
 * Prescio CLI — Sub-agent utility for game interaction + on-chain betting
 * 
 * Usage:
 *   prescio-cli games                          List active games
 *   prescio-cli game <id>                      Game detail (players, phase, chat)
 *   prescio-cli create [botCount]              Create a new game (default 6 bots)
 *   prescio-cli start <gameId> <hostId>        Start a game
 *   prescio-cli odds <gameId>                  Get betting odds
 *   prescio-cli bet <gameId> <suspectIndex> <amount> <privateKey>   Place a bet
 *   prescio-cli claim <gameId> <privateKey>    Claim winnings
 *   prescio-cli balance <address>              Check MON balance
 *   prescio-cli history                        Finished games
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  encodePacked,
  keccak256,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
const PRESCIO_MARKET_ADDRESS = "0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F" as const;
const PRESCIO_MARKET_ABI = [
  { type: "function", name: "placeBet", inputs: [{ name: "gameId", type: "bytes32" }, { name: "suspectIndex", type: "uint8" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "claim", inputs: [{ name: "gameId", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getMarketInfo", inputs: [{ name: "gameId", type: "bytes32" }], outputs: [{ name: "playerCount", type: "uint8" }, { name: "state", type: "uint8" }, { name: "totalPool", type: "uint256" }, { name: "impostorIndex", type: "uint8" }, { name: "protocolFee", type: "uint256" }, { name: "outcomeTotals", type: "uint256[]" }], stateMutability: "view" },
] as const;

const API_BASE = process.env.PRESCIO_API ?? "http://localhost:3001/api";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});

// ─── Helpers ───────────────────────────────

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  return res.json();
}

function gameIdToBytes32(gameId: string): `0x${string}` {
  // Convert UUID to bytes32 by hashing
  const hex = gameId.replace(/-/g, "");
  if (hex.length === 32) {
    return `0x${hex.padEnd(64, "0")}` as `0x${string}`;
  }
  return keccak256(encodePacked(["string"], [gameId]));
}

function getPublicClient() {
  return createPublicClient({ chain: monadTestnet, transport: http() });
}

function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return { client: createWalletClient({ account, chain: monadTestnet, transport: http() }), account };
}

// ─── Commands ──────────────────────────────

async function listGames() {
  const data = await api("/games");
  console.log(JSON.stringify(data, null, 2));
}

async function gameDetail(id: string) {
  const data = await api(`/games/${id}`);
  console.log(JSON.stringify(data, null, 2));
}

async function createGame(botCount = 6) {
  const data = await api("/games", {
    method: "POST",
    body: JSON.stringify({ nickname: "Spectator", botCount }),
  });
  console.log(JSON.stringify(data, null, 2));
}

async function startGame(gameId: string, hostId: string) {
  const data = await api(`/games/${gameId}/start`, {
    method: "POST",
    body: JSON.stringify({ hostId }),
  });
  console.log(JSON.stringify(data, null, 2));
}

async function getOdds(gameId: string) {
  const data = await api(`/games/${gameId}/odds`);
  console.log(JSON.stringify(data, null, 2));
}

async function getBets(gameId: string, address?: string) {
  const q = address ? `?address=${address}` : "";
  const data = await api(`/games/${gameId}/bets${q}`);
  console.log(JSON.stringify(data, null, 2));
}

async function placeBet(gameId: string, suspectIndex: number, amount: string, privateKey: string) {
  const pub = getPublicClient();
  const { client, account } = getWalletClient(privateKey);
  const bytes32 = gameIdToBytes32(gameId);
  const value = parseEther(amount);

  console.log(`Placing bet: game=${gameId}, suspect=${suspectIndex}, amount=${amount} MON`);
  console.log(`From: ${account.address}`);

  try {
    const hash = await client.writeContract({
      address: PRESCIO_MARKET_ADDRESS as Address,
      abi: PRESCIO_MARKET_ABI,
      functionName: "placeBet",
      args: [bytes32, suspectIndex],
      value,
    });
    console.log(`✓ Bet placed! tx: ${hash}`);

    const receipt = await pub.waitForTransactionReceipt({ hash });
    console.log(`  Block: ${receipt.blockNumber}, Status: ${receipt.status}`);
  } catch (e: any) {
    console.error(`✗ Failed: ${e.shortMessage ?? e.message}`);
    process.exit(1);
  }
}

async function claimWinnings(gameId: string, privateKey: string) {
  const pub = getPublicClient();
  const { client, account } = getWalletClient(privateKey);
  const bytes32 = gameIdToBytes32(gameId);

  console.log(`Claiming winnings: game=${gameId}`);
  console.log(`From: ${account.address}`);

  try {
    const hash = await client.writeContract({
      address: PRESCIO_MARKET_ADDRESS as Address,
      abi: PRESCIO_MARKET_ABI,
      functionName: "claim",
      args: [bytes32],
    });
    console.log(`✓ Claimed! tx: ${hash}`);

    const receipt = await pub.waitForTransactionReceipt({ hash });
    console.log(`  Block: ${receipt.blockNumber}, Status: ${receipt.status}`);
  } catch (e: any) {
    console.error(`✗ Failed: ${e.shortMessage ?? e.message}`);
    process.exit(1);
  }
}

async function checkBalance(address: string) {
  const pub = getPublicClient();
  const balance = await pub.getBalance({ address: address as Address });
  console.log(`${address}: ${formatEther(balance)} MON`);
}

async function getHistory() {
  const data = await api("/history?limit=20");
  console.log(JSON.stringify(data, null, 2));
}

// ─── Main ──────────────────────────────────

async function main() {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case "games":
      return listGames();
    case "game":
      return gameDetail(args[0]);
    case "create":
      return createGame(Number(args[0]) || 6);
    case "start":
      return startGame(args[0], args[1]);
    case "odds":
      return getOdds(args[0]);
    case "bets":
      return getBets(args[0], args[1]);
    case "bet":
      return placeBet(args[0], Number(args[1]), args[2], args[3]);
    case "claim":
      return claimWinnings(args[0], args[1]);
    case "balance":
      return checkBalance(args[0]);
    case "history":
      return getHistory();
    default:
      console.log(`Usage: prescio-cli <command> [args]
Commands:
  games                                    List active games
  game <id>                                Game detail
  create [botCount]                        Create game (default 6 bots)
  start <gameId> <hostId>                  Start game
  odds <gameId>                            Betting odds
  bets <gameId> [address]                  Bet status
  bet <gameId> <suspectIdx> <amt> <key>    Place bet (on-chain)
  claim <gameId> <key>                     Claim winnings
  balance <address>                        MON balance
  history                                  Finished games`);
  }
}

main().catch(console.error);
