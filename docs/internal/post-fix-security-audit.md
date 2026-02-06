# Prescio Post-Fix Security Audit Report

**감사 일시**: 2026-02-06  
**감사자**: OpenClaw Security Auditor  
**감사 유형**: Post-Fix Verification & Final Security Review

**대상 컨트랙트**:
- `PrescioMarketV4.sol` (V3 → V4 업그레이드)
- `PrescioVaultV2.sol`
- `PrescioStaking.sol`
- `AutoBetController.sol`

**참조 문서**:
- `market-vault-security-audit.md` (1차 감사)
- `staking-security-audit.md` (1차 감사)
- `post-fix-review.md` (coder 리뷰)

---

## 📊 Executive Summary

| 컨트랙트 | 이전 Critical | 이전 High | 수정 상태 | 최종 평가 |
|----------|--------------|----------|-----------|-----------|
| PrescioMarketV4 | 1 | 2 | ✅ 모두 수정 | **PASS** |
| PrescioVaultV2 | 0 | 0 | ✅ 개선 완료 | **PASS** |
| PrescioStaking | 3 | 5 | ⚠️ 1개 미해결 | **CONDITIONAL PASS** |
| AutoBetController | 1 | 2 | ✅ 모두 수정 | **PASS** |

**전체 평가**: ⚠️ **CONDITIONAL PASS**

> PrescioStaking의 Penalty 타입 불일치 이슈(Medium)가 해결되면 최종 승인 가능합니다.

---

## ✅ Part 1: 이전 감사 이슈 수정 검증

### 1.1 PrescioMarketV4 - 모든 이슈 해결 확인

#### 🔴 Critical Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| C-1 | ReentrancyGuard Storage Collision | ✅ 수정됨 | **VERIFIED** |

**검증 내용**:
```solidity
// V4에서 올바르게 수정됨
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

function initialize(...) public initializer {
    __ReentrancyGuard_init();  // ✅ 초기화 호출 확인
}

function initializeV4() public reinitializer(4) {
    __ReentrancyGuard_init();  // ✅ V3→V4 업그레이드용 재초기화
}
```

✅ Storage collision 위험 완전 해결

---

#### 🟠 High Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| H-1 | emergencyWithdraw 중앙화 | ✅ 수정됨 | **VERIFIED** |
| H-2 | resolve() Reentrancy | ✅ 수정됨 | **VERIFIED** |

**H-1 검증**:
```solidity
uint256 public constant EMERGENCY_DELAY = 7 days;

function requestEmergencyWithdraw() external onlyOwner {
    emergencyWithdrawRequested = true;
    emergencyWithdrawRequestTime = block.timestamp;
    emit EmergencyWithdrawRequested(owner(), block.timestamp + EMERGENCY_DELAY);
}

function emergencyWithdraw() external onlyOwner nonReentrant {
    if (!emergencyWithdrawRequested) revert EmergencyNotRequested();
    if (block.timestamp < emergencyWithdrawRequestTime + EMERGENCY_DELAY) {
        revert EmergencyDelayNotPassed();  // ✅ 7일 대기 필수
    }
    // ...
}
```

✅ 7일 timelock으로 rug pull 위험 대폭 감소

**H-2 검증**:
```solidity
function resolve(bytes32 gameId, uint8 impostorIndex) 
    external onlyOwner nonReentrant {  // ✅ nonReentrant 추가됨
```

✅ Reentrancy 보호 적용 확인

---

#### 🟡 Medium Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| M-1 | Vault 전송 DoS | ✅ 수정됨 | **VERIFIED** |
| M-2 | Front-Running | ⏭️ 의도적 미수정 | **ACKNOWLEDGED** |
| M-3 | feeRate 변경 | ✅ 수정됨 | **VERIFIED** |

**M-1 검증** (Pull Pattern):
```solidity
uint256 public pendingVaultFees;

function resolve(...) {
    // ✅ 직접 전송 대신 누적
    pendingVaultFees += fee;
}

function withdrawVaultFees() external nonReentrant {
    uint256 amount = pendingVaultFees;
    pendingVaultFees = 0;  // ✅ CEI 패턴 준수
    (bool success,) = payable(vault).call{value: amount}("");
    // ...
}
```

✅ Vault 전송 실패 시에도 resolve() 정상 동작

**M-2 (Front-Running)**: UX 복잡성 증가로 의도적 미적용. 문서화 필요.

**M-3 검증** (Market-specific feeRate):
```solidity
struct MarketInfo {
    // ...
    uint256 marketFeeRate;  // ✅ 마켓별 수수료율 고정
}

function createMarket(...) {
    markets[gameId] = MarketInfo({
        marketFeeRate: feeRate  // ✅ 생성 시점 수수료율 저장
    });
}
```

✅ 사용자 배팅 시점과 결과 시점의 수수료율 동일 보장

---

#### 🔵 Low & Informational

| ID | 이슈 | 수정 상태 |
|----|------|----------|
| L-1 | Zero address validation | ✅ 수정됨 |
| L-3 | EmergencyWithdraw event | ✅ 수정됨 |
| I-1 | Gas optimization | ✅ 수정됨 (unchecked) |
| I-2 | Magic numbers | ✅ 수정됨 (FEE_DENOMINATOR) |
| Storage Gap | 없음 | ✅ 추가됨 (uint256[50]) |

---

### 1.2 PrescioVaultV2 - 모든 이슈 해결 확인

| 이슈 | 수정 상태 |
|------|----------|
| Zero address in withdrawFeesTo | ✅ 수정됨 |
| Code duplication | ✅ _withdrawTo() 내부 함수 추가 |

```solidity
function withdrawFeesTo(address to) external onlyOwner nonReentrant {
    if (to == address(0)) revert ZeroAddress();  // ✅ 검증 추가
    _withdrawTo(to);
}
```

---

### 1.3 PrescioStaking - 대부분 이슈 해결 (1개 미해결)

#### 🔴 Critical Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| C-02 | _calculateTotalWeight 미구현 | ✅ 수정됨 | **VERIFIED** |
| C-03 | Claim DoS (Pagination) | ✅ 수정됨 | **VERIFIED** |

**C-02 검증** (Running Total Weight):
```solidity
uint256 public totalWeight;

function stake(...) {
    uint256 userWeight = _calculateWeight(amount, getTierForAmount(amount), lockType);
    totalWeight += userWeight;  // ✅ stake 시 weight 증가
}

function unstake() {
    uint256 userWeight = getUserWeight(msg.sender);
    totalWeight -= userWeight;  // ✅ unstake 시 weight 감소
}

function finalizeEpoch() {
    epoch.totalWeight = totalWeight;  // ✅ epoch 스냅샷
}
```

✅ 티어 부스트와 락업 배수가 정확히 반영됨

**C-03 검증** (Pagination):
```solidity
uint256 public constant MAX_CLAIM_EPOCHS = 52;

function claimRewards(uint256 maxEpochs) external nonReentrant {
    if (maxEpochs > MAX_CLAIM_EPOCHS) revert MaxEpochsExceeded();
    _claimRewards(msg.sender, maxEpochs);
}

function _claimRewards(address user, uint256 maxEpochs) internal {
    uint256 endEpoch = startEpoch + maxEpochs;
    if (endEpoch > currentEpoch) endEpoch = currentEpoch;
    // ✅ 최대 52 epochs만 처리
}
```

✅ Gas DoS 완전 방지

---

#### 🟠 High Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| H-01 | CEI Pattern | ✅ 수정됨 | **VERIFIED** |
| H-02 | Penalty 산술 오류 | ✅ 수정됨 | **VERIFIED** |
| H-03 | Epoch 중앙화 | ✅ 수정됨 | **VERIFIED** |

**H-01 검증** (CEI Pattern):
```solidity
function unstake() external nonReentrant {
    // 1. CHECKS & CALCULATIONS
    (uint256 rewards, uint256 claimedEpochs) = _calculatePendingRewards(msg.sender);
    uint256 userWeight = getUserWeight(msg.sender);
    
    // 2. EFFECTS - 상태 변경 먼저
    totalWeight -= userWeight;
    _removeStaker(msg.sender);
    delete stakes[msg.sender];
    totalStaked -= amount;
    
    // 3. INTERACTIONS - 외부 호출 마지막
    if (rewards > 0) {
        (bool rewardSuccess,) = payable(msg.sender).call{value: rewards}("");
    }
    prescioToken.safeTransfer(msg.sender, returnAmount);
}
```

✅ Cross-function reentrancy 방지 완벽

**H-02 검증** (Penalty Distribution):
```solidity
uint256 public pendingTreasuryAmount;  // ✅ 새로 추가됨

function _distributePenalty(uint256 penalty) internal {
    pendingBurnAmount += (penalty * PENALTY_BURN_SHARE) / PENALTY_PRECISION;      // 40%
    pendingStakerRewards += (penalty * PENALTY_STAKER_SHARE) / PENALTY_PRECISION; // 40%
    pendingTreasuryAmount += (penalty * PENALTY_TREASURY_SHARE) / PENALTY_PRECISION; // 20% ✅
}
```

✅ 100% 정확히 분배됨 (40% + 40% + 20%)

**H-03 검증** (Permissionless Finalization):
```solidity
uint256 public constant EPOCH_GRACE_PERIOD = 1 days;

function finalizeEpoch() external {
    bool isOwner = msg.sender == owner();
    bool gracePeriodPassed = block.timestamp >= epochStartTime + EPOCH_DURATION + EPOCH_GRACE_PERIOD;
    
    if (!isOwner && !gracePeriodPassed) {
        revert EpochNotReady();  // ✅ 1일 후 누구나 호출 가능
    }
}
```

✅ Owner 키 분실 시에도 프로토콜 지속 가능

---

#### 🟡 Medium Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| M-01 | Front-running | ✅ 수정됨 | **VERIFIED** |
| M-02 | Storage Gap | ✅ 수정됨 | **VERIFIED** |
| M-03 | receive() 함수 | ✅ 수정됨 | **VERIFIED** |
| M-04 | 시간 조작 | ⏭️ 프로토콜 한계 | **ACKNOWLEDGED** |
| M-05 | validateAutoBet modifier | ✅ 수정됨 | **VERIFIED** |
| M-06 | autoBetController 초기화 | ✅ 수정됨 | **VERIFIED** |

**M-01 검증** (Front-running Protection):
```solidity
struct Stake {
    uint256 firstEligibleEpoch;  // ✅ 새 필드
}

function stake(...) {
    stakes[msg.sender] = Stake({
        firstEligibleEpoch: currentEpoch + 1,  // ✅ 다음 epoch부터 자격
    });
}
```

✅ 스테이킹 직후 epoch에서 리워드 획득 불가

---

### 1.4 AutoBetController - 모든 이슈 해결 확인

#### 🔴 Critical Issues

| ID | 이슈 | 수정 상태 | 검증 결과 |
|----|------|----------|----------|
| C-01 | 무제한 자금 인출 | ✅ 수정됨 | **VERIFIED** |

**검증**:
```solidity
mapping(address => uint256) public userBalances;  // ✅ 잔액 추적

function withdraw(uint256 amount) external nonReentrant {
    if (userBalances[msg.sender] < amount) revert InsufficientBalance();  // ✅ 잔액 확인
    userBalances[msg.sender] -= amount;
    // ...
}

function executeAutoBet(...) external onlyOperator nonReentrant {
    if (userBalances[user] < amount) revert InsufficientBalance();  // ✅ 사용자별 잔액 확인
    userBalances[user] -= amount;  // ✅ 해당 사용자 잔액에서 차감
}
```

✅ 자금 탈취 취약점 완전 제거

#### 🟠 High Issues

| ID | 이슈 | 수정 상태 |
|----|------|----------|
| H-04 | 사용자 자금 미분리 | ✅ 수정됨 |
| H-05 | Operator 행동 추적 | ✅ 수정됨 |

---

## ⚠️ Part 2: Coder 발견 이슈 검토

### Issue #1: Penalty 타입 불일치 (Medium) - **미해결**

**위치**: `PrescioStaking.sol:distributePenalties()`

**문제 분석**:
```solidity
function distributePenalties() external nonReentrant {
    uint256 burnAmount = pendingBurnAmount;      // PRESCIO 토큰 수량
    uint256 stakerAmount = pendingStakerRewards; // PRESCIO 토큰 수량
    uint256 treasuryAmount = pendingTreasuryAmount; // PRESCIO 토큰 수량
    
    // ...
    
    // ⚠️ 문제: 토큰 수량을 ETH 리워드에 더함
    epochs[currentEpoch].totalRewards += stakerAmount;  
    
    // Burn은 토큰으로 처리 (올바름)
    if (burnAmount > 0) {
        prescioToken.safeTransfer(DEAD_ADDRESS, burnAmount);
    }
    
    // Treasury도 토큰으로 처리 (올바름)
    if (treasuryAmount > 0) {
        prescioToken.safeTransfer(treasury, treasuryAmount);
    }
}
```

**심각도**: 🟡 **Medium**

**영향**:
1. `epochs[currentEpoch].totalRewards`는 ETH 리워드 (wei 단위)
2. `stakerAmount`는 PRESCIO 토큰 수량 (token decimals)
3. 토큰 가치 ≠ ETH 가치이므로 리워드 계산 왜곡
4. 사용자가 실제보다 적거나 많은 리워드를 받을 수 있음

**권장 수정안**:

**Option A: 토큰 리워드 별도 관리 (권장)**
```solidity
// 새 상태 변수 추가
mapping(uint256 => uint256) public epochTokenRewards;

function distributePenalties() external nonReentrant {
    // ...
    // ETH epoch rewards에 추가하지 않고 별도 mapping에 저장
    epochTokenRewards[currentEpoch] += stakerAmount;
    // ...
}

// 별도의 토큰 리워드 클레임 함수
function claimTokenRewards(uint256 maxEpochs) external nonReentrant {
    // 사용자 weight 기반으로 epochTokenRewards에서 계산
    // prescioToken.safeTransfer(user, tokenReward);
}
```

**Option B: 토큰을 직접 스테이커에게 분배**
```solidity
function distributePenalties() external nonReentrant {
    // stakerAmount를 epoch rewards에 추가하지 않고
    // 직접 스테이커 비율에 따라 분배하거나
    // 별도 토큰 리워드 풀로 관리
}
```

**Option C: 현재 설계 유지 + 문서화 (최소 수정)**
- 문서에 "Penalty staker rewards는 토큰으로 관리되지 않고 ETH epoch rewards에 편입됩니다" 명시
- 단, 이 경우 토큰 가치와 ETH 가치 불일치 문제 지속

---

### Issue #2: AutoBetController receive() 자금 귀속 (Low) - **부분 해결**

**위치**: `AutoBetController.sol`

```solidity
receive() external payable {}  // ETH 수신하지만 자동 귀속 로직 없음
```

**현재 상태**:
- `refundBet()` 함수로 operator가 명시적으로 환불 처리 가능
- 운영 프로세스로 커버 가능

**잔여 위험**:
- Market에서 winnings 환불 시 자동으로 어떤 사용자에게 귀속시킬지 불명확
- Operator 실수 또는 지연 시 자금이 컨트랙트에 묶일 수 있음

**권장 수정안** (선택적):
```solidity
// Option A: receive 비활성화
receive() external payable {
    revert("Use refundBet()");
}

// Option B: 자동 환불 로직 (복잡도 증가)
// Market 컨트랙트에서 직접 사용자에게 환불하도록 설계 변경
```

**평가**: `refundBet()` 함수가 존재하므로 운영으로 관리 가능. **Low 심각도 유지**.

---

## 🔍 Part 3: 신규 발견 보안 이슈

### NEW-1: initializeV4() 버전 번호 검증 (Informational)

**위치**: `PrescioMarketV4.sol:initializeV4()`

```solidity
function initializeV4() public reinitializer(4) {
    __ReentrancyGuard_init();
}
```

**관찰**:
- `reinitializer(4)`는 현재 버전이 4 미만일 때만 실행됨
- V3에서 `reinitializer`를 사용하지 않았다면 (일반 `initializer`만 사용) 버전이 1로 기록됨
- 이 경우 V4 업그레이드 시 `reinitializer(4)` 정상 동작

**권장**: 
- 배포 전 testnet에서 V3 → V4 업그레이드 시뮬레이션 필수
- 업그레이드 후 `initializeV4()` 호출 확인

**심각도**: ⚪ Informational (테스트로 해결 가능)

---

### NEW-2: Staker Array 가스 비용 증가 가능성 (Informational)

**위치**: `PrescioStaking.sol`

```solidity
address[] public stakers;

function _removeStaker(address user) internal {
    // swap-and-pop 패턴 사용
    if (index != lastIndex) {
        address lastStaker = stakers[lastIndex];
        stakers[index] = lastStaker;
        stakerIndex[lastStaker] = index;
    }
    stakers.pop();
}
```

**관찰**:
- 현재 `stakers` 배열은 iteration에 사용되지 않음 (running total로 대체)
- 하지만 배열 자체는 유지되어 storage 비용 발생

**영향**: 매우 낮음 - `_removeStaker`의 swap-and-pop은 O(1)로 효율적

**권장**: 현재 설계 유지 (향후 governance 등에서 staker 목록 필요할 수 있음)

**심각도**: ⚪ Informational

---

### NEW-3: Operator 단일 실패점 (Low)

**위치**: `AutoBetController.sol`

**관찰**:
```solidity
modifier onlyOperator() {
    if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
    _;
}
```

- 모든 auto-bet 실행이 operator에 의존
- Operator 키 유출 시 사용자 자금으로 임의 베팅 가능

**현재 완화 요소**:
- 사용자별 `userBalances` 분리로 자금 탈취는 불가
- 일일 한도(`dailyLimit`)로 피해 범위 제한
- 이벤트 로깅으로 추적 가능

**권장 (선택적)**:
- 고액 베팅 시 multi-sig operator 요구
- 또는 사용자가 특정 게임/금액을 사전 승인하는 서명 기반 인증

**심각도**: 🔵 Low (현재 완화 요소 충분)

---

## 📋 Part 4: 최종 체크리스트

### 배포 전 필수 (Blocking)

| 항목 | 상태 | 비고 |
|------|------|------|
| Critical 이슈 수정 | ✅ | 모두 완료 |
| High 이슈 수정 | ✅ | 모두 완료 |
| **Penalty 타입 불일치 수정** | ❌ | **수정 필요** |
| Storage gap 추가 | ✅ | 모든 upgradeable 컨트랙트 |
| Zero address 검증 | ✅ | 모든 setter |
| initializeV4 업그레이드 테스트 | ⏳ | Testnet 시뮬레이션 필요 |

### 배포 전 권장 (Non-Blocking)

| 항목 | 상태 | 비고 |
|------|------|------|
| AutoBetController receive() 개선 | ⏭️ | refundBet()으로 운영 가능 |
| Front-running 문서화 | ⏳ | 사용자 고지 필요 |
| Tier 경계값 검증 | ⏭️ | Owner 책임으로 위임 |
| Multi-sig owner 설정 | ⏳ | 배포 후 권장 |

### 테스트 커버리지 확인

| 테스트 케이스 | 권장 |
|--------------|------|
| V3 → V4 업그레이드 | Testnet 필수 |
| Pagination 경계 (52 epochs) | Unit test |
| Penalty 분배 산술 | Unit test |
| 일일 한도 리셋 (자정 경계) | Unit test |
| emergencyWithdraw timelock | Integration test |

---

## ✅ Part 5: 결론 및 권장사항

### 최종 평가: ⚠️ CONDITIONAL PASS

**승인 조건**:
1. ✅ 모든 Critical/High 이슈 수정 확인됨
2. ⚠️ **PrescioStaking의 Penalty 타입 불일치 해결 필요**
3. ⏳ initializeV4 업그레이드 테스트 완료 필요

### 긍정적 발견

1. **보안 아키텍처 대폭 개선**
   - ReentrancyGuardUpgradeable 적용으로 storage collision 완전 해결
   - CEI 패턴 일관되게 적용
   - Pull pattern으로 DoS 벡터 제거

2. **중앙화 위험 완화**
   - 7일 timelock으로 emergencyWithdraw 남용 방지
   - 1일 grace period로 epoch finalization 탈중앙화
   - 이벤트 로깅 대폭 강화

3. **경제 모델 보호**
   - 마켓별 수수료율 고정
   - Front-running 방지 (firstEligibleEpoch)
   - Pagination으로 가스 DoS 방지

4. **코드 품질**
   - NatSpec 문서화 완료
   - 상수화된 매직 넘버
   - Storage gap 추가

### 필수 조치사항

1. **Penalty 타입 불일치 수정** (배포 전)
   - Option A 권장: 토큰 리워드 별도 관리
   - 또는 Option C: 문서화 후 v1.1 패치

2. **업그레이드 테스트** (배포 전)
   - Testnet에서 V3 → V4 업그레이드 시뮬레이션
   - initializeV4() 호출 및 상태 검증

3. **운영 가이드 작성** (배포 후)
   - Tier 설정 순서 주의사항
   - Operator 키 관리 절차
   - Emergency withdraw 절차

### 배포 후 권장사항

1. **Owner 권한 강화**
   - Gnosis Safe 등 multi-sig 적용
   - Timelock controller 도입 검토

2. **모니터링 설정**
   - Emergency withdraw 요청 알림
   - 대규모 베팅 패턴 감지
   - Operator 행동 로깅

3. **버그 바운티 프로그램**
   - Immunefi 등 플랫폼 등록 권장
   - 발견 보상 체계 마련

---

*감사자: OpenClaw Security Auditor*  
*감사 일시: 2026-02-06*  
*감사 유형: Post-Fix Verification & Final Security Review*

**다음 단계**: Penalty 타입 불일치 수정 후 재검토 요청
