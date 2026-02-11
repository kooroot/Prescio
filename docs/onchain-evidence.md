# Prescio 온체인 증거 (On-Chain Evidence)

## 네트워크 정보

| 항목 | Mainnet | Testnet |
|------|---------|---------|
| Chain | Monad Mainnet | Monad Testnet |
| Chain ID | 143 (0x8f) | 10143 (0x279f) |
| RPC | https://rpc.monad.xyz | https://monad-testnet.api.onfinality.io/public |

---

## 메인넷 컨트랙트 주소 (Monad Mainnet - Chain ID 143)

### 핵심 컨트랙트

| 컨트랙트 | 주소 | 설명 |
|----------|------|------|
| **PrescioMarket (Proxy)** | `0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C` | 베팅 마켓 (Parimutuel) |
| **PrescioMarket (Impl)** | `0xdCFd12C4797428E31AbA42C9c4Ca87339c3170De` | 마켓 구현체 |
| **PrescioVault** | `0xbCAad29d9a2Dd64a8b8F1B9fD2e1C59D2b6a3E43` | 프로토콜 수수료 관리 |
| **PrescioStaking (Proxy)** | `0xB835F850E26809Ac18032dA45c207bB8859481a7` | 스테이킹 컨트랙트 |
| **AutoBetController (Proxy)** | `0xEd96846b9Df01294404E52eA6A646ED96aC6791C` | 자동 베팅 컨트롤러 |
| **PRESCIO Token** | `0xffC86Ab0C36B0728BbF52164f6319762DA867777` | 거버넌스/유틸리티 토큰 |

### 관리 주소

| 역할 | 주소 |
|------|------|
| **Deployer/Owner** | `0x001436d283c6ec27f555c25dd045a6a57b5a4be2` |
| **Treasury** | `0x0094f42BF79B7ACC942624A9173fa0ED7554d300` |
| **Server Wallet** | *(별도 관리)* |

---

## 배포 트랜잭션 (Deployment Transactions)

### 2026-02-06 메인넷 배포

| 컨트랙트 | TX Hash | Block |
|----------|---------|-------|
| PrescioVault | `0xf29be39ef130fdca9fa7e6de507ae73b0df0a1ecc59185a60ae09eef4104fb91` | 53558225 |
| PrescioMarket (Impl) | `0xc2d9a6c30e172e737980560ab95f38c03dc5e398de29e5b8424783697bf80d23` | 53558225 |
| PrescioMarket (Proxy) | `0x50a6f6763350b4b525c3790d055febf52ec31088d57860fa4c82941e69bead7d` | 53558225 |

---

## 토큰 정보 (PRESCIO Token)

| 항목 | 값 |
|------|-----|
| **Contract** | `0xffC86Ab0C36B0728BbF52164f6319762DA867777` |
| **Symbol** | PRESCIO |
| **nad.fun** | https://nad.fun/tokens/0xffC86Ab0C36B0728BbF52164f6319762DA867777 |

---

## 테스트넷 컨트랙트 주소 (Monad Testnet - Chain ID 10143)

| 컨트랙트 | 주소 |
|----------|------|
| PrescioMarket | `0x13DAD4fE98D5C0EC317408A510b21A66992A1680` |
| PrescioVault | `0x4f97726E10F4676cDBa66B1D79ECAe921d9eFb76` |
| PrescioStaking | `0xD7CBdCAD334f2d783088224ac3680C5f127c68FD` |
| AutoBetController | `0x00b652f6618e553Ae2ecB3e7292ACf6255a8Bafc` |
| PRESCIO Token | `0xffC86Ab0C36B0728BbF52164f6319762DA867777` |

---

## 컨트랙트 기능

### PrescioMarket

**핵심 기능:**
- `createMarket(gameId, playerCount)` - 게임 마켓 생성
- `placeBet(gameId, suspectIndex)` - 베팅 (payable)
- `closeMarket(gameId)` - 베팅 마감
- `resolve(gameId, impostorIndex)` - 게임 결과 확정
- `claim(gameId)` - 상금 청구

**이벤트:**
- `MarketCreated(gameId, playerCount)`
- `BetPlaced(gameId, user, suspectIndex, amount)`
- `MarketClosed(gameId)`
- `MarketResolved(gameId, impostorIndex, totalPool, fee)`
- `Claimed(gameId, user, payout)`

**파라미터:**
- `MIN_BET`: 0.01 MON (10^16 wei)
- `FEE_RATE`: 100 (1%)
- `EMERGENCY_DELAY`: 7 days

### PrescioVault

**기능:**
- `withdrawFees()` - 수수료 인출
- `feeBalance()` - 현재 수수료 잔액 조회

### PrescioStaking

**기능:**
- 스테이킹/언스테이킹
- 리워드 분배

---

## 검증 방법

### Explorer에서 확인
```
https://explorer.monad.xyz/address/0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C
```

### Cast로 조회 (Foundry)
```bash
# 마켓 정보 조회
cast call 0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C \
  "getMarketInfo(bytes32)" <gameId> \
  --rpc-url https://rpc.monad.xyz

# 수수료율 조회
cast call 0x6ba44357D3A1693aFe72ABa204b01fb8F8B36F6C \
  "feeRate()" \
  --rpc-url https://rpc.monad.xyz
```

---

## 봇 지갑 (AI Agents)

| Agent | 역할 |
|-------|------|
| Shark | 공격적 임포스터 |
| Owl | 분석적 플레이어 |
| Fox | 교활한 거짓말쟁이 |
| Whale | 대담한 베터 |
| Rabbit | 빠른 반응 |
| Turtle | 신중한 플레이 |
| Eagle | 날카로운 관찰 |
| Cat | 호기심 많은 탐정 |
| Wolf | 팩 전략가 |
| Phantom | 스텔스 임포스터 |

*(지갑 주소는 보안상 별도 관리)*

---

## 현재 잔액 (2026-02-11 09:19 KST)

| 컨트랙트 | 잔액 (MON) |
|----------|------------|
| Market | 502.67 |
| Vault | 427.94 |
| Treasury | 0.00 |

---

## 업데이트 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-06 | 메인넷 배포 완료 |
| 2026-02-06 | nad.fun 토큰 등록 |
| 2026-02-10 | AutoBet 컨트롤러 업그레이드 |
| 2026-02-11 | 봇 지갑 자동 충전 시스템 가동 |

---

*Last Updated: 2026-02-11*
