# PrescioStaking V5 - addStake 함수 보안 감사 보고서

**Version**: 1.0  
**Date**: 2026-02-12  
**Auditor**: OpenClaw Security Subagent  
**Scope**: `addStake(uint256 amount, bool extendLock)` 함수 및 관련 V5 변경사항  
**Contract**: `/packages/contracts/src/PrescioStaking.sol`

---

## Executive Summary

PrescioStaking V5의 `addStake` 함수에 대한 보안 검토 결과, **1건의 High 심각도 이슈**와 **2건의 Low 심각도 이슈**, **2건의 Informational 이슈**가 발견되었습니다.

| 심각도 | 개수 |
|--------|------|
| Critical | 0 |
| High | 1 |
| Medium | 0 |
| Low | 2 |
| Informational | 2 |

---

## 감사 대상

### 검토 범위

1. `addStake(uint256 amount, bool extendLock)` 함수 (lines 406-446)
2. `StakeAdded` 이벤트
3. `initializeV5` reinitializer
4. `VERSION = 5` 상수

### 검토 항목

- 인출 불가 취약점
- Reentrancy 공격
- 오버플로우/언더플로우
- 권한 및 상태 검증
- Weight 계산 정확성
- Tier 재계산
- 보상 계산 영향

---

## 발견된 이슈

### [H-01] Weight 계산 불일치로 인한 totalWeight 오염

**심각도**: High  
**상태**: 수정 필요  
**위치**: `addStake()` 함수, lines 413-419

#### 설명

`addStake` 함수에서 `oldWeight` 계산 시 `_calculateWeight()`를 직접 호출하며, 이는 `getUserWeight()` 함수의 로직과 불일치합니다.

**현재 코드 (문제):**
```solidity
// addStake의 oldWeight 계산 - MIN_STAKE_DURATION_FOR_TIER 미적용
uint256 oldWeight = _calculateWeight(
    userStake.amount,
    getTierForAmount(userStake.amount),  // 실제 티어 사용
    userStake.lockType
);
```

**getUserWeight 로직 (H-02 FIX):**
```solidity
function getUserWeight(address user) public view returns (uint256) {
    // ...
    Tier effectiveTier;
    if (block.timestamp < userStake.startTime + MIN_STAKE_DURATION_FOR_TIER) {
        effectiveTier = Tier.BRONZE;  // 1일 미만 스테이킹은 BRONZE 취급
    } else {
        effectiveTier = getTier(user);
    }
    return _calculateWeight(userStake.amount, effectiveTier, userStake.lockType);
}
```

#### 공격 시나리오

1. 공격자가 150M PRESCIO를 FIXED_90D로 스테이킹 (DIAMOND 티어)
2. 1일 이내에 `addStake(1e18, false)` 호출
3. **oldWeight 계산**: DIAMOND 티어 기준 → 매우 큰 값 (예: 60,000,000e18)
4. **실제 기록된 weight** (via `stake()`): BRONZE 티어 기준 → 작은 값 (예: 16,500,000e18)
5. `totalWeight -= oldWeight` → **언더플로우 발생** 또는 **totalWeight 손상**
6. 모든 staker의 보상 계산이 잘못됨

#### 수치 예시

```
Initial stake: 150M PRESCIO, FIXED_90D
- DIAMOND boost: 200 (2.0x)
- LOCK_MULT_90D: 200 (2.0x)
- Diamond weight = 150M * 200 * 200 / 10000 = 600M weight units

Within 1 day (anti-gaming active):
- getUserWeight returns: 150M * 110 * 200 / 10000 = 330M (BRONZE 적용)
- totalWeight에 실제 기록된 값: 330M

addStake(1 token) 호출 시:
- oldWeight (잘못된 계산): 600M
- totalWeight -= 600M → 언더플로우!
```

#### 영향

- **totalWeight 언더플로우**: 트랜잭션 실패 또는 매우 큰 양수로 wrap
- **보상 분배 왜곡**: 모든 staker의 epoch 보상 비율이 잘못 계산됨
- **자금 손실 가능**: 보상이 과다 지급되거나 미지급될 수 있음

#### 권장 수정

```solidity
function addStake(uint256 amount, bool extendLock) external nonReentrant {
    if (amount == 0) revert ZeroAmount();
    
    Stake storage userStake = stakes[msg.sender];
    if (!userStake.exists) revert NoStakeFound();
    
    // ===== FIX: getUserWeight 사용하여 일관성 확보 =====
    uint256 oldWeight = getUserWeight(msg.sender);
    totalWeight -= oldWeight;
    
    uint256 newAmount = userStake.amount + amount;
    userStake.amount = newAmount;
    totalStaked += amount;
    
    if (extendLock) {
        uint256 lockDuration = _getLockDuration(userStake.lockType);
        userStake.lockEnd = block.timestamp + lockDuration;
    } else if (block.timestamp >= userStake.lockEnd) {
        userStake.lockEnd = block.timestamp + 7 days;
    }
    
    // 새 weight 계산 - MIN_STAKE_DURATION_FOR_TIER 고려
    Tier effectiveTier;
    if (block.timestamp < userStake.startTime + MIN_STAKE_DURATION_FOR_TIER) {
        effectiveTier = Tier.BRONZE;
    } else {
        effectiveTier = getTierForAmount(newAmount);
    }
    uint256 newWeight = _calculateWeight(newAmount, effectiveTier, userStake.lockType);
    totalWeight += newWeight;
    
    prescioToken.safeTransferFrom(msg.sender, address(this), amount);
    
    emit StakeAdded(msg.sender, amount, newAmount, getTierForAmount(newAmount));
}
```

---

### [L-01] 락 만료 후 addStake 시 lockType과 실제 락 기간 불일치

**심각도**: Low  
**상태**: 설계 의도 확인 필요  
**위치**: `addStake()` 함수, lines 428-432

#### 설명

락이 만료된 상태에서 `addStake(amount, false)` 호출 시, `lockEnd`는 7일로 재설정되지만 `lockType`은 기존 값(예: FIXED_90D)을 유지합니다.

```solidity
} else if (block.timestamp >= userStake.lockEnd) {
    // Lock expired → apply minimum lock (FLEXIBLE = 7 days)
    userStake.lockEnd = block.timestamp + 7 days;
    // lockType은 변경되지 않음!
}
```

#### 영향

- Weight 계산 시 기존 lockType의 multiplier가 적용됨
- FIXED_90D로 스테이킹한 후 락 만료 → addStake → 7일 락이지만 2.0x 배수 유지
- 공정성 문제: 사용자가 의도치 않게 높은 weight를 받을 수 있음

#### 권장 수정

두 가지 옵션:
1. lockType도 FLEXIBLE로 변경 (설계 변경)
2. 현 상태 유지 (기존 lockType 배수 유지는 의도된 기능으로 문서화)

---

### [L-02] 이벤트에 weight 및 lockExtended 정보 누락

**심각도**: Low  
**상태**: 개선 권장  
**위치**: `addStake()` 함수, line 444

#### 설명

기획서에서 정의한 이벤트:
```solidity
event StakeAdded(
    address indexed user, 
    uint256 addedAmount, 
    uint256 totalAmount,
    Tier newTier, 
    uint256 newWeight,      // 누락됨
    bool lockExtended       // 누락됨
);
```

실제 구현된 이벤트:
```solidity
event StakeAdded(address indexed user, uint256 addedAmount, uint256 newTotal, Tier newTier);
```

#### 영향

- 오프체인 모니터링 및 UI에서 weight 변화 추적 불가
- 락 연장 여부 확인을 위해 추가 조회 필요

#### 권장 수정

```solidity
event StakeAdded(
    address indexed user, 
    uint256 addedAmount, 
    uint256 newTotal, 
    Tier newTier,
    uint256 newWeight,
    bool lockExtended
);
```

---

### [I-01] initializeV5가 상태 변경 없이 빈 함수

**심각도**: Informational  
**상태**: 확인됨  
**위치**: `initializeV5()` 함수, lines 283-287

#### 설명

```solidity
function initializeV5() public reinitializer(5) {
    // V5: addStake feature added
    // No additional state initialization required
}
```

V5 업그레이드에 새로운 상태 변수가 필요 없으므로 정상입니다. 다만 reinitializer가 한 번만 호출 가능하므로, 추후 V5에 상태 초기화가 필요해지면 별도 migration 함수가 필요합니다.

#### 권장사항

현재 상태 유지 (문제 없음)

---

### [I-02] CEI 패턴 준수 확인

**심각도**: Informational  
**상태**: 양호  
**위치**: `addStake()` 함수

#### 확인 결과

CEI (Checks-Effects-Interactions) 패턴이 올바르게 적용되어 있습니다:

1. **Checks**: `ZeroAmount`, `NoStakeFound` 검증
2. **Effects**: `totalWeight`, `userStake.amount`, `totalStaked`, `lockEnd` 업데이트
3. **Interactions**: `prescioToken.safeTransferFrom()` 외부 호출

`nonReentrant` modifier도 적용되어 reentrancy 공격에 안전합니다.

---

## 검증 항목별 상세 결과

### 1. 인출 불가 취약점

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| addStake 후 unstake 가능 여부 | ✅ Pass | lockEnd 조건만 충족하면 정상 인출 |
| addStake 후 emergencyUnstake 가능 여부 | ✅ Pass | 50% 페널티로 즉시 인출 가능 |
| 자금 영구 락업 시나리오 | ✅ Pass | 발견되지 않음 |

**세부 분석:**
- `unstake()`: `userStake.amount` 전체 반환, addStake로 증가된 금액 포함
- `emergencyUnstake()`: Fixed lock도 50% 페널티로 인출 가능
- lockEnd 처리: 만료 시 7일 최소 락 적용 (영구 락 없음)

### 2. Reentrancy

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| nonReentrant modifier | ✅ Pass | 적용됨 |
| CEI 패턴 | ✅ Pass | 외부 호출 전 상태 변경 완료 |
| Cross-function reentrancy | ✅ Pass | ReentrancyGuard 전역 적용 |

### 3. 오버플로우/언더플로우

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| amount 추가 시 오버플로우 | ✅ Pass | Solidity 0.8+ 자동 검사 |
| totalWeight 언더플로우 | ⚠️ **[H-01]** | Weight 불일치로 발생 가능 |
| totalStaked 오버플로우 | ✅ Pass | 실질적 불가능 (토큰 공급량 제한) |

### 4. 권한 및 상태 검증

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| 스테이킹 없는 사용자 | ✅ Pass | `NoStakeFound` 에러 |
| Zero amount | ✅ Pass | `ZeroAmount` 에러 |
| 토큰 잔액/승인 부족 | ✅ Pass | SafeERC20 revert |

### 5. Weight 계산 정확성

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| 기존 weight 제거 | ⚠️ **[H-01]** | getUserWeight와 불일치 |
| 새 weight 추가 | ⚠️ **[H-01]** | 동일 이슈 |
| totalWeight 일관성 | ⚠️ **[H-01]** | H-01로 인해 손상 가능 |

### 6. Tier 재계산

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| getTierForAmount 호출 | ✅ Pass | 올바르게 호출됨 |
| 이벤트에 newTier 포함 | ✅ Pass | 포함됨 |

### 7. 보상 계산 영향

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| firstEligibleEpoch 유지 | ✅ Pass | 변경 안 함 |
| lastClaimEpoch 유지 | ✅ Pass | 변경 안 함 |
| startTime 유지 | ✅ Pass | 변경 안 함 |
| epoch 보상 분배 | ⚠️ | H-01로 totalWeight 손상 시 영향 |

---

## 수정 권장 사항 요약

### 필수 수정 (High)

1. **[H-01] Weight 계산 일관성 수정**
   - `getUserWeight(msg.sender)` 사용
   - 새 weight 계산 시에도 `MIN_STAKE_DURATION_FOR_TIER` 고려

### 권장 수정 (Low)

2. **[L-02] 이벤트 파라미터 확장**
   - `newWeight`, `lockExtended` 추가

### 선택적 검토 (Low)

3. **[L-01] lockType 불일치 정책 결정**
   - 현 동작이 의도된 것인지 확인 및 문서화

---

## 수정된 코드 제안

```solidity
/**
 * @notice Add tokens to existing stake
 * @dev Tier and weight are recalculated automatically. CEI pattern enforced.
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
    // 1. Remove old weight from total (FIXED: use getUserWeight for consistency)
    uint256 oldWeight = getUserWeight(msg.sender);
    totalWeight -= oldWeight;
    
    // 2. Update amount
    uint256 newAmount = userStake.amount + amount;
    userStake.amount = newAmount;
    totalStaked += amount;
    
    // 3. Handle lockEnd
    bool lockExtended = false;
    if (extendLock) {
        uint256 lockDuration = _getLockDuration(userStake.lockType);
        userStake.lockEnd = block.timestamp + lockDuration;
        lockExtended = true;
    } else if (block.timestamp >= userStake.lockEnd) {
        // Lock expired → apply minimum lock (FLEXIBLE = 7 days)
        userStake.lockEnd = block.timestamp + 7 days;
        lockExtended = true;
    }
    // else: keep existing lockEnd
    
    // 4. Calculate new tier and weight (FIXED: respect MIN_STAKE_DURATION_FOR_TIER)
    Tier effectiveTier;
    if (block.timestamp < userStake.startTime + MIN_STAKE_DURATION_FOR_TIER) {
        effectiveTier = Tier.BRONZE;
    } else {
        effectiveTier = getTierForAmount(newAmount);
    }
    uint256 newWeight = _calculateWeight(newAmount, effectiveTier, userStake.lockType);
    totalWeight += newWeight;
    
    Tier displayTier = getTierForAmount(newAmount);
    
    // ===== INTERACTIONS =====
    prescioToken.safeTransferFrom(msg.sender, address(this), amount);
    
    emit StakeAdded(msg.sender, amount, newAmount, displayTier, newWeight, lockExtended);
}
```

**이벤트 수정:**
```solidity
event StakeAdded(
    address indexed user, 
    uint256 addedAmount, 
    uint256 newTotal, 
    Tier newTier,
    uint256 newWeight,
    bool lockExtended
);
```

---

## 테스트 케이스 권장

### H-01 검증 테스트

```solidity
function test_addStake_weightConsistency_antiGaming() public {
    // Given: Diamond tier stake within MIN_STAKE_DURATION_FOR_TIER
    vm.startPrank(user);
    token.approve(address(staking), 200_000_000e18);
    staking.stake(150_000_000e18, PrescioStaking.LockType.FIXED_90D);
    
    uint256 totalWeightBefore = staking.totalWeight();
    uint256 userWeightBefore = staking.getUserWeight(user);
    
    // When: addStake within 1 day
    vm.warp(block.timestamp + 12 hours);
    staking.addStake(1_000_000e18, false);
    
    // Then: totalWeight should be consistent
    uint256 totalWeightAfter = staking.totalWeight();
    uint256 userWeightAfter = staking.getUserWeight(user);
    
    // totalWeight change should equal user weight change
    assertEq(
        totalWeightAfter - totalWeightBefore,
        userWeightAfter - userWeightBefore,
        "Weight change mismatch"
    );
    vm.stopPrank();
}
```

---

## 결론

PrescioStaking V5의 `addStake` 함수는 전반적으로 CEI 패턴과 reentrancy 보호가 잘 적용되어 있으나, **[H-01] Weight 계산 불일치** 이슈가 발견되었습니다. 이 이슈는 기존 V1.3의 anti-gaming 수정([H-02 FIX])과의 일관성 문제로, `totalWeight`를 손상시켜 모든 staker의 보상 계산에 영향을 줄 수 있습니다.

**배포 전 필수 조치:**
1. [H-01] 수정 적용
2. 제안된 테스트 케이스 통과 확인
3. Fuzz 테스트로 weight 일관성 검증

---

**Report End**

*Generated by OpenClaw Security Subagent*  
*Date: 2026-02-12*
