# Prescio Mainnet Deployment Checklist

**Version**: 1.0  
**Date**: 2026-02-06  
**Status**: READY FOR DEPLOYMENT  
**Network**: Monad Mainnet

---

## 📋 Executive Summary

본 문서는 Prescio 프로토콜의 메인넷 배포를 위한 최종 체크리스트입니다.

### 배포 대상 컨트랙트

| 컨트랙트 | 타입 | 상태 |
|----------|------|------|
| PrescioVaultV2 | 신규 배포 (Non-Upgradeable) | ✅ Ready |
| PrescioMarketV4 | 업그레이드 (UUPS) | ✅ Ready |
| PrescioStaking | 신규 배포 (UUPS Proxy) | ✅ Ready |
| AutoBetController | 신규 배포 (UUPS Proxy) | ✅ Ready |

### Security Audit Status

| 항목 | 상태 |
|------|------|
| Critical Issues | ✅ 모두 수정됨 |
| High Issues | ✅ 모두 수정됨 |
| Medium Issues | ✅ 모두 수정됨 (Penalty 타입 불일치 → 듀얼 리워드 시스템으로 해결) |
| Final Assessment | ✅ **PASS** |

---

## 🔄 Part 1: 배포 순서 및 의존성

### 1.1 컨트랙트 의존성 그래프

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CONTRACT DEPENDENCY GRAPH                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐                                                 │
│  │ PrescioVaultV2  │  ← 의존성 없음 (1순위 배포)                      │
│  └────────┬────────┘                                                 │
│           │                                                           │
│           ▼ (vault 주소)                                             │
│  ┌─────────────────┐                                                 │
│  │ PrescioMarketV4 │  ← Vault 필요 (2순위: 기존 프록시 업그레이드)    │
│  └────────┬────────┘                                                 │
│           │                                                           │
│           ▼ (market 주소)                                            │
│  ┌─────────────────┐     ┌──────────────────┐                        │
│  │ PrescioStaking  │ ←── │  PRESCIO Token   │ (외부 의존성)          │
│  │                 │ ←── │  Treasury Addr   │                        │
│  └────────┬────────┘     └──────────────────┘                        │
│           │ (staking 주소)                                           │
│           ▼                                                           │
│  ┌─────────────────────┐                                             │
│  │ AutoBetController   │  ← Staking + Market 필요 (4순위)            │
│  └─────────────────────┘                                             │
│                                                                       │
│  ═══════════════════════════════════════════════════════════════════ │
│                                                                       │
│  POST-DEPLOYMENT CONNECTIONS:                                         │
│  • Staking.setAutoBetController(autoBetProxy)                        │
│  • Market.setVault(vaultV2) ← 필요 시                                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 배포 순서 (Step-by-Step)

#### Phase 1: Infrastructure 배포

| Step | Action | 스크립트 | 검증 |
|------|--------|---------|------|
| 1.1 | PrescioVaultV2 배포 | `UpgradeV4.s.sol:DeployVaultV2` | owner() 확인 |
| 1.2 | VaultV2 주소 기록 | - | 환경변수에 저장 |

#### Phase 2: Market 업그레이드

| Step | Action | 스크립트 | 검증 |
|------|--------|---------|------|
| 2.1 | PrescioMarketV4 Implementation 배포 | `UpgradeV4.s.sol` | - |
| 2.2 | Proxy → V4 업그레이드 + initializeV4() | `UpgradeV4.s.sol` | pendingVaultFees=0 확인 |
| 2.3 | (선택) setVault(newVaultV2) | 수동 | vault() 확인 |

#### Phase 3: Staking System 배포

| Step | Action | 스크립트 | 검증 |
|------|--------|---------|------|
| 3.1 | PrescioStaking Implementation 배포 | `DeployStaking.s.sol` | - |
| 3.2 | Staking Proxy 배포 | `DeployStaking.s.sol` | currentEpoch=1 확인 |
| 3.3 | AutoBetController Implementation 배포 | `DeployStaking.s.sol` | - |
| 3.4 | AutoBet Proxy 배포 | `DeployStaking.s.sol` | staking() 확인 |
| 3.5 | Staking.setAutoBetController(autoBetProxy) | `DeployStaking.s.sol` | autoBetController() 확인 |

#### Phase 4: Post-Deployment 설정

| Step | Action | 명령어 | 검증 |
|------|--------|--------|------|
| 4.1 | Operator 등록 | `autoBet.setOperator(keeper, true)` | operators(keeper) = true |
| 4.2 | (선택) Tier 설정 조정 | `staking.updateTierConfig(...)` | tierConfigs 확인 |
| 4.3 | (선택) Owner Multi-sig 이전 | `transferOwnership(multisig)` | 모든 컨트랙트 owner 확인 |

---

## ⚙️ Part 2: 환경 변수 및 설정

### 2.1 필수 환경 변수

```bash
# ============================================
# MAINNET DEPLOYMENT ENVIRONMENT VARIABLES
# ============================================

# Deployer (Must be owner of existing Market proxy)
PRIVATE_KEY=0x...your_deployer_private_key...

# RPC Endpoint
RPC_URL=https://mainnet.monad.xyz/rpc  # 또는 실제 Monad mainnet RPC

# External Dependencies
PRESCIO_TOKEN=0x...prescio_token_address...    # $PRESCIO ERC-20 토큰 주소
TREASURY=0x...treasury_multisig_address...      # Treasury 멀티시그 주소

# Existing Contracts (Testnet → Mainnet 주소로 변경 필요!)
MARKET_PROXY=0x...existing_market_proxy...      # 기존 PrescioMarket 프록시 주소

# Optional: 기존 Vault 유지 시
VAULT_ADDRESS=0x...existing_vault...            # 기존 Vault 주소 (V2 배포 안 할 경우)

# Deployment Output (배포 후 기록)
STAKING_PROXY=                                  # 배포 후 기록
AUTOBET_PROXY=                                  # 배포 후 기록
VAULT_V2=                                       # 배포 후 기록
```

### 2.2 UpgradeV4.s.sol 수정 필요

⚠️ **중요**: `UpgradeV4.s.sol`에 하드코딩된 테스트넷 주소를 메인넷 주소로 변경해야 합니다.

```solidity
// 현재 (테스트넷)
address constant PROXY = 0x8Ba812709A23D3c35e328a4F13D09C6Cd3A7CD8F;

// 변경 필요 (메인넷)
address constant PROXY = vm.envAddress("MARKET_PROXY");  // 또는 실제 메인넷 주소
```

### 2.3 초기 설정값

#### PrescioMarketV4

| 설정 | 현재값 | 권장값 | 비고 |
|------|--------|--------|------|
| feeRate | 기존 유지 | 500 (5%) | MAX_FEE_RATE = 1000 (10%) |
| MIN_BET | 0.1 ether | 유지 | 변경 불가 (constant) |
| EMERGENCY_DELAY | 7 days | 유지 | 변경 불가 (constant) |

#### PrescioStaking

| 설정 | 기본값 | 비고 |
|------|--------|------|
| EPOCH_DURATION | 7 days | 변경 불가 (constant) |
| EPOCH_GRACE_PERIOD | 1 day | 변경 불가 (constant) |
| MAX_CLAIM_EPOCHS | 52 | 변경 불가 (constant) |

**Tier 기본 설정** (initialize에서 설정됨):

| Tier | Min Stake | Reward Boost | Auto-bet Daily Limit |
|------|-----------|--------------|---------------------|
| Bronze | 1,000 PRESCIO | 1.0x | 0 |
| Silver | 10,000 PRESCIO | 1.2x | 100 MON |
| Gold | 50,000 PRESCIO | 1.5x | 500 MON |
| Diamond | 200,000 PRESCIO | 2.0x | 2,000 MON |
| Legendary | 500,000 PRESCIO | 3.0x | 10,000 MON |

#### AutoBetController

| 설정 | 기본값 | 비고 |
|------|--------|------|
| Conservative 최소 odds | 1.2x | Gold+ |
| Balanced 최소 odds | 1.5x | Gold+ |
| Aggressive 최소 odds | 3.0x | Diamond+ |

---

## 🔄 Part 3: 기존 컨트랙트 업그레이드

### 3.1 V3 → V4 업그레이드 절차

```
┌──────────────────────────────────────────────────────────────────────┐
│                     V3 → V4 UPGRADE PROCEDURE                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  BEFORE UPGRADE:                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ V3 Implementation                                                │ │
│  │ - ReentrancyGuard (non-upgradeable) ⚠️ Storage Collision Risk    │ │
│  │ - emergencyWithdraw 즉시 실행 가능                               │ │
│  │ - Vault 직접 전송 (Push Pattern)                                 │ │
│  │ - 글로벌 feeRate                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼ upgradeToAndCall()                    │
│                                                                       │
│  AFTER UPGRADE:                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ V4 Implementation                                                │ │
│  │ ✅ ReentrancyGuardUpgradeable (storage safe)                     │ │
│  │ ✅ 7-day timelock on emergencyWithdraw                          │ │
│  │ ✅ Pull Pattern (pendingVaultFees)                               │ │
│  │ ✅ Market-specific feeRate                                       │ │
│  │ ✅ Storage Gap (uint256[50])                                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 업그레이드 실행 명령어

```bash
# 1. 환경 변수 설정
export PRIVATE_KEY=0x...
export RPC_URL=https://mainnet.monad.xyz/rpc

# 2. 업그레이드 실행
forge script script/UpgradeV4.s.sol:UpgradeV4 \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify
```

### 3.3 데이터 마이그레이션

✅ **마이그레이션 불필요**

| 항목 | 상태 | 이유 |
|------|------|------|
| Market States | 유지됨 | 기존 mapping 그대로 사용 |
| User Bets | 유지됨 | 기존 mapping 그대로 사용 |
| Outcome Pools | 유지됨 | 기존 mapping 그대로 사용 |
| Fee Rate | 유지됨 | 기존 slot 동일 |
| Vault Address | 유지됨 | 기존 slot 동일 |

**새 상태 변수** (기본값 초기화):
- `pendingVaultFees` = 0
- `emergencyWithdrawRequested` = false
- `emergencyWithdrawRequestTime` = 0

**initializeV4() 호출로 처리됨** (upgradeToAndCall에 포함)

### 3.4 업그레이드 롤백 계획

⚠️ **UUPS 업그레이드는 일반적으로 롤백 불가**

**예방 조치**:
1. Testnet에서 완전한 시뮬레이션 (필수!)
2. Fork 테스트 실행
3. 배포 후 모든 view 함수 검증

**긴급 상황 대응**:
```solidity
// V4에서 V5로 긴급 패치 가능
// 단, V3로 롤백은 storage layout 충돌로 불가
```

---

## ✅ Part 4: 체크리스트

### 4.1 배포 전 체크리스트

#### 코드 검증

- [ ] 모든 컨트랙트 컴파일 성공 (`forge build`)
- [ ] 전체 테스트 통과 (`forge test`)
- [ ] 커버리지 확인 (`forge coverage`)
- [ ] Slither/Aderyn 정적 분석 통과

#### 환경 설정

- [ ] 메인넷 RPC URL 확인
- [ ] PRESCIO_TOKEN 주소 검증 (토큰 symbol/decimals 확인)
- [ ] TREASURY 주소 검증 (multi-sig 확인)
- [ ] MARKET_PROXY 주소 검증 (owner가 deployer인지 확인)
- [ ] Deployer 주소 잔액 확인 (가스비 충분한지)

#### 스크립트 검증

- [ ] `UpgradeV4.s.sol`의 PROXY 주소를 메인넷 주소로 변경
- [ ] 모든 스크립트 dry-run 성공 (`forge script ... --dry-run`)

#### 테스트넷 시뮬레이션

- [ ] Monad Testnet에서 전체 배포 흐름 테스트 완료
- [ ] V3 → V4 업그레이드 테스트 완료
- [ ] Staking stake/unstake/claim 테스트 완료
- [ ] AutoBet 전체 플로우 테스트 완료

#### 보안 최종 확인

- [ ] Security audit 모든 이슈 해결 확인 (post-fix-security-audit.md)
- [ ] Storage layout 충돌 없음 확인
- [ ] Owner 권한 함수 목록 검토
- [ ] Emergency withdraw timelock (7일) 확인

### 4.2 배포 중 체크리스트

#### Phase 1: VaultV2

- [ ] `DeployVaultV2` 스크립트 실행
- [ ] Vault 주소 기록: `VAULT_V2=0x...`
- [ ] `vault.owner()` == deployer 확인
- [ ] `vault.feeBalance()` == 0 확인

#### Phase 2: MarketV4 업그레이드

- [ ] `UpgradeV4` 스크립트 실행
- [ ] 새 implementation 주소 기록
- [ ] `market.pendingVaultFees()` == 0 확인
- [ ] `market.getEmergencyStatus()` == (false, 0, 0) 확인
- [ ] 기존 market 데이터 정상 조회 확인

#### Phase 3: Staking & AutoBet

- [ ] `DeployStaking` 스크립트 실행
- [ ] Staking proxy 주소 기록: `STAKING_PROXY=0x...`
- [ ] AutoBet proxy 주소 기록: `AUTOBET_PROXY=0x...`
- [ ] `staking.currentEpoch()` == 1 확인
- [ ] `staking.autoBetController()` == autoBetProxy 확인
- [ ] `autoBet.staking()` == stakingProxy 확인
- [ ] `autoBet.market()` == marketProxy 확인

#### Phase 4: Post-Deployment

- [ ] Operator 등록: `autoBet.setOperator(keeper, true)`
- [ ] (선택) Vault 변경: `market.setVault(vaultV2)`
- [ ] (권장) Multi-sig로 owner 이전

### 4.3 배포 후 검증 체크리스트

#### 기능 테스트

| 테스트 | 방법 | 예상 결과 |
|--------|------|----------|
| Market 베팅 | placeBet() 호출 | BetPlaced 이벤트 |
| Staking | stake() 호출 | Staked 이벤트 |
| Tier 확인 | getTier() 호출 | 스테이킹량에 맞는 Tier |
| Auto-bet 활성화 | activateAutoBet() | AutoBetActivated 이벤트 |
| Vault Fee 인출 | withdrawVaultFees() | VaultFeesWithdrawn 이벤트 |

#### 상태 확인

- [ ] 모든 컨트랙트 owner 확인
- [ ] Market 기존 데이터 정상 조회
- [ ] Staking tier configs 확인
- [ ] AutoBet strategy params 확인

#### 모니터링 설정

- [ ] 컨트랙트 이벤트 모니터링 설정
- [ ] 대규모 트랜잭션 알림 설정
- [ ] Emergency 관련 이벤트 알림 설정

---

## ⚠️ Part 5: 리스크 및 대응 방안

### 5.1 예상 리스크

| 리스크 | 심각도 | 확률 | 완화 조치 |
|--------|--------|------|----------|
| 업그레이드 실패 | Critical | Low | Testnet 시뮬레이션 필수 |
| Gas 부족 | High | Low | 충분한 잔액 확보 |
| Storage Collision | Critical | Very Low | V4가 이미 해결함 |
| Key 유출 | Critical | Low | Multi-sig 사용 권장 |
| 오라클 지연 | Medium | Medium | Manual intervention 가능 |

### 5.2 비상 대응 계획

#### Scenario 1: 업그레이드 중 트랜잭션 실패

```
원인: Gas 부족, Nonce 충돌, RPC 장애

대응:
1. 트랜잭션 상태 확인 (pending/failed)
2. Failed인 경우:
   - Gas limit 증가
   - Nonce 확인 후 재시도
3. Pending인 경우:
   - Gas price 높여 교체 트랜잭션
```

#### Scenario 2: 업그레이드 후 기능 오작동

```
원인: Storage layout 변경, 로직 버그

대응:
1. 문제 범위 파악 (특정 함수/전체)
2. 영향받는 사용자에게 안내
3. V5 핫픽스 준비 (4-8시간 목표)
4. 새 implementation 배포 후 업그레이드
```

#### Scenario 3: 보안 취약점 발견

```
대응 프로토콜:
1. [즉시] 취약 함수 사용 중단 안내
2. [1시간] 영향 범위 분석
3. [4시간] 핫픽스 개발 및 테스트
4. [8시간] 긴급 업그레이드 배포

Emergency Actions:
- Market: pauseBetting() 호출
- Staking: (pause 기능 없음 - 추가 권장)
- AutoBet: operator 비활성화
```

#### Scenario 4: Owner Key 유출

```
대응:
1. [즉시] 새 owner 주소로 이전 시도
2. 이미 악용된 경우:
   - Market: emergencyWithdraw 7일 대기
   - Staking: user funds는 user만 인출 가능
   - AutoBet: userBalances는 user만 인출 가능
3. 커뮤니티 공지 및 포렌식
```

### 5.3 롤백 불가 사항

⚠️ **다음은 롤백 불가능합니다**:

1. UUPS 업그레이드 (V3 → V4)
2. 토큰 전송 (burn 포함)
3. 상태 변수 삭제

**대안**:
- 새 버전 (V5) 배포로 수정
- 데이터 migration 함수로 복구

---

## 📋 Part 6: 배포 명령어 Quick Reference

### 전체 배포 Flow

```bash
# ============================================
# MAINNET DEPLOYMENT COMMANDS
# ============================================

# 0. 환경 변수 설정
export PRIVATE_KEY="0x..."
export RPC_URL="https://mainnet.monad.xyz/rpc"
export PRESCIO_TOKEN="0x..."
export TREASURY="0x..."
export MARKET_PROXY="0x..."

# 1. VaultV2 배포
forge script script/UpgradeV4.s.sol:DeployVaultV2 \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvvv

# 배포된 주소 기록
export VAULT_V2="0x..." # 출력에서 확인

# 2. MarketV4 업그레이드
forge script script/UpgradeV4.s.sol:UpgradeV4 \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvvv

# 3. Staking & AutoBet 배포
forge script script/DeployStaking.s.sol:DeployStaking \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvvv

# 배포된 주소 기록
export STAKING_PROXY="0x..." # 출력에서 확인
export AUTOBET_PROXY="0x..." # 출력에서 확인

# 4. Post-Deployment 설정 (cast 사용)
# Operator 등록
cast send $AUTOBET_PROXY \
    "setOperator(address,bool)" \
    "0x_KEEPER_ADDRESS" true \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL

# (선택) Vault 변경
cast send $MARKET_PROXY \
    "setVault(address)" \
    $VAULT_V2 \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL
```

### 검증 명령어

```bash
# ============================================
# VERIFICATION COMMANDS
# ============================================

# Market 검증
cast call $MARKET_PROXY "vault()" --rpc-url $RPC_URL
cast call $MARKET_PROXY "feeRate()" --rpc-url $RPC_URL
cast call $MARKET_PROXY "pendingVaultFees()" --rpc-url $RPC_URL
cast call $MARKET_PROXY "getEmergencyStatus()" --rpc-url $RPC_URL

# Staking 검증
cast call $STAKING_PROXY "currentEpoch()" --rpc-url $RPC_URL
cast call $STAKING_PROXY "treasury()" --rpc-url $RPC_URL
cast call $STAKING_PROXY "autoBetController()" --rpc-url $RPC_URL
cast call $STAKING_PROXY "totalStaked()" --rpc-url $RPC_URL

# AutoBet 검증
cast call $AUTOBET_PROXY "staking()" --rpc-url $RPC_URL
cast call $AUTOBET_PROXY "market()" --rpc-url $RPC_URL
cast call $AUTOBET_PROXY "operators(address)" "0x_KEEPER_ADDRESS" --rpc-url $RPC_URL
```

---

## 📝 Part 7: 배포 후 운영 가이드

### 7.1 주간 운영 체크리스트

| 항목 | 주기 | 담당 |
|------|------|------|
| Epoch Finalization | 매주 | Owner 또는 자동화 |
| Reward Deposit | 매주 | Treasury |
| Penalty Distribution | 필요 시 | Anyone (permissionless) |
| Vault Fee Withdrawal | 필요 시 | Anyone (permissionless) |

### 7.2 Epoch 관리

```bash
# Epoch Finalization (Owner)
cast send $STAKING_PROXY "finalizeEpoch()" \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL

# Reward Deposit (Owner)
cast send $STAKING_PROXY "depositRewards()" \
    --value "10ether" \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL

# Penalty Distribution (Anyone)
cast send $STAKING_PROXY "distributePenalties()" \
    --rpc-url $RPC_URL
```

### 7.3 Emergency Procedures

```bash
# Emergency Withdraw Request (7일 대기 필요)
cast send $MARKET_PROXY "requestEmergencyWithdraw()" \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL

# Emergency Withdraw Cancel
cast send $MARKET_PROXY "cancelEmergencyWithdraw()" \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL

# Emergency Withdraw Execute (7일 후)
cast send $MARKET_PROXY "emergencyWithdraw()" \
    --private-key $PRIVATE_KEY \
    --rpc-url $RPC_URL
```

---

## 📚 Appendix: 주요 컨트랙트 주소 템플릿

배포 완료 후 아래 표를 업데이트하세요:

```markdown
# Prescio Mainnet Contracts

| Contract | Address | Type |
|----------|---------|------|
| PRESCIO Token | 0x... | ERC-20 |
| Treasury | 0x... | Multi-sig |
| PrescioVaultV2 | 0x... | Non-Upgradeable |
| PrescioMarketV4 (Proxy) | 0x... | UUPS Proxy |
| PrescioMarketV4 (Impl) | 0x... | Implementation |
| PrescioStaking (Proxy) | 0x... | UUPS Proxy |
| PrescioStaking (Impl) | 0x... | Implementation |
| AutoBetController (Proxy) | 0x... | UUPS Proxy |
| AutoBetController (Impl) | 0x... | Implementation |
| Keeper/Operator | 0x... | EOA |
```

---

**Document Version**: 1.0  
**Created**: 2026-02-06  
**Author**: Prescio PM Agent  
**Status**: Ready for Execution

---

## ✅ Final Sign-off

- [ ] Engineering Lead 승인
- [ ] Security Lead 승인
- [ ] Product Lead 승인
- [ ] Testnet 배포 완료
- [ ] Mainnet 배포 시작

**배포 예정일**: ________________

**배포 담당자**: ________________
