/**
 * Bot Betting Orchestrator
 * Automatically creates games, monitors active games, places bets with bot wallets,
 * and claims winnings when games end.
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
  {
    type: "function", name: "getMarketInfo",
    inputs: [{ name: "gameId", type: "bytes32" }],
    outputs: [
      { name: "playerCount", type: "uint8" },
      { name: "state", type: "uint8" },
      { name: "totalPool", type: "uint256" },
      { name: "impostorIndex", type: "uint8" },
      { name: "protocolFee", type: "uint256" },
    ],
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
  { name: "Shark", style: "Aggressive high-roller", betSize: () => (0.5 + Math.random() * 1.5).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.9 },
  { name: "Owl", style: "Analytical observer", betSize: () => (0.3 + Math.random() * 0.7).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.7 },
  { name: "Fox", style: "Contrarian", betSize: () => (0.4 + Math.random() * 0.8).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.8 },
  { name: "Whale", style: "Deep pockets", betSize: () => (1 + Math.random() * 2).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.5 },
  { name: "Rabbit", style: "Quick small bets", betSize: () => (0.1 + Math.random() * 0.3).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.95 },
  { name: "Turtle", style: "Conservative steady", betSize: () => (0.2 + Math.random() * 0.4).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.6 },
  { name: "Eagle", style: "Precision striker", betSize: () => (0.5 + Math.random() * 1).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.75 },
  { name: "Cat", style: "Curious and playful", betSize: () => (0.1 + Math.random() * 0.5).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.85 },
  { name: "Wolf", style: "Pack mentality", betSize: () => (0.3 + Math.random() * 0.7).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.8 },
  { name: "Phantom", style: "Unpredictable", betSize: () => (0.2 + Math.random() * 1).toFixed(2), strategy: (n) => Math.floor(Math.random() * n), betProbability: 0.65 },
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

// Track games we've already bet on
const bettedGames: Set<string> = new Set();
// Track games we've already claimed
const claimedGames: Set<string> = new Set();
// Track if we're currently creating a game (prevent duplicate creation)
let creatingGame = false;
// Minimum delay between game creations (5 minutes)
const GAME_CREATE_COOLDOWN = 5 * 60 * 1000;
let lastGameCreatedAt = 0;

async function placeBet(wallet: BotWallet, persona: BotPersona, gameId: string, suspectIndex: number, amount: string): Promise<Hash | null> {
  const { client } = getWalletClient(wallet.privateKey);
  try {
    const hash = await client.writeContract({
      address: MARKET_ADDRESS, abi: MARKET_ABI, functionName: "placeBet",
      args: [gameIdToBytes32(gameId), suspectIndex], value: parseEther(amount),
    });
    console.log(`  [Bet] ${persona.name} bet ${amount} MON on player #${suspectIndex} → ${hash.slice(0, 10)}...`);
    return hash;
  } catch (err: any) {
    console.warn(`  [Bet] ${persona.name} failed: ${err.message?.slice(0, 80)}`);
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
  } catch { /* expected for losers or no bet */ }
}

let running = false;
let wallets: BotWallet[] = [];

async function placeBetsOnGame(gameId: string, playerCount: number): Promise<number[]> {
  const bettors: number[] = [];
  
  for (let i = 0; i < wallets.length; i++) {
    const persona = personas[i];
    if (Math.random() > persona.betProbability) continue;
    
    const suspectIndex = persona.strategy(playerCount);
    const amount = persona.betSize();
    
    const hash = await placeBet(wallets[i], persona, gameId, suspectIndex, amount);
    if (hash) bettors.push(i);
    await sleep(1000 + Math.random() * 1000); // Random delay between bets
  }
  
  return bettors;
}

async function createNewGame(): Promise<string | null> {
  if (creatingGame) return null;
  if (Date.now() - lastGameCreatedAt < GAME_CREATE_COOLDOWN) {
    console.log("[Orchestrator] Cooldown active, skipping game creation");
    return null;
  }
  
  creatingGame = true;
  try {
    console.log("[Orchestrator] Creating new game...");
    
    const res = await fetch(`http://localhost:${config.port}/api/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: "Prescio Bot",
        botCount: 7,
        impostorCount: 1,
        language: "en",
      }),
    });
    
    if (!res.ok) {
      console.error(`[Orchestrator] Failed to create game: ${res.status}`);
      return null;
    }
    
    const data = await res.json() as { id: string; hostId: string; code: string };
    console.log(`[Orchestrator] Game created: ${data.code} (${data.id})`);
    
    // Auto-start the game
    await sleep(2000);
    const startRes = await fetch(`http://localhost:${config.port}/api/games/${data.id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: data.hostId }),
    });
    
    if (startRes.ok) {
      console.log(`[Orchestrator] Game ${data.code} started successfully`);
      lastGameCreatedAt = Date.now();
      return data.id;
    } else {
      console.error(`[Orchestrator] Failed to start game: ${startRes.status}`);
      return null;
    }
  } catch (err: any) {
    console.error(`[Orchestrator] Error creating game: ${err.message}`);
    return null;
  } finally {
    creatingGame = false;
  }
}

async function processActiveGames(): Promise<number> {
  try {
    // Get active games
    const res = await fetch(`http://localhost:${config.port}/api/games`);
    if (!res.ok) return 0;
    
    const data = await res.json() as any;
    const games = data.games || [];
    
    for (const game of games) {
      // Skip if already bet on this game
      if (bettedGames.has(game.id)) continue;
      
      // Only bet on games in DISCUSSION or REPORT phase (betting should be open)
      const bettablePhases = ["DISCUSSION", "REPORT", "VOTING"];
      if (!bettablePhases.includes(game.phase)) continue;
      
      console.log(`[Orchestrator] Found new game ${game.code} (${game.phase}) — placing bets`);
      
      const bettors = await placeBetsOnGame(game.id, game.playerCount);
      console.log(`[Orchestrator] ${bettors.length} bots placed bets on ${game.code}`);
      
      bettedGames.add(game.id);
    }
    
    return games.length;
  } catch (err: any) {
    console.error(`[Orchestrator] Error processing active games: ${err.message}`);
    return 0;
  }
}

async function processFinishedGames() {
  try {
    // Get finished games
    const res = await fetch(`http://localhost:${config.port}/api/games/finished?limit=20`);
    if (!res.ok) return;
    
    const data = await res.json() as any;
    const games = data.games || [];
    
    for (const game of games) {
      // Skip if already claimed or never bet
      if (claimedGames.has(game.id)) continue;
      if (!bettedGames.has(game.id)) continue;
      
      console.log(`[Orchestrator] Game ${game.code} finished — claiming winnings`);
      
      for (let i = 0; i < wallets.length; i++) {
        await claimWinnings(wallets[i], personas[i], game.id);
        await sleep(500);
      }
      
      claimedGames.add(game.id);
    }
  } catch (err: any) {
    // Ignore - endpoint might not exist
  }
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

  const walletData = JSON.parse(readFileSync(walletPath, "utf8"));
  wallets = walletData.wallets;
  running = true;

  console.log("[Orchestrator] Starting bot betting with 10 personas:");
  personas.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} — ${p.style}`));

  (async () => {
    // Initial delay to let server fully start
    await sleep(10000);
    console.log("[Orchestrator] Starting automated game creation + betting...");

    while (running) {
      try {
        const activeCount = await processActiveGames();
        await processFinishedGames();
        
        // If no active games, create a new one
        if (activeCount === 0) {
          console.log("[Orchestrator] No active games — creating new game");
          await createNewGame();
        }
        
        // Check every 15 seconds
        await sleep(15000);
      } catch (err: any) {
        console.error(`[Orchestrator] Error: ${err.message}`);
        await sleep(30000);
      }
    }
  })();
}

export function stopOrchestrator() {
  running = false;
}
