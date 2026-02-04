# Prescio — Hackathon Submission

## Moltiverse Hackathon | Agent + Token Track

> **Among Us × Prediction Market on Monad**
> *Where AI Agents Play, Bet, and Bluff — All On-Chain.*

---

## 🎮 One-Liner

**Prescio is an autonomous AI social deduction game where 10 AI agents play Among Us while users bet on outcomes through an on-chain parimutuel prediction market on Monad.**

---

## 📋 Project Summary

Prescio combines the social dynamics of Among Us with the financial excitement of prediction markets. Ten autonomous AI agents — each with unique personas and strategies — play a full social deduction game on The Skeld map. Users watch in real-time and bet on game outcomes using Monad's near-instant blockchain.

**Key Innovation**: AI agents don't just play games — they ARE the content. Every round generates a unique, entertaining, and unpredictable spectacle that drives continuous betting activity.

---

## 🏆 Judging Criteria Breakdown

### 1. Agent Intelligence & Autonomy (20%)

#### What We Built
- **10 distinct AI personas** powered by Gemini 2.0 Flash, each with unique personality, strategy, and behavioral patterns
- **Fully autonomous gameplay**: agents independently navigate a 14-room map, complete tasks, make kills, investigate, accuse, defend, and vote — with ZERO human intervention
- **Per-agent memory system**: each agent maintains suspicion scores, alibi records, and behavioral observations across rounds
- **Persona-driven decision making**: Shark is aggressive, Owl is analytical, Fox is manipulative, Phantom is unpredictable — these aren't just labels, they fundamentally alter how each agent processes information and makes decisions

#### Why It Stands Out
- **Multi-agent social reasoning**: agents don't just act — they reason about OTHER agents' reasoning. Fox forms alliances to betray. Wolf builds voting coalitions. Owl tracks contradictions in alibis.
- **Emergent behavior**: the interaction of 10 different personas creates emergent game dynamics that are genuinely unpredictable, even to us
- **Autonomous betting**: agents also place their own bets based on their private information and suspicion models, creating a unique "AI insider trading" dynamic

```
Autonomy Spectrum:
[Script] ──── [Reactive] ──── [Proactive] ──── [Strategic] ──── [Social]
                                                    ▲               ▲
                                              Individual AI    Prescio Agents
                                              (most projects)  (multi-agent social)
```

---

### 2. Technical Excellence (20%)

#### Architecture

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 19 + TanStack Router/Query + shadcn/ui + Tailwind | Modern, performant, beautiful UI |
| **Backend** | Express + WebSocket | Real-time game state streaming |
| **AI** | Gemini 2.0 Flash | Fast inference for 10 simultaneous agents |
| **Contracts** | Solidity (Foundry) | Industry-standard, tested, gas-optimized |
| **Infra** | Cloudflare Workers + cloudflared tunnel | Global CDN + secure backend tunneling |
| **Chain** | Monad Testnet | EVM-compatible, high throughput |

#### Technical Highlights

1. **Real-time Multi-Agent Orchestration**: Managing 10 concurrent AI agents with WebSocket broadcasting to all connected spectators
2. **Structured AI Output Parsing**: Reliable JSON action extraction from LLM outputs with fallback handling
3. **On-Chain Parimutuel Math**: Correct proportional payout calculations in Solidity (avoiding precision loss)
4. **Map State Machine**: Graph-based room adjacency system with kill range, task assignment, and movement validation
5. **Multi-language Support**: Full i18n across Korean, English, Japanese, Chinese — not just UI labels but AI agent dialogue
6. **Cloudflare Workers Edge Deployment**: Frontend + reverse proxy on edge for global low-latency access

#### Smart Contracts

```
PrescioMarket.sol
├── createMarket()       — Create betting market for each game
├── placeBet()           — Parimutuel bet placement
├── resolveMarket()      — Settle market with game outcome
├── claimWinnings()      — Proportional payout to winners
└── getMarketInfo()      — View odds and pool sizes

PrescioVault.sol
├── deposit()            — Secure fund storage
├── withdraw()           — Controlled withdrawals
├── distributeRewards()  — Automated reward distribution
└── emergencyPause()     — Safety mechanism
```

---

### 3. Monad Integration (20%)

#### Why Monad?

Prescio NEEDS Monad. Here's why:

| Requirement | Why Monad Fits |
|------------|---------------|
| **Speed** | Games last 5-15 min. Bets must confirm before the round ends. Monad's ~1s finality enables real-time betting. |
| **Throughput** | 10 agents × multiple bets per round × many concurrent games = high tx volume. Monad handles this. |
| **Low Fees** | Micro-bets (0.01-1 MON) must be economically viable. High gas fees kill the experience. |
| **EVM Compatibility** | We use standard Solidity/Foundry tooling. Monad's EVM compatibility means zero friction. |

#### On-Chain Components

- **PrescioMarket**: Deployed on Monad Testnet — manages all betting markets
- **PrescioVault**: Deployed on Monad Testnet — secures all funds
- **Every bet is on-chain**: Full transparency and verifiability
- **Game results recorded on-chain**: Permanent, auditable game history
- **Agent statistics on-chain**: Win rates, kill counts, survival rates — all verifiable

#### Monad-Specific Optimizations

1. **Batch Transactions**: Multiple agent bets bundled into single blocks
2. **Gas-Efficient Parimutuel**: Optimized storage patterns for pool accounting
3. **Real-time Odds**: Efficient view functions for instant odds calculation
4. **Parallel Settlement**: Leveraging Monad's parallel execution for multi-market settlement

---

### 4. Virality (20%)

#### Why Prescio Goes Viral

**🎬 Built-in Spectacle**
- "WHO DID THE AI KILL?" — every round is a mini-drama
- AI agents accusing each other, forming alliances, betraying trust
- Unpredictable outcomes that demand sharing

**📱 Shareable Moments**
- "Fox convinced everyone to vote out Owl, then killed Rabbit the next round 💀"
- These narratives are inherently shareable on Twitter/TikTok
- Each game produces clip-worthy moments automatically

**💰 Financial Incentive**
- "I called that Impostor Fox would win — bet 10 MON, won 50 MON"
- Prediction market success stories drive organic sharing
- Leaderboards create competitive social dynamics

**🌐 Multi-Language from Day 1**
- Korean, English, Japanese, Chinese
- 4 major crypto communities accessible from launch
- Localized AI agent dialogue (agents speak in the user's language!)

**🔄 Infinite Content Loop**
```
AI plays game → Creates drama → Users share → New users bet
       ↑                                           │
       └───────────────────────────────────────────┘
```

**📊 Viral Metrics Design**
- Referral system: 10% fee rebate for inviting new bettors
- Social share buttons with auto-generated game summaries
- Embeddable game widgets for blogs/Discord
- "Follow Agent" — get notifications when your favorite agent plays

#### Content Cadence
- **New game every 15 minutes** — always fresh content
- **96 games per day** — impossible to run out of things to watch/bet on
- **Each game is unique** — AI behavior ensures no two games are the same

---

### 5. Innovation & Impact (20%)

#### What's New

1. **First AI Social Deduction + Prediction Market**
   - No existing project combines autonomous AI gameplay with on-chain betting
   - Creates an entirely new category: "AI Entertainment Finance"

2. **AI Agents as Content Generators**
   - Most AI agent projects are chatbots or trading bots
   - Prescio's agents create entertainment content autonomously
   - Infinite content without human content creators

3. **Spectator Economy**
   - Traditional GameFi: "Play to Earn"
   - Prescio: "Watch AI to Earn"
   - Lower barrier to entry, higher entertainment value

4. **Multi-Agent Social Intelligence Showcase**
   - Demonstrates AI's capability for deception, cooperation, and social reasoning
   - Each game is a public experiment in multi-agent dynamics
   - Accessible AI research through entertainment

#### Impact

**For Monad Ecosystem**
- Brings entertainment/gaming use case to Monad
- Demonstrates Monad's speed advantage for real-time applications
- Attracts gaming/betting communities to Monad

**For AI Industry**
- Showcases practical multi-agent reasoning
- Public demonstration of AI social intelligence
- Entertainment-first approach to AI understanding

**For Prediction Markets**
- Solves the "boring waiting" problem — markets resolve in minutes, not days
- AI-generated content means unlimited market creation
- Makes prediction markets fun, not just financial

**For Users**
- Free entertainment (watch AI play Among Us)
- Easy on-ramp to prediction markets
- Multi-language accessibility
- No skill requirement (betting, not playing)

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| **Live Demo** | [prescio.xyz] |
| **GitHub** | [github.com/prescio] |
| **Smart Contracts** | [Monad Testnet Explorer] |
| **Demo Video** | [YouTube/Loom] |
| **Documentation** | [docs.prescio.xyz] |

---

## 👥 Team

| Role | Contribution |
|------|-------------|
| **Full-Stack Developer** | Frontend, Backend, Smart Contracts, AI Integration, Infrastructure |

*Solo builder, full-stack execution.*

---

## 🚀 What's Next

| Timeline | Milestone |
|----------|-----------|
| **Q2 2026** | Monad Mainnet deploy, $PRESCIO token launch |
| **Q3 2026** | New game modes (Tournament, Team, Human vs AI) |
| **Q4 2026** | DAO governance, community agents |
| **2027** | Platform SDK, cross-chain, multi-game |

---

## 💬 TL;DR

> **Prescio = Among Us + AI Agents + Prediction Markets + Monad**
>
> 10 autonomous AI agents play social deduction games 24/7.
> Users watch, bet, and earn — all on-chain on Monad.
> Every game is unique. Every game is a market.
> Entertainment meets DeFi meets AI.
>
> *This is the future of autonomous entertainment finance.*

---

*Built for Moltiverse Hackathon — Agent + Token Track*
*February 2026*
