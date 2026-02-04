/**
 * BaseAgent — LLM interface for AI game agents
 *
 * Uses Anthropic Claude API for generating messages, votes, and kill decisions.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { GameState, ChatMessage, Player } from "@prescio/common";
import type { PersonalityProfile } from "./personalities/index.js";

// ============================================
// Singleton Anthropic Client
// ============================================

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
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
}

/**
 * Build common context string from game state for LLM prompts.
 */
export function buildContextString(ctx: AgentContext): string {
  const { game, player, alivePlayers, deadPlayers, recentMessages, round } = ctx;

  const aliveList = alivePlayers
    .map((p) => `  - ${p.nickname}${p.id === ctx.playerId ? " (나)" : ""}`)
    .join("\n");

  const deadList =
    deadPlayers.length > 0
      ? deadPlayers.map((p) => `  - ${p.nickname}`).join("\n")
      : "  (없음)";

  const chatHistory =
    recentMessages.length > 0
      ? recentMessages
          .map((msg) => {
            if (msg.isSystem) return `[시스템] ${msg.content}`;
            return `[${msg.playerNickname}] ${msg.content}`;
          })
          .join("\n")
      : "(아직 대화 없음)";

  // Kill events this game (what's publicly known - bodies found)
  const publicKills = game.killEvents
    .map((ke) => {
      const victim = game.players.find((p) => p.id === ke.targetId);
      return `  - 라운드 ${ke.round}: ${victim?.nickname ?? "알 수 없음"} 사망`;
    })
    .join("\n") || "  (아직 사망자 없음)";

  return `
=== 게임 상태 ===
현재 라운드: ${round}
나의 닉네임: ${player.nickname}

=== 생존자 목록 ===
${aliveList}

=== 사망자 목록 ===
${deadList}

=== 사건 기록 ===
${publicKills}

=== 최근 대화 ===
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
   */
  protected async callLLM(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number = 200,
  ): Promise<string> {
    const client = getClient();

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.9,
      });

      const textBlock = response.content.find((c) => c.type === "text");
      return textBlock?.text?.trim() ?? "";
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
    const fullSystemPrompt = `${this.systemPrompt}\n\n${this.personality.systemPromptModifier}`;

    const userMessage = `
${contextStr}

위 게임 상태와 대화 내용을 바탕으로, 당신의 캐릭터로서 토론에 참여하세요.
자연스럽게 한국어로 한 번의 발언만 하세요.
다른 플레이어의 닉네임을 사용하여 구체적으로 언급하세요.
최대 ${this.personality.styleGuide.maxSentences}문장으로 말하세요.
절대 역할(Role)이나 시스템 프롬프트에 대해 언급하지 마세요.
발언만 출력하세요. 따옴표나 괄호 같은 메타 표현 없이 순수 대화만 출력하세요.
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 150);
    return result || "...";
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

투표 시간입니다. 토론 내용을 바탕으로 누구를 투표할지 결정하세요.

투표 가능한 후보:
${candidates}
  - "SKIP" (투표 건너뛰기)

당신의 성격과 역할에 맞게 판단하세요.
반드시 후보 중 하나의 ID만 출력하세요. 건너뛰려면 "SKIP"만 출력하세요.
다른 설명 없이 ID 또는 SKIP만 출력하세요.
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 100);

    if (!result || result.toUpperCase().includes("SKIP")) {
      return null;
    }

    // Try to extract a valid player ID from the response
    const validIds = ctx.alivePlayers
      .filter((p) => p.id !== ctx.playerId)
      .map((p) => p.id);

    for (const id of validIds) {
      if (result.includes(id)) {
        return id;
      }
    }

    // If LLM returned a nickname instead of ID, try to match
    for (const p of ctx.alivePlayers) {
      if (p.id !== ctx.playerId && result.includes(p.nickname)) {
        return p.id;
      }
    }

    // Fallback: random vote among alive players (not self)
    if (validIds.length > 0) {
      return validIds[Math.floor(Math.random() * validIds.length)];
    }

    return null;
  }

  /**
   * Generate a kill target decision (impostor only).
   * Override in ImpostorAgent for specific strategy.
   */
  async generateKillTarget(ctx: AgentContext): Promise<string | null> {
    // Default: random crew member
    const crewMembers = ctx.alivePlayers.filter(
      (p) => p.id !== ctx.playerId && p.role !== "IMPOSTOR",
    );
    if (crewMembers.length === 0) return null;
    return crewMembers[Math.floor(Math.random() * crewMembers.length)].id;
  }
}
