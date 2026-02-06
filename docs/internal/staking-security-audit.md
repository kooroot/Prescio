# Prescio Staking 보안 감사 보고서

**감사 일시**: 2026-02-06  
**감사 대상**: 
- `PrescioStaking.sol`
- `AutoBetController.sol`

**참조 컨트랙트**: `PrescioMarketV3.sol`  
**Solidity 버전**: 0.8.24  
**프레임워크**: OpenZeppelin Upgradeable (UUPS)

---

## 📊 요약

| 심각도 | 발견 수 |
|--------|---------|
| 🔴 Critical | 3 |
| 🟠 High | 5 |
| 🟡 Medium | 6 |
| 🟢 Low | 5 |
| 💡 Informational | 4 |

---

## 🔴 Critical (즉시 수정 필요)

### C-01: AutoBetController - 무제한 자금 인출 취약점

**위치**: `AutoBetController.sol:withdraw()`

**설명**:
```solidity
function withdraw(uint256 amount) external nonReentrant {
    (bool success,) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

누구나 `amount` 파라미터로 임의의 금액을 인출할 수 있습니다. 잔액 확인이나 사용자별 예치금 추적이 전혀 없어 **컨트랙트의 모든 자금 탈취가 가능**합니다.

**공격 시나리오**:
1. 공격자가 `withdraw(address(this).balance)` 호출
2. 모든 사용자의 예치금 탈취

**권장 수정**:
```solidity
mapping(address => uint256) public userBalances;

function deposit() external payable {
    userBalances[msg.sender] += msg.value;
}

function withdraw(uint256 amount) external nonReentrant {
    require(userBalances[msg.sender] >= amount, "Insufficient balance");
    userBalances[msg.sender] -= amount;
    (bool success,) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

---

### C-02: PrescioStaking - 잘못된 Total Weight 계산

**위치**: `PrescioStaking.sol:_calculateTotalWeight()`

**설명**:
```solidity
function _calculateTotalWeight() internal view returns (uint256) {
    // Note: In production, this would iterate through all stakers
    return totalStaked; // Simplified for now
}
```

현재 구현은 단순히 `totalStaked`를 반환하여 **티어 부스트와 락업 배수를 완전히 무시**합니다. 이로 인해 리워드 분배가 심각하게 왜곡됩니다.

**영향**:
- Legendary 티어(3x 부스트) + 90일 락업(2x 배수) 사용자는 6배 weight를 가져야 하지만 무시됨
- Bronze 티어 사용자가 더 많은 리워드를 받을 수 있음
- 경제 모델 완전 파괴

**권장 수정**:
```solidity
// 스테이커 목록 유지
address[] public stakers;
mapping(address => bool) public isStaker;

function _calculateTotalWeight() internal view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < stakers.length; i++) {
        total += getUserWeight(stakers[i]);
    }
    return total;
}
```

또는 가스 효율을 위해 running total 방식 사용:
```solidity
uint256 public totalWeight;

// stake/unstake 시 업데이트
totalWeight += getUserWeight(user); // on stake
totalWeight -= getUserWeight(user); // on unstake
```

---

### C-03: Reward Claiming DoS - 가스 한도 초과

**위치**: `PrescioStaking.sol:_claimRewards()`, `getPendingRewards()`

**설명**:
```solidity
for (uint256 e = userStake.lastClaimEpoch; e < currentEpoch; e++) {
    // ... 각 epoch 처리
}
```

장기간 리워드를 청구하지 않으면 for 루프가 수백 개의 epoch를 순회해야 합니다 (1년 = 52 epochs). 가스 한도 초과로 **자금이 영구 고착**될 수 있습니다.

**공격 시나리오**:
1. 사용자가 1년간 리워드 미청구
2. `claimRewards()` 호출 시 52개 epoch 순회
3. 가스 한도 초과로 트랜잭션 실패
4. 스테이킹된 자금 + 리워드 모두 청구 불가

**권장 수정**:
```solidity
function claimRewards(uint256 maxEpochs) external nonReentrant {
    // 최대 처리 epoch 수 제한
    uint256 endEpoch = userStake.lastClaimEpoch + maxEpochs;
    if (endEpoch > currentEpoch) endEpoch = currentEpoch;
    
    for (uint256 e = userStake.lastClaimEpoch; e < endEpoch; e++) {
        // ...
    }
    userStake.lastClaimEpoch = endEpoch;
}
```

---

## 🟠 High (중요 수정 필요)

### H-01: Cross-Function Reentrancy 위험

**위치**: `PrescioStaking.sol:unstake()`

**설명**:
```solidity
function unstake() external nonReentrant {
    // ...
    _claimRewards(msg.sender);  // ETH 전송 발생
    delete stakes[msg.sender];  // 상태 변경
    prescioToken.safeTransfer(msg.sender, amount);  // 토큰 전송
}
```

`_claimRewards()` 내에서 ETH 전송 시 공격자의 `receive()` 함수가 호출됩니다. `nonReentrant`가 적용되어 있지만, CEI (Checks-Effects-Interactions) 패턴이 아닙니다.

**권장 수정**:
```solidity
function unstake() external nonReentrant {
    Stake memory userStake = stakes[msg.sender];  // 복사
    uint256 rewards = _calculatePendingRewards(msg.sender);  // 계산만
    
    // Effects first
    delete stakes[msg.sender];
    totalStaked -= userStake.amount;
    
    // Interactions last
    if (rewards > 0) {
        (bool success,) = payable(msg.sender).call{value: rewards}("");
        if (!success) revert TransferFailed();
    }
    prescioToken.safeTransfer(msg.sender, amount);
}
```

---

### H-02: Penalty 분배 산술 오류

**위치**: `PrescioStaking.sol:_distributePenalty()`, `distributePenalties()`

**설명**:
```solidity
function _distributePenalty(uint256 penalty) internal {
    pendingBurnAmount += (penalty * 40) / 100;      // 40%
    pendingStakerRewards += (penalty * 40) / 100;   // 40%
    // 20%는 어디로?
}

function distributePenalties() external onlyOwner {
    uint256 treasuryAmount = (pendingBurnAmount + pendingStakerRewards) / 4;  // 잘못된 계산
    // ...
}
```

1. `_distributePenalty`에서 80%만 할당, 20%는 암시적으로 컨트랙트에 남음
2. `distributePenalties`에서 `(burn + staker) / 4`는 원래 penalty의 20%가 아닌 40%의 80%의 25% = **불일치**

**권장 수정**:
```solidity
uint256 public pendingTreasuryAmount;

function _distributePenalty(uint256 penalty) internal {
    pendingBurnAmount += (penalty * 40) / 100;
    pendingStakerRewards += (penalty * 40) / 100;
    pendingTreasuryAmount += (penalty * 20) / 100;
}
```

---

### H-03: Epoch Finalization 중앙화 의존성

**위치**: `PrescioStaking.sol:finalizeEpoch()`

**설명**:
Owner가 `finalizeEpoch()`를 호출하지 않으면 사용자는 리워드를 청구할 수 없습니다. Owner 키 분실, 악의적 행동, 또는 운영 중단 시 **모든 리워드가 고착**됩니다.

**권장 수정**:
```solidity
uint256 public constant EPOCH_GRACE_PERIOD = 1 days;

function finalizeEpoch() external {
    require(
        msg.sender == owner() || 
        block.timestamp >= epochStartTime + EPOCH_DURATION + EPOCH_GRACE_PERIOD,
        "Not authorized"
    );
    // ... 나머지 로직
}
```

---

### H-04: AutoBetController - 사용자 자금 미분리

**위치**: `AutoBetController.sol:executeAutoBet()`

**설명**:
`executeAutoBet()`이 `market.placeBet{value: amount}()`로 베팅할 때, 해당 금액이 실제로 해당 사용자의 예치금인지 확인하지 않습니다. Operator가 사용자 A의 예치금으로 사용자 B 명의의 베팅을 실행할 수 있습니다.

**권장 수정**:
```solidity
mapping(address => uint256) public userBalances;

function executeAutoBet(...) external onlyOperator nonReentrant {
    require(userBalances[user] >= amount, "Insufficient user balance");
    userBalances[user] -= amount;
    market.placeBet{value: amount}(gameId, suspectIndex);
}
```

---

### H-05: Operator 권한 남용 가능성

**위치**: `AutoBetController.sol:executeAutoBet()`, `settleBet()`

**설명**:
Operator는 사용자 동의 없이:
1. 임의 게임에 임의 금액 베팅 가능
2. 일일 한도 내 반복 베팅으로 사용자 자금 소진 가능
3. `settleBet()`으로 activeBets 조작 가능

**권장 수정**:
- Operator 행동에 대한 서명 기반 인증 추가
- 사용자가 특정 게임 ID 또는 조건 사전 승인
- Multi-sig operator 도입

---

## 🟡 Medium (권장 수정)

### M-01: Front-Running 취약점

**위치**: `PrescioStaking.sol:stake()`, `finalizeEpoch()`

**설명**:
공격자가 `finalizeEpoch()` 트랜잭션을 mempool에서 감지하고:
1. 높은 가스로 대량 `stake()` 실행
2. Epoch 스냅샷에 포함되어 리워드 획득
3. 7일 후 페널티 없이 `unstake()`

**권장 수정**:
- Epoch 스냅샷 시점을 과거로 설정 (commit-reveal 방식)
- 스테이킹 후 첫 epoch는 리워드 제외

---

### M-02: Storage Gap 부재

**위치**: 모든 Upgradeable 컨트랙트

**설명**:
UUPS 패턴 사용 시 향후 상태 변수 추가를 위한 storage gap이 없습니다.

**권장 수정**:
```solidity
// 컨트랙트 끝에 추가
uint256[50] private __gap;
```

---

### M-03: receive() 함수 의도치 않은 동작

**위치**: `PrescioStaking.sol:receive()`

**설명**:
```solidity
receive() external payable {
    epochs[currentEpoch].totalRewards += msg.value;
}
```

실수로 ETH를 전송하면 현재 epoch 리워드에 자동 추가됩니다. 의도된 동작인지 불명확하며, 자금 회수 메커니즘이 없습니다.

**권장 수정**:
```solidity
receive() external payable {
    revert("Use depositRewards()");
}
```

---

### M-04: 시간 조작 취약점

**위치**: `AutoBetController.sol:_checkDailyReset()`

**설명**:
```solidity
uint256 today = block.timestamp / 1 days;
```

블록 타임스탬프는 마이너/밸리데이터가 ±15초 조작 가능합니다. 일일 경계 시점에 조작하여 한도 리셋 타이밍 이용 가능.

**권장 수정**:
일일 한도의 정밀도가 중요하다면 더 robust한 시간 체크 또는 rolling window 방식 고려.

---

### M-05: validateAutoBet View 함수의 Modifier 사용

**위치**: `PrescioStaking.sol:validateAutoBet()`

**설명**:
```solidity
function validateAutoBet(...) external view onlyAutoBetController returns (bool)
```

`view` 함수에 access control modifier가 있어 off-chain에서 시뮬레이션 시 혼란 유발. 실제로 상태를 변경하지 않으므로 누구나 호출 가능해도 무방.

**권장 수정**:
modifier 제거하거나 별도의 public view 함수 제공.

---

### M-06: autoBetController 초기값 Zero Address

**위치**: `PrescioStaking.sol:initialize()`

**설명**:
`autoBetController`가 초기화되지 않아 배포 후 `setAutoBetController()` 호출 전까지 auto-bet 기능 동작 불가. 배포 순서에 의존적.

**권장 수정**:
```solidity
function initialize(
    address _prescioToken,
    address _treasury,
    address _autoBetController  // 추가
) public initializer {
    // ...
    autoBetController = _autoBetController;
}
```

---

## 🟢 Low (개선 권장)

### L-01: 이벤트 누락

**위치**: 
- `PrescioStaking.sol`: `setTreasury()`, `setAutoBetController()`
- `AutoBetController.sol`: `setStaking()`, `setMarket()`

**권장 수정**:
```solidity
event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

function setTreasury(address _treasury) external onlyOwner {
    emit TreasuryUpdated(treasury, _treasury);
    treasury = _treasury;
}
```

---

### L-02: Magic Numbers 사용

**위치**: 여러 곳

**설명**:
`1000`, `100`, `10000` 등 상수가 하드코딩되어 있어 가독성 저하.

**권장 수정**:
```solidity
uint256 public constant PENALTY_PRECISION = 1000;
uint256 public constant FEE_PRECISION = 10000;
```

---

### L-03: Zero Address 검증 누락

**위치**: 모든 setter 함수

**권장 수정**:
```solidity
function setTreasury(address _treasury) external onlyOwner {
    require(_treasury != address(0), "Zero address");
    treasury = _treasury;
}
```

---

### L-04: Tier 경계값 검증 없음

**위치**: `PrescioStaking.sol:updateTierConfig()`

**설명**:
tier 간 minStake 순서가 뒤바뀌어도 검증되지 않음. Bronze > Silver가 되면 로직 오류 발생.

**권장 수정**:
업데이트 시 인접 tier와 비교 검증 추가.

---

### L-05: emergencyUnstake 남용 가능성

**위치**: `PrescioStaking.sol:emergencyUnstake()`

**설명**:
Fixed lock 사용자가 50% 페널티를 받아들이고 언제든 탈출 가능. 설계 의도에 맞는지 확인 필요.

---

## 💡 Informational

### I-01: NatSpec 문서화 불완전
함수별 `@param`, `@return` 태그 부재.

### I-02: PrescioMarketV3에서 ReentrancyGuard 비-Upgradeable 사용
```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// ReentrancyGuardUpgradeable 사용 권장
```

### I-03: 테스트 커버리지 확인 필요
경계 조건, 에지 케이스에 대한 테스트 권장.

### I-04: 가스 최적화 가능
- `getUserWeight()` 결과 캐싱
- Epoch 데이터 접근 최적화

---

## 🔧 권장 조치 우선순위

### 즉시 (배포 전 필수)
1. ✅ C-01: withdraw() 취약점 수정
2. ✅ C-02: _calculateTotalWeight() 구현
3. ✅ C-03: Claim DoS 방지 (pagination 추가)
4. ✅ H-02: Penalty 산술 수정

### 단기 (1주 내)
5. H-01: CEI 패턴 적용
6. H-03: Epoch finalization 탈중앙화
7. H-04: 사용자별 자금 추적
8. M-02: Storage gap 추가

### 중기 (2주 내)
9. M-01: Front-running 방어
10. L-01~L-05: 모든 Low 이슈

---

## ✅ 보안 강점

- ReentrancyGuard 전반적 적용 ✅
- Solidity 0.8.x의 자동 overflow 체크 ✅
- SafeERC20 사용 ✅
- UUPS 업그레이드 패턴의 적절한 구현 ✅
- `_disableInitializers()` 사용 ✅
- Custom errors 사용 (가스 효율) ✅

---

## 📝 결론

**PrescioStaking.sol**: Critical 2개, High 3개 발견. 특히 `_calculateTotalWeight()` 미구현과 Claim DoS는 경제적 손실 및 자금 고착을 유발할 수 있어 **배포 전 반드시 수정** 필요.

**AutoBetController.sol**: Critical 1개 (withdraw 취약점)로 인해 현재 상태로는 **배포 불가**. 자금 추적 로직 전면 재설계 필요.

**전체 평가**: 핵심 로직의 프레임워크와 패턴은 적절하나, 자금 관리 및 경제 모델 구현에서 심각한 결함 존재. Critical/High 이슈 해결 후 재감사 권장.

---

*감사자: OpenClaw Security Auditor*  
*감사 유형: 수동 코드 리뷰*
