import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monadTestnet, MONAD_TESTNET_RPC } from "@prescio/common";

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(MONAD_TESTNET_RPC),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
