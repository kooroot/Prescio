# Prescio Staking System - Final Specification

**Version**: 2.0  
**Date**: 2026-02-06  
**Status**: APPROVED - Ready for Implementation  
**Authors**: Prescio Team, PM Agent  

---

## 📋 Executive Summary

본 문서는 Prescio 스테이킹 시스템의 **최종 확정 스펙**입니다. 기존 문서들(TOKENOMICS.md, staking-system.md, TOKENOMICS-REVIEW.md)의 불일치를 해소하고, 최종 결정된 사항을 단일 소스로 정리합니다.

### 핵심 결정 사항

| 항목 | 최종 결정 |
|------|----------|
| **페널티 분배** | 40% Burn / 40% Stakers / 20% Treasury |
| **보상 시스템** | 듀얼 보상 (MON + PRESCIO) |
| **MON 보상 소스** | 베팅 수수료 30% |
| **PRESCIO 보상 소스** | 페널티 40% |
| **토큰 구조** | PRESCIO (1B 고정), MON (네이티브) |

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PRESCIO DUAL REWARD STAKING SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         TOKEN FLOWS                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│         ┌──────────────────┐              ┌──────────────────┐              │
│         │     PRESCIO      │              │       MON        │              │
│         │   (ERC-20)       │              │   (Native)       │              │
│         │  1B Fixed Supply │              │  Monad Network   │              │
│         └────────┬─────────┘              └────────┬─────────┘              │
│                  │                                  │                        │
│                  │ stake                            │ betting                │
│                  ▼                                  ▼                        │
│         ┌──────────────────┐              ┌──────────────────┐              │
│         │ PrescioStaking   │              │  PrescioMarket   │              │
│         │   Contract       │              │    Contract      │              │
│         └────────┬─────────┘              └────────┬─────────┘              │
│                  │                                  │                        │
│                  │ early unstake                    │ 5% platform fee        │
│                  ▼                                  ▼                        │
│         ┌──────────────────────────────────────────────────────────┐        │
│         │                   REWARD SOURCES                          │        │
│         ├──────────────────────────────────────────────────────────┤        │
│         │                                                           │        │
│         │  ┌─────────────────────┐     ┌─────────────────────┐     │        │
│         │  │  PRESCIO PENALTIES  │     │   MON BETTING FEES  │     │        │
│         │  │                     │     │                     │     │        │
│         │  │  40% → BURN 🔥      │     │  50% → Treasury     │     │        │
│         │  │  40% → STAKERS 💰   │     │  30% → STAKERS 💰   │     │        │
│         │  │  20% → TREASURY 🏛️  │     │  20% → Development  │     │        │
│         │  └─────────────────────┘     └─────────────────────┘     │        │
│         │                                                           │        │
│         └────────────────────────┬─────────────────────────────────┘        │
│                                  │                                           │
│                                  ▼                                           │
│         ┌──────────────────────────────────────────────────────────┐        │
│         │                    STAKER REWARDS                         │        │
│         │                                                           │        │
│         │   ┌───────────────────┐   ┌───────────────────┐          │        │
│         │   │   MON REWARDS     │   │ PRESCIO REWARDS   │          │        │
│         │   │   (Weekly Epoch)  │   │  (Penalty Pool)   │          │        │
│         │   │                   │   │                   │          │        │
│         │   │  From: 30% of     │   │  From: 40% of     │          │        │
│         │   │  betting fees     │   │  early unstake    │          │        │
│         │   │                   │   │  penalties        │          │        │
│         │   └─────────┬─────────┘   └─────────┬─────────┘          │        │
│         │             │                       │                     │        │
│         │             └───────────┬───────────┘                     │        │
│         │                         │                                 │        │
│         │                         ▼                                 │        │
│         │           ┌─────────────────────────────┐                │        │
│         │           │      claimRewards()         │                │        │
│         │           │   (Claim Both at Once)      │                │        │
│         │           └─────────────────────────────┘                │        │
│         │                                                           │        │
│         └──────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🪙 Token Economics

### 1. PRESCIO Token

| 속성 | 값 |
|------|-----|
| **발행 플랫폼** | nad.fun |
| **총 공급량** | 1,000,000,000 (1B) |
| **추가 발행** | ❌ 불가능 (고정 공급) |
| **소수점** | 18 decimals |
| **네트워크** | Monad |

#### 분배

| 할당 | 비율 | 수량 | 용도 |
|------|------|------|------|
| Community & Ecosystem | 40% | 400M | 베팅 보상, 에어드랍, LP |
| Staking Rewards | 20% | 200M | 4년간 스테이킹 보상 |
| Team & Development | 15% | 150M | 팀 (2년 베스팅, 6개월 클리프) |
| Treasury Reserve | 15% | 150M | DAO 운영 |
| Investors | 10% | 100M | 투자자 (18개월 베스팅) |

### 2. MON Token

| 속성 | 값 |
|------|-----|
| **타입** | Monad 네트워크 네이티브 토큰 |
| **용도** | 베팅, 가스비, 스테이커 보상 |
| **특징** | 외부 토큰, Prescio가 발행하지 않음 |

### 3. 두 토큰의 관계

```
┌────────────────────────────────────────────────────────────────────┐
│                    TOKEN UTILITY MATRIX                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Action              │  Token Used  │  Notes                       │
│  ────────────────────┼──────────────┼──────────────────────────── │
│  Place Bet           │  MON         │  Native token for value      │
│  Stake               │  PRESCIO     │  Lock for benefits           │
│  Receive Bet Reward  │  MON         │  From betting fees (30%)     │
│  Receive Penalty     │  PRESCIO     │  From penalties (40%)        │
│  Pay Gas Fees        │  MON         │  Network native              │
│  Governance Vote     │  PRESCIO     │  1 token = 1 vote            │
│  Agent Creation      │  PRESCIO     │  Burn mechanism              │
│  Fee Discount        │  PRESCIO     │  Hold-based discount         │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 💰 Fee Structure

### Platform Fee (5% of Betting Pool)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PLATFORM FEE DISTRIBUTION                        │
│                        (5% of Betting Pool)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                    Total Fee: 5 MON (from 100 MON pool)              │
│                                                                      │
│         ┌───────────────────────────────────────────────┐           │
│         │                                               │           │
│         │    ┌─────────────────────────────────────┐    │           │
│         │    │           TREASURY                  │    │           │
│         │    │           50% (2.5 MON)             │    │           │
│         │    │                                     │    │           │
│         │    │    Protocol growth, liquidity       │    │           │
│         │    └─────────────────────────────────────┘    │           │
│         │                                               │           │
│         │    ┌─────────────────────────────────────┐    │           │
│         │    │           STAKERS                   │    │           │
│         │    │           30% (1.5 MON)             │    │           │
│         │    │                                     │    │           │
│         │    │    Weekly epoch rewards             │    │           │
│         │    └─────────────────────────────────────┘    │           │
│         │                                               │           │
│         │    ┌─────────────────────────────────────┐    │           │
│         │    │          DEVELOPMENT                │    │           │
│         │    │           20% (1.0 MON)             │    │           │
│         │    │                                     │    │           │
│         │    │    Team operations                  │    │           │
│         │    └─────────────────────────────────────┘    │           │
│         │                                               │           │
│         └───────────────────────────────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Penalty Distribution (FINAL)

### Early Unstaking Penalty Rates

| Lock Type | Exit Timing | Penalty Rate | Received |
|-----------|-------------|--------------|----------|
| **Flexible (7d)** | Day 1-2 | 15% | 85% |
| **Flexible (7d)** | Day 3-4 | 10% | 90% |
| **Flexible (7d)** | Day 5-6 | 5% | 95% |
| **Flexible (7d)** | Day 7+ | 0% | 100% |
| **Fixed (14d-90d)** | Emergency | 50% | 50% |

### Penalty Distribution (40/40/20)

```
┌─────────────────────────────────────────────────────────────────────┐
│              PENALTY DISTRIBUTION (FINAL - 40/40/20)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │              PENALTY POOL (100% PRESCIO)                     │  │
│    │                                                              │  │
│    │   Example: 10,000 PRESCIO penalty from early unstaker        │  │
│    └──────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│            ┌──────────────────┼──────────────────┐                  │
│            ▼                  ▼                  ▼                  │
│    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐          │
│    │     BURN     │   │   STAKERS    │   │   TREASURY   │          │
│    │     40%      │   │     40%      │   │     20%      │          │
│    │              │   │              │   │              │          │
│    │ 4,000 PRESCIO│   │ 4,000 PRESCIO│   │ 2,000 PRESCIO│          │
│    │              │   │              │   │              │          │
│    │  → 0xdead    │   │  → Reward    │   │  → Treasury  │          │
│    │  (Permanent) │   │     Pool     │   │   Address    │          │
│    └──────────────┘   └──────────────┘   └──────────────┘          │
│                                                                      │
│    ═══════════════════════════════════════════════════════════════  │
│                                                                      │
│    EFFECTS:                                                          │
│    • Burn: 공급량 영구 감소 → 디플레이션                              │
│    • Stakers: 충실한 홀더에게 PRESCIO 토큰 보상                       │
│    • Treasury: 프로토콜 운영 자금                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### ⚡ 이전 문서와의 차이점

| 항목 | TOKENOMICS-REVIEW 제안 | **최종 결정** |
|------|------------------------|---------------|
| Burn | 80% | **40%** |
| Stakers | 0% (제거) | **40%** |
| Treasury | 20% | **20%** |

**결정 이유**: 스테이커에게 직접적인 페널티 보상을 제공하여 장기 홀딩 인센티브 강화

---

## 💎 Dual Reward System

### 보상 소스 비교

| 보상 타입 | 토큰 | 소스 | 분배 주기 |
|-----------|------|------|-----------|
| **Betting Fee Reward** | MON | 플랫폼 수수료 30% | Weekly Epoch |
| **Penalty Reward** | PRESCIO | 페널티 40% | On-demand |

### 보상 플로우

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DUAL REWARD FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    SOURCE 1: BETTING FEES                     │   │
│  │                                                               │   │
│  │   [Betting Pool] ──5%──▶ [Platform Fee] ──30%──▶ [MON Pool]  │   │
│  │                                                               │   │
│  │   Accumulation: Continuous (per bet)                         │   │
│  │   Distribution: Weekly Epoch Snapshot                        │   │
│  │   Token: MON (Native)                                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   SOURCE 2: PENALTIES                         │   │
│  │                                                               │   │
│  │   [Early Unstake] ──Penalty──▶ [Penalty Pool] ──40%──▶       │   │
│  │                                             [PRESCIO Pool]    │   │
│  │                                                               │   │
│  │   Accumulation: On penalty events                            │   │
│  │   Distribution: On distributePenalties() call                │   │
│  │   Token: PRESCIO (ERC-20)                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     CLAIM MECHANISM                           │   │
│  │                                                               │   │
│  │   User calls: claimRewards()                                 │   │
│  │                    │                                          │   │
│  │                    ├──▶ MON rewards (from epochs)            │   │
│  │                    │         └──▶ transfer MON to user       │   │
│  │                    │                                          │   │
│  │                    └──▶ PRESCIO rewards (from penalty pool)  │   │
│  │                              └──▶ transfer PRESCIO to user   │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 보상 계산 공식

#### MON Epoch Reward

```
User MON Reward = (User Weight / Total Weight) × Epoch MON Pool

Where:
  User Weight = Staked Amount × Tier Boost × Lock Multiplier
  
  Tier Boost:
    Bronze:    1.0x (100)
    Silver:    1.2x (120)
    Gold:      1.5x (150)
    Diamond:   2.0x (200)
    Legendary: 3.0x (300)
    
  Lock Multiplier:
    7d Flex:   1.0x (100)
    14d Fixed: 1.1x (110)
    30d Fixed: 1.25x (125)
    60d Fixed: 1.5x (150)
    90d Fixed: 2.0x (200)
```

#### PRESCIO Penalty Reward

```
User PRESCIO Reward = (User Weight / Total Weight) × Penalty PRESCIO Pool

Penalty PRESCIO Pool = Accumulated penalties × 40%
```

---

## 🔧 Contract Modification Requirements

### Current State Analysis

**현재 PrescioStaking.sol의 문제점:**

1. **토큰 타입 혼합**: `epochs[currentEpoch].totalRewards`에 MON과 PRESCIO 보상이 혼합됨
2. **단일 보상**: PRESCIO 페널티 보상이 MON epoch 보상에 추가되어 있음 (타입 불일치)
3. **클레임 분리 없음**: 듀얼 보상 개별 클레임 불가

### Required Changes

#### 1. State Variables (추가)

```solidity
// PRESCIO 보상 풀 (페널티에서)
uint256 public pendingPrescioRewardsPool;

// 사용자별 PRESCIO 보상 클레임 트래킹
mapping(address => uint256) public userPrescioRewardsClaimed;

// Epoch별 PRESCIO 보상 (분리)
mapping(uint256 => uint256) public epochPrescioRewards;
```

#### 2. _distributePenalty 수정

```solidity
// 현재 (문제있는 코드)
function _distributePenalty(uint256 penalty) internal {
    pendingBurnAmount += (penalty * PENALTY_BURN_SHARE) / PENALTY_PRECISION;
    pendingStakerRewards += (penalty * PENALTY_STAKER_SHARE) / PENALTY_PRECISION;  // PRESCIO
    pendingTreasuryAmount += (penalty * PENALTY_TREASURY_SHARE) / PENALTY_PRECISION;
}

// 수정 후
function _distributePenalty(uint256 penalty) internal {
    uint256 burnAmount = (penalty * PENALTY_BURN_SHARE) / PENALTY_PRECISION;
    uint256 stakerAmount = (penalty * PENALTY_STAKER_SHARE) / PENALTY_PRECISION;
    uint256 treasuryAmount = (penalty * PENALTY_TREASURY_SHARE) / PENALTY_PRECISION;
    
    pendingBurnAmount += burnAmount;
    pendingPrescioRewardsPool += stakerAmount;  // 분리된 PRESCIO 풀
    pendingTreasuryAmount += treasuryAmount;
}
```

#### 3. distributePenalties 수정

```solidity
// 현재 (문제있는 코드 - MON epoch에 PRESCIO 추가)
function distributePenalties() external nonReentrant {
    // ...
    epochs[currentEpoch].totalRewards += stakerAmount;  // ❌ 잘못됨
    // ...
}

// 수정 후
function distributePenalties() external nonReentrant {
    uint256 burnAmount = pendingBurnAmount;
    uint256 stakerAmount = pendingPrescioRewardsPool;  // PRESCIO 풀
    uint256 treasuryAmount = pendingTreasuryAmount;
    
    if (burnAmount + stakerAmount + treasuryAmount == 0) return;

    // Reset
    pendingBurnAmount = 0;
    pendingPrescioRewardsPool = 0;
    pendingTreasuryAmount = 0;

    // PRESCIO 보상은 별도 풀에 추가 (현재 epoch와 연동)
    epochPrescioRewards[currentEpoch] += stakerAmount;

    // Burn
    if (burnAmount > 0) {
        prescioToken.safeTransfer(DEAD_ADDRESS, burnAmount);
    }

    // Treasury
    if (treasuryAmount > 0) {
        prescioToken.safeTransfer(treasury, treasuryAmount);
    }

    emit PenaltiesDistributed(burnAmount, stakerAmount, treasuryAmount);
}
```

#### 4. Claim Function 분리

```solidity
// MON 보상 클레임 (기존)
function claimMonRewards(uint256 maxEpochs) external nonReentrant {
    _claimMonRewards(msg.sender, maxEpochs);
}

// PRESCIO 보상 클레임 (신규)
function claimPrescioRewards(uint256 maxEpochs) external nonReentrant {
    _claimPrescioRewards(msg.sender, maxEpochs);
}

// 전체 클레임 (편의 함수)
function claimAllRewards(uint256 maxEpochs) external nonReentrant {
    _claimMonRewards(msg.sender, maxEpochs);
    _claimPrescioRewards(msg.sender, maxEpochs);
}
```

#### 5. _claimPrescioRewards 구현

```solidity
function _claimPrescioRewards(address user, uint256 maxEpochs) internal {
    Stake storage userStake = stakes[user];
    if (!userStake.exists) revert NoStakeFound();

    uint256 userWeight = getUserWeight(user);
    if (userWeight == 0) revert NothingToClaim();

    uint256 startEpoch = userStake.lastPrescioClaimEpoch;  // 새 필드 필요
    if (startEpoch < userStake.firstEligibleEpoch) {
        startEpoch = userStake.firstEligibleEpoch;
    }

    uint256 endEpoch = startEpoch + maxEpochs;
    if (endEpoch > currentEpoch) endEpoch = currentEpoch;

    uint256 totalReward = 0;

    for (uint256 e = startEpoch; e < endEpoch;) {
        Epoch storage epoch = epochs[e];
        uint256 prescioPool = epochPrescioRewards[e];
        
        if (epoch.finalized && epoch.totalWeight > 0 && prescioPool > 0) {
            uint256 epochReward = (prescioPool * userWeight) / epoch.totalWeight;
            totalReward += epochReward;
        }
        unchecked { ++e; }
    }

    if (totalReward == 0) revert NothingToClaim();

    userStake.lastPrescioClaimEpoch = endEpoch;  // 새 필드

    // PRESCIO 전송
    prescioToken.safeTransfer(user, totalReward);

    emit PrescioRewardsClaimed(user, startEpoch, endEpoch - 1, totalReward);
}
```

#### 6. Stake 구조체 수정

```solidity
struct Stake {
    uint256 amount;
    uint256 lockEnd;
    LockType lockType;
    uint256 startTime;
    uint256 lastClaimEpoch;         // MON 클레임 트래킹
    uint256 lastPrescioClaimEpoch;  // NEW: PRESCIO 클레임 트래킹
    uint256 firstEligibleEpoch;
    bool exists;
}
```

#### 7. View Functions 추가

```solidity
function getPendingMonRewards(address user) external view returns (uint256);
function getPendingPrescioRewards(address user) external view returns (uint256);
function getPendingRewards(address user) external view returns (
    uint256 monRewards,
    uint256 prescioRewards
);
```

---

## 📊 Staking Tiers (No Change)

| Tier | Name | Min Stake | Lock Period | Auto-Bet | Fee Discount | Boost |
|------|------|-----------|-------------|----------|--------------|-------|
| 🥉 Bronze | Watcher | 1,000 PRESCIO | 7일 | ❌ | 0% | 1.0x |
| 🥈 Silver | Bettor | 10,000 PRESCIO | 14일 | ✅ Basic | 10% | 1.2x |
| 🥇 Gold | Analyst | 50,000 PRESCIO | 30일 | ✅ Standard | 25% | 1.5x |
| 💎 Diamond | Whale | 200,000 PRESCIO | 60일 | ✅ Premium | 40% | 2.0x |
| 👑 Legendary | Oracle | 500,000 PRESCIO | 90일 | ✅ Ultimate | 50% | 3.0x |

---

## 🔄 Document Reconciliation

### 기존 문서 불일치 해소

| 문서 | 이슈 | 해결 방안 |
|------|------|----------|
| **TOKENOMICS.md** | "7일 이내 10%" 단순 설명 | 상세 구조로 업데이트 필요 |
| **staking-system.md** | 40/40/20 명시 (올바름) | 유지 |
| **TOKENOMICS-REVIEW.md** | 80/20 제안 | **최종 결정으로 덮어씀** (40/40/20) |
| **post-fix-review.md** | Issue #1 토큰 타입 혼합 | 본 스펙의 수정사항으로 해결 |

### 업데이트 필요 문서

1. **TOKENOMICS.md**
   - 페널티 상세 구조 추가 (Day별 비율)
   - 듀얼 보상 시스템 설명 추가

2. **staking-system.md**
   - Penalty Distribution 다이어그램 최신화 확인
   - Dual Reward 섹션 추가

3. **TOKENOMICS-REVIEW.md**
   - "최종 결정: 40/40/20" 명시 추가
   - 80/20 제안은 "검토됨, 채택 안함"으로 표시

---

## 🛡️ Security Considerations

### Audit 결과 반영 상태

| 이슈 ID | 심각도 | 설명 | 상태 |
|---------|--------|------|------|
| C-02 | Critical | totalWeight 계산 | ✅ 수정됨 |
| C-03 | Critical | Claim DoS | ✅ 수정됨 |
| H-02 | High | Penalty 산술 | ✅ 수정됨 |
| H-03 | High | Epoch 탈중앙화 | ✅ 수정됨 |
| M-01 | Medium | Front-running | ✅ 수정됨 |
| NEW | Medium | 토큰 타입 혼합 | 🔄 본 스펙으로 해결 |

### 듀얼 보상 도입 시 추가 고려사항

1. **토큰 잔액 확인**: PRESCIO 보상 클레임 시 컨트랙트 잔액 확인 필요
2. **풀 분리**: MON/PRESCIO 보상 풀의 완전한 분리
3. **이벤트 분리**: 각 보상 타입별 개별 이벤트 emit

---

## 📝 Implementation Checklist

### Phase 1: Contract Updates

- [ ] State variables 추가 (pendingPrescioRewardsPool, epochPrescioRewards, etc.)
- [ ] Stake 구조체에 lastPrescioClaimEpoch 추가
- [ ] _distributePenalty 수정
- [ ] distributePenalties 수정
- [ ] claimMonRewards, claimPrescioRewards, claimAllRewards 구현
- [ ] View functions 추가
- [ ] 신규 이벤트 추가 (PrescioRewardsClaimed)
- [ ] Storage gap 조정 (신규 변수 고려)

### Phase 2: Testing

- [ ] Unit tests for dual rewards
- [ ] Integration tests (stake → penalty → claim flow)
- [ ] Edge cases (no penalties, empty epochs)
- [ ] Gas optimization tests
- [ ] Upgrade path tests (V1 → V2)

### Phase 3: Documentation

- [ ] TOKENOMICS.md 업데이트
- [ ] staking-system.md 업데이트
- [ ] NatSpec 문서화
- [ ] User guide 작성

### Phase 4: Deployment

- [ ] Testnet 배포
- [ ] Internal audit
- [ ] External audit (필요시)
- [ ] Mainnet 배포
- [ ] 기존 스테이커 마이그레이션 (해당 시)

---

## 📚 Appendix

### A. Constants Summary

```solidity
// Penalty Distribution (40/40/20)
uint256 public constant PENALTY_BURN_SHARE = 400;      // 40%
uint256 public constant PENALTY_STAKER_SHARE = 400;    // 40%
uint256 public constant PENALTY_TREASURY_SHARE = 200;  // 20%
uint256 public constant PENALTY_PRECISION = 1000;

// Platform Fee Distribution (50/30/20)
uint256 public constant FEE_TREASURY_SHARE = 5000;     // 50%
uint256 public constant FEE_STAKER_SHARE = 3000;       // 30%
uint256 public constant FEE_DEV_SHARE = 2000;          // 20%
uint256 public constant FEE_PRECISION = 10000;

// Early Unstaking Penalties
uint256 public constant PENALTY_DAY_1_2 = 150;         // 15%
uint256 public constant PENALTY_DAY_3_4 = 100;         // 10%
uint256 public constant PENALTY_DAY_5_6 = 50;          // 5%
uint256 public constant EMERGENCY_PENALTY = 500;       // 50%

// Tier Boosts
uint256 public constant BOOST_BRONZE = 100;            // 1.0x
uint256 public constant BOOST_SILVER = 120;            // 1.2x
uint256 public constant BOOST_GOLD = 150;              // 1.5x
uint256 public constant BOOST_DIAMOND = 200;           // 2.0x
uint256 public constant BOOST_LEGENDARY = 300;         // 3.0x

// Lock Multipliers
uint256 public constant LOCK_MULT_7D = 100;            // 1.0x
uint256 public constant LOCK_MULT_14D = 110;           // 1.1x
uint256 public constant LOCK_MULT_30D = 125;           // 1.25x
uint256 public constant LOCK_MULT_60D = 150;           // 1.5x
uint256 public constant LOCK_MULT_90D = 200;           // 2.0x
```

### B. Event Definitions

```solidity
// Existing
event Staked(address indexed user, uint256 amount, LockType lockType, Tier tier);
event Unstaked(address indexed user, uint256 amount, uint256 penalty);
event EmergencyUnstaked(address indexed user, uint256 amount, uint256 penalty);
event EpochFinalized(uint256 indexed epoch, uint256 totalRewards, uint256 totalWeight);
event RewardsDeposited(uint256 amount, uint256 epoch);
event PenaltiesDistributed(uint256 burned, uint256 toStakers, uint256 toTreasury);

// Updated (split)
event MonRewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 amount);
event PrescioRewardsClaimed(address indexed user, uint256 fromEpoch, uint256 toEpoch, uint256 amount);
```

### C. Migration Notes

기존 스테이커가 있는 상태에서 업그레이드 시:

1. `lastPrescioClaimEpoch`은 `lastClaimEpoch`과 동일하게 초기화
2. 이전 epoch의 penalty 보상은 소급 적용하지 않음 (새 epoch부터 적용)
3. reinitializer(2) 사용하여 새 변수 초기화

---

**End of Specification**

---

*Document maintained by: Prescio PM Agent*  
*Last updated: 2026-02-06*  
*Review status: APPROVED*
