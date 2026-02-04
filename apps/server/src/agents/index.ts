/**
 * Agents module — public API
 */
export { BaseAgent } from "./base.js";
export type { AgentContext } from "./base.js";
export { ImpostorAgent } from "./impostor.js";
export { CrewAgent } from "./crew.js";
export { AgentManager, agentManager } from "./manager.js";
export {
  ALL_PERSONALITIES,
  pickPersonalities,
} from "./personalities/index.js";
export type { PersonalityProfile } from "./personalities/index.js";
