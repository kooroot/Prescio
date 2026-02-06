# Prescio 메인넷 배포 체크리스트

## 📋 빌드 상태
- [x] OpenZeppelin 4.9.6 호환성 수정
- [x] `forge build --skip test` 성공
- [x] via_ir 활성화 (stack too deep 해결)

---

## 🔧 사전 준비

### 1. 환경 변수 설정
```bash
export DEPLOYER_PRIVATE_KEY="<배포자 프라이빗 키>"
export MONAD_RPC_URL="<모나드 메인넷 RPC>"
export PRESCIO_TOKEN="<PRESCIO 토큰 주소>"
export TREASURY="<재무 멀티시그 주소>"
```

### 2. PRESCIO 토큰 준비
- [ ] nad.fun에서 PRESCIO 토큰 발행
- [ ] 토큰 주소 기록: `_______________`
- [ ] Total Supply: 1B (고정)

### 3. Treasury 주소 준비
- [ ] 멀티시그 지갑 생성 (권장: Gnosis Safe)
- [ ] Treasury 주소 기록: `_______________`

---

## 📦 배포 순서

### Phase 1: Core Contracts

#### Step 1: PrescioVault 배포
```bash
cd packages/contracts
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast
```
- [ ] PrescioVault 주소 기록: `_______________`

#### Step 2: PrescioMarket 배포 (UUPS Proxy)
Deploy.s.sol 실행 시 같이 배포됨
- [ ] PrescioMarket Proxy 주소 기록: `_______________`
- [ ] PrescioMarket Implementation 주소 기록: `_______________`

### Phase 2: Staking System

#### Step 3: PrescioStaking 배포
```bash
export MARKET_PROXY="<PrescioMarket 프록시 주소>"
forge script script/DeployStaking.s.sol --rpc-url $MONAD_RPC_URL --broadcast
```
- [ ] PrescioStaking Proxy 주소 기록: `_______________`
- [ ] AutoBetController Proxy 주소 기록: `_______________`

### Phase 3: 연결 및 설정

#### Step 4: 컨트랙트 연결
```bash
# 이미 DeployStaking.s.sol에서 자동 실행됨
# 수동 실행 필요 시:
cast send $STAKING_PROXY "setAutoBetController(address)" $AUTOBET_PROXY --private-key $DEPLOYER_PRIVATE_KEY
```
- [ ] Staking ↔ AutoBetController 연결 확인

#### Step 5: Market 설정
```bash
# Vault 설정 (이미 초기화 시 설정됨)
cast call $MARKET_PROXY "vault()"
```
- [ ] Market.vault() == PrescioVault 주소

---

## ✅ 배포 후 검증

### 1. 컨트랙트 상태 확인
```bash
# Market
cast call $MARKET_PROXY "owner()"
cast call $MARKET_PROXY "feeRate()"
cast call $MARKET_PROXY "vault()"

# Staking
cast call $STAKING_PROXY "owner()"
cast call $STAKING_PROXY "treasury()"
cast call $STAKING_PROXY "autoBetController()"
cast call $STAKING_PROXY "currentEpoch()"

# AutoBet
cast call $AUTOBET_PROXY "owner()"
cast call $AUTOBET_PROXY "staking()"
cast call $AUTOBET_PROXY "market()"
```

### 2. 기능 테스트 (소액)
- [ ] Market: createMarket → placeBet → closeMarket → resolve → claim
- [ ] Staking: stake → claimAllRewards → unstake
- [ ] AutoBet: deposit → activateAutoBet → executeAutoBet

---

## 🔐 보안 체크

### 1. 권한 확인
- [ ] Market.owner() == 배포자/멀티시그
- [ ] Staking.owner() == 배포자/멀티시그
- [ ] AutoBet.owner() == 배포자/멀티시그

### 2. 초기 설정 확인
- [ ] Market.feeRate() == 100 (1%)
- [ ] Staking 티어 설정 확인

### 3. 비상 기능 테스트
- [ ] Market.requestEmergencyWithdraw() (7일 타임락 확인)
- [ ] Staking.emergencyUnstake() (50% 페널티 확인)

---

## 📝 배포 후 작업

### 1. 컨트랙트 검증 (Etherscan/Explorer)
```bash
forge verify-contract $MARKET_PROXY PrescioMarket --chain monad
forge verify-contract $STAKING_PROXY PrescioStaking --chain monad
forge verify-contract $AUTOBET_PROXY AutoBetController --chain monad
```

### 2. 프론트엔드 업데이트
- [ ] 컨트랙트 주소 환경 변수 업데이트
- [ ] ABI 파일 업데이트 (out/ 폴더에서)

### 3. 문서 업데이트
- [ ] README.md에 컨트랙트 주소 추가
- [ ] API 문서 업데이트

---

## ⚠️ 롤백 계획

### UUPS 업그레이드 (문제 발생 시)
```bash
# 새 implementation 배포 후
cast send $PROXY "upgradeToAndCall(address,bytes)" $NEW_IMPL "0x" --private-key $KEY
```

### 비상 출금 (7일 대기 필요)
```bash
cast send $MARKET_PROXY "requestEmergencyWithdraw()" --private-key $KEY
# 7일 후
cast send $MARKET_PROXY "emergencyWithdraw()" --private-key $KEY
```

---

## 📊 배포 결과 기록

| 컨트랙트 | 주소 | 상태 |
|----------|------|------|
| PrescioVault | | ⬜ |
| PrescioMarket (Proxy) | | ⬜ |
| PrescioMarket (Impl) | | ⬜ |
| PrescioStaking (Proxy) | | ⬜ |
| PrescioStaking (Impl) | | ⬜ |
| AutoBetController (Proxy) | | ⬜ |
| AutoBetController (Impl) | | ⬜ |
| PRESCIO Token | | ⬜ |

---

## 📅 타임라인

| 단계 | 예상 시간 |
|------|----------|
| 토큰 발행 (nad.fun) | 10분 |
| Core 배포 | 5분 |
| Staking 배포 | 5분 |
| 연결 및 검증 | 10분 |
| 프론트엔드 업데이트 | 30분 |
| **총 예상 시간** | **~1시간** |

---

*Last Updated: 2026-02-06*
