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
  }

  /**
   * Transition to the next phase.
   */
  private transitionTo(gameId: string, nextPhase: Phase): void {
    const game = getGame(gameId);
    if (!game) return;

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
    // Use agent manager for AI-driven kills, fallback to auto
    agentManager
      .runNightAction(gameId)
      .then((agentKills) => {
        const game = getGame(gameId);
        if (!game) return;

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
            round: game.round,
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
      });
  }

  // ---- REPORT ----

  private enterReport(game: GameState): void {
    game.phase = Phase.REPORT;
    updateGame(game);
    this.emit("phaseChange", game.id, Phase.REPORT, game.round);
    this.schedulePhase(game.id, Phase.REPORT);
  }

  // ---- DISCUSSION ----

  private enterDiscussion(game: GameState): void {
    game.phase = Phase.DISCUSSION;
    updateGame(game);
    this.emit("phaseChange", game.id, Phase.DISCUSSION, game.round);
    this.schedulePhase(game.id, Phase.DISCUSSION);

    // Trigger AI discussion (runs async, doesn't block phase timer)
    agentManager.runDiscussion(game.id).catch((err) => {
      console.error(`[Engine] Agent discussion error:`, err instanceof Error ? err.message : err);
    });
  }

  // ---- VOTE ----

  private enterVote(game: GameState): void {
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
    try {
      const { game, result } = tallyVotes(gameId);
      this.emit("voteResult", gameId, result);

      // Check win condition after elimination
      const winner = checkGameOver(game);
      if (winner) {
        this.endGame(game, winner);
        return;
      }

      this.transitionTo(gameId, Phase.RESULT);
    } catch (err) {
      this.emit("engineError", gameId, err instanceof Error ? err : new Error(String(err)));
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
    if (!game) return;

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
    game.phase = Phase.RESULT;
    game.winner = winner;
    updateGame(game);
    this.emit("gameOver", game.id, winner, game);
    agentManager.cleanup(game.id);
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

    const timer = setTimeout(() => {
      this.onPhaseTimeout(gameId, phase);
    }, duration * 1000);

    this.timers.set(gameId, timer);
  }

  private onPhaseTimeout(gameId: string, phase: Phase): void {
    switch (phase) {
      case Phase.NIGHT:
        this.processNight(gameId);
        break;
      case Phase.REPORT:
        this.transitionTo(gameId, Phase.DISCUSSION);
        break;
      case Phase.DISCUSSION:
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
    deleteGame(gameId);
  }

  /**
   * Get remaining time for current phase timer (approximate).
   */
  getTimeRemaining(gameId: string): number {
    const game = getGame(gameId);
    if (!game) return 0;
    // We don't store start time, so return full duration as approximation.
    // In production, track phase start times for precision.
    return this.getPhaseDuration(gameId, game.phase);
  }
}

// ============================================
// Singleton Engine Instance
// ============================================

export const gameEngine = new GameEngine();
