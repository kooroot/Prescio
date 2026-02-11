import { createPublicClient, http, formatEther } from 'viem';

const client = createPublicClient({ transport: http('https://rpc.monad.xyz') });

const wallets = [
  { name: 'Bot 1', address: '0x4f29D09983FdBd6732490c1122028e1d57eb10eE' as const },
  { name: 'Bot 2', address: '0x8E5b39F4f73071663aa4881f2B5f09336974B002' as const },
  { name: 'Bot 3', address: '0x202Cc56279f4247D4F1cC29a17c3073eB3709dfB' as const },
  { name: 'Bot 4', address: '0x284dBEc66F5EF5a0CF51d2FE5cfd04a383781b03' as const },
  { name: 'Bot 5', address: '0xA28Db7C89a3Ba11cB175241a3505F67E3D28262d' as const },
  { name: 'Bot 6', address: '0xe2396b76010cbCD5982d3749A15BeeB1C1327f4A' as const },
  { name: 'Bot 7', address: '0xcFF882DC3D653E839065ba5dd91054917675C4d3' as const },
  { name: 'Bot 8', address: '0x1A38657a1F365c9c394FCaB8d96F82eCA7E3C19E' as const },
  { name: 'Bot 9', address: '0xF7a1166F47402CaE3A02f8D02cB54827Ac04AB5c' as const },
  { name: 'Bot 10', address: '0x564a81C607153f12d93e3526FA63b7CFe9292CE3' as const },
];

async function main() {
  const owner = '0x001436D283C6eC27F555c25dD045a6A57B5A4BE2' as const;
  const market = '0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C' as const;
  
  const ownerBal = await client.getBalance({ address: owner });
  const marketBal = await client.getBalance({ address: market });
  
  console.log('=== Prescio Mainnet Balances ===');
  console.log('Server:', formatEther(ownerBal), 'MON');
  console.log('Market:', formatEther(marketBal), 'MON');
  console.log('---');
  
  let total = 0n;
  for (const w of wallets) {
    const bal = await client.getBalance({ address: w.address });
    total += bal;
    console.log(`${w.name}: ${formatEther(bal)} MON`);
  }
  console.log('---');
  console.log('Bot Total:', formatEther(total), 'MON');
}

main().catch(console.error);
