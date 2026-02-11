import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Monad Mainnet
export const MONAD_MAINNET_CHAIN_ID = 143;
export const MONAD_MAINNET_RPC = "https://rpc.monad.xyz";

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
      url: "https://monadexplorer.com",
    },
  },
  testnet: false,
});

export const wagmiConfig = createConfig({
  chains: [monadMainnet],
  connectors: [injected()],
  transports: {
    [monadMainnet.id]: http(MONAD_MAINNET_RPC),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
