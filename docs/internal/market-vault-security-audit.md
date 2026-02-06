# Prescio Smart Contracts Security Audit Report

**대상 컨트랙트:**
- `PrescioMarketV3.sol` - UUPS 업그레이드 가능한 예측 시장 컨트랙트
- `PrescioVault.sol` - 프로토콜 수수료 수집 볼트

**감사 일자:** 2026-02-06  
**Solidity 버전:** ^0.8.24

---

## 📊 요약

| 심각도 | 발견 건수 |
|--------|-----------|
| 🔴 Critical | 1 |
| 🟠 High | 2 |
| 🟡 Medium | 4 |
| 🔵 Low | 3 |
| ⚪ Informational | 3 |

---

## 🔴 Critical (즉시 수정 필요)

### C-1: Storage Collision - ReentrancyGuard 상속 문제

**파일:** `PrescioMarketV3.sol`  
**위치:** Line 14

```solidity
contract PrescioMarketV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {
```

**설명:**  
UUPS 업그레이드 가능한 컨트랙트에서 일반 `ReentrancyGuard`를 사용하고 있습니다. 업그레이드 가능한 컨트랙트는 반드시 `ReentrancyGuardUpgradeable`을 사용해야 합니다.

**위험:**
- Storage slot 충돌로 인해 reentrancy guard가 작동하지 않을 수 있음
- 업그레이드 시 storage layout이 꼬여 컨트랙트가 영구적으로 손상될 수 있음
- 현재 배포된 상태에서 업그레이드하면 모든 사용자 자금이 위험

**권장 수정:**
```solidity
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract PrescioMarketV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    
    function initialize(uint256 _feeRate, address _vault) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();  // 추가 필요
        // ...
    }
}
```

---

## 🟠 High (빠른 수정 권장)

### H-1: 중앙화된 비상 출금 - 사용자 자금 탈취 가능

**파일:** `PrescioMarketV3.sol`  
**위치:** Lines 150-155

```solidity
function emergencyWithdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    if (balance == 0) revert NothingToClaim();
    (bool success,) = payable(owner()).call{value: balance}("");
    if (!success) revert TransferFailed();
}
```

**설명:**  
Owner가 언제든지 컨트랙트의 모든 자금(사용자 배팅금 포함)을 인출할 수 있습니다.

**위험:**
- Rug pull 가능성
- Owner 키 유출 시 전체 자금 손실
- 사용자 신뢰 저하

**권장 수정:**
```solidity
// Option 1: Timelock 적용
uint256 public emergencyWithdrawRequestTime;
uint256 public constant EMERGENCY_DELAY = 7 days;

function requestEmergencyWithdraw() external onlyOwner {
    emergencyWithdrawRequestTime = block.timestamp;
    emit EmergencyWithdrawRequested();
}

function emergencyWithdraw() external onlyOwner {
    require(emergencyWithdrawRequestTime > 0, "Not requested");
    require(block.timestamp >= emergencyWithdrawRequestTime + EMERGENCY_DELAY, "Delay not passed");
    // ...
}

// Option 2: 멀티시그 요구
```

---

### H-2: resolve() 함수의 Reentrancy 보호 부재

**파일:** `PrescioMarketV3.sol`  
**위치:** Lines 108-136

```solidity
function resolve(bytes32 gameId, uint8 impostorIndex) external onlyOwner {
    // ... 상태 변경 ...
    
    if (toVault > 0 && vault != address(0)) {
        (bool success,) = payable(vault).call{value: toVault}("");  // 외부 호출
        if (!success) revert TransferFailed();
    }
}
```

**설명:**  
`resolve()` 함수에 `nonReentrant` modifier가 없습니다. vault가 악의적인 컨트랙트라면 reentrancy 공격이 가능합니다.

**위험:**
- 현재 `ReentrancyGuard` storage 충돌 문제와 결합되면 더욱 위험
- vault 주소가 변경될 수 있으므로 공격 표면 존재

**권장 수정:**
```solidity
function resolve(bytes32 gameId, uint8 impostorIndex) external onlyOwner nonReentrant {
```

---

## 🟡 Medium (수정 권장)

### M-1: Vault 전송 실패 시 DoS

**파일:** `PrescioMarketV3.sol`  
**위치:** Lines 128-131

```solidity
if (toVault > 0 && vault != address(0)) {
    (bool success,) = payable(vault).call{value: toVault}("");
    if (!success) revert TransferFailed();
}
```

**설명:**  
vault가 ETH를 받지 못하면 (gas 부족, fallback revert 등) `resolve()` 전체가 실패합니다.

**위험:**
- 마켓 resolution이 영구적으로 불가능해질 수 있음
- 사용자들이 claim 불가

**권장 수정:**
```solidity
// Pull pattern 적용
mapping(address => uint256) public pendingWithdrawals;

function resolve(bytes32 gameId, uint8 impostorIndex) external onlyOwner nonReentrant {
    // ...
    if (toVault > 0) {
        pendingWithdrawals[vault] += toVault;
    }
}

function claimVaultFees() external {
    uint256 amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    (bool success,) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

---

### M-2: Front-Running 취약점

**파일:** `PrescioMarketV3.sol`  
**위치:** `placeBet()`, `resolve()`

**설명:**  
1. 배팅 정보가 mempool에서 공개되어 다른 사용자가 이를 보고 전략적으로 배팅 가능
2. `resolve()` 트랜잭션을 보고 승자를 미리 알 수 있음 (배팅은 CLOSED 상태에서 불가하므로 직접적 악용은 제한적)

**위험:**
- 대규모 배팅자의 선택이 노출됨
- 오라클 없이 owner가 결과를 결정하므로 owner의 resolve 트랜잭션 타이밍이 중요

**권장 수정:**
```solidity
// Commit-reveal 패턴 적용
mapping(bytes32 => mapping(address => bytes32)) public commitments;

function commitBet(bytes32 gameId, bytes32 commitment) external payable {
    // commitment = keccak256(abi.encodePacked(suspectIndex, secret))
}

function revealBet(bytes32 gameId, uint8 suspectIndex, bytes32 secret) external {
    require(keccak256(abi.encodePacked(suspectIndex, secret)) == commitments[gameId][msg.sender]);
}
```

---

### M-3: 무제한 feeRate 변경

**파일:** `PrescioMarketV3.sol`  
**위치:** Lines 138-142

```solidity
function setFeeRate(uint256 _feeRate) external onlyOwner {
    if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
    feeRate = _feeRate;
    emit FeeRateUpdated(_feeRate);
}
```

**설명:**  
진행 중인 마켓의 feeRate를 즉시 변경할 수 있어, 사용자가 배팅할 때와 resolve될 때의 수수료가 다를 수 있습니다.

**권장 수정:**
```solidity
// 마켓 생성 시 feeRate 고정
struct MarketInfo {
    // ...
    uint256 marketFeeRate;  // 생성 시점의 수수료율 저장
}

function createMarket(bytes32 gameId, uint8 playerCount) external onlyOwner {
    markets[gameId] = MarketInfo({
        // ...
        marketFeeRate: feeRate
    });
}
```

---

### M-4: impostorIndex 검증 시점 문제

**파일:** `PrescioMarketV3.sol`  
**위치:** Line 113

```solidity
if (impostorIndex >= market.playerCount) revert InvalidSuspectIndex();
```

**설명:**  
playerCount가 0이면 모든 impostorIndex가 유효하게 됩니다. 하지만 playerCount 0 체크가 먼저 이루어지므로 현재는 안전합니다. 다만, 마켓이 존재하지 않는 경우의 처리가 명시적이지 않습니다.

---

## 🔵 Low (개선 권장)

### L-1: Vault 주소 Zero Check 없음

**파일:** `PrescioMarketV3.sol`  
**위치:** `setVault()`

```solidity
function setVault(address _vault) external onlyOwner {
    vault = _vault;  // zero address 허용
    emit VaultUpdated(_vault);
}
```

**권장 수정:**
```solidity
function setVault(address _vault) external onlyOwner {
    require(_vault != address(0), "Invalid vault");
    vault = _vault;
    emit VaultUpdated(_vault);
}
```

---

### L-2: 사용자당 단일 배팅 제한

**파일:** `PrescioMarketV3.sol`  
**위치:** Line 168

```solidity
if (userBets[gameId][msg.sender].amount > 0) revert AlreadyBet();
```

**설명:**  
사용자가 한 마켓에 한 번만 배팅할 수 있습니다. 이는 의도된 설계일 수 있으나, 추가 배팅이나 배팅 변경 기능이 없습니다.

---

### L-3: 이벤트 누락 - emergencyWithdraw

**파일:** `PrescioMarketV3.sol`  

```solidity
function emergencyWithdraw() external onlyOwner {
    // 이벤트 emit 없음
}
```

**권장 수정:**
```solidity
event EmergencyWithdraw(address indexed to, uint256 amount);

function emergencyWithdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    // ...
    emit EmergencyWithdraw(owner(), balance);
}
```

---

## ⚪ Informational

### I-1: 가스 최적화 가능

**파일:** `PrescioMarketV3.sol`  
**위치:** `getOdds()`

```solidity
for (uint8 i = 0; i < m.playerCount; i++) {
    odds[i] = outcomePools[gameId][i];
}
```

`playerCount`를 memory 변수로 캐싱하면 gas 절약 가능

---

### I-2: Magic Number 사용

**파일:** `PrescioMarketV3.sol`

```solidity
uint256 fee = (market.totalPool * feeRate) / 10000;  // 10000을 상수로
```

`10000`을 `FEE_DENOMINATOR` 상수로 정의 권장

---

### I-3: NatSpec 문서화 부족

여러 함수에 `@notice`, `@param`, `@return` 주석이 없습니다.

---

## ✅ 긍정적 발견 사항

1. **Solidity 0.8.24 사용** - 자동 overflow/underflow 보호
2. **placeBet(), claim()에 nonReentrant 적용** - 주요 사용자 함수 보호
3. **Custom errors 사용** - Gas 효율적인 에러 처리
4. **명확한 상태 머신** - MarketState enum 사용
5. **이벤트 로깅** - 대부분의 상태 변경에 이벤트 발생
6. **최소 배팅 금액 설정** - 스팸 방지

---

## 📋 수정 우선순위

| 우선순위 | 이슈 | 예상 작업 |
|----------|------|-----------|
| 1 | C-1: ReentrancyGuardUpgradeable 교체 | 새 버전 배포 필요 |
| 2 | H-1: emergencyWithdraw 제한 | Timelock/Multisig 추가 |
| 3 | H-2: resolve() nonReentrant 추가 | 간단한 수정 |
| 4 | M-1: Pull pattern 적용 | 구조 변경 필요 |
| 5 | M-3: 마켓별 feeRate 고정 | Storage 추가 |

---

## 🔐 PrescioVault.sol 분석

### 보안 상태: ✅ 양호

**긍정적 요소:**
- ReentrancyGuard 적용
- Ownable 접근 제어
- 단순한 구조로 공격 표면 최소화
- receive() 함수로 안전한 ETH 수신

**주의 사항:**
- Owner가 모든 자금 인출 가능 (의도된 설계이지만 Multisig 권장)
- `withdrawFeesTo(address to)`에서 to 주소 검증 없음

---

## 📝 결론

PrescioMarketV3는 **Critical 수준의 storage collision 문제**가 있어 즉각적인 수정이 필요합니다. 현재 상태로 업그레이드를 진행하면 컨트랙트가 손상될 위험이 있습니다.

또한 emergencyWithdraw 기능으로 인한 **중앙화 위험**이 존재하며, 사용자 신뢰를 위해 Timelock이나 Multisig 도입을 강력히 권장합니다.

PrescioVault는 상대적으로 안전하나, 전체 시스템의 보안을 위해 Market 컨트랙트의 수정이 우선시되어야 합니다.
