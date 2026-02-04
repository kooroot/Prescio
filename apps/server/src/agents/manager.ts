/**
 * Agent Manager — Orchestrates AI agents in the game
 *
 * Assigns personalities, coordinates discussion/voting/night actions.
 */
import { Role, type GameState, type Player, type ChatMessage } from "@prescio/common";
import { getGame, updateGame } from "../game/state.js";
import { addMessage, addSystemMessage, getRecentMessages } from "../game/discussion.js";
import { castVote } from "../game/vote.js";
import { executeKill } from "../game/round.js";
import { ImpostorAgent } from "./impostor.js";
import { CrewAgent } from "./crew.js";
import { BaseAgent, type AgentContext } from "./base.js";
import {
  pickPersonalities,
  type PersonalityProfile,
} from "./personalities/index.js";
import { getSystemMessages, normalizeLanguage, type GameLanguage } from "./i18n.js";

// ============================================
// Types
// ============================================

interface BotAssignment {
  playerId: string;
  agent: BaseAgent;
  personality: PersonalityProfile;
  role: Role;
}

// ============================================
// Agent Manager
// ============================================

export class AgentManager {
  /** gameId → bot assignments */
  private assignments = new Map<string, BotAssignment[]>();

  /** Callback for broadcasting chat messages */
  private onChatMessage?: (gameId: string, message: ChatMessage) => void;

  /** Callback for broadcasting vote cast events */
  private onVoteCast?: (gameId: string, voterId: string) => void;

  /**
   * Set a callback that gets called when a bot sends a chat message.
   * Used to broadcast messages via WebSocket.
   */
  setOnChatMessage(cb: (gameId: string, message: ChatMessage) => void): void {
    this.onChatMessage = cb;
  }

  /**
   * Set a callback for when a bot casts a vote.
   */
  setOnVoteCast(cb: (gameId: string, voterId: string) => void): void {
    this.onVoteCast = cb;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize agents for a game. Call after roles are assigned.
   * Assigns unique personalities to each bot player.
   */
  initializeAgents(game: GameState): void {
    const botPlayers = game.players.filter((p) => this.isBot(p));
    if (botPlayers.length === 0) return;

    const personalities = pickPersonalities(botPlayers.length);
    const assignments: BotAssignment[] = [];

    for (let i = 0; i < botPlayers.length; i++) {
      const player = botPlayers[i];
      const personality = personalities[i % personalities.length];
      const role = player.role!;

      const agent =
        role === Role.IMPOSTOR
          ? new ImpostorAgent(personality)
          : new CrewAgent(personality);

      assignments.push({
        playerId: player.id,
        agent,
        personality,
        role,
      });

      console.log(
        `[AgentManager] ${player.nickname} → ${role} / personality: ${personality.name}`,
      );
    }

    this.assignments.set(game.id, assignments);
  }

  /**
   * Check if a player is a bot (not a real WebSocket-connected human).
   * Bots are identified by having an address starting with 0x0000.
   */
  private isBot(player: Player): boolean {
    return player.address.startsWith("0x000000");
  }

  /**
   * Get bot assignments for a game.
   */
  private getBots(gameId: string): BotAssignment[] {
    return this.assignments.get(gameId) ?? [];
  }

  /**
   * Build agent context for a specific bot.
   */
  private buildContext(game: GameState, bot: BotAssignment): AgentContext {
    const player = game.players.find((p) => p.id === bot.playerId)!;
    const alivePlayers = game.players.filter((p) => p.isAlive);
    const deadPlayers = game.players.filter((p) => !p.isAlive);
    const recentMessages = getRecentMessages(game.id, 30);
    const language = normalizeLanguage(game.settings.language);

    const ctx: AgentContext = {
      game,
      playerId: bot.playerId,
      player,
      personality: bot.personality,
      alivePlayers,
      deadPlayers,
      recentMessages,
      round: game.round,
      language,
    };

    // Add teammate info for impostors
    if (bot.role === Role.IMPOSTOR) {
      ctx.teammates = game.players.filter(
        (p) => p.role === Role.IMPOSTOR && p.id !== bot.playerId && p.isAlive,
      );
    }

    return ctx;
  }

  // ============================================
  // Discussion Phase
  // ============================================

  /**
   * Run discussion: bots take turns speaking for 2-3 rounds.
   * Returns when all bots have spoken.
   */
  async runDiscussion(gameId: string): Promise<void> {
    const game = getGame(gameId);
    if (!game) return;

    const bots = this.getBots(gameId).filter((b) => {
      const player = game.players.find((p) => p.id === b.playerId);
      return player?.isAlive;
    });

    if (bots.length === 0) return;

    // Add system message about dead bodies if it's after a night
    const lang = normalizeLanguage(game.settings.language);
    const sysMessages = getSystemMessages(lang);
    const nightKills = game.killEvents.filter((ke) => ke.round === game.round);
    for (const kill of nightKills) {
      const victim = game.players.find((p) => p.id === kill.targetId);
      if (victim) {
        const { message: sysMsg } = addSystemMessage(
          gameId,
          sysMessages.bodyFound(victim.nickname),
        );
        this.onChatMessage?.(gameId, sysMsg);
        await this.delay(500);
      }
    }

    // 2-3 rounds of discussion
    const discussionRounds = Math.min(2 + Math.floor(Math.random() * 2), 3);

    for (let round = 0; round < discussionRounds; round++) {
      // Shuffle speaking order each round
      const shuffled = [...bots].sort(() => Math.random() - 0.5);

      for (const bot of shuffled) {
        // Re-fetch game state for fresh context
        const currentGame = getGame(gameId);
        if (!currentGame || currentGame.phase !== "DISCUSSION") return;

        const player = currentGame.players.find((p) => p.id === bot.playerId);
        if (!player?.isAlive) continue;

        try {
          const ctx = this.buildContext(currentGame, bot);
          const content = await bot.agent.generateMessage(ctx);

          if (content && content.trim()) {
            const { message: chatMsg } = addMessage(gameId, bot.playerId, content);
            this.onChatMessage?.(gameId, chatMsg);
          }
        } catch (err) {
          console.error(
            `[AgentManager] Failed to generate message for ${player.nickname}:`,
            err instanceof Error ? err.message : err,
          );
        }

        // Delay between messages for natural feel (1.5-3s)
        await this.delay(1500 + Math.random() * 1500);
      }

      // Pause between discussion rounds (1-2s)
      if (round < discussionRounds - 1) {
        await this.delay(1000 + Math.random() * 1000);
      }
    }
  }

  // ============================================
  // Voting Phase
  // ============================================

  /**
   * Run voting: each bot decides who to vote for.
   */
  async runVoting(gameId: string): Promise<void> {
    const game = getGame(gameId);
    if (!game) return;

    const bots = this.getBots(gameId).filter((b) => {
      const player = game.players.find((p) => p.id === b.playerId);
      return player?.isAlive;
    });

    if (bots.length === 0) return;

    // Shuffle voting order
    const shuffled = [...bots].sort(() => Math.random() - 0.5);

    for (const bot of shuffled) {
      const currentGame = getGame(gameId);
      if (!currentGame || currentGame.phase !== "VOTE") return;

      const player = currentGame.players.find((p) => p.id === bot.playerId);
      if (!player?.isAlive) continue;

      try {
        const ctx = this.buildContext(currentGame, bot);
        const targetId = await bot.agent.generateVote(ctx);

        castVote(gameId, bot.playerId, targetId);
        this.onVoteCast?.(gameId, bot.playerId);
        console.log(
          `[AgentManager] ${player.nickname} voted for ${
            targetId
              ? currentGame.players.find((p) => p.id === targetId)?.nickname ?? targetId
              : "SKIP"
          }`,
        );
      } catch (err) {
        console.error(
          `[AgentManager] Failed to vote for ${player.nickname}:`,
          err instanceof Error ? err.message : err,
        );
        // Fallback: skip vote
        try {
          castVote(gameId, bot.playerId, null);
        } catch {
          // Already voted or game state changed
        }
      }

      // Delay between votes (0.5-1.5s)
      await this.delay(500 + Math.random() * 1000);
    }
  }

  // ============================================
  // Night Phase
  // ============================================

  /**
   * Run night actions: impostor(s) choose kill target.
   * Returns the kill target ID for each impostor, or null.
   */
  async runNightAction(gameId: string): Promise<Array<{ killerId: string; targetId: string }>> {
    const game = getGame(gameId);
    if (!game) return [];

    const impostorBots = this.getBots(gameId).filter((b) => {
      const player = game.players.find((p) => p.id === b.playerId);
      return player?.isAlive && b.role === Role.IMPOSTOR;
    });

    if (impostorBots.length === 0) return [];

    const kills: Array<{ killerId: string; targetId: string }> = [];
    const killedThisNight = new Set<string>();

    for (const bot of impostorBots) {
      const currentGame = getGame(gameId);
      if (!currentGame || currentGame.phase !== "NIGHT") break;

      try {
        const ctx = this.buildContext(currentGame, bot);
        let targetId = await bot.agent.generateKillTarget(ctx);

        // Don't kill same target twice
        if (targetId && killedThisNight.has(targetId)) {
          const otherTargets = ctx.alivePlayers.filter(
            (p) =>
              p.id !== bot.playerId &&
              !killedThisNight.has(p.id) &&
              !ctx.teammates?.some((t) => t.id === p.id),
          );
          targetId = otherTargets.length > 0
            ? otherTargets[Math.floor(Math.random() * otherTargets.length)].id
            : null;
        }

        if (targetId) {
          executeKill(gameId, bot.playerId, targetId);
          killedThisNight.add(targetId);
          kills.push({ killerId: bot.playerId, targetId });

          const victim = currentGame.players.find((p) => p.id === targetId);
          console.log(
            `[AgentManager] ${currentGame.players.find((p) => p.id === bot.playerId)?.nickname} killed ${victim?.nickname}`,
          );
        }
      } catch (err) {
        console.error(
          `[AgentManager] Failed night action:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return kills;
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Remove agent assignments for a game.
   */
  cleanup(gameId: string): void {
    this.assignments.delete(gameId);
  }

  // ============================================
  // Utilities
  // ============================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Singleton
// ============================================

export const agentManager = new AgentManager();
