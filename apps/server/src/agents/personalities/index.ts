/**
 * Personality System — 20 unique personality types for AI agents
 */

export type { PersonalityProfile, PersonalityStyleGuide } from "./types.js";

// Original 5 personalities
export { aggressivePersonality } from "./aggressive.js";
export { analyticalPersonality } from "./analytical.js";
export { quietPersonality } from "./quiet.js";
export { socialPersonality } from "./social.js";
export { chaoticPersonality } from "./chaotic.js";

// Expanded 15 personalities
export {
  detectivePersonality,
  paranoidPersonality,
  peacemakerPersonality,
  jokerPersonality,
  strategistPersonality,
  emotionalPersonality,
  veteranPersonality,
  newcomerPersonality,
  leaderPersonality,
  skepticPersonality,
  observerPersonality,
  loyalistPersonality,
  manipulatorPersonality,
  hotHeadPersonality,
  philosopherPersonality,
} from "./expanded.js";

import type { PersonalityProfile } from "./types.js";
import { aggressivePersonality } from "./aggressive.js";
import { analyticalPersonality } from "./analytical.js";
import { quietPersonality } from "./quiet.js";
import { socialPersonality } from "./social.js";
import { chaoticPersonality } from "./chaotic.js";
import {
  detectivePersonality,
  paranoidPersonality,
  peacemakerPersonality,
  jokerPersonality,
  strategistPersonality,
  emotionalPersonality,
  veteranPersonality,
  newcomerPersonality,
  leaderPersonality,
  skepticPersonality,
  observerPersonality,
  loyalistPersonality,
  manipulatorPersonality,
  hotHeadPersonality,
  philosopherPersonality,
} from "./expanded.js";

/**
 * All 20 available personalities
 */
export const ALL_PERSONALITIES: PersonalityProfile[] = [
  // Original 5
  aggressivePersonality,
  analyticalPersonality,
  quietPersonality,
  socialPersonality,
  chaoticPersonality,
  // Expanded 15
  detectivePersonality,
  paranoidPersonality,
  peacemakerPersonality,
  jokerPersonality,
  strategistPersonality,
  emotionalPersonality,
  veteranPersonality,
  newcomerPersonality,
  leaderPersonality,
  skepticPersonality,
  observerPersonality,
  loyalistPersonality,
  manipulatorPersonality,
  hotHeadPersonality,
  philosopherPersonality,
];

/**
 * Pick N unique personalities randomly (Fisher-Yates shuffle).
 */
export function pickPersonalities(count: number): PersonalityProfile[] {
  const shuffled = [...ALL_PERSONALITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
