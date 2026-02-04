/** Contract addresses — updated after deployment */
export const CONTRACT_ADDRESSES = {
  /** PrescioMarket contract */
  PRESCIO_MARKET: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  /** PrescioVault contract */
  PRESCIO_VAULT: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

/** PrescioMarket ABI */
export const PRESCIO_MARKET_ABI = [
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "gameId", type: "bytes32", internalType: "bytes32" },
      { name: "question", type: "string", internalType: "string" },
      { name: "outcomeCount", type: "uint8", internalType: "uint8" },
    ],
    outputs: [{ name: "marketId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "placeBet",
    inputs: [
      { name: "marketId", type: "uint256", internalType: "uint256" },
      { name: "outcomeIndex", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [
      { name: "marketId", type: "uint256", internalType: "uint256" },
      { name: "winningOutcome", type: "uint8", internalType: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "marketId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMarket",
    inputs: [
      { name: "marketId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct PrescioMarket.MarketInfo",
        components: [
          { name: "gameId", type: "bytes32", internalType: "bytes32" },
          { name: "question", type: "string", internalType: "string" },
          { name: "outcomeCount", type: "uint8", internalType: "uint8" },
          { name: "totalPool", type: "uint256", internalType: "uint256" },
          { name: "resolved", type: "bool", internalType: "bool" },
          { name: "winningOutcome", type: "uint8", internalType: "uint8" },
          { name: "creator", type: "address", internalType: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserBet",
    inputs: [
      { name: "marketId", type: "uint256", internalType: "uint256" },
      { name: "user", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "outcomeIndex", type: "uint8", internalType: "uint8" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "claimed", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "gameId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "question", type: "string", indexed: false, internalType: "string" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "outcomeIndex", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketResolved",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "winningOutcome", type: "uint8", indexed: false, internalType: "uint8" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;

/** PrescioVault ABI */
export const PRESCIO_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
