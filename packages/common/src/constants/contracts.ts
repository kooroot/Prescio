/** Contract addresses — Monad Mainnet (Chain ID: 143) */
export const CONTRACT_ADDRESSES = {
  /** PrescioMarket contract (Proxy) */
  PRESCIO_MARKET: "0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C" as `0x${string}`,
  /** PrescioVault contract (V2 - Staking integrated) */
  PRESCIO_VAULT: "0xc8671dFD067F31e6CD08B42dd0Fe7Ba565901A96" as `0x${string}`,
  /** PrescioStaking contract (Proxy) */
  PRESCIO_STAKING: "0xa0742ffb1762FF3EA001793aCBA202f82244D983" as `0x${string}`,
  /** AutoBetController contract (Proxy) */
  AUTOBET_CONTROLLER: "0x75c13a16be34bc5882a1Dc466FaF9e603480Ba13" as `0x${string}`,
  /** PRESCIO Token */
  PRESCIO_TOKEN: "0xffC86Ab0C36B0728BbF52164f6319762DA867777" as `0x${string}`,
} as const;

/** Contract addresses — Monad Testnet (Chain ID: 10143) */
export const TESTNET_CONTRACT_ADDRESSES = {
  PRESCIO_MARKET: "0x13DAD4fE98D5C0EC317408A510b21A66992A1680" as `0x${string}`,
  PRESCIO_VAULT: "0x4f97726E10F4676cDBa66B1D79ECAe921d9eFb76" as `0x${string}`,
  PRESCIO_STAKING: "0xD7CBdCAD334f2d783088224ac3680C5f127c68FD" as `0x${string}`,
  AUTOBET_CONTROLLER: "0x00b652f6618e553Ae2ecB3e7292ACf6255a8Bafc" as `0x${string}`,
  PRESCIO_TOKEN: "0xffC86Ab0C36B0728BbF52164f6319762DA867777" as `0x${string}`,
} as const;

/** PrescioMarket ABI — Parimutuel betting market */
export const PRESCIO_MARKET_ABI = [
  // Owner functions
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "gameId", type: "bytes32", internalType: "bytes32" },
      { name: "playerCount", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "closeMarket",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [
      { name: "gameId", type: "bytes32", internalType: "bytes32" },
      { name: "impostorIndex", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // User functions
  {
    type: "function",
    name: "placeBet",
    inputs: [
      { name: "gameId", type: "bytes32", internalType: "bytes32" },
      { name: "suspectIndex", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // View functions
  {
    type: "function",
    name: "getMarketInfo",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "playerCount", type: "uint8", internalType: "uint8" },
      { name: "state", type: "uint8", internalType: "enum PrescioMarket.MarketState" },
      { name: "totalPool", type: "uint256", internalType: "uint256" },
      { name: "impostorIndex", type: "uint8", internalType: "uint8" },
      { name: "protocolFee", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserBets",
    inputs: [
      { name: "gameId", type: "bytes32", internalType: "bytes32" },
      { name: "user", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "suspectIndex", type: "uint8", internalType: "uint8" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "claimed", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOdds",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "odds", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feeRate",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vault",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MIN_BET",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  // Admin
  {
    type: "function",
    name: "setFeeRate",
    inputs: [{ name: "_feeRate", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setVault",
    inputs: [{ name: "_vault", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // V3: Betting pause/resume
  {
    type: "function",
    name: "pauseBetting",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resumeBetting",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isBettingOpen",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bettingPaused",
    inputs: [{ name: "gameId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "playerCount", type: "uint8", indexed: false, internalType: "uint8" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "suspectIndex", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketClosed",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketResolved",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "impostorIndex", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "totalPool", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "fee", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "payout", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  // V3 Events
  {
    type: "event",
    name: "BettingPaused",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BettingResumed",
    inputs: [
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
] as const;

/** PrescioVault ABI — Protocol fee management */
export const PRESCIO_VAULT_ABI = [
  {
    type: "function",
    name: "withdrawFees",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawFeesTo",
    inputs: [{ name: "to", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "feeBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FeesReceived",
    inputs: [
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeesWithdrawn",
    inputs: [
      { name: "to", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
