# Prescio 컨트랙트 코드 리뷰

**리뷰 대상:**
- `PrescioMarketV3.sol` - UUPS 업그레이더블 예측 시장 컨트랙트
- `PrescioVault.sol` - 프로토콜 수수료 수집 Vault

**리뷰 일자:** 2026-02-06

---

## 📋 요약

| 항목 | PrescioMarketV3 | PrescioVault |
|------|----------------|--------------|
| 전반적 품질 | ⭐⭐⭐⭐ 양호 | ⭐⭐⭐⭐⭐ 우수 |
| 보안 | ⚠️ 중요 이슈 1건 | ✅ 양호 |
| 가스 효율성 | 개선 여지 있음 | 개선 여지 있음 |

---

## 🔴 Critical Issues (반드시 수정 필요)

### 1. ReentrancyGuard 비업그레이더블 버전 사용 (PrescioMarketV3)

**문제:**
```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// ...
contract PrescioMarketV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {
```

업그레이더블 컨트랙트에서 일반 `ReentrancyGuard`를 사용하고 있습니다. 이는 스토리지 레이아웃 충돌을 일으킬 수 있습니다.

**수정:**
```solidity
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
// ...
contract PrescioMarketV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {

function initialize(uint256 _feeRate, address _vault) public initializer {
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();
    // ...
}
```

---

## 🟡 Medium Issues (권장 수정)

### 2. Storage Gap 누락 (PrescioMarketV3)

업그레이더블 컨트랙트에서 향후 변수 추가를 위한 storage gap이 없습니다.

**수정:**
```solidity
// 컨트랙트 맨 아래에 추가
uint256[50] private __gap;
```

### 3. Zero Address 검증 누락 (PrescioVault)

`withdrawFeesTo`에서 목적지 주소 검증이 없습니다.

**수정:**
```solidity
function withdrawFeesTo(address to) external onlyOwner nonReentrant {
    if (to == address(0)) revert InvalidAddress();
    // ...
}
```

### 4. Initialize 함수에서 `__UUPSUpgradeable_init()` 누락

```solidity
function initialize(uint256 _feeRate, address _vault) public initializer {
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();  // 추가 권장
    // ...
}
```

---

## 🟢 코드 품질 및 가독성

### 긍정적인 부분

1. **명확한 섹션 구분** - 주석으로 섹션이 잘 분리됨
2. **Custom Errors 사용** - 가스 효율적이고 명확한 에러 처리
3. **이벤트 로깅** - 모든 주요 상태 변경에 이벤트 발생
4. **NatSpec 문서화** - 컨트랙트 레벨 문서 존재

### 개선 제안

1. **함수별 NatSpec 추가** - 각 함수에 `@param`, `@return` 문서 추가 권장
2. **상수 문서화** - `MIN_BET`, `MAX_FEE_RATE` 등의 의미 설명

---

## ⛽ 가스 최적화

### 1. 반복문 내 Storage 접근 캐싱 (PrescioMarketV3)

**현재 코드:**
```solidity
function getOdds(bytes32 gameId) external view returns (uint256[] memory) {
    MarketInfo storage m = markets[gameId];
    uint256[] memory odds = new uint256[](m.playerCount);
    for (uint8 i = 0; i < m.playerCount; i++) {  // 매 반복마다 storage 접근
        odds[i] = outcomePools[gameId][i];
    }
    return odds;
}
```

**최적화:**
```solidity
function getOdds(bytes32 gameId) external view returns (uint256[] memory) {
    uint8 playerCount = markets[gameId].playerCount;  // 한 번만 읽기
    uint256[] memory odds = new uint256[](playerCount);
    for (uint8 i = 0; i < playerCount; i++) {
        odds[i] = outcomePools[gameId][i];
    }
    return odds;
}
```

**예상 절감:** 반복 횟수 × ~100 gas

### 2. 코드 중복 제거 (PrescioVault)

`withdrawFees`와 `withdrawFeesTo`가 거의 동일합니다.

**최적화:**
```solidity
function withdrawFees() external onlyOwner nonReentrant {
    _withdrawFeesTo(owner());
}

function withdrawFeesTo(address to) external onlyOwner nonReentrant {
    if (to == address(0)) revert InvalidAddress();
    _withdrawFeesTo(to);
}

function _withdrawFeesTo(address to) private {
    uint256 balance = address(this).balance;
    if (balance == 0) revert NoFees();

    (bool success,) = payable(to).call{value: balance}("");
    if (!success) revert TransferFailed();

    emit FeesWithdrawn(to, balance);
}
```

### 3. View 함수 Storage vs Memory (PrescioMarketV3)

`isBettingOpen`에서 market 전체를 storage 포인터로 가져온 후 일부만 사용:

```solidity
// 현재
function isBettingOpen(bytes32 gameId) external view returns (bool) {
    MarketInfo storage market = markets[gameId];
    return market.playerCount > 0 && 
           market.state == MarketState.OPEN && 
           !bettingPaused[gameId];
}

// 최적화 (직접 접근이 더 효율적일 수 있음)
function isBettingOpen(bytes32 gameId) external view returns (bool) {
    MarketInfo memory m = markets[gameId];
    return m.playerCount > 0 && 
           m.state == MarketState.OPEN && 
           !bettingPaused[gameId];
}
```

---

## 🔍 로직 분석

### Parimutuel Market 로직 (정상 작동)

```
1. createMarket → OPEN 상태
2. placeBet → 베팅 수집 (일시정지 가능)
3. closeMarket → CLOSED 상태
4. resolve → RESOLVED + 수수료 처리
5. claim → 승자 지급
```

### 승자 없는 경우 처리 (정상)

```solidity
if (winningPool == 0) {
    // No winners: entire pool goes to vault ✅
    toVault = market.totalPool;
} else {
    // Winners exist: only fee goes to vault ✅
    toVault = fee;
}
```

### 잠재적 개선점

**impostorIndex 초기값 문제:**
- `impostorIndex`의 기본값이 0이고, 0은 유효한 인덱스
- RESOLVED 상태에서만 의미 있지만, 조회 시 혼란 가능

**제안:**
```solidity
struct MarketInfo {
    uint8 playerCount;
    uint8 impostorIndex;  // 255 = 미확정 (또는 별도 bool hasResolved 추가)
    // ...
}
```

---

## 🛡️ 보안 분석

### 체크리스트

| 항목 | PrescioMarketV3 | PrescioVault |
|------|----------------|--------------|
| Reentrancy Protection | ⚠️ 비업그레이더블 버전 | ✅ |
| Access Control | ✅ onlyOwner | ✅ onlyOwner |
| Integer Overflow | ✅ Solidity 0.8+ | ✅ Solidity 0.8+ |
| Pull Pattern (claim) | ✅ 사용자가 claim | N/A |
| ETH Transfer | ✅ call 사용 | ✅ call 사용 |

### Emergency 함수

```solidity
function emergencyWithdraw() external onlyOwner {
    // 모든 잔액을 owner에게 전송
}
```
- ✅ 비상 상황 대비 존재
- ⚠️ 진행 중인 마켓의 자금도 인출 가능 (의도적 설계로 보임)

---

## 📝 수정 우선순위

### 🔴 P0 (배포 전 필수)
1. `ReentrancyGuard` → `ReentrancyGuardUpgradeable` 교체
2. `__ReentrancyGuard_init()` 호출 추가

### 🟡 P1 (권장)
1. Storage gap 추가
2. `__UUPSUpgradeable_init()` 호출 추가
3. Zero address 검증 추가 (Vault)

### 🟢 P2 (선택)
1. 가스 최적화 적용
2. NatSpec 문서 보강
3. 코드 중복 제거

---

## 📄 수정된 코드 예시

### PrescioMarketV3.sol (핵심 수정)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";  // ✅ 수정

contract PrescioMarketV3 is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable  // ✅ 수정
{
    // ... (기존 코드)

    function initialize(uint256 _feeRate, address _vault) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();       // ✅ 추가
        __ReentrancyGuard_init();       // ✅ 추가

        if (_feeRate > MAX_FEE_RATE) revert InvalidFeeRate();
        feeRate = _feeRate;
        vault = _vault;
    }

    // ... (기존 코드)

    // ✅ Storage gap 추가
    uint256[50] private __gap;
}
```

---

## ✅ 결론

전반적으로 **잘 작성된 컨트랙트**입니다. UUPS 패턴을 적절히 사용하고 있으며, 커스텀 에러와 이벤트 로깅이 잘 되어 있습니다.

**반드시 수정해야 할 사항:**
- `ReentrancyGuard`를 업그레이더블 버전으로 교체

**권장 사항:**
- Storage gap 추가로 향후 업그레이드 안전성 확보
- 가스 최적화 적용으로 사용자 비용 절감

이 수정사항들을 적용하면 프로덕션 배포에 적합한 상태가 됩니다.
