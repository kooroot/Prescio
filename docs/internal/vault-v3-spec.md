# PrescioVault V3 Specification

## Overview
TOKENOMICS.md 설계에 맞게 3-way 수수료 분배를 구현하는 Vault 업그레이드.

## 현재 상태 (V2)
- 2-way 분배: Staking vs Owner
- `stakingDistributionRatio = 10000` (100%)
- Treasury/Development 별도 분배 불가
- Non-upgradeable contract

## 목표 상태 (V3)
| 수신처 | 비율 | 주소 |
|--------|------|------|
| Treasury | 50% (5000) | 0x0094f42BF79B7ACC942624A9173fa0ED7554d300 |
| Stakers | 30% (3000) | 0xB835F850E26809Ac18032dA45c207bB8859481a7 (Staking Contract) |
| Development | 20% (2000) | 0x001436d283c6ec27f555c25dd045a6a57b5a4be2 (Server) |

## Contract Changes

### State Variables
```solidity
// 기존
address public stakingContract;
uint256 public stakingDistributionRatio;

// 추가
address public treasuryAddress;
address public developmentAddress;
uint256 public treasuryRatio;      // 5000 = 50%
uint256 public stakingRatio;       // 3000 = 30%  
uint256 public developmentRatio;   // 2000 = 20%
```

### Functions

#### setDistributionRatios
```solidity
function setDistributionRatios(
    uint256 _treasuryRatio,
    uint256 _stakingRatio,
    uint256 _developmentRatio
) external onlyOwner {
    require(_treasuryRatio + _stakingRatio + _developmentRatio == RATIO_PRECISION, "Must sum to 100%");
    treasuryRatio = _treasuryRatio;
    stakingRatio = _stakingRatio;
    developmentRatio = _developmentRatio;
    emit DistributionRatiosUpdated(_treasuryRatio, _stakingRatio, _developmentRatio);
}
```

#### setAddresses
```solidity
function setTreasuryAddress(address _treasury) external onlyOwner;
function setDevelopmentAddress(address _dev) external onlyOwner;
// stakingContract는 기존 함수 유지
```

#### distributeAll (수정)
```solidity
function distributeAll() external onlyOwner nonReentrant {
    uint256 balance = address(this).balance;
    require(balance > 0, "No fees");
    
    uint256 toTreasury = (balance * treasuryRatio) / RATIO_PRECISION;
    uint256 toStaking = (balance * stakingRatio) / RATIO_PRECISION;
    uint256 toDev = balance - toTreasury - toStaking; // 나머지
    
    if (toTreasury > 0) {
        (bool s1,) = treasuryAddress.call{value: toTreasury}("");
        require(s1, "Treasury transfer failed");
    }
    
    if (toStaking > 0) {
        IPrescioStaking(stakingContract).depositRewardsFromVault{value: toStaking}();
    }
    
    if (toDev > 0) {
        (bool s2,) = developmentAddress.call{value: toDev}("");
        require(s2, "Dev transfer failed");
    }
    
    emit FeesDistributed(toTreasury, toStaking, toDev);
}
```

### Events
```solidity
event DistributionRatiosUpdated(uint256 treasury, uint256 staking, uint256 dev);
event FeesDistributed(uint256 treasury, uint256 staking, uint256 dev);
event TreasuryAddressUpdated(address indexed oldAddr, address indexed newAddr);
event DevelopmentAddressUpdated(address indexed oldAddr, address indexed newAddr);
```

## Migration Plan

### Step 1: Deploy V3
새 PrescioVault V3 컨트랙트 배포

### Step 2: Configure V3
```
setTreasuryAddress(0x0094f42BF79B7ACC942624A9173fa0ED7554d300)
setStakingContract(0xB835F850E26809Ac18032dA45c207bB8859481a7)
setDevelopmentAddress(TBD)
setDistributionRatios(5000, 3000, 2000)
```

### Step 3: Update Market
Market 컨트랙트의 vault 주소를 V3로 변경:
```
PrescioMarket.setVault(NEW_VAULT_V3_ADDRESS)
```

### Step 4: Migrate Pending Fees
1. V2에서 `withdrawVaultFees()` 호출하여 Market의 pendingVaultFees를 V2로 이동
2. V2 owner가 V3로 수동 이체
3. 또는 Market에서 직접 V3로 withdrawVaultFees() 호출 (setVault 이후)

## Security Considerations
1. Owner 권한 집중 - Multisig 권장
2. Reentrancy protection 필수
3. Zero address 검증
4. 비율 합계 100% 검증
5. Staking 컨트랙트 호출 실패 시 전체 revert

## Testing Requirements
1. 3-way 분배 정확성 테스트
2. 비율 변경 테스트
3. 주소 변경 테스트
4. Edge cases (0% 비율, 작은 금액 등)
5. Reentrancy 공격 테스트

## Timeline
1. Coder 구현: 1-2시간
2. Code Review: 30분
3. Security Audit: 1시간
4. Testnet 배포 및 테스트: 1시간
5. Mainnet 배포: 30분

---
Author: koosoot
Date: 2026-02-12
Version: 1.0
