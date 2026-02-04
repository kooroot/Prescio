/**
 * Impostor Agent — AI agent playing as an impostor
 *
 * Strategy: Hide identity, create alibis, deflect suspicion, eliminate threats.
 */
import { BaseAgent, buildContextString, type AgentContext } from "./base.js";
import type { PersonalityProfile } from "./personalities/index.js";
import { getLanguageInstruction } from "./i18n.js";

const IMPOSTOR_SYSTEM_PROMPT = `
You are an impostor in a Mafia (Among Us-style) game.
Your goal is to hide your identity while eliminating crew members one by one.

## Core Strategy
1. **Never reveal that you are the impostor**
2. **Create natural alibis** — say things like "I was doing X earlier"
3. **Deflect suspicion to other crew members** — but don't be too obvious or you'll get caught
4. **Stay calm when suspected** — getting angry or flustered makes you more suspicious
5. **Go along with the crowd sometimes** — act like you're following the majority opinion
6. **Don't be too aggressive in accusing others** — impostors who accuse others get counter-suspected

## Discussion Strategy
- Act like a crew member. Agree with others: "Yeah, I also thought {name} was acting weird"
- Create specific alibis, but don't over-explain — too many details look suspicious
- Show appropriate reactions to deaths (shock, sadness)
- Occasionally point out contradictions in others' statements (to look like a crew member)
- But steer public opinion toward a main target

## Voting Strategy
- Vote for the most threatening crew member (whoever suspects you, or the most analytical player)
- But don't vote alone against the crowd — that draws attention. Read the room.
- If the majority targets another crew member, go along with it (safe choice)

## Kill Target Strategy
- Prioritize eliminating players who suspect you the most
- Analytical, logical players are the most dangerous
- Quiet players can be dealt with later

## Important Rules
- Use natural conversational language
- Never mention the game system or AI
- Never reveal that you are the impostor
`.trim();

export class ImpostorAgent extends BaseAgent {
  constructor(personality: PersonalityProfile) {
    super(IMPOSTOR_SYSTEM_PROMPT, personality);
  }

  /**
   * Override: Generate message with impostor-specific context.
   */
  override async generateMessage(ctx: AgentContext): Promise<string> {
    // Add teammate info to context for strategic awareness
    const contextStr = buildContextString(ctx);
    const langInstruction = getLanguageInstruction(ctx.language);
    const teammateInfo = ctx.teammates
      ? `\n\n=== Fellow Impostors (SECRET INFO) ===\n${ctx.teammates.map((t) => `  - ${t.nickname}`).join("\n")}\n(You must NEVER mention this information in chat!)`
      : "";

    const fullSystemPrompt = `${this.systemPrompt}\n\n${this.personality.systemPromptModifier}`;

    const userMessage = `
${contextStr}${teammateInfo}

Based on the game state and chat above, participate in the discussion while hiding your identity as an impostor.
Act naturally as if you were a crew member.
Make a single statement.
Use other players' nicknames to refer to them specifically.
Maximum ${this.personality.styleGuide.maxSentences} sentences.
Output only your spoken dialogue. No quotes or meta-expressions.

${langInstruction}
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 150);
    return result || "...";
  }

  /**
   * Override: Strategic kill target selection.
   */
  override async generateKillTarget(ctx: AgentContext): Promise<string | null> {
    const contextStr = buildContextString(ctx);
    const fullSystemPrompt = `${this.systemPrompt}\n\n${this.personality.systemPromptModifier}`;

    // Filter crew members only (can't kill fellow impostors)
    const crewTargets = ctx.alivePlayers.filter(
      (p) => p.id !== ctx.playerId && (!ctx.teammates || !ctx.teammates.some((t) => t.id === p.id)),
    );

    if (crewTargets.length === 0) return null;

    const candidates = crewTargets
      .map((p) => `  - "${p.nickname}" (ID: ${p.id})`)
      .join("\n");

    const userMessage = `
${contextStr}

Night has fallen. As the impostor, decide who to eliminate.

Available targets:
${candidates}

Strategically choose the most dangerous crew member:
- Someone who suspected you
- Someone who made sharp deductions
- Someone who leads public opinion

Output ONLY the target's ID. No explanations — just the ID.
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 100);

    // Try to match a valid ID
    for (const p of crewTargets) {
      if (result.includes(p.id)) return p.id;
    }
    // Try nickname match
    for (const p of crewTargets) {
      if (result.includes(p.nickname)) return p.id;
    }

    // Fallback: random target
    return crewTargets[Math.floor(Math.random() * crewTargets.length)].id;
  }
}
