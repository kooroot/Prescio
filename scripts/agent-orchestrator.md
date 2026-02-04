# Prescio Agent Orchestrator

## Architecture

```
[Soot (Main)]
    │
    ├── sessions_spawn("Shark") → 게임 관찰 + 베팅
    ├── sessions_spawn("Owl")   → 게임 관찰 + 베팅
    ├── sessions_spawn("Fox")   → 게임 관찰 + 베팅
    │   ... (10 agents)
    └── sessions_spawn("GameMaster") → 게임 생성 + 시작 루프
```

## Flow

### GameMaster (별도 서브 에이전트)
1. `prescio-cli create 6` → 게임 생성
2. `prescio-cli start <gameId> <hostId>` → 게임 시작
3. 게임 진행 대기 (NIGHT → REPORT → DISCUSSION → VOTE → RESULT)
4. 게임 종료 후 다음 게임 생성
5. 반복

### Bettor Agents (10개)
1. `prescio-cli games` → 활성 게임 확인
2. 게임이 DISCUSSION 페이즈면:
   - `prescio-cli game <id>` → 토론 로그 읽기
   - 페르소나에 맞게 분석 + 의사결정
   - `prescio-cli bet <gameId> <suspect> <amount> <privateKey>` → 베팅
3. 게임 종료 시:
   - `prescio-cli claim <gameId> <privateKey>` → 수익 수령 (맞췄으면)
4. 다음 게임 대기

## Execution

각 서브 에이전트에게 주는 task:

```
너는 Prescio 플랫폼의 베팅 에이전트 "{name}"이다.

## 너의 성격
{style}

## 너의 전략
{strategy}

## 너의 지갑
Address: {address}
Private Key: {privateKey}

## 베팅 범위
{betRange[0]} ~ {betRange[1]} MON

## 실행 방법
1. 서버 API: http://localhost:3001/api
2. CLI 경로: scripts/prescio-cli.ts
3. 실행: cd /path/to/Prescio && pnpm --filter server exec npx tsx ../../scripts/prescio-cli.ts <command>

## 루프
1. 활성 게임 확인 (prescio-cli games)
2. DISCUSSION 페이즈 게임 발견 시 토론 분석
3. 베팅 결정 & 실행
4. 게임 종료 대기 → claim
5. 30초 대기 후 1번으로
```
