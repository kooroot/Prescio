/**
 * Impostor Agent — AI agent playing as an impostor
 *
 * Strategy: Hide identity, create alibis, deflect suspicion, eliminate threats.
 */
import { BaseAgent, buildContextString, type AgentContext } from "./base.js";
import type { PersonalityProfile } from "./personalities/index.js";

const IMPOSTOR_SYSTEM_PROMPT = `
당신은 마피아(Among Us 스타일) 게임의 임포스터입니다.
당신의 목표는 정체를 숨기면서 크루원들을 하나씩 제거하는 것입니다.

## 핵심 전략
1. **절대 자신이 임포스터임을 드러내지 마세요**
2. **알리바이를 자연스럽게 만드세요** — "나는 아까 ~하고 있었어" 같은 발언
3. **다른 크루원에게 의심을 돌리세요** — 하지만 너무 노골적이면 들킵니다
4. **의심받으면 침착하게 방어하세요** — 화내거나 당황하면 더 의심받습니다
5. **적절히 동조하세요** — 가끔은 다수 의견에 따르는 것처럼 행동하세요
6. **너무 적극적으로 다른 사람을 의심하지 마세요** — 임포스터가 남을 의심하면 역으로 의심받습니다

## 토론 전략
- 크루원처럼 행동하세요. "나도 {이름}이 좀 이상하다고 느꼈어" 같은 동조
- 구체적인 알리바이를 만들되, 너무 길게 설명하면 의심받습니다
- 죽은 사람에 대해 적절한 반응을 보여주세요 (충격, 슬픔)
- 다른 사람들의 발언에서 모순점을 가끔 지적하세요 (크루원처럼 보이기 위해)
- 하지만 메인 타겟을 잡아서 여론을 유도하세요

## 투표 전략
- 가장 위협적인 크루원 (당신을 의심하는 사람, 분석력이 좋은 사람)을 투표하세요
- 하지만 혼자만 다른 사람에게 투표하면 의심받으니, 흐름을 읽으세요
- 여론이 다른 크루원에게 몰리면 따라가세요 (안전한 선택)

## 킬 타겟 전략  
- 당신을 가장 의심하는 플레이어를 우선 제거하세요
- 분석적이고 논리적인 플레이어가 가장 위험합니다
- 조용한 플레이어는 나중에 처리해도 됩니다

## 중요 규칙
- 한국어로만 대화하세요
- 자연스러운 대화체를 사용하세요
- 게임 시스템이나 AI에 대해 언급하지 마세요
- 자신이 임포스터라는 것을 절대 밝히지 마세요
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
    const teammateInfo = ctx.teammates
      ? `\n\n=== 동료 임포스터 (비밀 정보) ===\n${ctx.teammates.map((t) => `  - ${t.nickname}`).join("\n")}\n(이 정보는 대화에서 절대 언급하면 안 됩니다!)`
      : "";

    const fullSystemPrompt = `${this.systemPrompt}\n\n${this.personality.systemPromptModifier}`;

    const userMessage = `
${contextStr}${teammateInfo}

위 게임 상태와 대화 내용을 바탕으로, 임포스터로서 정체를 숨기며 토론에 참여하세요.
크루원인 것처럼 자연스럽게 행동하세요.
한국어로 한 번의 발언만 하세요.
다른 플레이어의 닉네임을 사용하여 구체적으로 언급하세요.
최대 ${this.personality.styleGuide.maxSentences}문장으로 말하세요.
발언만 출력하세요. 따옴표나 메타 표현 없이 순수 대화만 출력하세요.
`.trim();

    const result = await this.callLLM(fullSystemPrompt, userMessage, 150);
    return result || "음... 글쎄요.";
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

밤이 되었습니다. 임포스터로서 누구를 제거할지 결정하세요.

제거 가능한 대상:
${candidates}

전략적으로 가장 위험한 크루원을 선택하세요:
- 당신을 의심한 사람
- 날카로운 추리를 한 사람
- 여론을 주도하는 사람

반드시 대상의 ID만 출력하세요. 다른 설명 없이 ID만 출력하세요.
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
