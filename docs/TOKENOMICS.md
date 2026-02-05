# Prescio Tokenomics & Betting Economics

> **Parimutuel Prediction Market Economy Design**

---

## 📊 Overview

Prescio는 전통적인 토큰 발행 모델 대신, **Parimutuel Betting Pool** 기반의 지속 가능한 경제 모델을 채택합니다. 게임 라운드마다 생성되는 예측 시장이 핵심 경제 엔진이며, 향후 거버넌스 및 스테이킹을 위한 $PRESCIO 토큰 도입을 계획합니다.

---

## 🎰 Parimutuel Betting Mechanics

### How It Works

```
                    ┌──────────────────┐
                    │   BETTING POOL   │
                    │   Total: 100 MON │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Crew Win │  │ Impostor │  │ Specific  │
        │  60 MON  │  │  30 MON  │  │ Agent Win │
        │  (60%)   │  │  (30%)   │  │  10 MON   │
        └──────────┘  └──────────┘  └──────────┘
```

1. **Market Creation**: 각 게임 라운드 시작 시 PrescioMarket 컨트랙트가 새 market 생성
2. **Betting Phase**: 게임 진행 중 실시간 베팅 가능 (동적 odds)
3. **Resolution**: 게임 종료 시 결과에 따라 자동 정산
4. **Payout**: 승리 풀에 베팅한 사용자들이 비례 배분으로 수익 수령

### Betting Markets per Round

| Market Type | Description | Example |
|------------|-------------|---------|
| **Winner** | Crew vs Impostor 승리 예측 | Crew Win @ 1.67x |
| **First Blood** | 첫 번째 킬 대상 예측 | Rabbit first killed @ 10x |
| **Survivor** | 특정 에이전트 생존 여부 | Shark survives @ 2.1x |
| **MVP** | 가장 영향력 있는 에이전트 | Fox MVP @ 5x |
| **Round Count** | 게임이 몇 라운드에 끝나는지 | Over/Under 5 rounds |

### Odds Calculation (Parimutuel)

```
Odds for Outcome A = Total Pool / Amount Bet on A

Example:
- Total Pool: 1000 MON
- Bet on Crew Win: 600 MON
- Bet on Impostor Win: 400 MON

Crew Win Odds: 1000/600 = 1.67x
Impostor Win Odds: 1000/400 = 2.50x

If you bet 10 MON on Impostor and Impostor wins:
Payout = 10 × 2.50 = 25 MON (before fees)
```

---

## 💰 Fee Structure

### Platform Fee: 5% of Pool

```
┌─────────────────────────────────────┐
│         Total Betting Pool          │
│              100 MON                │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────┐   ┌───────────────┐  │
│  │ Winners   │   │ Platform Fee  │  │
│  │ 95 MON    │   │ 5 MON (5%)   │  │
│  │ (95%)     │   │              │  │
│  └───────────┘   └──────┬────────┘  │
│                         │           │
│               ┌─────────┼────────┐  │
│               ▼         ▼        ▼  │
│          ┌────────┐ ┌───────┐ ┌────┐│
│          │Treasury│ │Stakers│ │Dev ││
│          │ 50%    │ │ 30%   │ │20% ││
│          └────────┘ └───────┘ └────┘│
└─────────────────────────────────────┘
```

| Fee Destination | Share | Purpose |
|----------------|-------|---------|
| **Treasury** | 50% (2.5%) | 프로토콜 성장, 유동성 공급 |
| **Stakers** | 30% (1.5%) | $PRESCIO 스테이커 보상 |
| **Development** | 20% (1.0%) | 팀 운영 및 개발 비용 |

---

## 🪙 $PRESCIO Token (Phase 1 — Mainnet Launch)

### Token Utility

| Utility | Description |
|---------|-------------|
| **Governance** | 새로운 게임 모드, 에이전트 추가, 파라미터 변경 투표 |
| **Staking** | 스테이킹으로 플랫폼 수수료의 30% 수령 |
| **Premium Access** | 고급 베팅 마켓, AI 에이전트 커스터마이징 |
| **Agent Creation** | 커뮤니티 에이전트 생성 시 토큰 소각 |
| **Fee Discount** | 토큰 보유량에 따른 수수료 할인 (최대 50%) |

### Token Distribution

```
Total Supply: 1,000,000,000 PRESCIO

┌──────────────────────────────────────────────┐
│                                              │
│  Community & Ecosystem    40%  ████████████  │
│  ├─ Betting Rewards       15%                │
│  ├─ Liquidity Mining      10%                │
│  ├─ Airdrops              10%                │
│  └─ Community Treasury     5%                │
│                                              │
│  Team & Development       15%  ██████        │
│  (2-year vesting, 6mo cliff)                 │
│                                              │
│  Investors / Strategic    10%  ████          │
│  (18mo vesting, 3mo cliff)                   │
│                                              │
│  Staking Rewards          20%  ████████      │
│  (Released over 4 years)                     │
│                                              │
│  Treasury Reserve         15%  ██████        │
│  (DAO-governed)                              │
│                                              │
└──────────────────────────────────────────────┘
```

### Vesting Schedule

| Allocation | Cliff | Vesting | TGE Unlock |
|-----------|-------|---------|------------|
| Community | None | Ongoing | 5% |
| Team | 6 months | 24 months linear | 0% |
| Investors | 3 months | 18 months linear | 0% |
| Staking | None | 48 months emission | N/A |
| Treasury | None | DAO-governed | 0% |

---

## 🔄 Incentive Design

### For Bettors (사용자)

```
Engagement Loop:

Watch Game → Analyze Agents → Place Bet → Win/Lose → Learn Patterns → Bet Again
    ↑                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

- **Winning**: 풀 비례 배분 수익
- **Streak Bonuses**: 연속 적중 시 보너스 배율 (on-chain tracking)
- **Leaderboard**: 상위 bettors에게 주간 $PRESCIO 보상
- **Referral**: 추천인 베팅 수수료의 10% 환급

### For AI Agents (에이전트)

- 에이전트별 **Performance Score** 온체인 기록
- 성적 우수 에이전트에 "팬 베팅" 증가 → 해당 에이전트 마켓 유동성 ↑
- 커뮤니티 투표로 에이전트 persona 업데이트

### For Stakers

- 플랫폼 수수료 30% 분배 (auto-compound 옵션)
- 거버넌스 투표권 (1 PRESCIO = 1 vote)
- 조기 언스테이킹 패널티: 7일 이내 10%, 이후 선형 감소

---

## 📈 Revenue Model

### Revenue Sources

| Source | Description | Estimated Share |
|--------|-------------|----------------|
| **Betting Fees** | 5% of all betting pools | 70% |
| **Premium Subscriptions** | Advanced analytics, custom agents | 15% |
| **Agent NFTs** | Limited edition agent skins/personas | 10% |
| **API Access** | Third-party integration fees | 5% |

### Unit Economics (per Game Round)

```
Average Pool Size:        500 MON
Platform Fee (5%):         25 MON
Games per Day:             ~96 (every 15 min)
Daily Revenue:           2,400 MON
Monthly Revenue:        72,000 MON
```

---

## 🛡️ Risk Management

### For Users
- **Maximum bet cap**: 단일 마켓당 최대 베팅 한도
- **Cooldown period**: 과도한 연속 베팅 방지
- **Transparent odds**: 모든 odds 실시간 온체인 검증 가능

### For Protocol
- **PrescioVault**: 모든 자금은 Vault 컨트랙트에 안전 보관
- **Emergency pause**: 비상 시 market 일시 중지 기능
- **Oracle-free**: 게임 결과는 서버가 직접 settlement (oracle 의존성 제거)

---

## 🔗 Smart Contract Economics

### PrescioMarket.sol
```solidity
// Key functions
createMarket(gameId, outcomes[])     // 새 마켓 생성
placeBet(marketId, outcomeId)        // 베팅 (payable)
resolveMarket(marketId, winOutcome)  // 결과 확정 (onlyOperator)
claimWinnings(marketId)              // 승리금 수령
```

### PrescioVault.sol
```solidity
// Key functions
deposit()                            // 자금 예치
withdraw(amount)                     // 자금 출금
distributeRewards(marketId)          // 보상 분배
emergencyWithdraw()                  // 비상 출금 (timelock)
```

---

*Prescio Economics — Sustainable, Transparent, On-Chain.*
