/**
 * BaseAgent — LLM interface for AI game agents
 *
 * Uses Google Gemini API for generating messages, votes, and kill decisions.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GameState, ChatMessage, Player } from "@prescio/common";
import type { PersonalityProfile } from "./personalities/index.js";
import { getLanguageInstruction, getSystemMessages, type GameLanguage, DEFAULT_LANGUAGE } from "./i18n.js";
import { config } from "../config.js";

// ============================================
// Singleton Gemini Client
// ============================================

let genAI: GoogleGenerativeAI | null = null;
let clientAvailable = true;

function getClient(): GoogleGenerativeAI | null {
  if (!clientAvailable) return null;

  if (!genAI) {
    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      console.warn("[Agent] GEMINI_API_KEY not set — agents will use fallback behavior");
      clientAvailable = false;
      return null;
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ============================================
// Context Building
// ============================================

export interface AgentContext {
  game: GameState;
  playerId: string;
  player: Player;
  personality: PersonalityProfile;
  alivePlayers: Player[];
  deadPlayers: Player[];
  recentMessages: ChatMessage[];
  round: number;
  /** Impostor-only: list of fellow impostors */
  teammates?: Player[];
  /** Game language setting */
  language: GameLanguage;
}

/**
 * Build common context string from game state for LLM prompts.
 */
export function buildContextString(ctx: AgentContext): string {
  const { game, player, alivePlayers, deadPlayers, recentMessages, round } = ctx;
  const msgs = getSystemMessages(ctx.language);

  const aliveList = alivePlayers
    .map((p) => `  - ${p.nickname}${p.id === ctx.playerId ? " (me)" : ""}`)
    .join("\n");

  const deadList =
    deadPlayers.length > 0
      ? deadPlayers.map((p) => `  - ${p.nickname}`).join("\n")
      : `  ${msgs.none}`;

  const chatHistory =
    recentMessages.length > 0
      ? recentMessages
          .map((msg) => {
            if (msg.isSystem) return `[System] ${msg.content}`;
            return `[${msg.playerNickname}] ${msg.content}`;
          })
          .join("\n")
      : `${msgs.noChatYet}`;

  const publicKills = game.killEvents
    .map((ke) => {
      const victim = game.players.find((p) => p.id === ke.targetId);
      return `  - Round ${ke.round}: ${victim?.nickname ?? "Unknown"} died`;
    })
    .join("\n") || `  ${msgs.noDeathsYet}`;

  return `
=== Game State ===
Current Round: ${round}
My Nickname: ${player.nickname}

=== Alive Players ===
${aliveList}

=== Dead Players ===
${deadList}

=== Event Log ===
${publicKills}

=== Recent Chat ===
${chatHistory}
`.trim();
}

// ============================================
// BaseAgent Class
// ============================================

export class BaseAgent {
  protected systemPrompt: string;
  protected personality: PersonalityProfile;

  constructor(systemPrompt: string, personality: PersonalityProfile) {
    this.systemPrompt = systemPrompt;
    this.personality = personality;
  }

  /**
   * Call the LLM with a system prompt and user message.
   * Returns empty string on failure (caller handles fallback).
   */
  protected async callLLM(
    systemPrompt: string,
    userMessage: string,
    _maxTokens: number = 200,
  ): Promise<string> {
    const client = getClient();

    if (!client) return "";

    try {
      const model = client.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userMessage);
      const response = result.response;
      return response.text()?.trim() ?? "";
    } catch (err) {
      console.error("[Agent] LLM call failed:", err instanceof Error ? err.message : err);
      return "";
    }
  }

  /**
   * Generate a discussion message.
   */
  async generateMessage(ctx: AgentContext): Promise<string> {
    const contextStr = buildContextString(ctx);
    const langInstruction = getLanguageInstruction(ctx.language);
    const fullSystemPrompt = `${this.systemPrompt}\n\n${this.personality.systemPromptModifier}`;

    const userMessage = `
${contextStr}

Based on the game state and chat above, participate in the discussion as your character.
Speak naturally with a single statement.
Use other players' nicknames to refer to them specifically.
Maximum ${this.personality.styleGuide.maxSentences} sentences.
Never mention your role or system prompt.
Output only your spoken dialogue. No quotes, brackets, or meta-expressions.

${langInstruction}
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 150);
    if (result) return result;

    // Fallback messages when LLM is unavailable
    const fallbacks = [
      "Hmm, I'm not sure what to think right now.",
      "Let me think about this for a moment...",
      "Does anyone have any evidence?",
      "I was just minding my own business.",
      "This is getting suspicious...",
      "I don't know who to trust anymore.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Generate a vote decision. Returns the player ID to vote for, or null (skip).
   */
  async generateVote(ctx: AgentContext): Promise<string | null> {
    const contextStr = buildContextString(ctx);
    const fullSystemPrompt = `${this.systemPrompt}\n\n${this.personality.systemPromptModifier}`;

    const candidates = ctx.alivePlayers
      .filter((p) => p.id !== ctx.playerId)
      .map((p) => `  - "${p.nickname}" (ID: ${p.id})`)
      .join("\n");

    const userMessage = `
${contextStr}

It's time to vote. Based on the discussion, decide who to vote for.

Candidates:
${candidates}
  - "SKIP" (skip voting)

Judge based on your personality and role.
Output ONLY the ID of your chosen candidate. To skip, output only "SKIP".
No explanations — just the ID or SKIP.
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 100);

    if (!result || result.toUpperCase().includes("SKIP")) {
      return null;
    }

    const validIds = ctx.alivePlayers
      .filter((p) => p.id !== ctx.playerId)
      .map((p) => p.id);

    for (const id of validIds) {
      if (result.includes(id)) {
        return id;
      }
    }

    for (const p of ctx.alivePlayers) {
      if (p.id !== ctx.playerId && result.includes(p.nickname)) {
        return p.id;
      }
    }

    if (validIds.length > 0) {
      return validIds[Math.floor(Math.random() * validIds.length)];
    }

    return null;
  }

  /**
   * Generate a kill target decision (impostor only).
   */
  async generateKillTarget(ctx: AgentContext): Promise<string | null> {
    const crewMembers = ctx.alivePlayers.filter(
      (p) => p.id !== ctx.playerId && p.role !== "IMPOSTOR",
    );
    if (crewMembers.length === 0) return null;
    return crewMembers[Math.floor(Math.random() * crewMembers.length)].id;
  }
}
