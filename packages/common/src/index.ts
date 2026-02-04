// Types
export { Role, Phase } from "./types/game.js";
export type {
  Player,
  Vote,
  ChatMessage,
  KillEvent,
  GameState,
  GameSettings,
  GameLanguage,
  LobbyInfo,
} from "./types/game.js";

export { BetType, BetStatus, MarketStatus } from "./types/betting.js";
export type {
  Odds,
  Market,
  Bet,
  PlaceBetRequest,
  BettingPortfolio,
} from "./types/betting.js";

export type {
  ServerEvent,
  ServerPayloads,
  ClientEvent,
  ClientPayloads,
} from "./types/events.js";
export {
  createServerEvent,
  createClientEvent,
  parseEvent,
  serializeEvent,
} from "./types/events.js";

// Map
export { Room } from "./types/map.js";
export type {
  RoomInfo,
  PlayerLocation,
  TaskAssignment,
  MapState,
} from "./types/map.js";
export {
  THE_SKELD,
  getPath,
  getDistance,
  isAdjacent,
  canVent,
  getVentTargets,
} from "./types/map.js";

// Constants
export {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DISCUSSION_TIME,
  VOTE_TIME,
  NIGHT_TIME,
  REPORT_TIME,
  RESULT_TIME,
  GAME_CODE_LENGTH,
  MAX_CHAT_LENGTH,
  MAX_NICKNAME_LENGTH,
  MIN_NICKNAME_LENGTH,
  IMPOSTOR_COUNT_MAP,
  DEFAULT_GAME_SETTINGS,
  generateGameCode,
  getImpostorCount,
  checkWinCondition,
} from "./constants/game.js";

export {
  CONTRACT_ADDRESSES,
  PRESCIO_MARKET_ABI,
  PRESCIO_VAULT_ABI,
} from "./constants/contracts.js";

// Utils
export {
  monadTestnet,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC,
  MONAD_TESTNET_EXPLORER,
  getExplorerTxUrl,
  getExplorerAddressUrl,
} from "./utils/monad.js";

export {
  shortenAddress,
  formatMON,
  parseMON,
  formatNumber,
  formatOdds,
  formatProbability,
  formatRelativeTime,
  formatCountdown,
} from "./utils/format.js";
