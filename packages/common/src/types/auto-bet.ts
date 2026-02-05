/**
 * Auto-Bet Strategy Types
 */

export type AutoBetStrategyType = 'conservative' | 'balanced' | 'aggressive';

export interface AutoBetConfig {
  odometer: string; // wallet address
  strategy: AutoBetStrategyType;
  maxBetPerRound: string; // in wei
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AutoBetStatus {
  config: AutoBetConfig | null;
  currentGameId: string | null;
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  profitLoss: string; // in wei
}

export interface StrategyDecision {
  shouldBet: boolean;
  targetPlayer: string | null;
  betAmount: string; // in wei
  confidence: number; // 0-1
  reasoning: string;
}

export const STRATEGY_DESCRIPTIONS: Record<AutoBetStrategyType, {
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  riskLevel: 'low' | 'medium' | 'high';
  icon: string;
}> = {
  conservative: {
    name: 'Conservative',
    nameKo: '보수적',
    description: 'Follow majority opinion, small bets. Lower risk, steady returns.',
    descriptionKo: '다수 의견 추종, 소액 베팅. 낮은 리스크, 안정적 수익.',
    riskLevel: 'low',
    icon: '🛡️',
  },
  balanced: {
    name: 'Balanced',
    nameKo: '균형',
    description: 'Analyze win probability, medium bets. Balanced risk-reward.',
    descriptionKo: '승률 분석, 중간 베팅. 균형 잡힌 리스크-수익.',
    riskLevel: 'medium',
    icon: '⚖️',
  },
  aggressive: {
    name: 'Aggressive',
    nameKo: '공격적',
    description: 'Contrarian bets on high odds. High risk, high potential reward.',
    descriptionKo: '역배팅 + 고배당 노림. 높은 리스크, 높은 잠재 수익.',
    riskLevel: 'high',
    icon: '🔥',
  },
};
