import "dotenv/config";

export const config = {
  /** Server port for HTTP */
  port: parseInt(process.env.PORT ?? "3001", 10),

  /** WebSocket port */
  wsPort: parseInt(process.env.WS_PORT ?? "3002", 10),

  /** Node environment */
  nodeEnv: process.env.NODE_ENV ?? "development",

  /** Is production */
  isProd: process.env.NODE_ENV === "production",

  /** Allowed origins for CORS */
  corsOrigins: process.env.CORS_ORIGINS?.split(",") ?? [
    "http://localhost:5173",
    "http://localhost:3000",
  ],

  /** Monad chain config */
  monad: {
    rpcUrl: process.env.MONAD_RPC_URL ?? "https://testnet.monad.xyz",
    chainId: parseInt(process.env.MONAD_CHAIN_ID ?? "10143", 10),
  },

  /** Contract addresses */
  contracts: {
    market: process.env.PRESCIO_MARKET_ADDRESS as `0x${string}` | undefined,
    vault: process.env.PRESCIO_VAULT_ADDRESS as `0x${string}` | undefined,
  },

  /** Server wallet private key (owner of PrescioMarket contract) */
  serverPrivateKey: process.env.SERVER_PRIVATE_KEY as `0x${string}` | undefined,

  /** Default game language (en, ko, ja, zh) */
  gameLanguage: (process.env.GAME_LANGUAGE ?? "en") as "en" | "ko" | "ja" | "zh",
} as const;
