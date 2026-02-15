# Prescio 통계 API 기능명세서

**작성일**: 2026-02-15  
**작성자**: PM  
**상태**: 검토 완료 → 구현 착수

---

## 1. 개요

### 1.1 목적
- 게임 통계를 집계하여 Twitter 등 SNS에 주기적으로 공유
- 에이전트별 성과 리더보드 제공
- 커뮤니티 engagement 증가

### 1.2 주요 메트릭
| 메트릭 | 설명 |
|--------|------|
| **Top Wins** | 임포스터로 승리한 횟수 |
| **Most Kills** | 총 킬 수 |
| **Win Streak** | 연속 승리 횟수 |
| **Survival Rate** | 게임 종료 시 생존율 |
| **K/D Ratio** | 킬/데스 비율 (임포스터 기준) |

---

## 2. API 엔드포인트

### 2.1 GET /api/stats/leaderboard

전체 리더보드 조회

**Query Parameters:**
- `metric`: `wins` | `kills` | `survival` | `kd` (default: `wins`)
- `limit`: 결과 수 (default: 10, max: 50)
- `period`: `all` | `daily` | `weekly` (default: `all`)

**Response:**
```json
{
  "metric": "wins",
  "period": "all",
  "leaderboard": [
    {
      "rank": 1,
      "agentName": "Agent-Alpha",
      "value": 42,
      "gamesPlayed": 100,
      "lastPlayed": 1739600000000
    }
  ],
  "totalGames": 500,
  "generatedAt": 1739600000000
}
```

### 2.2 GET /api/stats/agent/:name

특정 에이전트 상세 통계

**Response:**
```json
{
  "agentName": "Agent-Alpha",
  "stats": {
    "gamesPlayed": 100,
    "gamesAsImpostor": 20,
    "gamesAsCrew": 80,
    "wins": {
      "total": 45,
      "asImpostor": 15,
      "asCrew": 30
    },
    "kills": 45,
    "deaths": 30,
    "survivalRate": 0.55,
    "kdRatio": 1.5,
    "currentStreak": 3,
    "bestStreak": 7
  },
  "recentGames": [
    {
      "gameId": "abc123",
      "role": "IMPOSTOR",
      "result": "WIN",
      "kills": 3,
      "survived": true,
      "finishedAt": 1739600000000
    }
  ]
}
```

### 2.3 GET /api/stats/summary

전체 통계 요약 (트윗용)

**Response:**
```json
{
  "totalGames": 500,
  "totalPlayers": 7,
  "topWinner": {
    "name": "Agent-Alpha",
    "wins": 42
  },
  "topKiller": {
    "name": "Agent-Bravo",
    "kills": 89
  },
  "mostSurvived": {
    "name": "Agent-Charlie",
    "rate": 0.72
  },
  "impostorWinRate": 0.45,
  "avgGameDuration": 180000,
  "period": {
    "start": 1739000000000,
    "end": 1739600000000
  }
}
```

---

## 3. 데이터 요구사항

### 3.1 현재 저장되는 데이터 (FinishedGameRecord)
- ✅ gameId, code, winner, rounds, playerCount
- ✅ players: { nickname, role, isAlive }
- ✅ finishedAt

### 3.2 추가 저장 필요
- ❌ **killEvents**: { killerId, targetId, round, timestamp }
  - Most Kills, K/D Ratio 계산에 필수
- ❌ **deathCause**: 각 플레이어의 사망 원인
  - `'killed'` (밤에 임포스터에게 살해)
  - `'eliminated'` (투표로 처형)
  - `'survived'` (생존)
  - K/D Ratio 정확한 계산에 필요

### 3.3 백엔드 수정 사항

**파일**: `apps/server/src/game/persistence.ts`

```typescript
// FinishedGameRecord에 killEvents 추가
export interface FinishedGameRecord {
  id: string;
  code: string;
  winner: string;
  rounds: number;
  playerCount: number;
  players: Array<{
    nickname: string;
    role: string | null;
    isAlive: boolean;
  }>;
  killEvents: Array<{  // 추가
    killerId: string;
    killerName: string;
    targetId: string;
    targetName: string;
    round: number;
  }>;
  finishedAt: number;
}
```

**파일**: `apps/server/src/api/routes.ts`

gameOver 이벤트 핸들러 수정:
```typescript
gameEngine.on("gameOver", (gameId, winner, game) => {
  const record: FinishedGameRecord = {
    // ... 기존 필드
    killEvents: game.killEvents.map(ke => ({
      killerId: ke.killerId,
      killerName: game.players.find(p => p.id === ke.killerId)?.nickname ?? 'Unknown',
      targetId: ke.targetId,
      targetName: game.players.find(p => p.id === ke.targetId)?.nickname ?? 'Unknown',
      round: ke.round,
    })),
  };
  // ...
});
```

---

## 4. 새 파일 구조

```
apps/server/src/
├── api/
│   ├── routes.ts (기존)
│   └── stats.ts (신규) - 통계 API 라우트
├── stats/
│   ├── index.ts - 통계 계산 로직
│   ├── aggregator.ts - 데이터 집계
│   └── types.ts - 타입 정의
```

---

## 5. Twitter 연동

### 5.1 트윗 포맷 예시

**일일 리더보드:**
```
📊 Prescio Daily Stats

🏆 Top Winner: Agent-Alpha (8 wins)
🔪 Most Kills: Agent-Bravo (15 kills)
🛡️ Best Survivor: Agent-Charlie (80%)

Games played today: 25
Impostor win rate: 48%

Watch AI agents deceive each other 👀
prescio.fun
```

**주간 요약:**
```
📈 Prescio Weekly Recap

Total games: 150
Most dominant: Agent-Delta (23 wins)
Deadliest: Agent-Echo (67 kills)

The agents are getting smarter... 🤖

#Prescio #AImafia #Monad
```

### 5.2 트윗 주기
- 일일 요약: 매일 오후 6시 KST
- 주간 리더보드: 매주 일요일 오후 8시 KST

---

## 6. 구현 우선순위

1. **Phase 1** (필수)
   - [ ] killEvents 저장 추가
   - [ ] GET /api/stats/summary 구현
   - [ ] GET /api/stats/leaderboard 구현

2. **Phase 2** (선택)
   - [ ] GET /api/stats/agent/:name 구현
   - [ ] 기간별 필터링 (daily/weekly)

3. **Phase 3** (자동화)
   - [ ] Twitter 크론 잡 연동
   - [ ] 트윗 템플릿 구현

---

## 7. 계산 로직 상세

### 7.1 K/D Ratio 계산
```
K/D = (임포스터로서 킬 수) / (임포스터로서 처형당한 횟수)

- 킬: killEvents에서 killerId로 카운트
- 데스: deathCause='eliminated' && role='IMPOSTOR'인 경우 카운트
- 크루로 죽은 건 포함 안함
- 데스가 0이면 K/D = null (JSON 직렬화 호환)
```

**API 응답 예시:**
```json
{
  "kdRatio": 2.5,    // 정상
  "kdRatio": null    // 데스 0인 경우 (무패)
}
```

### 7.2 Win Streak 계산
```
연속 승리 = 최근 게임부터 역순으로 연속 WIN 카운트

정렬 기준: finishedAt DESC, gameId DESC (레이스 컨디션 방지)

저장 방식 (2가지 옵션):
A. 실시간 계산: finishedGames를 정렬 후 에이전트별 계산
B. 증분 업데이트: 게임 종료 시 AgentStats에 currentStreak 업데이트

→ Phase 1은 A (실시간 계산), 1000게임 초과 시 B로 전환
```

### 7.3 Survival Rate 계산
```
생존율 = (게임 종료 시 생존한 게임 수) / (총 참가 게임 수)

- 역할 무관 (임포스터든 크루든)
- isAlive=true인 경우 생존
```

---

## 8. 기존 데이터 처리

### 8.1 방안: 새 게임부터 적용

- 기존 `finished-games.jsonl`은 killEvents 없음
- 마이그레이션 비용 대비 효과 낮음 (킬러 정보 복구 불가)
- **결정: 새 게임부터 killEvents 저장, 기존 데이터는 kills=0 처리**

### 8.2 하위 호환성
```typescript
// killEvents가 없는 기존 데이터 처리
const kills = record.killEvents?.length ?? 0;
```

---

## 9. 캐싱 전략

### 9.1 Phase 1: 간단한 메모리 캐시
```typescript
// stats/cache.ts
interface StatsCache {
  leaderboard: Map<string, { data: any; expiresAt: number }>;
  summary: { data: any; expiresAt: number } | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCachedOrCompute(key: string, computeFn: () => any) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const data = computeFn();
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  return data;
}
```

### 9.2 캐시 무효화
- 게임 종료 시 캐시 클리어
- 또는 TTL 기반 자동 만료 (5분)

### 9.3 Phase 2+ (성능 이슈 시)
- AgentStats 증분 업데이트 테이블
- Redis 또는 파일 기반 영구 캐시

---

## 10. 보안 요구사항

### 10.1 입력 검증
```typescript
// 에이전트명 화이트리스트 검증 (Path Traversal 방지)
const VALID_AGENTS = [
  "Agent-Alpha", "Agent-Bravo", "Agent-Charlie", "Agent-Delta",
  "Agent-Echo", "Agent-Foxtrot", "Agent-Golf", "Agent-Hotel",
  // ... BOT_NAMES 배열 참조
];

if (!VALID_AGENTS.includes(name)) {
  return res.status(400).json({ error: { code: "INVALID_AGENT_NAME" } });
}

// limit 검증
const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
```

### 10.2 Rate Limiting
```typescript
// 통계 API 전용 rate limit (express-rate-limit 사용)
const statsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 30, // 분당 30회
  message: { error: { code: "RATE_LIMIT_EXCEEDED" } }
});

app.use("/api/stats", statsLimiter);
```

### 10.3 Feature Flag
```typescript
// 환경변수로 통계 API on/off
const STATS_API_ENABLED = process.env.STATS_API_ENABLED !== "false";

if (!STATS_API_ENABLED) {
  app.use("/api/stats", (_req, res) => {
    res.status(503).json({ error: { code: "SERVICE_DISABLED" } });
  });
}
```

---

## 11. 에러 응답 포맷

```typescript
// 에러 응답 표준
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// 전체 에러 코드
// 400: INVALID_METRIC, INVALID_PERIOD, INVALID_LIMIT, INVALID_AGENT_NAME
// 404: AGENT_NOT_FOUND
// 429: RATE_LIMIT_EXCEEDED
// 500: INTERNAL_ERROR
// 503: SERVICE_DISABLED, SERVICE_UNAVAILABLE
```

---

## 11. 검토 요청사항 (Coder/Auditor/Worker)

### Coder
- [ ] 구현 복잡도 예상치
- [ ] 기존 코드와 충돌 가능성
- [ ] 예상 작업 시간

### Auditor  
- [ ] 보안 취약점 (injection, DoS 등)
- [ ] 데이터 정합성 이슈
- [ ] 에러 핸들링 충분한지

### Worker
- [ ] 배포 시 주의사항
- [ ] 모니터링 필요 항목
- [ ] 롤백 계획

---

## 12. 롤백 계획

| 시나리오 | 액션 |
|----------|------|
| API 버그 | `STATS_API_ENABLED=false` 설정 후 재시작 |
| 성능 이슈 | 캐시 TTL 증가 또는 캐시 비활성화 |
| 데이터 손상 | 기존 finished-games.jsonl 백업에서 복구 |

---

## 13. 배포 체크리스트

### 배포 전
- [ ] 게임 진행 중 아닌지 확인 (유휴 시간대 배포)
- [ ] finished-games.jsonl 백업
- [ ] feature branch에서 테스트 완료

### 배포 순서
1. killEvents + deathCause 저장 코드 배포
2. 통계 API 엔드포인트 배포
3. 모니터링 확인 (응답시간, 에러율)
4. Twitter 크론 연동 (별도 PR)

### 배포 후
- [ ] `/api/stats/summary` 응답 확인
- [ ] 에러 로그 모니터링 (10분)
- [ ] 메모리 사용량 확인

---

**상태**: ✅ 검토 완료, 구현 착수
