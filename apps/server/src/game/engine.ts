/**
 * GameEngine — State machine orchestrator with auto-progression
 *
 * Phase flow: LOBBY → NIGHT → REPORT → DISCUSSION → VOTE → RESULT
 *   - RESULT loops back to NIGHT (next round) or ends the game
 *   - WIN can happen after NIGHT (kills) or after VOTE (elimination)
 */
import { EventEmitter } from "events";
import {
  Phase,
  Role,
  NIGHT_TIME,
  REPORT_TIME,
  DISCUSSION_TIME,
  VOTE_TIME,
  RESULT_TIME,
  type GameState,
  type KillEvent,
} from "@prescio/common";
import { getGame, updateGame, deleteGame } from "./state.js";
import { executeNightAuto, checkGameOver } from "./round.js";
import { startVote, tallyVotes, allVotesCast, type VoteResult } from "./vote.js";
import { agentManager } from "../agents/manager.js";
import {
  handleGameStart as bettingGameStart,
  handleBettingOpen,
  handleBettingClose,
  handleGameEnd as bettingGameEnd,
  cleanupMarket,
  isOnChainEnabled,
  onChainPauseBetting,
} from "../betting/index.js";
import { startOddsPolling, stopOddsPolling } from "../betting/odds.js";

// ============================================
// Event Types
// ============================================

export interface GameEngineEvents {
  /** Phase changed */
  phaseChange: (gameId: string, phase: Phase, round: number) => void;
  /** Night kills happened */
  nightKills: (gameId: string, kills: KillEvent[]) => void;
  /** Vote results are in */
  voteResult: (gameId: string, result: VoteResult) => void;
  /** Game is over */
  gameOver: (gameId: string, winner: Role, game: GameState) => void;
  /** Error during engine processing */
  engineError: (gameId: string, error: Error) => void;
}

// ============================================
// GameEngine Class
// ============================================

export class GameEngine extends EventEmitter {
  /** Active phase timers: gameId → timer handle */
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Phase start timestamps: gameId → epoch ms */
  private phaseStartTimes = new Map<string, number>();

  /** Discussion abort controllers: gameId → AbortController */
  private discussionAborts = new Map<string, AbortController>();

  /** Guard against double-processing: gameId → processing phase */
  private processing = new Set<string>();

  constructor() {
    super();
  }

  // ---- Typed emit/on helpers ----

  override emit<K extends keyof GameEngineEvents>(
    event: K,
    ...args: Parameters<GameEngineEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof GameEngineEvents>(
    event: K,
    listener: GameEngineEvents[K],
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override off<K extends keyof GameEngineEvents>(
    event: K,
    listener: GameEngineEvents[K],
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  // ============================================
  // Phase Transitions
  // ============================================

  /**
   * Begin the game loop from NIGHT phase (called after startGame in lobby).
   */
  startLoop(gameId: string): void {
    const game = getGame(gameId);
    if (!game || game.phase !== Phase.NIGHT) return;

    this.emit("phaseChange", gameId, Phase.NIGHT, game.round);
    this.schedulePhase(gameId, Phase.NIGHT);

    // Create on-chain betting market (async, non-blocking)
    if (isOnChainEnabled()) {
      const playerCount = game.players.length;
      bettingGameStart(gameId, playerCount)
        .then(async (ok) => {
          if (ok) {
            // V3: Start with betting paused (NIGHT phase)
            await onChainPauseBetting(gameId);
            startOddsPolling(gameId);
            console.log(`[Engine] Betting market created for game ${gameId} (paused)`);
          }
        })
        .catch((err) => {
          console.error(`[Engine] Failed to create betting market:`, err instanceof Error ? err.message : err);
        });
    }
  }

  /**
   * Resume a game loop from its current phase (for games restored from persistence).
   * Re-schedules the timer for the current phase.
   */
  resumeLoop(gameId: string): boolean {
    const game = getGame(gameId);
    if (!game) return false;

    // Don't resume finished games or lobby games
    if (game.winner || game.phase === Phase.LOBBY) return false;

    console.log(`[Engine] Resuming game ${gameId} from phase ${game.phase} (round ${game.round})`);

    // Re-emit phase change for clients
    this.emit("phaseChange", gameId, game.phase, game.round);

    // Re-schedule the timer for current phase
    this.schedulePhase(gameId, game.phase);

    // Resume betting state based on current phase
    if (isOnChainEnabled()) {
      const playerCount = game.players.length;
      // Ensure market exists in cache
      bettingGameStart(gameId, playerCount)
        .then(async (ok) => {
          // If phase is REPORT or DISCUSSION, betting should be open
          if (game.phase === Phase.REPORT || game.phase === Phase.DISCUSSION) {
            await handleBettingOpen(gameId);
            console.log(`[Engine] Betting resumed OPEN for game ${gameId} (phase: ${game.phase})`);
          }
          startOddsPolling(gameId);
        })
        .catch((err) => {
          console.error(`[Engine] Failed to resume betting market:`, err instanceof Error ? err.message : err);
        });
    }

    // Re-initialize agent manager for this game
    agentManager.initializeAgents(game);

    return true;
  }

  /**
   * Transition to the next phase with guard against double-processing.
   */
  private transitionTo(gameId: string, nextPhase: Phase): void {
    const game = getGame(gameId);
    if (!game) return;

    // Guard: don't transition if game is over
    if (game.winner) return;

    this.clearTimer(gameId);

    try {
      switch (nextPhase) {
        case Phase.NIGHT:
          this.enterNight(game);
          break;
        case Phase.REPORT:
          this.enterReport(game);
          break;
        case Phase.DISCUSSION:
          this.enterDiscussion(game);
          break;
        case Phase.VOTE:
          this.enterVote(game);
          break;
        case Phase.RESULT:
          this.enterResult(game);
          break;
        default:
          break;
      }
    } catch (err) {
      this.emit("engineError", gameId, err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ---- NIGHT ----

  private enterNight(game: GameState): void {
    game.phase = Phase.NIGHT;
    updateGame(game);
    this.emit("phaseChange", game.id, Phase.NIGHT, game.round);
    this.schedulePhase(game.id, Phase.NIGHT);
  }

  /**
   * Called when NIGHT timer expires.
   * Let AI agents choose kill targets, then check win condition, then move to REPORT.
   */
  private processNight(gameId: string): void {
    const game = getGame(gameId);
    if (!game || game.phase !== Phase.NIGHT) return;

    // Guard against double-processing
    const lockKey = `night:${gameId}`;
    if (this.processing.has(lockKey)) return;
    this.processing.add(lockKey);

    // Use agent manager for AI-driven kills, fallback to auto
    agentManager
      .runNightAction(gameId)
      .then((agentKills) => {
        const currentGame = getGame(gameId);
        if (!currentGame || currentGame.phase !== Phase.NIGHT) return;

        // If agents didn't kill anyone, fallback to auto
        if (agentKills.length === 0) {
          try {
            const { game: updatedGame, kills } = executeNightAuto(gameId);
            this.emit("nightKills", gameId, kills);

            const winner = checkGameOver(updatedGame);
            if (winner) {
              this.endGame(updatedGame, winner);
              return;
            }
          } catch (err) {
            this.emit("engineError", gameId, err instanceof Error ? err : new Error(String(err)));
            return;
          }
        } else {
          // Agent kills already executed via executeKill in manager
          const kills = agentKills.map((k) => ({
            killerId: k.killerId,
            targetId: k.targetId,
            round: currentGame.round,
            timestamp: Date.now(),
          }));
          this.emit("nightKills", gameId, kills);

          const latestGame = getGame(gameId);
          if (!latestGame) return;
          const winner = checkGameOver(latestGame);
          if (winner) {
            this.endGame(latestGame, winner);
            return;
          }
        }

        // Move to REPORT phase
        this.transitionTo(gameId, Phase.REPORT);
      })
      .catch((err) => {
        this.emit("engineError", gameId, err instanceof Error ? err : new Error(String(err)));
        // Fallback to auto on error
        try {
          const { game, kills } = executeNightAuto(gameId);
          this.emit("nightKills", gameId, kills);
          const winner = checkGameOver(game);
          if (winner) {
            this.endGame(game, winner);
            return;
          }
          this.transitionTo(gameId, Phase.REPORT);
        } catch (innerErr) {
          this.emit("engineError", gameId, innerErr instanceof Error ? innerErr : new Error(String(innerErr)));
        }
      })
      .finally(() => {
        this.processing.delete(lockKey);
      });
  }

  // ---- REPORT ----

  private enterReport(game: GameState): void {
    game.phase = Phase.REPORT;
    updateGame(game);
    this.emit("phaseChange", game.id, Phase.REPORT, game.round);
    this.schedulePhase(game.id, Phase.REPORT);

    // Enable betting now that death is revealed (was PAUSED during NIGHT)
    // handleBettingOpen now calls resumeBetting on-chain if needed (V3)
    if (isOnChainEnabled()) {
      handleBettingOpen(game.id)
        .then((ok) => {
          if (ok) console.log(`[Engine] Betting OPEN for game ${game.id} (round ${game.round})`);
        })
        .catch((err) => console.error(`[Engine] handleBettingOpen failed:`, err));
    }
  }

  // ---- DISCUSSION ----

  private enterDiscussion(game: GameState): void {
    game.phase = Phase.DISCUSSION;
    updateGame(game);
    this.emit("phaseChange", game.id, Phase.DISCUSSION, game.round);

    // Cancel any previous discussion abort controller
    this.abortDiscussion(game.id);

    // Create new abort controller for this discussion
    const abortController = new AbortController();
    this.discussionAborts.set(game.id, abortController);

    // Start agent discussion AND timer concurrently
    // Discussion timer is the hard deadline
    this.schedulePhase(game.id, Phase.DISCUSSION);

    // Trigger AI discussion with abort signal
    agentManager
      .runDiscussion(game.id, abortController.signal)
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          console.log(`[Engine] Discussion aborted for game ${game.id} (timer expired)`);
          return;
        }
        console.error(`[Engine] Agent discussion error:`, err instanceof Error ? err.message : err);
      });
  }

  /**
   * Abort ongoing discussion for a game.
   */
  private abortDiscussion(gameId: string): void {
    const controller = this.discussionAborts.get(gameId);
    if (controller) {
      controller.abort();
      this.discussionAborts.delete(gameId);
    }
  }

  // ---- VOTE ----

  private enterVote(game: GameState): void {
    // Abort any ongoing discussion
    this.abortDiscussion(game.id);

    // Pause/close betting market
    if (isOnChainEnabled()) {
      // V3: Pause betting on-chain before vote
      onChainPauseBetting(game.id)
        .then((hash) => {
          if (hash) console.log(`[Engine] Betting paused on-chain for game ${game.id}`);
        })
        .catch((err) => console.error(`[Engine] pauseBetting failed:`, err));
      handleBettingClose(game.id).catch((err) => {
        console.error(`[Engine] Failed to close betting market:`, err instanceof Error ? err.message : err);
      });
      stopOddsPolling(game.id);
      console.log(`[Engine] Betting CLOSED for game ${game.id}`);
    }

    startVote(game.id);
    // game.phase is set by startVote
    const updatedGame = getGame(game.id);
    if (!updatedGame) return;
    this.emit("phaseChange", game.id, Phase.VOTE, updatedGame.round);
    this.schedulePhase(game.id, Phase.VOTE);

    // Trigger AI voting (runs async)
    agentManager
      .runVoting(game.id)
      .then(() => {
        // Check if all votes are in after bots voted
        this.onVoteCast(game.id);
      })
      .catch((err) => {
        console.error(`[Engine] Agent voting error:`, err instanceof Error ? err.message : err);
      });
  }

  /**
   * Called when VOTE timer expires (or all votes are in).
   * Tally votes and move to RESULT.
   */
  processVote(gameId: string): void {
    const game = getGame(gameId);
    if (!game || game.phase !== Phase.VOTE) return;

    // Guard against double-processing
    const lockKey = `vote:${gameId}`;
    if (this.processing.has(lockKey)) return;
    this.processing.add(lockKey);

    try {
      const { game: updatedGame, result } = tallyVotes(gameId);
      this.emit("voteResult", gameId, result);

      // Check win condition after elimination
      const winner = checkGameOver(updatedGame);
      if (winner) {
        this.endGame(updatedGame, winner);
        return;
      }

      this.transitionTo(gameId, Phase.RESULT);
    } catch (err) {
      this.emit("engineError", gameId, err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.processing.delete(lockKey);
    }
  }

  // ---- RESULT ----

  private enterResult(game: GameState): void {
    game.phase = Phase.RESULT;
    updateGame(game);
    this.emit("phaseChange", game.id, Phase.RESULT, game.round);
    this.schedulePhase(game.id, Phase.RESULT);
  }

  /**
   * After RESULT display, start the next round (NIGHT).
   */
  private processResult(gameId: string): void {
    const game = getGame(gameId);
    if (!game || game.phase !== Phase.RESULT) return;

    // Don't start a new round if game is already over
    if (game.winner) return;

    game.round += 1;
    game.votes = []; // Clear votes for next round
    updateGame(game);
    this.transitionTo(gameId, Phase.NIGHT);
  }

  // ============================================
  // End Game
  // ============================================

  private endGame(game: GameState, winner: Role): void {
    this.clearTimer(game.id);
    this.abortDiscussion(game.id);
    game.phase = Phase.RESULT;
    game.winner = winner;
    updateGame(game);
    this.emit("gameOver", game.id, winner, game);
    agentManager.cleanup(game.id);

    // Resolve betting market (async, non-blocking)
    if (isOnChainEnabled()) {
      stopOddsPolling(game.id);

      // Find the impostor index
      const impostorPlayer = game.players.find((p) => p.role === Role.IMPOSTOR);
      if (impostorPlayer) {
        const impostorIndex = game.players.indexOf(impostorPlayer);
        bettingGameEnd(game.id, impostorIndex)
          .then((ok) => {
            if (ok) {
              console.log(`[Engine] Betting market resolved for game ${game.id}`);
            }
          })
          .catch((err) => {
            console.error(`[Engine] Failed to resolve betting market:`, err instanceof Error ? err.message : err);
          })
          .finally(() => {
            // Clean up cache after a delay to allow final queries
            setTimeout(() => cleanupMarket(game.id), 60_000);
          });
      }
    }
  }

  // ============================================
  // Timer Management
  // ============================================

  /**
   * Schedule auto-progression for a phase.
   */
  private schedulePhase(gameId: string, phase: Phase): void {
    this.clearTimer(gameId);

    const duration = this.getPhaseDuration(gameId, phase);
    if (duration <= 0) return;

    // Track phase start time for accurate time-remaining calculations
    this.phaseStartTimes.set(gameId, Date.now());

    const timer = setTimeout(() => {
      this.onPhaseTimeout(gameId, phase);
    }, duration * 1000);

    this.timers.set(gameId, timer);
  }

  private onPhaseTimeout(gameId: string, phase: Phase): void {
    // Verify game is still in the expected phase (guard against stale timers)
    const game = getGame(gameId);
    if (!game || game.phase !== phase) return;

    switch (phase) {
      case Phase.NIGHT:
        this.processNight(gameId);
        break;
      case Phase.REPORT:
        this.transitionTo(gameId, Phase.DISCUSSION);
        break;
      case Phase.DISCUSSION:
        this.abortDiscussion(gameId);
        this.transitionTo(gameId, Phase.VOTE);
        break;
      case Phase.VOTE:
        this.processVote(gameId);
        break;
      case Phase.RESULT:
        this.processResult(gameId);
        break;
      default:
        break;
    }
  }

  private getPhaseDuration(gameId: string, phase: Phase): number {
    const game = getGame(gameId);
    if (!game) return 0;

    switch (phase) {
      case Phase.NIGHT:
        return game.settings.nightTime ?? NIGHT_TIME;
      case Phase.REPORT:
        return REPORT_TIME;
      case Phase.DISCUSSION:
        return game.settings.discussionTime ?? DISCUSSION_TIME;
      case Phase.VOTE:
        return game.settings.voteTime ?? VOTE_TIME;
      case Phase.RESULT:
        return RESULT_TIME;
      default:
        return 0;
    }
  }

  /**
   * Called when a vote is cast — check if all votes are in to end early.
   */
  onVoteCast(gameId: string): void {
    const game = getGame(gameId);
    if (!game || game.phase !== Phase.VOTE) return;

    if (allVotesCast(game)) {
      // All alive players have voted — skip remaining time
      this.processVote(gameId);
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  private clearTimer(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(gameId);
    }
  }

  /**
   * Stop and clean up a game entirely.
   */
  destroyGame(gameId: string): void {
    this.clearTimer(gameId);
    this.abortDiscussion(gameId);
    this.processing.delete(`night:${gameId}`);
    this.processing.delete(`vote:${gameId}`);
    deleteGame(gameId);
  }

  /**
   * Get remaining time for current phase timer.
   */
  getTimeRemaining(gameId: string): number {
    const game = getGame(gameId);
    if (!game) return 0;

    const startTime = this.phaseStartTimes.get(gameId);
    if (!startTime) return this.getPhaseDuration(gameId, game.phase);

    const totalDuration = this.getPhaseDuration(gameId, game.phase);
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.max(0, Math.round(totalDuration - elapsed));
  }
}

// ============================================
// Singleton Engine Instance
// ============================================

export const gameEngine = new GameEngine();
