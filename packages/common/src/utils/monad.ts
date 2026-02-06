import { defineChain } from "viem";

/** Monad Mainnet chain ID */
export const MONAD_MAINNET_CHAIN_ID = 143;

/** Monad Testnet chain ID */
export const MONAD_TESTNET_CHAIN_ID = 10143;

/** Monad Mainnet RPC URL */
export const MONAD_MAINNET_RPC = "https://rpc.monad.xyz";

/** Monad Testnet RPC URL */
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";

/** Monad Mainnet block explorer */
export const MONAD_MAINNET_EXPLORER = "https://monadexplorer.com";

/** Monad Testnet block explorer */
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

/** Monad Mainnet chain definition for viem/wagmi */
export const monadMainnet = defineChain({
  id: MONAD_MAINNET_CHAIN_ID,
  name: "Monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MONAD_MAINNET_RPC],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: MONAD_MAINNET_EXPLORER,
    },
  },
  testnet: false,
});

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

/** Get the explorer URL for a transaction (mainnet) */
export function getExplorerTxUrl(txHash: string, testnet = false): string {
  const explorer = testnet ? MONAD_TESTNET_EXPLORER : MONAD_MAINNET_EXPLORER;
  return `${explorer}/tx/${txHash}`;
}

/** Get the explorer URL for an address (mainnet) */
export function getExplorerAddressUrl(address: string, testnet = false): string {
  const explorer = testnet ? MONAD_TESTNET_EXPLORER : MONAD_MAINNET_EXPLORER;
  return `${explorer}/address/${address}`;
}
