/**
 * Prescio Sub-Agent Orchestrator
 * 
 * Autonomously creates games, places on-chain bets with bot wallets,
 * and claims winnings. Runs in a continuous loop.
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
import { readFileSync } from "fs";

// ── Config ──────────────────────────────────────────
const API_BASE = "http://localhost:3001/api";
const RPC_URL = "https://testnet-rpc.monad.xyz";
const CHAIN_ID = 10143;
const MARKET_ADDRESS = "0xdCFd12C4797428E31AbA42C9c4Ca87339c3170De" as Address;

const MARKET_ABI = [
  {
    type: "function", name: "placeBet",
    inputs: [
      { name: "gameId", type: "bytes32" },
      { name: "suspectIndex", type: "uint8" },
    ],
    outputs: [], stateMutability: "payable",
  },
  {
    type: "function", name: "claim",
    inputs: [{ name: "gameId", type: "bytes32" }],
    outputs: [], stateMutability: "nonpayable",
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
      { name: "outcomeTotals", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "getUserBets",
    inputs: [
      { name: "gameId", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "suspectIndex", type: "uint8" },
      { name: "amount", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

// ── Persona definitions ─────────────────────────────
interface BotPersona {
  name: string;
  style: string;
  betSize: () => string; // MON amount
  strategy: (playerCount: number) => number; // returns suspectIndex
  betProbability: number; // 0-1, chance of betting each game
}

const personas: BotPersona[] = [
  {
    name: "Shark",
    style: "Aggressive high-roller, bets big on gut feeling",
    betSize: () => (1 + Math.random() * 4).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.9,
  },
  {
    name: "Owl",
    style: "Analytical, waits and watches patterns",
    betSize: () => (0.5 + Math.random() * 1.5).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.7,
  },
  {
    name: "Fox",
    style: "Contrarian, bets against the crowd",
    betSize: () => (1 + Math.random() * 2).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.8,
  },
  {
    name: "Whale",
    style: "Deep pockets, huge bets but selective",
    betSize: () => (3 + Math.random() * 7).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.5,
  },
  {
    name: "Rabbit",
    style: "Quick small bets, high frequency",
    betSize: () => (0.2 + Math.random() * 0.8).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.95,
  },
  {
    name: "Turtle",
    style: "Conservative, small steady bets",
    betSize: () => (0.3 + Math.random() * 0.7).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.6,
  },
  {
    name: "Eagle",
    style: "Precision striker, medium bets with confidence",
    betSize: () => (1.5 + Math.random() * 2.5).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.75,
  },
  {
    name: "Cat",
    style: "Curious and playful, random amounts",
    betSize: () => (0.1 + Math.random() * 3).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.85,
  },
  {
    name: "Wolf",
    style: "Pack mentality, follows the trend",
    betSize: () => (1 + Math.random() * 3).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.8,
  },
  {
    name: "Phantom",
    style: "Mysterious, unpredictable bet sizes and timing",
    betSize: () => (0.5 + Math.random() * 5).toFixed(2),
    strategy: (n) => Math.floor(Math.random() * n),
    betProbability: 0.65,
  },
];

// ── Load wallets ────────────────────────────────────
interface BotWallet {
  name: string;
  address: string;
  privateKey: string;
}

const walletsData = JSON.parse(readFileSync(".bot-wallets.json", "utf8"));
const wallets: BotWallet[] = walletsData.wallets;

// ── Viem clients ────────────────────────────────────
const monadChain = {
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return {
    client: createWalletClient({
      account,
      chain: monadChain,
      transport: http(RPC_URL),
    }),
    account,
  };
}

function gameIdToBytes32(gameId: string): `0x${string}` {
  return keccak256(toHex(gameId));
}

// ── API helpers ─────────────────────────────────────
async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} ${res.status}: ${body}`);
  }
  return res.json();
}

async function createGame(): Promise<{ id: string; code: string; hostId: string; bots: Array<{ id: string; nickname: string }> }> {
  return api("/games", {
    method: "POST",
    body: JSON.stringify({ nickname: "Orchestrator", botCount: 7, impostorCount: 1 }),
  });
}

async function startGame(gameId: string, hostId: string) {
  return api(`/games/${gameId}/start`, {
    method: "POST",
    body: JSON.stringify({ hostId }),
  });
}

async function getGameState(gameId: string) {
  return api(`/games/${gameId}`);
}

async function getGames() {
  return api("/games");
}

// ── Betting helpers ─────────────────────────────────
async function placeBet(
  walletIdx: number,
  gameId: string,
  suspectIndex: number,
  amount: string
): Promise<Hash | null> {
  const wallet = wallets[walletIdx];
  const persona = personas[walletIdx];
  const { client, account } = getWalletClient(wallet.privateKey);
  const gameIdBytes = gameIdToBytes32(gameId);

  try {
    const hash = await client.writeContract({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI,
      functionName: "placeBet",
      args: [gameIdBytes, suspectIndex],
      value: parseEther(amount),
    });
    console.log(`  🎲 ${persona.name} bet ${amount} MON on player #${suspectIndex} → ${hash.slice(0, 10)}...`);
    return hash;
  } catch (err: any) {
    console.warn(`  ⚠️  ${persona.name} bet failed: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

async function claimWinnings(
  walletIdx: number,
  gameId: string
): Promise<Hash | null> {
  const wallet = wallets[walletIdx];
  const persona = personas[walletIdx];
  const { client } = getWalletClient(wallet.privateKey);
  const gameIdBytes = gameIdToBytes32(gameId);

  try {
    // Check if has unclaimed bet
    const [suspectIndex, amount, claimed] = await publicClient.readContract({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI,
      functionName: "getUserBets",
      args: [gameIdBytes, wallet.address as Address],
    });
    
    if (amount === 0n || claimed) return null;

    const hash = await client.writeContract({
      address: MARKET_ADDRESS,
      abi: MARKET_ABI,
      functionName: "claim",
      args: [gameIdBytes],
    });
    console.log(`  💰 ${persona.name} claimed winnings → ${hash.slice(0, 10)}...`);
    return hash;
  } catch (err: any) {
    // Claim fails if they didn't win — that's expected
    if (!err.message?.includes("not winner") && !err.message?.includes("already claimed")) {
      console.warn(`  ⚠️  ${persona.name} claim failed: ${err.message?.slice(0, 80)}`);
    }
    return null;
  }
}

// ── Orchestrator loop ───────────────────────────────
async function waitForPhase(gameId: string, phase: string, timeoutMs = 300_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const game = await getGameState(gameId);
    if (game.phase === phase || game.winner) return game;
    await sleep(3000);
  }
  throw new Error(`Timeout waiting for phase ${phase}`);
}

async function waitForGameEnd(gameId: string, timeoutMs = 600_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const game = await getGameState(gameId);
    if (game.winner) return game;
    await sleep(5000);
  }
  throw new Error("Timeout waiting for game end");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Track games for claiming
const pendingClaims: Array<{ gameId: string; bettors: number[] }> = [];

async function runOneGame() {
  console.log("\n" + "═".repeat(50));
  console.log(`🎮 Creating new game... [${new Date().toLocaleTimeString()}]`);
  
  // 1. Create game
  const game = await createGame();
  console.log(`  Game ${game.id.slice(0, 8)}... (code: ${game.code})`);
  console.log(`  Players: ${game.bots.map(b => b.nickname).join(", ")}`);

  // 2. Start game
  const started = await startGame(game.id, game.hostId);
  console.log(`  Phase: ${started.phase}, Round: ${started.round}`);

  // 3. Wait for betting window (market created during NIGHT phase)
  await sleep(3000);

  // 4. Place bets from bot wallets
  console.log("  📊 Betting round...");
  const bettors: number[] = [];
  const gameState = await getGameState(game.id);
  const playerCount = gameState.playerCount;

  for (let i = 0; i < wallets.length; i++) {
    const persona = personas[i];
    if (Math.random() > persona.betProbability) {
      console.log(`  ⏭️  ${persona.name} skips this round`);
      continue;
    }

    const suspectIndex = persona.strategy(playerCount);
    const amount = persona.betSize();
    
    const hash = await placeBet(i, game.id, suspectIndex, amount);
    if (hash) {
      bettors.push(i);
      // Small delay between bets to avoid nonce issues
      await sleep(1500);
    }
  }

  console.log(`  ${bettors.length} bets placed`);
  pendingClaims.push({ gameId: game.id, bettors });

  // 5. Wait for game to finish
  console.log("  ⏳ Waiting for game to finish...");
  try {
    const finished = await waitForGameEnd(game.id);
    console.log(`  🏆 Winner: ${finished.winner}`);
    
    // 6. Claim winnings
    await sleep(5000); // Wait for resolution tx
    console.log("  💰 Claiming winnings...");
    for (const idx of bettors) {
      await claimWinnings(idx, game.id);
      await sleep(1000);
    }
  } catch (err: any) {
    console.error(`  ❌ Game error: ${err.message}`);
  }
}

async function processPendingClaims() {
  // Try claiming from older games that might have resolved
  const toRemove: number[] = [];
  for (let i = 0; i < pendingClaims.length; i++) {
    const { gameId, bettors } = pendingClaims[i];
    try {
      const game = await getGameState(gameId);
      if (game.winner) {
        for (const idx of bettors) {
          await claimWinnings(idx, gameId);
          await sleep(500);
        }
        toRemove.push(i);
      }
    } catch {
      toRemove.push(i); // Game no longer exists
    }
  }
  for (const i of toRemove.reverse()) {
    pendingClaims.splice(i, 1);
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        Prescio Agent Orchestrator            ║");
  console.log("║  10 autonomous bettors × continuous games    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  console.log("Personas:");
  personas.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} — ${p.style}`);
  });
  console.log("");

  // Verify server is running
  try {
    const { games } = await getGames();
    console.log(`Server online. ${games.length} active games.`);
  } catch (err) {
    console.error("❌ Server not reachable at", API_BASE);
    process.exit(1);
  }

  // Main loop
  let gameCount = 0;
  while (true) {
    try {
      gameCount++;
      console.log(`\n[Game #${gameCount}]`);
      await runOneGame();
      
      // Process any pending claims from previous games
      await processPendingClaims();
      
      // Wait between games (60-120 seconds)
      const waitTime = 60_000 + Math.random() * 60_000;
      console.log(`\n⏰ Next game in ${Math.round(waitTime / 1000)}s...`);
      await sleep(waitTime);
    } catch (err: any) {
      console.error(`\n❌ Error in game loop: ${err.message}`);
      await sleep(30_000); // Wait 30s on error
    }
  }
}

main().catch(console.error);
