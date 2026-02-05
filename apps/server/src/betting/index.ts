/**
 * Betting module — public API
 */
export { initOnChain, isOnChainEnabled, gameIdToBytes32 } from "./onchain.js";
export type { OnChainMarketInfo, OnChainUserBet } from "./onchain.js";

export {
  handleGameStart,
  handleBettingOpen,
  pauseBetting,
  handleBettingClose,
  handleGameEnd,
  getMarketInfo,
  getOdds,
  getUserBets,
  isBettingEnabled,
  cleanupMarket,
  getActiveMarkets,
} from "./market.js";
export type { CachedMarket } from "./market.js";

export {
  startOddsPolling,
  stopOddsPolling,
  stopAllPolling,
  formatOdds,
  calculateLocalOdds,
} from "./odds.js";
export type { FormattedOdds } from "./odds.js";
