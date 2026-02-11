# PrescioStaking V5 - addStake 기능 명세서

**Version**: 5.0
**Date**: 2026-02-12
**Status**: Draft
**Author**: Prescio PM Agent

---

## 1. 개요

### 1.1 문제 정의

현재 PrescioStaking 컨트랙트(V4)는 `stake()` 함수에서 `AlreadyStaked` 에러를 반환하여 기존 스테이커의 추가 스테이킹을 차단합니다:

```solidity
if (stakes[msg.sender].exists) revert AlreadyStaked();
```

이로 인해 발생하는 UX 문제:
- **티어 업그레이드 불편**: Bronze → Silver 업그레이드 시 unstake → restake 필요
- **가스비 낭비**: 2회 트랜잭션 필요 (unstake + stake)
- **보상 손실 위험**: unstake 시점에 축적된 보상 정산, 새 에폭 대기 필요
- **락업 리셋**: 기존 락업 기간이 완전히 초기화됨

### 1.2 솔루션

`addStake(uint256 amount, bool extendLock)` 함수 추가로 기존 스테이킹에 금액을 추가하고, 티어와 weight를 자동 재계산합니다.

---

## 2. 상세 기능 명세

### 2.1 함수 시그니처

```solidity
/**
 * @notice Add tokens to existing stake
 * @dev Requires active stake. Tier and weight are recalculated.
 * @param amount Amount of PRESCIO tokens to add
 * @param extendLock If true, reset lockEnd to current time + original lock duration
 *                   If false, keep existing lockEnd (minimum lock period check still applies)
 * @custom:security nonReentrant, checks-effects-interactions pattern
 */
function addStake(uint256 amount, bool extendLock) external nonReentrant;
```

### 2.2 상태 변경

| State Variable | 변경 내용 |
|----------------|-----------|
| `stakes[user].amount` | `+= amount` |
| `stakes[user].lockEnd` | 조건부 연장 (extendLock 옵션) |
| `totalStaked` | `+= amount` |
| `totalWeight` | 기존 weight 제거 후 새 weight 추가 |
| `firstEligibleEpoch` | **유지** (기존 값 보존) |
| `startTime` | **유지** (기존 값 보존) |

### 2.3 티어 자동 재계산

티어는 `getTierForAmount()` 함수에서 `stakes[user].amount` 기반으로 계산되므로, amount 증가 시 자동으로 상위 티어 적용:

```
기존 10M (Bronze) + 추가 10M → 총 20M (Silver)
기존 30M (Silver) + 추가 20M → 총 50M (Gold)
```

### 2.4 Weight 재계산 로직

```solidity
// 1. 기존 weight 제거
uint256 oldWeight = getUserWeight(msg.sender);
totalWeight -= oldWeight;

// 2. amount 증가
userStake.amount += amount;

// 3. 새 weight 계산 및 추가
Tier newTier = getTierForAmount(userStake.amount);
uint256 newWeight = _calculateWeight(userStake.amount, newTier, userStake.lockType);
totalWeight += newWeight;
```

### 2.5 lockEnd 처리 옵션

#### Option A: `extendLock = false` (기본)
- lockEnd 유지
- 단, 현재 시점이 lockEnd를 이미 지났다면 → 최소 락업 기간 적용

```solidity
if (block.timestamp >= userStake.lockEnd) {
    // 락업 만료 상태 → 최소 7일 락업 재설정
    userStake.lockEnd = block.timestamp + 7 days;
}
// else: 기존 lockEnd 유지
```

#### Option B: `extendLock = true`
- 현재 시점부터 원래 lockType에 해당하는 기간으로 재설정

```solidity
uint256 lockDuration = _getLockDuration(userStake.lockType);
userStake.lockEnd = block.timestamp + lockDuration;
```

---

## 3. 보안 요구사항

### 3.1 보안 체크리스트

| # | 취약점 | 대응책 | 구현 |
|---|--------|--------|------|
| S-01 | Reentrancy | `nonReentrant` modifier 사용 | ✅ 기존 ReentrancyGuardUpgradeable 활용 |
| S-02 | 오버플로우 | Solidity 0.8+ 내장 검사 | ✅ 자동 적용 |
| S-03 | 무허가 인출 | 인출 함수 영향 없음 (amount만 증가) | ✅ |
| S-04 | Zero amount attack | `if (amount == 0) revert ZeroAmount()` | 구현 필요 |
| S-05 | 스테이킹 없는 상태 | `if (!userStake.exists) revert NoStakeFound()` | 구현 필요 |
| S-06 | 토큰 전송 실패 | SafeERC20.safeTransferFrom 사용 | ✅ 기존 패턴 |
| S-07 | Weight 정합성 | 트랜잭션 내 atomic 업데이트 | 구현 필요 |
| S-08 | Front-running | firstEligibleEpoch 유지로 방지 | ✅ |
| S-09 | Epoch 조작 | weightAtEpochStart 스냅샷 유지 | ✅ 기존 로직 |

### 3.2 CEI 패턴 (Checks-Effects-Interactions)

```solidity
function addStake(uint256 amount, bool extendLock) external nonReentrant {
    // ===== CHECKS =====
    if (amount == 0) revert ZeroAmount();
    
    Stake storage userStake = stakes[msg.sender];
    if (!userStake.exists) revert NoStakeFound();
    
    // ===== EFFECTS =====
    // Weight 업데이트 (상태 변경)
    uint256 oldWeight = getUserWeight(msg.sender);
    totalWeight -= oldWeight;
    
    userStake.amount += amount;
    totalStaked += amount;
    
    // lockEnd 처리
    if (extendLock) {
        uint256 lockDuration = _getLockDuration(userStake.lockType);
        userStake.lockEnd = block.timestamp + lockDuration;
    } else if (block.timestamp >= userStake.lockEnd) {
        // 만료된 경우 최소 락업 적용
        userStake.lockEnd = block.timestamp + 7 days;
    }
    
    // 새 weight 계산
    Tier newTier = getTierForAmount(userStake.amount);
    uint256 newWeight = _calculateWeight(userStake.amount, newTier, userStake.lockType);
    totalWeight += newWeight;
    
    // ===== INTERACTIONS =====
    prescioToken.safeTransferFrom(msg.sender, address(this), amount);
    
    emit StakeAdded(msg.sender, amount, newTier, newWeight);
}
```

---

## 4. 엣지 케이스 처리

### 4.1 케이스 정의

| # | 케이스 | 예상 동작 | 처리 방법 |
|---|--------|-----------|-----------|
| E-01 | 스테이킹 없는 상태에서 호출 | Revert | `NoStakeFound` 에러 |
| E-02 | amount = 0 | Revert | `ZeroAmount` 에러 |
| E-03 | 락 기간 중 추가 스테이킹 | 허용 | lockEnd 유지 (extendLock=false) 또는 연장 |
| E-04 | 락 만료 후 추가 스테이킹 | 허용 | 최소 7일 락업 재설정 |
| E-05 | 티어 변경 없는 추가 | 허용 | weight만 증가 |
| E-06 | 티어 상승하는 추가 | 허용 | 티어 + weight 모두 변경 |
| E-07 | 보상 클레임 전 추가 | 허용 | 보상 계산에 즉시 반영 안됨 (epoch 스냅샷) |
| E-08 | emergency unstake 직후 addStake | Revert | 스테이크가 삭제되어 NoStakeFound |
| E-09 | 최대 uint256 초과 | Revert | Solidity 오버플로우 검사 |
| E-10 | 토큰 잔액 부족 | Revert | SafeERC20 실패 |

### 4.2 보상 계산 영향

```
[Epoch N] [Epoch N+1] [Epoch N+2]
   │         │           │
   ▼         ▼           ▼
 stake()  addStake()  finalize()
   │         │           │
   └─────────┴───────────┘
             │
   firstEligibleEpoch = N+1 (유지)
   
- addStake 호출 시점의 weight 변경은 "현재 진행 중인 epoch"부터 반영
- 단, 해당 epoch이 finalize될 때 weightAtEpochStart가 사용됨
- 따라서 epoch 시작 이후의 addStake는 해당 epoch 보상에 영향 없음 (안전)
```

**Weight 스냅샷 보호 (V1.3 M-01 FIX)**:
- `finalizeEpoch()` 시 `weightAtEpochStart` 사용
- addStake로 인한 weight 변경은 다음 epoch부터 적용

---

## 5. 구현 코드

### 5.1 새로운 에러 및 이벤트

```solidity
// ============================================
// Events (추가)
// ============================================

event StakeAdded(
    address indexed user, 
    uint256 addedAmount, 
    uint256 totalAmount,
    Tier newTier, 
    uint256 newWeight,
    bool lockExtended
);

// ============================================
// Errors (추가 없음 - 기존 활용)
// ============================================
// ZeroAmount - 기존
// NoStakeFound - 기존
```

### 5.2 함수 구현

```solidity
/**
 * @notice Add tokens to existing stake
 * @dev Tier and weight are recalculated automatically
 * @param amount Amount of PRESCIO tokens to add (must be > 0)
 * @param extendLock If true, reset lockEnd based on lockType. 
 *                   If false, keep existing lockEnd (with minimum 7d if expired)
 */
function addStake(uint256 amount, bool extendLock) external nonReentrant {
    // ===== CHECKS =====
    if (amount == 0) revert ZeroAmount();
    
    Stake storage userStake = stakes[msg.sender];
    if (!userStake.exists) revert NoStakeFound();
    
    // ===== EFFECTS =====
    // 1. 기존 weight 제거
    uint256 oldWeight = _calculateWeight(
        userStake.amount, 
        getTierForAmount(userStake.amount), 
        userStake.lockType
    );
    totalWeight -= oldWeight;
    
    // 2. amount 증가
    uint256 newAmount = userStake.amount + amount;
    userStake.amount = newAmount;
    totalStaked += amount;
    
    // 3. lockEnd 처리
    bool lockWasExtended = false;
    if (extendLock) {
        uint256 lockDuration = _getLockDuration(userStake.lockType);
        userStake.lockEnd = block.timestamp + lockDuration;
        lockWasExtended = true;
    } else if (block.timestamp >= userStake.lockEnd) {
        // 락업 만료 상태 → 최소 락업 재설정 (FLEXIBLE 기준)
        userStake.lockEnd = block.timestamp + 7 days;
        lockWasExtended = true;
    }
    
    // 4. 새 tier 및 weight 계산
    Tier newTier = getTierForAmount(newAmount);
    uint256 newWeight = _calculateWeight(newAmount, newTier, userStake.lockType);
    totalWeight += newWeight;
    
    // ===== INTERACTIONS =====
    prescioToken.safeTransferFrom(msg.sender, address(this), amount);
    
    emit StakeAdded(msg.sender, amount, newAmount, newTier, newWeight, lockWasExtended);
}
```

### 5.3 VERSION 업데이트

```solidity
uint256 public constant VERSION = 5;
```

### 5.4 Initializer (V5)

```solidity
/**
 * @notice Reinitializer for v5 upgrade - addStake feature
 * @dev No state changes needed, just version bump
 */
function initializeV5() public reinitializer(5) {
    // V5: addStake feature added
    // No additional state initialization required
}
```

---

## 6. 테스트 케이스

### 6.1 단위 테스트

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrescioStaking.sol";

contract AddStakeTest is Test {
    PrescioStaking staking;
    MockERC20 token;
    address user = address(0x1);
    
    function setUp() public {
        // Setup staking contract and token
    }
    
    // ===== 정상 케이스 =====
    
    function test_addStake_basic() public {
        // Given: user has 5M staked (Bronze)
        vm.startPrank(user);
        token.approve(address(staking), 25_000_000e18);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        
        // When: add 15M more
        staking.addStake(15_000_000e18, false);
        
        // Then: total 20M (Silver)
        assertEq(staking.stakes(user).amount, 20_000_000e18);
        assertEq(uint8(staking.getTier(user)), uint8(PrescioStaking.Tier.SILVER));
        vm.stopPrank();
    }
    
    function test_addStake_weightUpdate() public {
        // Given: user staked with known weight
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FIXED_30D);
        uint256 initialWeight = staking.getUserWeight(user);
        uint256 initialTotalWeight = staking.totalWeight();
        
        // When: add more tokens
        staking.addStake(5_000_000e18, false);
        
        // Then: weight increased proportionally
        uint256 newWeight = staking.getUserWeight(user);
        assertTrue(newWeight > initialWeight);
        assertEq(staking.totalWeight(), initialTotalWeight - initialWeight + newWeight);
        vm.stopPrank();
    }
    
    function test_addStake_tierUpgrade() public {
        // Given: Bronze tier
        vm.startPrank(user);
        staking.stake(TIER_BRONZE_MIN, PrescioStaking.LockType.FLEXIBLE);
        assertEq(uint8(staking.getTier(user)), uint8(PrescioStaking.Tier.BRONZE));
        
        // When: add enough to reach Silver
        uint256 toAdd = TIER_SILVER_MIN - TIER_BRONZE_MIN;
        staking.addStake(toAdd, false);
        
        // Then: Silver tier
        assertEq(uint8(staking.getTier(user)), uint8(PrescioStaking.Tier.SILVER));
        vm.stopPrank();
    }
    
    function test_addStake_extendLock_true() public {
        // Given: user staked 30 days ago (lock almost expired)
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FIXED_30D);
        uint256 originalLockEnd = staking.stakes(user).lockEnd;
        
        vm.warp(block.timestamp + 29 days);
        
        // When: addStake with extendLock=true
        staking.addStake(1_000_000e18, true);
        
        // Then: lockEnd reset to 30 days from now
        uint256 newLockEnd = staking.stakes(user).lockEnd;
        assertEq(newLockEnd, block.timestamp + 30 days);
        assertTrue(newLockEnd > originalLockEnd);
        vm.stopPrank();
    }
    
    function test_addStake_extendLock_false_keepLock() public {
        // Given: active lock
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FIXED_30D);
        uint256 originalLockEnd = staking.stakes(user).lockEnd;
        
        vm.warp(block.timestamp + 10 days);
        
        // When: addStake with extendLock=false
        staking.addStake(1_000_000e18, false);
        
        // Then: lockEnd unchanged
        assertEq(staking.stakes(user).lockEnd, originalLockEnd);
        vm.stopPrank();
    }
    
    function test_addStake_expiredLock_minLockApplied() public {
        // Given: lock expired
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        
        vm.warp(block.timestamp + 10 days); // lock expired (7 days)
        
        // When: addStake with extendLock=false
        staking.addStake(1_000_000e18, false);
        
        // Then: minimum 7 day lock applied
        assertEq(staking.stakes(user).lockEnd, block.timestamp + 7 days);
        vm.stopPrank();
    }
    
    // ===== 에러 케이스 =====
    
    function test_addStake_revert_zeroAmount() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        
        vm.expectRevert(PrescioStaking.ZeroAmount.selector);
        staking.addStake(0, false);
        vm.stopPrank();
    }
    
    function test_addStake_revert_noStake() public {
        vm.startPrank(user);
        vm.expectRevert(PrescioStaking.NoStakeFound.selector);
        staking.addStake(1_000_000e18, false);
        vm.stopPrank();
    }
    
    function test_addStake_revert_insufficientBalance() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        
        // User has no more tokens
        vm.expectRevert(); // SafeERC20 revert
        staking.addStake(1_000_000_000e18, false);
        vm.stopPrank();
    }
    
    function test_addStake_revert_noApproval() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        
        // Revoke approval
        token.approve(address(staking), 0);
        
        vm.expectRevert(); // SafeERC20 revert
        staking.addStake(1_000_000e18, false);
        vm.stopPrank();
    }
    
    // ===== 통합 테스트 =====
    
    function test_addStake_totalStakedUpdated() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        uint256 initialTotal = staking.totalStaked();
        
        staking.addStake(3_000_000e18, false);
        
        assertEq(staking.totalStaked(), initialTotal + 3_000_000e18);
        vm.stopPrank();
    }
    
    function test_addStake_preservesRewardEligibility() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        uint256 originalFirstEligible = staking.stakes(user).firstEligibleEpoch;
        
        staking.addStake(3_000_000e18, false);
        
        // firstEligibleEpoch should not change
        assertEq(staking.stakes(user).firstEligibleEpoch, originalFirstEligible);
        vm.stopPrank();
    }
    
    function test_addStake_preservesStartTime() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        uint256 originalStartTime = staking.stakes(user).startTime;
        
        vm.warp(block.timestamp + 5 days);
        staking.addStake(3_000_000e18, false);
        
        // startTime should not change
        assertEq(staking.stakes(user).startTime, originalStartTime);
        vm.stopPrank();
    }
    
    function test_addStake_eventEmitted() public {
        vm.startPrank(user);
        staking.stake(5_000_000e18, PrescioStaking.LockType.FLEXIBLE);
        
        vm.expectEmit(true, false, false, true);
        emit StakeAdded(user, 3_000_000e18, 8_000_000e18, PrescioStaking.Tier.BRONZE, /* weight */, false);
        
        staking.addStake(3_000_000e18, false);
        vm.stopPrank();
    }
    
    // ===== Reentrancy 테스트 =====
    
    function test_addStake_reentrancyProtected() public {
        // Deploy malicious token that calls addStake on transfer
        MaliciousToken malToken = new MaliciousToken(address(staking));
        // ... setup and test reentrancy protection
    }
}
```

### 6.2 퍼징 테스트

```solidity
function testFuzz_addStake_amountRange(uint256 initialAmount, uint256 addAmount) public {
    // Bound inputs to reasonable ranges
    initialAmount = bound(initialAmount, TIER_BRONZE_MIN, TIER_DIAMOND_MIN * 2);
    addAmount = bound(addAmount, 1, TIER_DIAMOND_MIN);
    
    // Give user tokens
    token.mint(user, initialAmount + addAmount);
    
    vm.startPrank(user);
    token.approve(address(staking), initialAmount + addAmount);
    
    staking.stake(initialAmount, PrescioStaking.LockType.FLEXIBLE);
    staking.addStake(addAmount, false);
    
    assertEq(staking.stakes(user).amount, initialAmount + addAmount);
    vm.stopPrank();
}

function testFuzz_addStake_weightConsistency(uint256 amount1, uint256 amount2) public {
    amount1 = bound(amount1, TIER_BRONZE_MIN, TIER_GOLD_MIN);
    amount2 = bound(amount2, 1e18, TIER_SILVER_MIN);
    
    // Test: stake(a+b) weight == stake(a) + addStake(b) weight
    // ... implementation
}
```

---

## 7. 마이그레이션 가이드

### 7.1 업그레이드 절차

```bash
# 1. 컨트랙트 컴파일
forge build

# 2. 테스트 실행
forge test --match-contract AddStakeTest -vvv

# 3. 업그레이드 스크립트 실행 (testnet)
forge script script/UpgradeV5.s.sol --rpc-url $TESTNET_RPC --broadcast

# 4. Verify
forge verify-contract $NEW_IMPL_ADDR PrescioStaking --chain-id $CHAIN_ID
```

### 7.2 업그레이드 스크립트

```solidity
// script/UpgradeV5.s.sol
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PrescioStaking.sol";

contract UpgradeV5 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("STAKING_PROXY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation
        PrescioStaking newImpl = new PrescioStaking();
        
        // Upgrade proxy
        PrescioStaking proxy = PrescioStaking(payable(proxyAddress));
        proxy.upgradeToAndCall(
            address(newImpl),
            abi.encodeWithSelector(PrescioStaking.initializeV5.selector)
        );
        
        // Verify version
        require(proxy.getVersion() == 5, "Version mismatch");
        
        vm.stopBroadcast();
        
        console.log("Upgraded to V5:", address(newImpl));
    }
}
```

---

## 8. 체크리스트

### 8.1 개발 체크리스트

- [ ] `addStake` 함수 구현
- [ ] `StakeAdded` 이벤트 추가
- [ ] VERSION 상수를 5로 업데이트
- [ ] `initializeV5` reinitializer 추가
- [ ] Storage gap 조정 (필요시)

### 8.2 보안 체크리스트

- [ ] nonReentrant modifier 적용 확인
- [ ] ZeroAmount 체크 확인
- [ ] NoStakeFound 체크 확인
- [ ] CEI 패턴 준수 확인
- [ ] totalWeight 정합성 확인
- [ ] totalStaked 정합성 확인
- [ ] lockEnd 로직 정확성 확인
- [ ] firstEligibleEpoch 유지 확인

### 8.3 테스트 체크리스트

- [ ] 기본 addStake 동작
- [ ] 티어 업그레이드 검증
- [ ] Weight 재계산 검증
- [ ] extendLock=true 케이스
- [ ] extendLock=false 케이스
- [ ] 만료된 락 처리
- [ ] ZeroAmount 리버트
- [ ] NoStakeFound 리버트
- [ ] 토큰 잔액 부족 리버트
- [ ] 이벤트 발생 확인
- [ ] Reentrancy 방어 확인
- [ ] Fuzz 테스트 통과

### 8.4 배포 체크리스트

- [ ] Testnet 배포 및 테스트
- [ ] 프론트엔드 연동 테스트
- [ ] Audit 검토 (권장)
- [ ] Mainnet 배포
- [ ] Etherscan/Block Explorer 검증

---

## 9. 부록

### 9.1 가스 비용 예상

| 함수 | 예상 가스 | 비고 |
|------|-----------|------|
| `stake()` | ~150k | 기존 |
| `addStake()` | ~80k | 신규 (더 적은 storage 쓰기) |
| `unstake()` | ~100k | 기존 |

### 9.2 관련 문서

- PrescioStaking V4 컨트랙트: `/packages/contracts/src/PrescioStaking.sol`
- 테스트: `/packages/contracts/test/PrescioStaking.t.sol`
- 배포 스크립트: `/packages/contracts/script/`

---

**Document End**
