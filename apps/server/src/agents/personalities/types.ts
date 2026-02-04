/**
 * Personality System Types
 */

export interface PersonalityStyleGuide {
  /** short / medium / long */
  sentenceLength: "short" | "medium" | "long";
  /** Maximum number of sentences per message */
  maxSentences: number;
  /** Overall tone */
  tone: string;
  /** Example phrases with {name} placeholder for player names */
  examplePhrases: string[];
}

export interface PersonalityProfile {
  id: string;
  nameKo: string;
  systemPromptModifier: string;
  styleGuide: PersonalityStyleGuide;
}
