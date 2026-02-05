/** Contract addresses — updated after deployment */
export const CONTRACT_ADDRESSES = {
  /** PrescioMarket contract */
  PRESCIO_MARKET: "0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F" as `0x${string}`,
  /** PrescioVault contract */
  PRESCIO_VAULT: "0xbCAad29d9a2Dd64a8b8F1B9fD2e1C59D2b6a3E43" as `0x${string}`,
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
