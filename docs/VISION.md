# Prescio V2 Vision: Dynamic Information-Value Markets

> **Solving Prediction Market's Fundamental Flaw with ERC-1155 + CCA on Monad**

---

## 📋 Executive Summary

Traditional prediction markets suffer from a critical asymmetry: late bettors have more information than early bettors, yet both receive the same odds structure. This creates a **"wait and see"** meta where rational actors delay betting until maximum information is available, reducing market liquidity and engagement.

Prescio V2 solves this with a **Dynamic Information-Value Minting** model that prices shares based on the game phase and information availability.

---

## 🧠 The Problem: Information Asymmetry

In a Prescio game with 7 agents:

| Time | Information Available | Rational Action |
|------|----------------------|-----------------|
| NIGHT (start) | Zero — roles hidden | Risk-takers bet, cautious wait |
| REPORT | 1 death confirmed | Slightly more info, still uncertain |
| DISCUSSION | Agent dialogue, accusations | Much more info — late bettors advantaged |
| VOTE | Voting patterns visible | Maximum info before resolution |

**Result**: Early bettors take more risk but get no compensation. Late bettors free-ride on revealed information.

---

## 💡 The Solution: Information Premium Pricing

### Core Formula

```
P(t, d) = (P_base × (1 + i)^n) + P_auction(d)
```

| Variable | Description | Example |
|----------|-------------|---------|
| `P_base` | Initial price at game start | 0.01 MON per share |
| `i` | Information multiplier per round | 0.5 (50% increase) |
| `n` | Current round number | Round 3 → 1.5³ = 3.375x |
| `P_auction(d)` | CCA demand premium | +0.002 MON if high demand |

### Example Pricing

| Round | Phase | P_base × (1+i)^n | Effective Price |
|-------|-------|------------------|-----------------|
| 1 | NIGHT | 0.01 × 1.5¹ = 0.015 | 0.015 MON |
| 1 | DISCUSSION | 0.01 × 1.5¹ = 0.015 | 0.017 MON (+CCA) |
| 2 | NIGHT | 0.01 × 1.5² = 0.0225 | 0.0225 MON |
| 2 | DISCUSSION | 0.01 × 1.5² = 0.0225 | 0.025 MON (+CCA) |
| 3 | DISCUSSION | 0.01 × 1.5³ = 0.0338 | 0.038 MON (+CCA) |

**Insight**: Early bettors get shares at 0.015 MON. Late bettors (Round 3) pay 0.038 MON — 2.5x more. This compensates early risk-takers fairly.

---

## 🏗️ Technical Architecture

### ERC-1155 Outcome Shares

Each agent in a game becomes a fungible token within a single ERC-1155 contract:

```solidity
// Token ID mapping
mapping(bytes32 gameId => mapping(uint8 agentIndex => uint256 tokenId)) public outcomeTokens;

// Example:
// Game ABC, Agent 0 (Alpha) → Token ID 1001
// Game ABC, Agent 1 (Bravo) → Token ID 1002
// Game ABC, Agent 2 (Charlie) → Token ID 1003
// ...
```

**Benefits**:
- **Batch operations**: Buy shares in 3 agents with 1 transaction
- **Gas efficiency**: ~60% cheaper than multiple ERC-20 transfers
- **Portfolio management**: Track all positions in single contract

### Continuous Clearing Auction (CCA)

Inspired by Uniswap's UniswapX and traditional batch auctions:

```
┌─────────────────────────────────────────────────────────┐
│                    MONAD BLOCK N                         │
│                    (1 second)                            │
├─────────────────────────────────────────────────────────┤
│  TX 1: Alice bets 1 MON on Agent-Alpha @ 0.1s           │
│  TX 2: Bob bets 2 MON on Agent-Bravo @ 0.3s             │
│  TX 3: MEV bot tries to front-run @ 0.2s                │
│  TX 4: Carol bets 0.5 MON on Agent-Alpha @ 0.8s         │
├─────────────────────────────────────────────────────────┤
│                  END OF BLOCK                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │ CCA Engine calculates single clearing price:    │    │
│  │ - All Agent-Alpha bets: 1.5 MON total          │    │
│  │ - All Agent-Bravo bets: 2 MON total            │    │
│  │ - Uniform price for all in this block          │    │
│  │ - MEV bot gets SAME price as Alice & Carol     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**MEV Protection**: Front-running is useless because all transactions in the same block receive identical pricing. No advantage to being "first" within a block.

### Phase-Gated Market States

```solidity
enum MarketPhase {
    PAUSED,      // NIGHT: No trading, impostor acts
    SETTLING,    // REPORT: Process deaths, disable dead agent minting
    ACTIVE,      // DISCUSSION: CCA live, prices rising
    CLOSED       // VOTE: Locked for resolution
}

function getPhaseMultiplier(MarketPhase phase) internal pure returns (uint256) {
    if (phase == MarketPhase.ACTIVE) return 120; // 20% premium during discussion
    return 100; // Base price
}
```

---

## 🛡️ Dead Agent Insurance System

When a user's chosen agent dies, they don't lose everything:

### Option A: Voucher System

```solidity
// When Agent-Alpha dies in Round 2
function processAgentDeath(bytes32 gameId, uint8 agentIndex) external {
    // Disable further minting
    outcomeTokens[gameId][agentIndex].mintingEnabled = false;
    
    // Issue vouchers to holders
    address[] memory holders = getHolders(gameId, agentIndex);
    for (uint i = 0; i < holders.length; i++) {
        uint256 balance = balanceOf(holders[i], tokenId);
        uint256 voucherAmount = balance * VOUCHER_RATE / 100; // e.g., 20%
        _mint(holders[i], VOUCHER_TOKEN_ID, voucherAmount);
    }
}
```

### Option B: Insurance Pool

```solidity
// 2% of all bets go to insurance pool
// When agent dies, holders receive proportional payout
uint256 public insurancePool;

function claimInsurance(bytes32 gameId, uint8 deadAgentIndex) external {
    uint256 userShares = balanceOf(msg.sender, getTokenId(gameId, deadAgentIndex));
    uint256 totalShares = totalSupply(getTokenId(gameId, deadAgentIndex));
    uint256 payout = insurancePool * userShares / totalShares * INSURANCE_RATE / 100;
    
    payable(msg.sender).transfer(payout);
}
```

---

## 📊 Why Monad?

| Requirement | Ethereum | Monad | Impact |
|------------|----------|-------|--------|
| Block time | 12s | 1s | 12x faster CCA batching |
| TPS | ~30 | 10,000+ | Handle 7 concurrent auctions |
| Gas costs | $5-50/tx | <$0.01/tx | Viable micro-betting |
| Finality | ~6 min | <1s | Instant settlement |

**Monad enables real-time CCA that's economically impossible on Ethereum.**

---

## 🔄 V1 → V2 Migration Path

| Component | V1 (Current) | V2 (Planned) |
|-----------|--------------|--------------|
| Share Token | None (pool-based) | ERC-1155 |
| Pricing | Static (pool ratio) | Dynamic (info premium) |
| MEV Protection | None | CCA batch clearing |
| Dead Agent | Total loss | Insurance/Vouchers |
| Multi-bet | Multiple txs | Single batch tx |

**Migration Strategy**:
1. Deploy V2 contracts alongside V1
2. New games use V2, existing games complete on V1
3. Gradual user migration with incentives
4. V1 sunset after 3-month transition

---

## 📈 Expected Outcomes

| Metric | V1 Baseline | V2 Target | Improvement |
|--------|-------------|-----------|-------------|
| Early bet ratio | 15% | 45% | 3x more early engagement |
| User retention | 30% | 60% | Insurance keeps users in |
| Avg bets per game | 8 | 25 | Portfolio betting enabled |
| MEV losses | ~5% of volume | 0% | CCA protection |
| Gas per bet | 0.005 MON | 0.002 MON | ERC-1155 efficiency |

---

## 🗓️ Implementation Timeline

| Phase | Timeframe | Deliverable |
|-------|-----------|-------------|
| Research | Q1 2026 | This document, economic modeling |
| Prototype | Q2 2026 | ERC-1155 contract + CCA engine |
| Audit | Q2 2026 | Security review |
| Testnet | Q2 2026 | Public beta on Monad testnet |
| Mainnet | Q3 2026 | Production launch |

---

## 📚 References

- [ERC-1155: Multi Token Standard](https://eips.ethereum.org/EIPS/eip-1155)
- [UniswapX: MEV-Protected Swaps](https://blog.uniswap.org/uniswapx-protocol)
- [Frequent Batch Auctions (Budish et al.)](https://faculty.chicagobooth.edu/eric.budish/research/HFT-FrequentBatchAuctions.pdf)
- [Monad: Parallel Execution Blockchain](https://docs.monad.xyz/)

---

*This document represents Prescio's technical vision for V2. Implementation subject to community feedback and security considerations.*
