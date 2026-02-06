# Prescio 스테이킹 컨트랙트 코드 리뷰

**리뷰 날짜:** 2026-02-06  
**리뷰어:** Coder Agent  
**대상 파일:**
- `PrescioStaking.sol`
- `AutoBetController.sol`
- 참조: `PrescioMarketV3.sol`

---

## 1. 요약 (Executive Summary)

| 항목 | PrescioStaking | AutoBetController |
|------|----------------|-------------------|
| 코드 품질 | ⭐⭐⭐⭐ Good | ⭐⭐⭐ Moderate |
| UUPS 패턴 | ✅ 올바름 | ✅ 올바름 |
| 보안 | ⚠️ 중간 위험 | 🔴 심각한 위험 |
| 가스 최적화 | 개선 필요 | 양호 |

**주요 발견사항:**
- 🔴 **Critical**: AutoBetController의 `withdraw` 함수에 치명적 취약점
- 🔴 **Critical**: PrescioStaking의 `_calculateTotalWeight()`가 정확한 weight 계산 안함
- ⚠️ **High**: 패널티 분배 계산 오류
- ⚠️ **Medium**: 미사용 상태변수 존재

---

## 2. PrescioStaking.sol 상세 리뷰

### 2.1 코드 품질 및 가독성 ⭐⭐⭐⭐

**장점:**
- ✅ 명확한 섹션 구분 (Types, Constants, State, Events, Errors 등)
- ✅ NatSpec 문서화가 잘 되어 있음
- ✅ 의미있는 변수/함수 이름 사용
- ✅ Custom errors 사용으로 가스 절약 및 가독성 향상
- ✅ SafeERC20 라이브러리 적절히 사용

**개선 필요:**
```solidity
// 현재: 중복 코드
function getPendingRewards(address user) external view returns (uint256) {
    // ... 로직
}

function _claimRewards(address user) internal {
    // ... 동일한 로직 반복
}

// 개선: 공통 로직 분리
function _calculatePendingRewards(address user) internal view returns (uint256, uint256) {
    // 리워드와 epochsClaimed 반환
}
```

### 2.2 UUPS 업그레이더블 패턴 ✅

**올바르게 구현됨:**
```solidity
// ✅ 올바른 상속 순서
contract PrescioStaking is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable 

// ✅ 생성자에서 초기화 비활성화
constructor() {
    _disableInitializers();
}

// ✅ initialize에서 모든 __init 호출
function initialize(...) public initializer {
    __Ownable_init(msg.sender);
    __ReentrancyGuard_init();
    __UUPSUpgradeable_init();
    // ...
}

// ✅ 업그레이드 권한 제한
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
```

**참고:** MarketV3와 비교시, Staking이 더 올바른 패턴 사용:
- Staking: `ReentrancyGuardUpgradeable` ✅
- MarketV3: `ReentrancyGuard` (non-upgradeable) ⚠️ - 수정 권장

### 2.3 버그 및 로직 오류

#### 🔴 CRITICAL: _calculateTotalWeight() 미구현

```solidity
// 현재 코드 - 잘못됨
function _calculateTotalWeight() internal view returns (uint256) {
    return totalStaked; // ❌ weight 아님!
}
```

**문제:** `getUserWeight()`는 `amount * tierBoost * lockMult`를 계산하지만, `_calculateTotalWeight()`는 단순히 `totalStaked`만 반환. 이로 인해 리워드 분배가 정확하지 않음.

**해결 방안:**
```solidity
// Option 1: 런닝 토탈 유지
uint256 public totalWeight; // 새 상태 변수

function stake(...) external {
    // ...
    totalWeight += getUserWeight(msg.sender);
}

function unstake() external {
    totalWeight -= getUserWeight(msg.sender);
    // ...
}

// Option 2: Epoch 스냅샷 시 off-chain 계산 후 제출
function finalizeEpoch(uint256 computedTotalWeight) external onlyOwner {
    epoch.totalWeight = computedTotalWeight;
    // ...
}
```

#### ⚠️ HIGH: 패널티 분배 계산 오류

```solidity
// 현재 코드 - 잘못됨
function distributePenalties() external onlyOwner {
    // ...
    uint256 treasuryAmount = (pendingBurnAmount + pendingStakerRewards) / 4;
    // ❌ 이미 40%+40% = 80%가 할당됨. 20%를 계산하려면 다른 방식 필요
}
```

**해결:**
```solidity
function _distributePenalty(uint256 penalty) internal {
    uint256 burnShare = (penalty * 40) / 100;
    uint256 stakerShare = (penalty * 40) / 100;
    uint256 treasuryShare = penalty - burnShare - stakerShare; // 나머지 = 20%
    
    pendingBurnAmount += burnShare;
    pendingStakerRewards += stakerShare;
    pendingTreasuryAmount += treasuryShare; // 새 변수 필요
}
```

#### ⚠️ MEDIUM: 미사용 상태변수

```solidity
// 선언만 되고 사용되지 않음
mapping(uint256 => mapping(address => uint256)) public userWeightSnapshots;
```

**권장:** 사용 예정이 아니면 삭제 (스토리지 슬롯 절약)

#### ⚠️ MEDIUM: Burn 로직 미구현

```solidity
// 주석만 있음
// Note: Burn would require token to have burn function
// For now, transfer to dead address or keep in contract
```

**해결:** 
```solidity
address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

// distributePenalties에서
if (burnAmount > 0) {
    prescioToken.safeTransfer(DEAD_ADDRESS, burnAmount);
}
```

### 2.4 가스 최적화

#### 1. getTier() 최적화

```solidity
// 현재: storage 읽기 5회
function getTier(address user) public view returns (Tier) {
    uint256 staked = stakes[user].amount;
    if (staked >= tierConfigs[Tier.LEGENDARY].minStake) return Tier.LEGENDARY;
    if (staked >= tierConfigs[Tier.DIAMOND].minStake) return Tier.DIAMOND;
    // ...
}

// 개선: 상수 사용 (배포 시 고정값이므로)
uint256 public constant TIER_LEGENDARY_MIN = 500_000 * 1e18;
uint256 public constant TIER_DIAMOND_MIN = 200_000 * 1e18;
// ...

function getTier(address user) public view returns (Tier) {
    uint256 staked = stakes[user].amount;
    if (staked >= TIER_LEGENDARY_MIN) return Tier.LEGENDARY;
    if (staked >= TIER_DIAMOND_MIN) return Tier.DIAMOND;
    // ... 가스 절약: ~2000 gas per call
}
```

#### 2. _claimRewards 루프 최적화

```solidity
// 현재: 매 epoch마다 getUserWeight 호출
for (uint256 e = ...; e < currentEpoch; e++) {
    uint256 userWeight = getUserWeight(user); // ❌ 불필요한 반복 계산
}

// 개선: 루프 밖에서 한 번만 계산
function _claimRewards(address user) internal {
    uint256 userWeight = getUserWeight(user); // ✅ 한 번만
    
    for (uint256 e = ...; e < currentEpoch; e++) {
        // userWeight 재사용
    }
}
```

#### 3. unchecked 블록 활용

```solidity
// 오버플로우 불가능한 연산에 사용
for (uint256 e = userStake.lastClaimEpoch; e < currentEpoch;) {
    // ...
    unchecked { ++e; } // 가스 절약
}
```

---

## 3. AutoBetController.sol 상세 리뷰

### 3.1 코드 품질 및 가독성 ⭐⭐⭐

**장점:**
- ✅ 구조가 명확함
- ✅ 이벤트/에러가 잘 정의됨

**개선 필요:**
- StrategyParams의 stopLossPercent가 선언만 되고 미사용

### 3.2 UUPS 업그레이더블 패턴 ✅

PrescioStaking과 동일하게 올바르게 구현됨.

### 3.3 버그 및 보안 취약점

#### 🔴 CRITICAL: withdraw() 무제한 출금 취약점

```solidity
// 현재 코드 - 심각한 보안 문제!
function withdraw(uint256 amount) external nonReentrant {
    (bool success,) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

**문제:** 
- 사용자별 잔고 추적 없음
- 누구나 컨트랙트의 모든 자금을 빼갈 수 있음

**해결:**
```solidity
mapping(address => uint256) public userBalances;

function deposit() external payable {
    userBalances[msg.sender] += msg.value;
}

function withdraw(uint256 amount) external nonReentrant {
    if (userBalances[msg.sender] < amount) revert InsufficientBalance();
    userBalances[msg.sender] -= amount;
    
    (bool success,) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

#### ⚠️ HIGH: executeAutoBet 자금 출처 불명확

```solidity
// 누구의 자금으로 베팅하는가?
market.placeBet{value: amount}(gameId, suspectIndex);
```

**문제:** 사용자의 deposit이 추적되지 않으므로, 컨트랙트의 총 잔고에서 베팅됨.

**해결:** userBalances에서 차감:
```solidity
function executeAutoBet(...) external onlyOperator {
    // ...
    if (userBalances[user] < amount) revert InsufficientBalance();
    userBalances[user] -= amount;
    
    market.placeBet{value: amount}(gameId, suspectIndex);
}
```

#### ⚠️ MEDIUM: canExecuteBet view 함수의 daily reset 미반영

```solidity
function canExecuteBet(address user, uint256 amount) external view returns (bool) {
    // _checkDailyReset은 internal이고 상태를 변경함 (view에서 호출 불가)
    // 따라서 dailySpent가 리셋되었어야 하는지 체크 안 됨
}
```

**해결:**
```solidity
function canExecuteBet(address user, uint256 amount) external view returns (bool) {
    UserConfig storage config = userConfigs[user];
    
    uint256 effectiveDailySpent = config.dailySpent;
    uint256 today = block.timestamp / 1 days;
    if (config.lastResetDay < today) {
        effectiveDailySpent = 0; // view에서 가상 리셋
    }
    
    // ...
}
```

### 3.4 가스 최적화

양호함. 특별한 최적화 포인트 없음.

---

## 4. MarketV3와의 일관성 비교

| 항목 | MarketV3 | Staking | AutoBet | 권장 |
|------|----------|---------|---------|------|
| ReentrancyGuard | Non-upgradeable ⚠️ | Upgradeable ✅ | Upgradeable ✅ | All Upgradeable |
| Custom Errors | ✅ | ✅ | ✅ | 일관됨 |
| NatSpec | 최소 | 상세 | 중간 | 통일 권장 |
| Event naming | PastTense | PastTense | PastTense | 일관됨 ✅ |

**권장:** MarketV3의 `ReentrancyGuard`를 `ReentrancyGuardUpgradeable`로 변경

```solidity
// MarketV3 수정 필요
- import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
+ import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

- contract PrescioMarketV3 is ... ReentrancyGuard {
+ contract PrescioMarketV3 is ... ReentrancyGuardUpgradeable {

function initialize(...) public initializer {
    // ...
+   __ReentrancyGuard_init();
}
```

---

## 5. 개선 제안 요약

### 🔴 Critical (즉시 수정 필요)

1. **AutoBetController.withdraw()**: 잔고 추적 및 검증 추가
2. **PrescioStaking._calculateTotalWeight()**: 실제 weight 계산 구현

### ⚠️ High Priority

3. **패널티 분배 계산 수정** (treasuryAmount 계산 오류)
4. **userBalances 매핑 추가** (AutoBetController)
5. **MarketV3 ReentrancyGuard 업그레이드**

### 💡 Medium Priority

6. **미사용 변수 제거** (userWeightSnapshots)
7. **코드 중복 제거** (getPendingRewards / _claimRewards)
8. **Burn 로직 구현**

### ⚡ Gas Optimization

9. **getTier() 상수 사용**
10. **루프 내 계산 최적화**
11. **unchecked 블록 활용**

---

## 6. 권장 테스트 케이스

```solidity
// PrescioStaking
- test_StakeAndUnstakeFlexible()
- test_FixedLockNoEarlyExit()
- test_EmergencyUnstake50Percent()
- test_TierUpgradeOnAdditionalStake() // 현재 불가능 (AlreadyStaked)
- test_RewardCalculationWithDifferentWeights()
- test_PenaltyDistribution40_40_20()

// AutoBetController
- test_DepositAndWithdraw()
- test_WithdrawMoreThanDeposited_ShouldFail()
- test_ExecuteAutoBetWithInsufficientFunds()
- test_DailyLimitReset()
- test_OperatorOnlyFunctions()
```

---

## 7. 결론

전반적으로 코드 구조와 UUPS 패턴은 잘 구현되어 있으나, **AutoBetController의 자금 관리**와 **PrescioStaking의 weight 계산**에 심각한 문제가 있습니다. 메인넷 배포 전 반드시 수정이 필요합니다.

특히 AutoBetController의 `withdraw` 함수는 현재 상태로 배포될 경우 **자금 탈취 위험**이 있으므로 즉시 수정해야 합니다.
