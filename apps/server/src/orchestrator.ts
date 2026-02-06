/**
 * Built-in Agent Orchestrator
 * Runs inside the server process — no extra memory overhead.
 * Creates games, places on-chain bets with bot wallets, claims winnings.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  keccak256,
  toHex,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { config } from "./config.js";

const MARKET_ADDRESS = config.contracts.market as Address;
const RPC_URL = config.monad.rpcUrl;

const MARKET_ABI = [
  {
    type: "function", name: "placeBet",
    inputs: [{ name: "gameId", type: "bytes32" }, { name: "suspectIndex", type: "uint8" }],
    outputs: [], stateMutability: "payable",
  },
  {
    type: "function", name: "claim",
    inputs: [{ name: "gameId", type: "bytes32" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getUserBets",
    inputs: [{ name: "gameId", type: "bytes32" }, { name: "user", type: "address" }],
    outputs: [{ name: "suspectIndex", type: "uint8" }, { name: "amount", type: "uint256" }, { name: "claimed", type: "bool" }],
    stateMutability: "view",
  },
] as const;

interface BotPersona {
  name: string;
  style: string;
  betSize: () => string;
  strategy: (n: number) => number;
  betProbability: number;
}

const personas: BotPersona[] = [
  { name: "Shark", style: "Aggressive high-roller", betSize: () => (1 + Math.random() * 4).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.9 },
  { name: "Owl", style: "Analytical observer", betSize: () => (0.5 + Math.random() * 1.5).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.7 },
  { name: "Fox", style: "Contrarian", betSize: () => (1 + Math.random() * 2).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.8 },
  { name: "Whale", style: "Deep pockets", betSize: () => (3 + Math.random() * 7).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.5 },
  { name: "Rabbit", style: "Quick small bets", betSize: () => (0.2 + Math.random() * 0.8).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.95 },
  { name: "Turtle", style: "Conservative steady", betSize: () => (0.3 + Math.random() * 0.7).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.6 },
  { name: "Eagle", style: "Precision striker", betSize: () => (1.5 + Math.random() * 2.5).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.75 },
  { name: "Cat", style: "Curious and playful", betSize: () => (0.1 + Math.random() * 3).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.85 },
  { name: "Wolf", style: "Pack mentality", betSize: () => (1 + Math.random() * 3).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.8 },
  { name: "Phantom", style: "Unpredictable", betSize: () => (0.5 + Math.random() * 5).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.65 },
];

interface BotWallet { name: string; address: string; privateKey: string; }

const monadChain = {
  id: config.monad.chainId,
  name: config.monad.chainId === 143 ? "Monad" : "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const publicClient = createPublicClient({ transport: http(RPC_URL) });

function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return { client: createWalletClient({ account, chain: monadChain, transport: http(RPC_URL) }), account };
}

function gameIdToBytes32(gameId: string): `0x${string}` {
  return keccak256(toHex(gameId));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function placeBet(wallet: BotWallet, persona: BotPersona, gameId: string, suspectIndex: number, amount: string): Promise<Hash | null> {
  const { client } = getWalletClient(wallet.privateKey);
  try {
    const hash = await client.writeContract({
      address: MARKET_ADDRESS, abi: MARKET_ABI, functionName: "placeBet",
      args: [gameIdToBytes32(gameId), suspectIndex], value: parseEther(amount),
    });
    console.log(`  [Bet] ${persona.name} bet ${amount} MON on #${suspectIndex} → ${hash.slice(0, 10)}...`);
    return hash;
  } catch (err: any) {
    console.warn(`  [Bet] ${persona.name} failed: ${err.message?.slice(0, 60)}`);
    return null;
  }
}

async function claimWinnings(wallet: BotWallet, persona: BotPersona, gameId: string): Promise<void> {
  const { client } = getWalletClient(wallet.privateKey);
  const gameIdBytes = gameIdToBytes32(gameId);
  try {
    const [, amount, claimed] = await publicClient.readContract({
      address: MARKET_ADDRESS, abi: MARKET_ABI, functionName: "getUserBets",
      args: [gameIdBytes, wallet.address as Address],
    });
    if (amount === 0n || claimed) return;
    const hash = await client.writeContract({
      address: MARKET_ADDRESS, abi: MARKET_ABI, functionName: "claim", args: [gameIdBytes],
    });
    console.log(`  [Claim] ${persona.name} claimed → ${hash.slice(0, 10)}...`);
  } catch { /* expected for losers */ }
}

let running = false;
let gameCount = 0;

async function runOneGame(wallets: BotWallet[]) {
  gameCount++;
  console.log(`\n[Orchestrator] Game #${gameCount} — ${new Date().toLocaleTimeString()}`);

  // Create game via internal API
  const res = await fetch(`http://localhost:${config.port}/api/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: "Orchestrator", botCount: 7, impostorCount: 1 }),
  });
  if (!res.ok) { console.error("[Orchestrator] Failed to create game"); return; }
  const game = await res.json() as any;
  console.log(`  Created ${game.id.slice(0, 8)}... (${game.bots.map((b: any) => b.nickname).join(", ")})`);

  // Start game
  await fetch(`http://localhost:${config.port}/api/games/${game.id}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostId: game.hostId }),
  });

  await sleep(3000);

  // Place bets
  const bettors: number[] = [];
  const gameState = await (await fetch(`http://localhost:${config.port}/api/games/${game.id}`)).json() as any;

  for (let i = 0; i < wallets.length; i++) {
    const persona = personas[i];
    if (Math.random() > persona.betProbability) continue;
    const hash = await placeBet(wallets[i], persona, game.id, persona.strategy(gameState.playerCount), persona.betSize());
    if (hash) bettors.push(i);
    await sleep(1500);
  }
  console.log(`  ${bettors.length} bets placed`);

  // Wait for game end
  const start = Date.now();
  while (Date.now() - start < 600_000) {
    const g = await (await fetch(`http://localhost:${config.port}/api/games/${game.id}`)).json() as any;
    if (g.winner) {
      console.log(`  Winner: ${g.winner}`);
      await sleep(5000);
      for (const idx of bettors) {
        await claimWinnings(wallets[idx], personas[idx], game.id);
        await sleep(1000);
      }
      return;
    }
    await sleep(5000);
  }
  console.error("  Timeout waiting for game end");
}

export function startOrchestrator() {
  // Find .bot-wallets.json — check cwd and monorepo root
  const candidates = [
    ".bot-wallets.json",
    "../../.bot-wallets.json",
    resolve(process.cwd(), "../../.bot-wallets.json"),
  ];
  let walletPath = candidates.find((p) => existsSync(p)) ?? ".bot-wallets.json";
  if (!existsSync(walletPath)) {
    console.log("[Orchestrator] No .bot-wallets.json found — skipping");
    return;
  }

  const wallets: BotWallet[] = JSON.parse(readFileSync(walletPath, "utf8")).wallets;
  running = true;

  console.log("[Orchestrator] Starting with 10 personas:");
  personas.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} — ${p.style}`));

  (async () => {
    // Initial delay to let server fully start
    await sleep(5000);

    while (running) {
      try {
        await runOneGame(wallets);
        const wait = 60_000 + Math.random() * 60_000;
        console.log(`[Orchestrator] Next game in ${Math.round(wait / 1000)}s...`);
        await sleep(wait);
      } catch (err: any) {
        console.error(`[Orchestrator] Error: ${err.message}`);
        await sleep(30_000);
      }
    }
  })();
}

export function stopOrchestrator() {
  running = false;
}
