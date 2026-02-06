import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  monadMainnet,
  monadTestnet,
  MONAD_MAINNET_RPC,
  MONAD_TESTNET_RPC,
} from "@prescio/common";

export const wagmiConfig = createConfig({
  chains: [monadMainnet, monadTestnet],
  connectors: [injected()],
  transports: {
    [monadMainnet.id]: http(MONAD_MAINNET_RPC),
    [monadTestnet.id]: http(MONAD_TESTNET_RPC),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
