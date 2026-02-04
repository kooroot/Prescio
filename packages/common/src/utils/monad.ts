import { defineChain } from "viem";

/** Monad Testnet chain ID */
export const MONAD_TESTNET_CHAIN_ID = 10143;

/** Monad Testnet RPC URL */
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";

/** Monad Testnet block explorer */
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

/** Monad Testnet chain definition for viem/wagmi */
export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MONAD_TESTNET_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: MONAD_TESTNET_EXPLORER,
    },
  },
  testnet: true,
});

/** Get the explorer URL for a transaction */
export function getExplorerTxUrl(txHash: string): string {
  return `${MONAD_TESTNET_EXPLORER}/tx/${txHash}`;
}

/** Get the explorer URL for an address */
export function getExplorerAddressUrl(address: string): string {
  return `${MONAD_TESTNET_EXPLORER}/address/${address}`;
}
