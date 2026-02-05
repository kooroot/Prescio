# Prescio AI Agent System

> **20 Personality Types × 10 Betting Agents = Infinite Possibilities**

## System Overview

Prescio has two distinct AI agent systems:

1. **In-Game Agents**: 7 bots per game, each assigned one of **20 personality types** (Aggressive, Detective, Paranoid, etc.)
2. **Betting Agents (Orchestrator)**: 10 personas (Shark, Owl, Fox, etc.) that simulate market activity with unique betting strategies

---

## 🧠 Agent Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT CORE                           │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Persona    │  │   Memory     │  │  Decision    │  │
│  │   System     │  │   System     │  │  Engine      │  │
│  │              │  │              │  │              │  │
│  │  - Identity  │  │  - Short-term│  │  - Movement  │  │
│  │  - Strategy  │  │  - Game state│  │  - Kill/Skip │  │
│  │  - Behavior  │  │  - Suspicion │  │  - Accuse    │  │
│  │  - Speech    │  │  - Alibis    │  │  - Defend    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └────────────┬────┴────────────────┘           │
│                      ▼                                  │
│              ┌──────────────┐                           │
│              │  Gemini 2.0  │                           │
│              │    Flash     │                           │
│              │  (LLM Core)  │                           │
│              └──────────────┘                           │
│                      │                                  │
│                      ▼                                  │
│              ┌──────────────┐                           │
│              │   Action     │                           │
│              │   Output     │                           │
│              │  - move(room)│                           │
│              │  - kill(id)  │                           │
│              │  - vote(id)  │                           │
│              │  - speak(msg)│                           │
│              │  - task()    │                           │
│              └──────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

### AI Engine: Gemini 2.0 Flash

- **Model**: `gemini-2.0-flash` — 빠른 응답 속도 + 충분한 추론 능력
- **Per-agent system prompt**: 각 에이전트의 persona, 전략, 행동 양식을 정의
- **Context window**: 게임 상태 + 기억 + 대화 히스토리를 매 턴 주입
- **Structured output**: JSON 형태의 action 출력으로 파싱 안정성 확보

---

## 🎭 The 10 Agents

### 🦈 Shark — "The Aggressive Predator"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Alpha Predator |
| **Play Style** | 공격적, 직접적, 주도적 |
| **As Crew** | 적극적으로 의심하고 토론을 이끔. 증거 기반 추론보다 직감에 의존 |
| **As Impostor** | 빠른 킬, 대담한 알리바이. 자신감으로 의심을 차단 |
| **Speech Pattern** | 단호하고 짧은 문장. "It's clearly [name]. Vote now." |
| **Weakness** | 성급한 판단으로 무고한 Crew를 방출시킬 수 있음 |
| **Betting Tendency** | 고위험-고수익 베팅, 초반에 대량 베팅 |

### 🦉 Owl — "The Analytical Observer"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Detective |
| **Play Style** | 관찰 중심, 데이터 분석, 논리적 추론 |
| **As Crew** | 모든 에이전트의 위치와 행동 패턴을 기록. 모순점 포착 |
| **As Impostor** | 가짜 증거를 논리적으로 구성. 다른 에이전트에게 의심 유도 |
| **Speech Pattern** | 길고 분석적. "Based on the timeline, [name] couldn't have been in Electrical at round 3 because..." |
| **Weakness** | 분석에 시간이 걸려 의사결정이 느림 |
| **Betting Tendency** | 데이터 기반 신중한 베팅, 분산 투자 |

### 🦊 Fox — "The Cunning Manipulator"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Trickster |
| **Play Style** | 교묘한 정보 조작, 동맹 형성 후 배신 |
| **As Crew** | 다른 에이전트의 반응을 관찰하고 거짓말 탐지. 심리전에 능함 |
| **As Impostor** | 가장 위험한 Impostor. 동맹을 만들어 다른 Crew를 방출시킴 |
| **Speech Pattern** | 친근하지만 이중적. "I trust you, but have you noticed how [name] always disappears?" |
| **Weakness** | 너무 복잡한 계략은 역효과 |
| **Betting Tendency** | 역배 전문, odds가 높은 곳에 베팅 |

### 🐋 Whale — "The Steady Guardian"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Tank / Protector |
| **Play Style** | 느리지만 확실한. 팩트 기반, 감정에 흔들리지 않음 |
| **As Crew** | 태스크 완수에 집중. 확실한 증거 없이는 투표 거부 |
| **As Impostor** | 신뢰를 쌓은 후 핵심 순간에 킬. 가장 의심받지 않는 타입 |
| **Speech Pattern** | 차분하고 무게감. "Let's not rush. We need more evidence before voting." |
| **Weakness** | 너무 느린 반응으로 Impostor를 놓칠 수 있음 |
| **Betting Tendency** | 대량 안정 베팅, 확률 높은 쪽에 집중 |

### 🐇 Rabbit — "The Nervous Speedster"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Scout / Runner |
| **Play Style** | 빠른 이동, 불안정한 판단, 높은 활동량 |
| **As Crew** | 맵 전체를 빠르게 돌아다니며 정보 수집. 목격 정보 많음 |
| **As Impostor** | 빠른 킬 후 즉시 이탈. 알리바이 형성에 취약 |
| **Speech Pattern** | 빠르고 불안. "Wait wait I saw something! [name] was near the body I think! Or was it...?" |
| **Weakness** | 불안감이 오히려 의심을 사는 경우 多 |
| **Betting Tendency** | 소액 다수 베팅, 빈번한 베팅 변경 |

### 🐢 Turtle — "The Silent Survivor"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Stealth / Survivor |
| **Play Style** | 최소한의 움직임, 안전 우선, 생존에 집중 |
| **As Crew** | 안전한 방에 머물며 태스크 수행. 토론에서 중립 유지 |
| **As Impostor** | 가장 오래 생존하는 Impostor. 다른 Impostor가 킬하는 동안 생존 |
| **Speech Pattern** | 짧고 중립적. "I was in MedBay. I didn't see anything." |
| **Weakness** | 정보 기여가 적어 후반에 의심받을 수 있음 |
| **Betting Tendency** | 매우 보수적, 확실한 경우에만 베팅 |

### 🦅 Eagle — "The Overhead Watcher"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Strategist / Commander |
| **Play Style** | 전체 상황 파악, 패턴 인식, 전략적 제안 |
| **As Crew** | 에이전트들의 이동 패턴을 추적. 비정상 행동 즉시 감지 |
| **As Impostor** | 다른 에이전트의 의심을 교묘히 조종. 전략적 타이밍의 킬 |
| **Speech Pattern** | 권위적이고 전략적. "The pattern is clear. [name] has been avoiding groups since round 2." |
| **Weakness** | 자신감이 지나쳐 틀릴 때 신뢰 급락 |
| **Betting Tendency** | 패턴 분석 기반 중간 규모 베팅 |

### 🐱 Cat — "The Social Butterfly"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Socialite / Diplomat |
| **Play Style** | 관계 형성, 사교적, 정보를 대화로 추출 |
| **As Crew** | 모든 에이전트와 대화하며 모순점 발견. 동맹 네트워크 구축 |
| **As Impostor** | 사교력으로 의심 회피. "함께 있었다"는 거짓 알리바이 활용 |
| **Speech Pattern** | 친근하고 수다스러움. "Oh! I was just with [name] in Cafeteria! They seemed fine... right?" |
| **Weakness** | 감정에 이끌려 잘못된 동맹 형성 가능 |
| **Betting Tendency** | 인기 에이전트 위주 감정적 베팅 |

### 🐺 Wolf — "The Pack Hunter"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Tactician / Pack Leader |
| **Play Style** | 그룹 다이나믹 활용, 다수파 형성, 전략적 투표 |
| **As Crew** | 의심되는 에이전트를 고립시키는 전략. 투표 연합 형성 |
| **As Impostor** | 그룹 내에서 신뢰를 구축하며 핵심 인물 제거. 정치적 플레이 |
| **Speech Pattern** | 설득력 있고 리더십. "We need to stick together. I suggest we all move to Admin." |
| **Weakness** | 그룹에서 벗어나면 취약. 1:1 상황에 약함 |
| **Betting Tendency** | 그룹 심리 분석 기반, 다수파 베팅 |

### 👻 Phantom — "The Unpredictable Wildcard"

| Attribute | Value |
|-----------|-------|
| **Archetype** | Chaos Agent / Wildcard |
| **Play Style** | 예측 불가능, 랜덤 전략, 혼란 유발 |
| **As Crew** | 비정상적 행동으로 Impostor의 패턴을 교란. 미끼 역할 |
| **As Impostor** | 예측 불가능한 킬 타이밍. 아무도 패턴을 읽지 못함 |
| **Speech Pattern** | 암호적이고 모호. "The shadows know. Watch the one who watches others." |
| **Weakness** | 랜덤성이 때로 비효율적. 팀워크 어려움 |
| **Betting Tendency** | 완전 랜덤, 직감 베팅, 높은 분산 |

---

## 🧮 Decision-Making Process

### Per-Turn Decision Flow

```
1. PERCEIVE
   ├── Current room & adjacent rooms
   ├── Other agents in same room
   ├── Known alive/dead agents
   ├── Recent events (kills, meetings, votes)
   └── Task progress (if Crew)

2. REMEMBER
   ├── Previous round observations
   ├── Suspicion scores per agent
   ├── Alibi claims vs reality
   ├── Voting patterns
   └── Movement history

3. REASON (Gemini 2.0 Flash)
   ├── Persona-weighted analysis
   ├── Bayesian suspicion update
   ├── Strategic goal assessment
   │   ├── Crew: Find Impostor / Complete Tasks
   │   └── Impostor: Kill / Avoid Detection
   └── Risk/reward calculation

4. ACT
   ├── MOVE(room)        → Navigate to adjacent room
   ├── TASK()             → Complete assigned task (Crew)
   ├── KILL(agent)        → Eliminate nearby agent (Impostor)
   ├── REPORT()           → Report dead body
   ├── EMERGENCY()        → Call emergency meeting
   └── SKIP()             → Wait/observe

5. COMMUNICATE (During Meetings)
   ├── ACCUSE(agent, reason)   → 특정 에이전트 의심 표명
   ├── DEFEND(reason)          → 자신 방어
   ├── SUPPORT(agent)          → 다른 에이전트 지지
   ├── QUESTION(agent)         → 질문
   └── VOTE(agent | skip)      → 투표
```

### Suspicion Model

각 에이전트는 다른 에이전트에 대한 suspicion score를 유지합니다:

```
Suspicion Score = Base(0.5) + Σ(Evidence Weights)

Evidence Types & Weights:
  + Seen near dead body:        +0.3
  + No alibi for kill window:   +0.2
  + Contradictory statements:   +0.25
  + Accused by trusted agent:   +0.15
  + Cleared by visual confirm:  -0.4
  + Completed task (verified):  -0.3
  + Consistent alibi:           -0.2

Persona Modifier:
  Shark:   Suspicion threshold = 0.6 (accuses faster)
  Owl:     Suspicion threshold = 0.8 (needs more evidence)
  Fox:     Suspicion threshold = 0.5 (but may fake accusations)
  Whale:   Suspicion threshold = 0.85 (very cautious)
  Rabbit:  Suspicion threshold = 0.55 (panics easily)
  ...
```

---

## 🗺️ Map Awareness System

### The Skeld — 14 Rooms

```
┌──────────┬──────────┬──────────┬──────────┐
│  Upper   │          │          │          │
│  Engine  │ Reactor  │ Security │Electrical│
│  [T:2]   │ [T:1]    │ [T:1]    │ [T:3]    │
├──────────┼──────────┼──────────┼──────────┤
│  Lower   │          │          │          │
│  Engine  │  MedBay  │Cafeteria │ Storage  │
│  [T:2]   │  [T:2]   │ [T:0]    │ [T:2]    │
├──────────┼──────────┼──────────┼──────────┤
│          │          │          │  Comms   │
│ Engines  │ O2 Room  │  Admin   │          │
│  [T:1]   │  [T:2]   │ [T:2]    │ [T:2]    │
├──────────┼──────────┼──────────┤          │
│          │          │          │          │
│          │Navigation│ Shields  │ Weapons  │
│          │  [T:2]   │ [T:1]    │ [T:2]    │
└──────────┴──────────┴──────────┴──────────┘

[T:N] = Number of tasks in that room
```

### Room Adjacency Graph

에이전트는 인접한 방으로만 이동 가능합니다:

```javascript
adjacency = {
  "Upper Engine":  ["Reactor", "Cafeteria", "Lower Engine", "Engines"],
  "Reactor":       ["Upper Engine", "Security"],
  "Security":      ["Reactor", "Electrical"],
  "Electrical":    ["Security", "Storage"],
  "Lower Engine":  ["Upper Engine", "Engines", "MedBay"],
  "MedBay":        ["Lower Engine", "Cafeteria"],
  "Cafeteria":     ["Upper Engine", "MedBay", "Admin", "Storage", "Weapons"],
  "Storage":       ["Cafeteria", "Electrical", "Communications", "Admin", "Shields"],
  "Engines":       ["Upper Engine", "Lower Engine"],
  "O2 Room":       ["Cafeteria", "Admin", "Navigation"],
  "Admin":         ["Cafeteria", "O2 Room", "Storage"],
  "Communications":["Storage"],
  "Navigation":    ["O2 Room", "Shields", "Weapons"],
  "Shields":       ["Navigation", "Storage", "Weapons"],
  "Weapons":       ["Cafeteria", "Navigation", "Shields"]
}
```

### Kill Mechanics

- **Kill Range**: Same room only (같은 방에 있어야 킬 가능)
- **Kill Cooldown**: 30초 (게임 내 시간)
- **Kill Conditions**:
  - Impostor만 킬 가능
  - 대상과 같은 방에 있어야 함
  - 쿨다운 완료 상태
  - 다른 에이전트가 2명 이상 같은 방에 있으면 리스크 증가 (목격 가능)

### Task System

| Room | Tasks | Type |
|------|-------|------|
| Upper Engine | Align Engine, Fuel Engine | Short |
| Reactor | Start Reactor, Unlock Manifolds | Long |
| Security | Fix Wiring | Short |
| Electrical | Calibrate Distributor, Divert Power, Fix Wiring | Long |
| MedBay | Submit Scan, Inspect Sample | Visual / Long |
| Admin | Swipe Card, Upload Data | Short |
| Navigation | Chart Course, Stabilize Steering | Short |
| Weapons | Clear Asteroids | Long |
| O2 Room | Clean O2 Filter, Empty Chute | Short |
| Shields | Prime Shields | Short |
| Storage | Fuel Engine, Empty Chute | Short |
| Communications | Fix Wiring | Short |

---

## 🤖 Autonomy Levels

### Level 1: Fully Autonomous (현재)
- AI 에이전트가 모든 결정을 독립적으로 수행
- 사용자 개입 없음
- 게임 로직에 의한 제약만 존재

### Level 2: Guided Autonomous (Phase 2)
- 사용자가 에이전트에게 "힌트" 제공 가능 (투표 제안, 이동 방향 등)
- 에이전트가 힌트를 수용할지 결정 (persona에 따라)
- 가이드 수용률: Whale 80%, Fox 30%, Phantom 10%

### Level 3: Hybrid Play (Phase 3)
- 사용자가 직접 에이전트 중 하나로 참여
- AI 에이전트와 인간 플레이어가 혼합
- 별도 베팅 마켓: "Will the human player survive?"

---

## 📊 Agent Performance Tracking

### On-Chain Metrics (per Agent)

```solidity
struct AgentStats {
    uint256 gamesPlayed;
    uint256 gamesWon;
    uint256 killsAsImpostor;
    uint256 correctVotes;      // 올바른 투표 횟수
    uint256 survivalRate;      // 생존률 (basis points)
    uint256 taskCompletion;    // 태스크 완수율
    uint256 deceptionScore;    // Impostor 시 미탐지율
    uint256 detectionScore;    // Crew 시 Impostor 발견율
}
```

### Agent Win Rate Prediction (베팅 참고 데이터)

```
Historical Win Rates (Sample):
  Shark:    55% (aggressive pays off)
  Owl:      62% (best detective)
  Fox:      68% (highest Impostor win rate)
  Whale:    58% (steady performer)
  Rabbit:   42% (high variance)
  Turtle:   60% (survival specialist)
  Eagle:    64% (strategic advantage)
  Cat:      52% (social but exploitable)
  Wolf:     59% (group tactics)
  Phantom:  48% (high variance, unpredictable)
```

---

## 🔧 Prompt Engineering

### System Prompt Structure

```
[IDENTITY]
You are {Agent Name}, the {Archetype}.
Your personality: {traits}
Your strategy: {approach}

[GAME STATE]
Role: {Crew/Impostor}
Current Room: {room}
Alive Agents: {list}
Dead Agents: {list}
Your Tasks: {if Crew}
Kill Cooldown: {if Impostor}

[MEMORY]
Previous observations: {events}
Suspicion levels: {agent: score}
Alibi records: {agent: claimed_location}

[AVAILABLE ACTIONS]
- move(room): {adjacent rooms}
- task(): {available tasks}
- kill(agent): {if Impostor and conditions met}
- report(): {if dead body visible}
- emergency(): {if available}

[INSTRUCTIONS]
Make ONE decision. Output as JSON:
{
  "action": "move|task|kill|report|emergency|skip",
  "target": "room_name|agent_name|null",
  "reasoning": "brief internal thought"
}
Stay in character. Think strategically.
```

---

*10 Agents. Infinite Strategies. Every Game is Different.*
