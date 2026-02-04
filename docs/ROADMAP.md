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
│  MVP   │   │ Mainnet  │   │Expansion │   │Community │   │ Platform │
│Testnet │   │ Launch   │   │& Growth  │   │  DAO     │   │Ecosystem │
└────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## 🚀 Phase 1: MVP on Testnet (Q1 2026) — *CURRENT*

**Goal**: Moltiverse Hackathon 제출 및 핵심 프로토타입 완성

### ✅ Completed

| Feature | Status | Details |
|---------|--------|---------|
| Game Engine | ✅ Done | Among Us 스타일 소셜 디덕션 게임 로직 |
| 10 AI Agents | ✅ Done | Shark, Owl, Fox, Whale, Rabbit, Turtle, Eagle, Cat, Wolf, Phantom |
| The Skeld Map | ✅ Done | 14방 맵 시스템, 이동, 킬 범위, 태스크 |
| Gemini Integration | ✅ Done | gemini-2.0-flash 기반 에이전트 의사결정 |
| PrescioMarket Contract | ✅ Done | Parimutuel betting 핵심 컨트랙트 |
| PrescioVault Contract | ✅ Done | 자금 보관 및 정산 컨트랙트 |
| Monad Testnet Deploy | ✅ Done | 컨트랙트 배포 및 테스트 완료 |
| Frontend UI | ✅ Done | React + shadcn/ui 게임 관전 화면 |
| WebSocket Real-time | ✅ Done | 실시간 게임 상태 스트리밍 |
| Multi-language | ✅ Done | ko/en/ja/zh 4개국어 지원 |
| Cloudflare Deployment | ✅ Done | Workers + cloudflared tunnel 인프라 |

### 🔜 In Progress (Before Feb 15)

| Feature | Status | Details |
|---------|--------|---------|
| Betting UI Integration | 🔨 WIP | 프론트엔드 ↔ 컨트랙트 연동 |
| Agent Betting Logic | 🔨 WIP | 에이전트가 직접 베팅하는 자율 로직 |
| Game Replay System | 🔨 WIP | 완료된 게임 리플레이 |
| Demo Video | 📋 Todo | 해커톤 제출용 데모 영상 |

### 📊 Phase 1 Metrics Target

- Active games per day: 10+
- Unique testnet users: 100+
- AI agent rounds completed: 500+

---

## 🌐 Phase 2: Mainnet Launch (Q2 2026)

**Goal**: Monad Mainnet 배포, $PRESCIO 토큰 런칭, 본격 서비스 시작

### Milestones

| Milestone | Target Date | Description |
|-----------|------------|-------------|
| **Security Audit** | Apr 2026 | PrescioMarket + PrescioVault 스마트 컨트랙트 감사 |
| **Mainnet Deploy** | May 2026 | Monad Mainnet에 컨트랙트 배포 |
| **$PRESCIO TGE** | May 2026 | 토큰 발행 및 초기 유동성 공급 |
| **Staking Launch** | Jun 2026 | 스테이킹 프로그램 시작, 수수료 분배 |
| **Mobile Responsive** | Jun 2026 | 모바일 최적화 UI |

### Key Features

- [ ] 실제 MON 토큰 베팅 (testnet → mainnet)
- [ ] $PRESCIO 토큰 스테이킹 & 거버넌스
- [ ] 에이전트 성적 리더보드 (온체인)
- [ ] 사용자 프로필 & 베팅 히스토리
- [ ] 수수료 자동 분배 시스템
- [ ] Advanced betting markets (multi-outcome, conditional)

### 📊 Phase 2 Metrics Target

- DAU (Daily Active Users): 1,000+
- Daily betting volume: 10,000+ MON
- Total games played: 10,000+

---

## 📈 Phase 3: Expansion & Growth (Q3 2026)

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
| **Phase 1** | Q1 2026 | ✅ MVP + Hackathon Submission |
| **Phase 2** | Q2 2026 | Mainnet Launch + Token |
| **Phase 3** | Q3 2026 | Game Mode Expansion |
| **Phase 4** | Q4 2026 | DAO Governance |
| **Phase 5** | 2027+ | Platform Ecosystem |

---

*Building the future of AI entertainment, one prediction at a time.*
