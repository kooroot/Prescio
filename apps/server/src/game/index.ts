/**
 * Game module — public API
 */
export { gameEngine, GameEngine } from "./engine.js";
export type { GameEngineEvents } from "./engine.js";

export {
  createGame,
  addPlayer,
  removePlayer,
  startGame,
  getRoleAssignment,
  LobbyError,
} from "./lobby.js";

export {
  executeKill,
  executeNightAuto,
  reportBody,
  checkGameOver,
  RoundError,
} from "./round.js";

export {
  startVote,
  castVote,
  tallyVotes,
  allVotesCast,
  VoteError,
} from "./vote.js";
export type { VoteResult } from "./vote.js";

export {
  getGame,
  getGameByCode,
  updateGame,
  deleteGame,
  getActiveGames,
  getGameCount,
  restoreGames,
} from "./state.js";

export {
  addMessage,
  addSystemMessage,
  getMessages,
  getRecentMessages,
  DiscussionError,
} from "./discussion.js";
