/**
 * Personality System — Export all personalities
 */
export type { PersonalityProfile, PersonalityStyleGuide } from "./types.js";

export { aggressivePersonality } from "./aggressive.js";
export { analyticalPersonality } from "./analytical.js";
export { quietPersonality } from "./quiet.js";
export { socialPersonality } from "./social.js";
export { chaoticPersonality } from "./chaotic.js";

import { aggressivePersonality } from "./aggressive.js";
import { analyticalPersonality } from "./analytical.js";
import { quietPersonality } from "./quiet.js";
import { socialPersonality } from "./social.js";
import { chaoticPersonality } from "./chaotic.js";
import type { PersonalityProfile } from "./types.js";

/** All available personalities */
export const ALL_PERSONALITIES: PersonalityProfile[] = [
  aggressivePersonality,
  analyticalPersonality,
  quietPersonality,
  socialPersonality,
  chaoticPersonality,
];

/**
 * Pick N unique personalities randomly (Fisher-Yates shuffle).
 */
export function pickPersonalities(count: number): PersonalityProfile[] {
  const shuffled = [...ALL_PERSONALITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
