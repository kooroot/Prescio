import { createPublicClient, http, formatEther } from 'viem';
import { readFileSync } from 'fs';

const client = createPublicClient({ transport: http('https://testnet-rpc.monad.xyz') });
const wallets = JSON.parse(readFileSync('.bot-wallets.json', 'utf8')).wallets;

async function main() {
  // Owner balance
  const ownerBal = await client.getBalance({ address: '0x001436D283C6eC27F555c25dD045a6A57B5A4BE2' });
  console.log('Owner:', formatEther(ownerBal), 'MON');
  console.log('---');
  
  for (const w of wallets) {
    const bal = await client.getBalance({ address: w.address });
    console.log(`${w.name}: ${formatEther(bal)} MON`);
  }
}

main();
