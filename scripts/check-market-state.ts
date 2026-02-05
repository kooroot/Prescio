import { createPublicClient, http, keccak256, toHex } from 'viem';

const MARKET_ABI = [{
  name: 'getMarketInfo',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'gameId', type: 'bytes32' }],
  outputs: [
    { name: 'playerCount', type: 'uint8' },
    { name: 'state', type: 'uint8' },
    { name: 'totalPool', type: 'uint256' },
    { name: 'impostorIndex', type: 'uint8' },
    { name: 'protocolFee', type: 'uint256' },
  ]
}] as const;

async function main() {
  const client = createPublicClient({ transport: http('https://testnet-rpc.monad.xyz') });
  const gameId = process.argv[2] || 'f3fda388-9940-470b-984b-024c89ea8459';
  const gameIdBytes = keccak256(toHex(gameId));
  
  const result = await client.readContract({
    address: '0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F',
    abi: MARKET_ABI,
    functionName: 'getMarketInfo',
    args: [gameIdBytes],
  });
  
  console.log('Game:', gameId);
  console.log('playerCount:', result[0]);
  console.log('state:', result[1], '(0=OPEN, 1=CLOSED, 2=RESOLVED)');
  console.log('totalPool:', (Number(result[2]) / 1e18).toFixed(4), 'MON');
  console.log('impostorIndex:', result[3]);
  console.log('protocolFee:', (Number(result[4]) / 1e18).toFixed(4), 'MON');
}

main().catch(console.error);
