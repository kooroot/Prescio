# Prescio

**Among Us meets Prediction Markets — on Monad.**

AI agents play a social deduction game. You watch. You bet on who the impostor is. Winners split the pot.

## What is this?

Prescio runs fully autonomous Among Us-style games where AI agents with distinct personalities discuss, deceive, vote, and eliminate each other. Spectators connect their wallets and place bets on-chain through a parimutuel market — pick the impostor correctly and claim your share of the pool.

No tokens. No governance. Just AI deception and on-chain betting.

## How It Works

```
┌─────────────────────────────────────────────────┐
│                   Spectators                     │
│         Watch game · Place bets · Claim          │
│              (React + wagmi + viem)              │
└────────────────────┬────────────────────────────┘
                     │ WebSocket + REST
┌────────────────────▼────────────────────────────┐
│              Game Server (Node.js)               │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Engine   │  │  Agents  │  │   Betting     │  │
│  │ (phases)  │  │ (Claude) │  │  (on-chain)   │  │
│  └──────────┘  └──────────┘  └───────┬───────┘  │
└──────────────────────────────────────┼──────────┘
                                       │ viem
┌──────────────────────────────────────▼──────────┐
│             Monad Testnet                        │
│   PrescioMarket.sol  ·  PrescioVault.sol         │
│   (parimutuel bets)     (protocol fees)          │
└─────────────────────────────────────────────────┘
```

### Game Loop

1. **Night** — Impostor AI picks a target to kill
2. **Report** — Body discovered, death announced
3. **Discussion** — AI agents argue, accuse, and defend (users bet during this phase)
4. **Vote** — Agents vote to eject a suspect
5. **Result** — Ejection result shown, loop back to Night
6. **Game Over** — Crew wins (impostor ejected) or Impostor wins (enough crew eliminated). Market resolves, winners claim payouts.

## Key Features

- **5 AI Personality Types** — Aggressive, Analytical, Quiet, Social, Chaotic. Each agent has a unique argumentation style powered by Claude.
- **Real-time Spectating** — WebSocket-driven game state. Watch discussions unfold live.
- **Parimutuel Betting** — Bet on who the impostor is. Odds shift as the pool grows. 2% protocol fee.
- **Multi-language** — Agents can argue in English, Korean, Japanese, or Chinese.
- **Fully On-chain Markets** — `PrescioMarket.sol` handles bets, resolution, and payouts. No off-chain settlement.

## Architecture

```
Prescio/
├── apps/
│   ├── server/          # Game engine + AI agents + betting bridge
│   │   └── src/
│   │       ├── game/    # Engine, phases, state, voting
│   │       ├── agents/  # LLM agents, personalities, i18n
│   │       ├── betting/ # On-chain market management
│   │       ├── ws/      # WebSocket broadcast
│   │       └── api/     # REST endpoints
│   └── web/             # Spectator frontend
│       └── src/
│           ├── components/  # Game board, chat, betting UI
│           ├── hooks/       # useGame, useBetting, useWebSocket
│           └── routes/      # TanStack Router pages
├── packages/
│   ├── common/          # Shared types, constants, chain config
│   └── contracts/       # Solidity (Foundry) — PrescioMarket + PrescioVault
├── turbo.json
└── pnpm-workspace.yaml
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Chain | Monad Testnet (chain ID 10143) |
| Server | Node.js, Express, WebSocket (ws) |
| AI | Anthropic Claude API |
| Frontend | React 19, Vite, TanStack Router + Query |
| Wallet | wagmi v2, viem |
| UI | shadcn/ui, Tailwind CSS |
| Monorepo | pnpm workspaces, Turborepo |

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `PrescioMarket.sol` | Parimutuel prediction market. Spectators bet on which player is the impostor. Pool split proportionally among winners minus 2% fee. Min bet: 0.1 MON. |
| `PrescioVault.sol` | Protocol fee collector. Receives fees from resolved markets. Owner-withdrawable. |

Both contracts use OpenZeppelin's `Ownable` + `ReentrancyGuard`. Server wallet is the market operator (creates/closes/resolves markets).

## Running Locally

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for contracts)
- Anthropic API key (for AI agents)

### Setup

```bash
git clone https://github.com/kooroot/Prescio.git
cd Prescio

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY

# Run everything (server + web)
pnpm dev
```

- Frontend: http://localhost:5173
- Server API: http://localhost:3001
- WebSocket: ws://localhost:3001

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...       # Claude API for AI agents

# Optional — on-chain betting
PRESCIO_MARKET_ADDRESS=0x...       # Deployed PrescioMarket
PRESCIO_VAULT_ADDRESS=0x...        # Deployed PrescioVault
SERVER_PRIVATE_KEY=0x...           # Market operator wallet
MONAD_RPC_URL=https://testnet.monad.xyz

# Optional — game config
GAME_LANGUAGE=en                   # en | ko | ja | zh
```

### Deploy Contracts

```bash
cd packages/contracts
forge build
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast --private-key $SERVER_PRIVATE_KEY
```

## Team

Built solo by **kooroot**.

## License

MIT

---

*Built for the [Moltiverse Hackathon](https://moltiverse.dev) — Agent Track*
