/**
 * i18n — Multi-language support for agent prompts and system messages
 *
 * Prompts are always in English for best LLM performance.
 * The language instruction at the end tells the LLM which language to respond in.
 */

export type GameLanguage = "en" | "ko" | "ja" | "zh";

export const SUPPORTED_LANGUAGES: GameLanguage[] = ["en", "ko", "ja", "zh"];

export const DEFAULT_LANGUAGE: GameLanguage = "en";

// ============================================
// Language Instructions (appended to prompts)
// ============================================

const LANGUAGE_INSTRUCTIONS: Record<GameLanguage, string> = {
  en: "You MUST respond in English.",
  ko: "You MUST respond in Korean (한국어). 자연스러운 한국어 구어체를 사용하세요.",
  ja: "You MUST respond in Japanese (日本語). 自然な日本語の口語体を使用してください。",
  zh: "You MUST respond in Chinese (中文). 请使用自然的中文口语。",
};

/**
 * Get the language instruction to append to the end of prompts.
 */
export function getLanguageInstruction(lang: GameLanguage): string {
  return LANGUAGE_INSTRUCTIONS[lang] ?? LANGUAGE_INSTRUCTIONS[DEFAULT_LANGUAGE];
}

// ============================================
// System Messages (UI-facing, translated)
// ============================================

interface SystemMessages {
  bodyFound: (nickname: string) => string;
  systemSpeaker: string;
  chatHistoryLabel: string;
  systemLabel: string;
  noDeathsYet: string;
  noChatYet: string;
  none: string;
}

const SYSTEM_MESSAGES: Record<GameLanguage, SystemMessages> = {
  en: {
    bodyFound: (nickname: string) => `💀 ${nickname}'s body was found!`,
    systemSpeaker: "System",
    chatHistoryLabel: "[System]",
    systemLabel: "[System]",
    noDeathsYet: "(No deaths yet)",
    noChatYet: "(No chat yet)",
    none: "(None)",
  },
  ko: {
    bodyFound: (nickname: string) => `💀 ${nickname}의 시체가 발견되었습니다!`,
    systemSpeaker: "시스템",
    chatHistoryLabel: "[시스템]",
    systemLabel: "[시스템]",
    noDeathsYet: "(아직 사망자 없음)",
    noChatYet: "(아직 대화 없음)",
    none: "(없음)",
  },
  ja: {
    bodyFound: (nickname: string) => `💀 ${nickname}の遺体が発見されました！`,
    systemSpeaker: "システム",
    chatHistoryLabel: "[システム]",
    systemLabel: "[システム]",
    noDeathsYet: "(まだ死亡者なし)",
    noChatYet: "(まだ会話なし)",
    none: "(なし)",
  },
  zh: {
    bodyFound: (nickname: string) => `💀 发现了${nickname}的尸体！`,
    systemSpeaker: "系统",
    chatHistoryLabel: "[系统]",
    systemLabel: "[系统]",
    noDeathsYet: "(暂无死亡)",
    noChatYet: "(暂无聊天)",
    none: "(无)",
  },
};

/**
 * Get system messages for a given language.
 */
export function getSystemMessages(lang: GameLanguage): SystemMessages {
  return SYSTEM_MESSAGES[lang] ?? SYSTEM_MESSAGES[DEFAULT_LANGUAGE];
}

/**
 * Validate and normalize a language code.
 */
export function normalizeLanguage(lang: string | undefined): GameLanguage {
  if (lang && SUPPORTED_LANGUAGES.includes(lang as GameLanguage)) {
    return lang as GameLanguage;
  }
  return DEFAULT_LANGUAGE;
}
