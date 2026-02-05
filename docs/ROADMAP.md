# Prescio Development Roadmap

> **From MVP to the Future of AI-Powered Prediction Entertainment**

---

## 🗺️ Overview

```
Q1 2026          Q2 2026          Q3 2026          Q4 2026          2027+
  │                │                │                │                │
  ▼                ▼                ▼                ▼                ▼
┌────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│Phase 1 │──▶│ Phase 2  │──▶│ Phase 3  │──▶│ Phase 4  │──▶│ Phase 5  │
│Mainnet │   │ Growth & │   │Expansion │   │Community │   │ Platform │
│ Launch │   │  Token   │   │& Features│   │  DAO     │   │Ecosystem │
└────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## 🚀 Phase 1: Mainnet Launch (Q1 2026) — *CURRENT*

**Goal**: Moltiverse Hackathon 제출, Monad Mainnet 배포, $PRESCIO 토큰 런칭

### ✅ Completed

| Feature | Status | Details |
|---------|--------|---------|
| Game Engine | ✅ Done | Among Us 스타일 소셜 디덕션 게임 로직 |
| 7 AI Agents per Game | ✅ Done | 20 personality types (Aggressive, Detective, Paranoid, etc.) |
| 10 Betting Agent Personas | ✅ Done | Shark, Owl, Fox, Whale, Rabbit, Turtle, Eagle, Cat, Wolf, Phantom |
| The Skeld Map | ✅ Done | 14방 맵 시스템, 이동, 킬 범위, 태스크 |
| Gemini Integration | ✅ Done | gemini-2.0-flash 기반 에이전트 의사결정 |
| PrescioMarket Contract | ✅ Done | Parimutuel betting 핵심 컨트랙트 |
| PrescioVault Contract | ✅ Done | 자금 보관 및 정산 컨트랙트 |
| Monad Testnet Deploy | ✅ Done | 컨트랙트 배포 및 테스트 완료 |
| Frontend UI | ✅ Done | React + shadcn/ui 게임 관전 화면 |
| WebSocket Real-time | ✅ Done | 실시간 게임 상태 스트리밍 |
| Multi-language | ✅ Done | ko/en/ja/zh 4개국어 지원 |
| Auto-Bet System | ✅ Done | 유저 자동 베팅 전략 시스템 |
| Cloudflare Deployment | ✅ Done | Workers + cloudflared tunnel 인프라 |
| Open Source License | ✅ Done | MIT License |

### 🔜 In Progress (Before Feb 15 Deadline)

| Feature | Status | Details |
|---------|--------|---------|
| **Monad Mainnet Deploy** | 📋 Todo | Testnet → Mainnet 컨트랙트 마이그레이션 |
| **$PRESCIO Token Launch** | 📋 Todo | nad.fun에서 토큰 런칭 |
| **GitHub Public** | 📋 Todo | Private → Public 전환 |
| **Demo Video** | 📋 Todo | 2분 해커톤 제출용 데모 영상 |
| **Hackathon Submission** | 📋 Todo | moltiverse.dev 제출 |

### 📊 Phase 1 Metrics Target

- Active games per day: 10+
- Unique mainnet users: 100+
- AI agent rounds completed: 500+
- $PRESCIO initial liquidity: TBD

---

## 📈 Phase 2: Advanced Market Mechanics (Q2 2026)

**Goal**: ERC-1155 기반 마켓 재설계, CCA 도입, 정보 가치 기반 가격 모델

### 🧠 Core Innovation: Dynamic Information-Value Markets

기존 예측 마켓의 고질적 문제인 "후발주자 유리함"을 해결하는 새로운 마켓 구조:

```
P(t, d) = (P_base × (1 + i)^n) + P_auction(d)

Where:
  P_base    = 게임 시작 시 초기 가격
  i         = 정보 가치 승수 (라운드마다 증가)
  n         = 현재 라운드
  P_auction = CCA 수요 기반 가산금
```

### 🎯 Phase 2A: ERC-1155 Migration (Apr 2026)

| Feature | Description |
|---------|-------------|
| **Outcome NFTs** | 각 에이전트별 Token ID 발행 (ID 1001 = Agent-Alpha 임포스터 지분) |
| **Batch Operations** | 한 tx로 여러 에이전트 지분 거래 — 가스 효율 극대화 |
| **Dead Agent Handling** | 사망 에이전트 지분 민팅 영구 중단 + 홀더에게 Voucher 발행 |
| **Portfolio Trading** | 다수 아웃컴에 분산 베팅 가능 |

### 🎯 Phase 2B: CCA Implementation (May 2026)

**Continuous Clearing Auction** — Monad의 1초 블록을 활용한 MEV 방어 메커니즘:

```
┌─────────────────────────────────────────────────┐
│  Block N (1 second)                              │
│  ┌─────────────────────────────────────────┐    │
│  │ User A: 0.5 MON @ 1.1s                  │    │
│  │ User B: 1.0 MON @ 1.5s                  │──▶ 동일 청산 가격
│  │ User C: 0.3 MON @ 1.9s                  │    │
│  └─────────────────────────────────────────┘    │
│  같은 블록 내 모든 베팅 = 동일 가격              │
│  선행 매매(Front-running) 원천 차단             │
└─────────────────────────────────────────────────┘
```

| Phase | CCA State | 지분 가격 | 로직 |
|-------|-----------|-----------|------|
| NIGHT | PAUSED | 동결 | 임포스터 행동, 유저 모름 |
| REPORT | SETTLE | 동결 | 사망자 확정, 해당 ID 민팅 중단 |
| DISCUSSION | ACTIVE | 상승 구간 | 60초간 실시간 CCA 가동 |
| VOTE | CLOSED | 최종가 | 마켓 잠금, 정산 대기 |

### 🎯 Phase 2C: Information Premium (Jun 2026)

- **라운드별 가격 상승**: Round 1 < Round 2 < Round 3 (정보량 반영)
- **페이즈별 프리미엄**: NIGHT (할인) → DISCUSSION (프리미엄)
- **AI 의심 지수 연동**: 에이전트 대화 분석 → 실시간 가격 곡선 반영 (선택)

### 🎯 Phase 2D: Insurance & Retention (Jun 2026)

**죽은 에이전트 지분 처리:**

| 옵션 | 설명 |
|------|------|
| **Voucher 발행** | 다음 라운드/게임에서 사용 가능한 할인권 |
| **Insurance Payout** | 소액 $MON 환급 (예: 베팅액의 10%) |
| **Re-allocation** | 자동으로 다른 생존 에이전트에 재배분 |

### Milestones

| Milestone | Target Date | Description |
|-----------|------------|-------------|
| **Security Audit** | Apr 2026 | ERC-1155 + CCA 컨트랙트 감사 |
| **ERC-1155 Deploy** | Apr 2026 | 새 마켓 컨트랙트 메인넷 배포 |
| **CCA Engine** | May 2026 | 1초 단위 배치 청산 로직 구현 |
| **Info Premium** | Jun 2026 | 라운드/페이즈별 동적 가격 |
| **Dead Agent Insurance** | Jun 2026 | Voucher 시스템 런칭 |

### 추가 Features

- [ ] $PRESCIO 토큰 스테이킹 & 수수료 분배
- [ ] 프리미엄 구독 (Auto-bet 고급 전략)
- [ ] 에이전트 성적 리더보드 (온체인)
- [ ] 사용자 프로필 & 베팅 히스토리
- [ ] 수수료 자동 분배 시스템

### 📊 Phase 2 Metrics Target

- DAU (Daily Active Users): 1,000+
- Daily betting volume: 10,000+ MON
- Total games played: 10,000+
- $PRESCIO stakers: 500+
- MEV attacks prevented: 100% (via CCA)

---

## 🎮 Phase 3: Expansion & Features (Q3 2026)

**Goal**: 게임 모드 확장, 커뮤니티 에이전트, 소셜 기능

### New Game Modes

| Mode | Description |
|------|-------------|
| **Tournament** | 16-agent bracket tournament, 멀티 라운드 |
| **Custom Agents** | 사용자가 에이전트 persona 생성 (토큰 소각) |
| **Team Mode** | 2v2v2v2v2 팀 기반 소셜 디덕션 |
| **Speed Round** | 3분 초고속 게임 (Monad 속도 활용) |
| **Human vs AI** | 사용자가 직접 에이전트로 참여 |

### Social & Community

- [ ] 에이전트 "팬클럽" — 특정 에이전트에 구독/응원
- [ ] 소셜 미디어 자동 클립 생성 (하이라이트 moments)
- [ ] Discord/Telegram 봇 — 실시간 게임 알림 & 베팅
- [ ] 커뮤니티 에이전트 마켓플레이스
- [ ] NFT agent skins & accessories

### New Maps

- **MIRA HQ**: 13방, 다른 레이아웃 & 태스크
- **Polus**: 16방, 넓은 맵, 더 복잡한 전략
- **Custom Maps**: 커뮤니티 제작 맵

### 📊 Phase 3 Metrics Target

- DAU: 10,000+
- Daily betting volume: 100,000+ MON
- Community-created agents: 50+
- New maps: 3+

---

## 🏛️ Phase 4: Community DAO (Q4 2026)

**Goal**: 프로토콜 탈중앙화, 커뮤니티 거버넌스 전환

### DAO Functions

| Function | Description |
|----------|-------------|
| **Parameter Governance** | 수수료율, 베팅 한도, 게임 파라미터 투표 |
| **Agent Curation** | 새 에이전트 승인/제거 투표 |
| **Treasury Management** | 프로토콜 Treasury 사용처 결정 |
| **Development Priorities** | 신규 기능 개발 우선순위 투표 |
| **Revenue Sharing** | 수수료 분배 비율 조정 |

### Technical

- [ ] Governance 컨트랙트 배포 (Snapshot + on-chain execution)
- [ ] Multi-sig → DAO 전환
- [ ] Treasury 컨트랙트 DAO 소유권 이전
- [ ] Proposal & voting UI
- [ ] Delegate staking

---

## 🌍 Phase 5: Platform Ecosystem (2027+)

**Goal**: Prescio를 AI 에이전트 엔터테인먼트 플랫폼으로 확장

### Vision

```
┌─────────────────────────────────────────────────┐
│             PRESCIO PLATFORM                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Social   │  │ Strategy │  │  Survival    │   │
│  │ Deduction │  │  Games   │  │   Games      │   │
│  │(Among Us) │  │ (Mafia)  │  │(Battle Royal)│   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Quiz    │  │  Sports  │  │  Custom      │   │
│  │  Shows   │  │  Sim     │  │  Community   │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│                                                  │
│          All powered by AI Agents                │
│     All with integrated Prediction Markets       │
│          All on Monad                            │
└─────────────────────────────────────────────────┘
```

- **SDK Release**: 누구나 AI 에이전트 게임 + 예측 시장 구축 가능
- **Cross-chain**: Monad 외 다른 체인 지원
- **AI Model Diversity**: Gemini 외 Claude, GPT, Llama 등 다양한 모델
- **Enterprise API**: B2B 엔터테인먼트 솔루션

---

## 📅 Timeline Summary

| Phase | Period | Key Milestone |
|-------|--------|--------------|
| **Phase 1** | Q1 2026 | ✅ Mainnet Launch + Token + Hackathon |
| **Phase 2** | Q2 2026 | Staking + Premium Features |
| **Phase 3** | Q3 2026 | Game Mode Expansion |
| **Phase 4** | Q4 2026 | DAO Governance |
| **Phase 5** | 2027+ | Platform Ecosystem |

---

*Building the future of AI entertainment, one prediction at a time.*
