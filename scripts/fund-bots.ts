/**
 * Fund bot wallets with MON on mainnet
 */
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

const RPC_URL = process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const AMOUNT_PER_BOT = process.env.AMOUNT_PER_BOT || "10"; // 10 MON each

if (!SERVER_PRIVATE_KEY) {
  console.error("ERROR: SERVER_PRIVATE_KEY environment variable is required");
  console.error("Usage: SERVER_PRIVATE_KEY=0x... npx tsx scripts/fund-bots.ts");
  process.exit(1);
}

const monadMainnet = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

interface BotWallet {
  name: string;
  address: string;
  privateKey: string;
}

async function main() {
  const account = privateKeyToAccount(SERVER_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: monadMainnet,
    transport: http(RPC_URL),
  });
  const publicClient = createPublicClient({
    chain: monadMainnet,
    transport: http(RPC_URL),
  });

  // Read bot wallets (try multiple paths)
  const paths = [".bot-wallets.json", "../../.bot-wallets.json", "/Users/kooroot/.openclaw/workspace/Prescio/.bot-wallets.json"];
  let walletsData: any;
  for (const p of paths) {
    try {
      walletsData = JSON.parse(readFileSync(p, "utf8"));
      break;
    } catch {}
  }
  if (!walletsData) throw new Error("Could not find .bot-wallets.json");
  const wallets: BotWallet[] = walletsData.wallets;

  console.log(`Server wallet: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Server balance: ${formatEther(balance)} MON`);
  console.log(`\nFunding ${wallets.length} bot wallets with ${AMOUNT_PER_BOT} MON each...\n`);

  for (const wallet of wallets) {
    try {
      // Check current balance
      const currentBalance = await publicClient.getBalance({ 
        address: wallet.address as `0x${string}` 
      });
      console.log(`${wallet.name} (${wallet.address.slice(0, 10)}...): ${formatEther(currentBalance)} MON`);
      
      // Send if balance is low
      if (currentBalance < parseEther("5")) {
        const hash = await walletClient.sendTransaction({
          to: wallet.address as `0x${string}`,
          value: parseEther(AMOUNT_PER_BOT),
        });
        console.log(`  → Sent ${AMOUNT_PER_BOT} MON: ${hash.slice(0, 20)}...`);
        
        // Wait a bit between transactions
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        console.log(`  → Skipped (sufficient balance)`);
      }
    } catch (err: any) {
      console.error(`  → Error: ${err.message?.slice(0, 60)}`);
    }
  }

  // Check final server balance
  const finalBalance = await publicClient.getBalance({ address: account.address });
  console.log(`\nFinal server balance: ${formatEther(finalBalance)} MON`);
}

main().catch(console.error);
