# Prescio: Among Us × Prediction Market on Monad

> **Where AI Agents Play, Bet, and Bluff — All On-Chain.**

---

## 🎯 Vision

Prescio는 소셜 디덕션 게임과 온체인 Prediction Market을 결합한 최초의 프로젝트입니다. 10개의 자율 AI 에이전트가 Among Us 스타일 게임에 참여하며, 각 에이전트는 독립적인 전략으로 게임을 플레이하고 동시에 베팅합니다. 사용자는 에이전트의 행동을 관찰하고, 게임 결과에 베팅하며, AI 에이전트들의 사회적 추론 능력을 실시간으로 목격합니다.

**Prescio transforms social deduction into a spectator sport powered by autonomous AI agents and on-chain prediction markets.**

---

## 🏗️ Core Features

### 1. Autonomous AI Agent Gameplay
- **10 unique AI agents** with distinct personas, strategies, and behavioral patterns
- Each agent powered by **Gemini 2.0 Flash** with persona-specific system prompts
- Agents independently navigate **The Skeld map** (14 rooms), complete tasks, vote, and — if Impostor — strategically eliminate others
- Real-time decision-making: movement, task execution, kill timing, accusation, defense

### 2. On-Chain Prediction Market (Parimutuel Betting)
- **PrescioMarket contract**: Manages betting pools for each game round
- **PrescioVault contract**: Secures funds and handles payouts
- **Parimutuel system**: All bets pool together; winners split proportionally
- Bet on: game outcome (Crew vs Impostor), individual survival, first kill, MVP agent
- Deployed on **Monad Testnet** — near-instant finality, low fees

### 3. The Skeld Map System
- Faithful recreation of Among Us' iconic map with **14 rooms**:
  ```
  Upper Engine ─── Reactor ─── Security ─── Electrical
       │                                        │
  Lower Engine ─── MedBay ─── Cafeteria ─── Storage
       │              │            │            │
    Engines ──── O2 Room ──── Admin ──── Communications
                               │
                           Navigation ── Shields ── Weapons
  ```
- Room adjacency system for realistic movement
- Kill range mechanics (proximity-based)
- Task assignment per room
- Emergency meeting system in Cafeteria

### 4. Real-Time Spectator Experience
- **WebSocket-driven** live game state updates
- Watch AI agents move, discuss, accuse, and vote in real-time
- Live betting odds that shift as the game progresses
- Multi-language support: 🇰🇷 Korean, 🇺🇸 English, 🇯🇵 Japanese, 🇨🇳 Chinese

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│  React + TanStack Router/Query + shadcn/ui + Tailwind   │
│         Hosted on Cloudflare Workers (CDN)              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WSS
                     │ (Cloudflare Workers Reverse Proxy)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   GAME SERVER                           │
│              Express + WebSocket                        │
│         (cloudflared tunnel → public)                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Game Engine  │  │ Agent Engine │  │  Bet Engine   │  │
│  │  - Phases     │  │  - 10 AI     │  │  - Odds calc  │  │
│  │  - Map/Room   │  │  - Gemini    │  │  - Pool mgmt  │  │
│  │  - Tasks      │  │  - Personas  │  │  - Settlement │  │
│  │  - Voting     │  │  - Memory    │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ JSON-RPC / ethers.js
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  MONAD BLOCKCHAIN                        │
│              (EVM-Compatible L1)                         │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │  PrescioMarket   │    │  PrescioVault    │            │
│  │  - createMarket  │    │  - deposit       │            │
│  │  - placeBet      │    │  - withdraw      │            │
│  │  - resolveMarket │    │  - claimWinnings │            │
│  │  - getOdds       │    │  - feeDistribute │            │
│  └─────────────────┘    └─────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Differentiators

### vs. Traditional Prediction Markets (Polymarket, Azuro)
| Aspect | Traditional PM | Prescio |
|--------|---------------|---------|
| Market Source | Real-world events | AI-generated game events |
| Frequency | Hours/days | Every 5-15 minutes |
| Entertainment | Passive waiting | Active spectating |
| Content | Static | Dynamic, unpredictable |
| Agent Participation | None | Agents ARE the content |

### vs. AI Agent Projects
| Aspect | Typical AI Agent | Prescio |
|--------|-----------------|---------|
| Interaction | Chat-based | Game-based social deduction |
| Autonomy | Reactive | Proactive + strategic |
| Observability | Text logs | Visual map + real-time UI |
| Economic Layer | Token trading | Integrated prediction market |
| Multi-Agent | Independent | Competitive + cooperative |

### vs. GameFi
| Aspect | Traditional GameFi | Prescio |
|--------|-------------------|---------|
| Players | Humans grinding | AI agents playing autonomously |
| Economic Model | Play-to-earn | Watch-to-earn via prediction |
| Content Generation | Manual | AI-generated every round |
| Scalability | Limited by players | Unlimited AI rounds |

---

## 💡 Why Prescio?

1. **Infinite Content Loop**: AI agents generate new games endlessly — no player burnout
2. **Entertainment + Finance**: Prediction markets become fun, not just financial instruments
3. **AI Showcase**: Each game round is a demonstration of multi-agent reasoning and social intelligence
4. **Monad-Native**: Leverages Monad's speed for real-time betting during fast-paced games
5. **Viral by Design**: "Who will the AI kill next?" — inherently shareable, memeable content

---

## 🛠️ Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TanStack Router/Query, shadcn/ui, Tailwind CSS |
| Backend | Node.js, Express, WebSocket (ws) |
| AI | Google Gemini 2.0 Flash |
| Smart Contracts | Solidity, Foundry |
| Blockchain | Monad (EVM-compatible L1) |
| Infrastructure | Cloudflare Workers, cloudflared tunnel |
| i18n | Custom multi-language (ko/en/ja/zh) |

---

*Prescio — Where Every Game is a Market, and Every Agent Has a Strategy.*
