# Prescio — Moltiverse Hackathon Submission

**Track:** Agent Track

## Submission Checklist

- [x] **Working agent** — AI agents powered by Claude play full Among Us games autonomously (discuss, vote, kill)
- [x] **On-chain integration** — Parimutuel betting market deployed on Monad testnet via `PrescioMarket.sol`
- [x] **Real-time frontend** — WebSocket-driven spectator UI with live game state, chat, and betting panel
- [x] **Documentation** — README with architecture, setup instructions, and contract details
- [x] **Source code** — GitHub repo at github.com/kooroot/Prescio

## What the Agent Does

5 AI agents with distinct personalities (Aggressive, Analytical, Quiet, Social, Chaotic) play a social deduction game:

1. **Night action** — Impostor agent selects a kill target based on game state analysis
2. **Discussion** — All alive agents generate arguments, accusations, and defenses via Claude API. Each personality has unique speech patterns and strategies.
3. **Voting** — Agents analyze discussion history and cast votes to eject suspected impostors

The agents operate fully autonomously — no human players required. Spectators watch and bet.

## Monad Integration

- **Chain:** Monad Testnet (chain ID 10143)
- **Contracts:** `PrescioMarket.sol` (parimutuel betting) + `PrescioVault.sol` (fee collection)
- **Why Monad:** Fast block times enable real-time bet placement during live game phases. Low gas costs make micro-bets viable (min 0.1 MON).
- **On-chain flow:**
  1. Server creates market when game starts (`createMarket`)
  2. Spectators place bets during discussion phase (`placeBet`)
  3. Server closes market before voting (`closeMarket`)
  4. Server resolves market after game ends (`resolve`)
  5. Winners claim proportional payouts (`claim`)
- **Tech:** viem for contract interaction (both server-side and client-side via wagmi)

## What's Original

Everything in this repo was built from scratch for this hackathon:

- Game engine with phase-based state machine and auto-progression timers
- AI agent system with personality profiles, multi-language i18n, and Claude integration
- Parimutuel market smart contracts (PrescioMarket + PrescioVault)
- Real-time WebSocket spectator protocol
- Full React frontend with live game board, chat log, and betting UI
- On-chain betting bridge (server ↔ Monad)

## What's Reused (Libraries/Frameworks)

- **OpenZeppelin** — `Ownable`, `ReentrancyGuard` for contract security
- **shadcn/ui** — Pre-built UI components (buttons, cards, tabs, etc.)
- **Standard tooling** — React, Vite, Express, Foundry, wagmi, viem, TanStack Router/Query, Tailwind CSS

No existing game code, prediction market code, or AI agent frameworks were reused.

## Stats

- ~80 source files
- ~9,600 lines of code
- Solo developer (kooroot)

## Demo

Run locally: `pnpm install && pnpm dev`

The game auto-creates with AI agents and runs autonomously. Connect a wallet on Monad testnet to place bets.
