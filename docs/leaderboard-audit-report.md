# Staking Leaderboard Code Audit Report

> **감사일:** 2026-02-12  
> **감사자:** OpenClaw Auditor  
> **대상:** Prescio Staking Leaderboard Feature  
> **버전:** 1.0  

---

## 📊 요약

| 심각도 | 개수 |
|--------|------|
| 🔴 Critical | 0 |
| 🟠 High | 3 |
| 🟡 Medium | 7 |
| 🟢 Low | 8 |

**전체 평가:** 코드는 전반적으로 잘 작성되었으며, 심각한 보안 취약점은 발견되지 않았습니다. 그러나 데이터 페칭 효율성과 일부 타입 안전성 개선이 필요합니다.

---

## 🔴 Critical Issues (0)

없음 - 즉시 수정이 필요한 심각한 보안 취약점은 발견되지 않았습니다.

---

## 🟠 High Priority Issues (3)

### H-1: 비효율적인 Multicall 구조 및 중복 데이터 페칭

**위치:** `src/hooks/useLeaderboard.ts`, `src/components/leaderboard/LeaderboardPage.tsx`

**문제:**
1. `useLeaderboard` 훅이 3단계 multicall을 수행 (주소 → stakes → tier/weight)
2. `LeaderboardPage`에서 `useLeaderboard`를 2회 호출 (일반 데이터 + Top 3)
3. `useMyRank`에서 `useAllStakers`를 별도 호출하여 동일한 데이터 중복 페칭

**영향:** 
- RPC 요청 증가로 인한 비용 상승
- 초기 로딩 시간 증가
- Rate limiting 위험

**수정 제안:**

```typescript
// src/hooks/useLeaderboard.ts
// 개선: 단일 소스로 데이터를 관리하고 필터링만 훅에서 처리

// 1. 전역 캐시를 활용한 단일 데이터 소스
const leaderboardQueryKey = ['leaderboard', 'all'] as const;

export function useLeaderboardData() {
  return useQuery({
    queryKey: leaderboardQueryKey,
    queryFn: fetchAllStakersWithMulticall,
    refetchInterval: LEADERBOARD_REFRESH_INTERVAL,
    staleTime: LEADERBOARD_REFRESH_INTERVAL / 2,
  });
}

// 2. 필터/페이지네이션은 훅 레벨에서 처리
export function useLeaderboard(options: UseLeaderboardOptions = {}) {
  const { data: allStakers, isLoading } = useLeaderboardData();
  
  // 필터, 정렬, 페이지네이션 로직...
  const processedData = useMemo(() => {
    // 한 번 가져온 데이터로 모든 처리
  }, [allStakers, options]);
  
  return processedData;
}
```

```typescript
// src/components/leaderboard/LeaderboardPage.tsx
// 개선: 단일 훅 호출 후 데이터 분리

export function LeaderboardPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<TierLevel | null>(null);
  
  // 단일 훅 호출
  const leaderboardResult = useLeaderboard({
    page: currentPage,
    pageSize: 50,
    tierFilter,
    includeUnfiltered: true, // Top 3용 원본 데이터 포함
  });
  
  const { 
    paginatedStakers, 
    allStakers,  // 필터 없는 전체 데이터
    totalStakers, 
    // ...
  } = leaderboardResult;
  
  // Top 3는 allStakers에서 추출
  const topStakers = useMemo(() => allStakers.slice(0, 3), [allStakers]);
  
  // ...
}
```

---

### H-2: 에러 핸들링 누락

**위치:** `src/hooks/useLeaderboard.ts` (line 193)

**문제:**
```typescript
// 현재 코드: 에러가 항상 null로 반환됨
return {
  // ...
  error: null,  // ❌ 실제 에러 상태를 무시
  refetch,
};
```

**영향:**
- multicall 실패 시 사용자에게 피드백 없음
- 부분적 데이터 실패 시 무시됨
- 디버깅 어려움

**수정 제안:**

```typescript
// src/hooks/useLeaderboard.ts
export function useLeaderboard(options: UseLeaderboardOptions = {}): UseLeaderboardResult {
  // ... 기존 코드 ...

  // 에러 상태 수집
  const error = useMemo(() => {
    if (stakerAddressError) return stakerAddressError;
    if (stakeDataError) return stakeDataError;
    if (epochError) return epochError;
    return null;
  }, [stakerAddressError, stakeDataError, epochError]);

  // 부분 실패 처리
  const hasPartialFailure = useMemo(() => {
    if (!stakeDataResults) return false;
    return stakeDataResults.some(r => r.status === 'failure');
  }, [stakeDataResults]);

  return {
    // ...
    error,
    hasPartialFailure,
    failedCount: stakeDataResults?.filter(r => r.status === 'failure').length ?? 0,
    refetch,
  };
}
```

```typescript
// src/components/leaderboard/LeaderboardPage.tsx
// 에러 상태 표시 추가
{error && (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-5 h-5 text-red-400" />
      <p className="text-red-400">Failed to load leaderboard data. Please try again.</p>
    </div>
    <Button onClick={refetch} variant="ghost" size="sm" className="mt-2">
      Retry
    </Button>
  </div>
)}
```

---

### H-3: Tier 로직 불일치 가능성

**위치:** `src/lib/leaderboard/constants.ts`, `src/lib/leaderboard/utils.ts`

**문제:**
클라이언트 측 `getTierFromAmount()`와 컨트랙트의 `getTier()` 반환값이 불일치할 수 있음.

```typescript
// constants.ts - 클라이언트 측 계산
export function getTierFromAmount(amount: bigint): TierInfo | null {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (amount >= TIERS[i].minStake) {
      return TIERS[i];
    }
  }
  return null;  // 티어 없음 = null
}

// 컨트랙트에서는 TierLevel enum (0-4) 반환
// 만약 컨트랙트 로직이 변경되면 불일치 발생
```

**영향:**
- UI에 표시되는 티어와 실제 보상 배수 불일치
- 사용자 혼란 및 잘못된 예상 리워드 표시

**수정 제안:**

```typescript
// 1. 컨트랙트 데이터를 항상 신뢰할 것
// src/components/leaderboard/MyRankCard.tsx

// ❌ 현재: 클라이언트 계산 혼용
const tierInfo = nextTierProgress?.currentTier;

// ✅ 개선: 컨트랙트 tier를 우선 사용
const tierInfo = myRank ? TIER_MAP[myRank.tier] : null;
```

```typescript
// 2. utils.ts의 getTierProgress 함수 개선
export function getTierProgress(
  currentAmount: bigint,
  contractTier?: TierLevel  // 컨트랙트에서 가져온 실제 티어
): { /* ... */ } {
  // 컨트랙트 티어가 있으면 우선 사용
  const currentTier = contractTier !== undefined 
    ? TIER_MAP[contractTier]
    : getTierFromAmount(currentAmount);
  
  // ...
}
```

---

## 🟡 Medium Priority Issues (7)

### M-1: 타입 안전성 - 하드코딩된 ChainId 캐스팅

**위치:** `src/hooks/useLeaderboard.ts` (line 8), `src/hooks/useMyRank.ts` (line 8)

**문제:**
```typescript
// 하드코딩된 리터럴 타입 캐스팅
const CHAIN_ID = MONAD_MAINNET_CHAIN_ID as 143;
```

**수정 제안:**
```typescript
// src/lib/wagmi.ts에서 타입을 export
export const MONAD_MAINNET_CHAIN_ID = 143 as const;
export type MonadChainId = typeof MONAD_MAINNET_CHAIN_ID;

// 훅에서 사용
import { MONAD_MAINNET_CHAIN_ID, type MonadChainId } from '@/lib/wagmi';
const CHAIN_ID: MonadChainId = MONAD_MAINNET_CHAIN_ID;
```

---

### M-2: LeaderboardTable 검색 범위 제한

**위치:** `src/components/leaderboard/LeaderboardTable.tsx` (line 33-37)

**문제:**
```typescript
// 현재: 페이지네이션된 데이터에서만 검색
const filteredStakers = searchQuery
  ? stakers.filter((s) =>  // ← stakers는 이미 페이지네이션됨
      s.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : stakers;
```

**수정 제안:**
```typescript
interface LeaderboardTableProps {
  stakers: StakerInfo[];
  allStakers: StakerInfo[];  // 전체 데이터 추가
  // ...
  onSearch: (query: string) => void;  // 검색을 부모로 위임
}

// 또는 검색 시 서버/인덱서 쿼리 사용
```

---

### M-3: 미사용 파라미터

**위치:** `src/lib/leaderboard/utils.ts`

**문제:**
```typescript
// line 36: _totalStakers 미사용
export function getFOMOMessage(rank: number, _totalStakers: number): string {
  // _totalStakers가 사용되지 않음
}

// line 47: currentTierLevel 미사용
export function getTierProgressMessage(
  currentAmount: bigint,
  currentTierLevel: TierLevel  // 사용되지 않음
): string | null {
```

**수정 제안:**
```typescript
// 불필요한 파라미터 제거 또는 활용
export function getFOMOMessage(rank: number): string {
  if (rank === 1) {
    return "🏆 당신이 1등입니다!";
  }
  return `📊 당신보다 ${(rank - 1).toLocaleString()}명이 더 많이 스테이킹 중`;
}
```

---

### M-4: EpochCountdown 리렌더링 최적화

**위치:** `src/components/leaderboard/LeaderboardStats.tsx` (line 17-38)

**문제:**
부모 컴포넌트 리렌더링 시 EpochCountdown이 불필요하게 재생성됨.

**수정 제안:**
```typescript
import { memo } from 'react';

const EpochCountdown = memo(function EpochCountdown({ 
  epochEndTime 
}: { 
  epochEndTime: bigint 
}) {
  // ... 기존 로직
});

// displayName 설정 (DevTools에서 디버깅 용이)
EpochCountdown.displayName = 'EpochCountdown';
```

---

### M-5: 빈 refetch 콜백

**위치:** `src/hooks/useLeaderboard.ts` (line 188-190)

**문제:**
```typescript
const refetch = useCallback(() => {
  // Refetch is handled by react-query refetchInterval
}, []);  // 빈 함수
```

**수정 제안:**
```typescript
const refetch = useCallback(() => {
  // 실제 refetch 기능 구현
  queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
}, [queryClient]);
```

---

### M-6: 하드코딩된 Epoch Duration

**위치:** `src/components/leaderboard/LeaderboardPage.tsx` (line 12)

**문제:**
```typescript
const EPOCH_DURATION = 7n * 24n * 60n * 60n; // 하드코딩
```

**수정 제안:**
```typescript
// 컨트랙트에서 가져오거나, 상수 파일에서 관리
import { EPOCH_DURATION_SECONDS } from '@/lib/leaderboard/constants';

// 또는 컨트랙트에 epochDuration view 함수가 있다면:
const { data: epochDuration } = useReadContract({
  // ...
  functionName: 'epochDuration',
});
```

---

### M-7: 접근성(A11y) 부족

**위치:** 여러 컴포넌트

**문제:**
- 테이블에 `aria-label` 누락
- 색상만으로 티어 구분 (색맹 사용자 고려 필요)
- 키보드 네비게이션 지원 부족

**수정 제안:**
```tsx
// LeaderboardTable.tsx
<table 
  className="w-full" 
  role="table" 
  aria-label="Staking Leaderboard"
>
  <thead>
    <tr role="row">
      <th scope="col" aria-sort="ascending">Rank</th>
      {/* ... */}
    </tr>
  </thead>
  {/* ... */}
</table>

// TierBadge.tsx - 아이콘과 텍스트 모두 표시
<span 
  className={/* ... */}
  role="status"
  aria-label={`${tierInfo.name} tier`}
>
  <span aria-hidden="true">{tierInfo.icon}</span>
  <span>{tierInfo.name}</span>
</span>
```

---

## 🟢 Low Priority Issues (8)

### L-1: 중복 유틸리티 함수

**위치:** `src/lib/leaderboard/utils.ts`, `src/App.tsx`

- `maskAddress` (utils.ts) vs `truncateAddress` (App.tsx) - 동일 기능
- `formatFullNumber` 중복 정의

**수정:** 공통 유틸리티로 통합

---

### L-2: 일관되지 않은 에러 메시지 언어

**위치:** 전체

- 한국어: "당신이 1등입니다", "최고 티어 달성"
- 영어: "Connect wallet to see your rank", "No stakers yet"

**수정:** 언어 일관성 유지 또는 i18n 적용

---

### L-3: Top 3 배열 하드코딩

**위치:** `src/lib/leaderboard/constants.ts` (line 59-63)

```typescript
export const TOP_RANKER_POSITIONS = [
  { rank: 1, icon: "🥇", /* ... */ },
  { rank: 2, icon: "🥈", /* ... */ },
  { rank: 3, icon: "🥉", /* ... */ },
];
```

**개선:** 배열 길이 상수화 `TOP_RANKER_COUNT = 3`

---

### L-4: 매직 넘버

**위치:** 여러 곳

- `52n` (최대 에폭 수) - 상수로 추출
- `0.0001` (최소 MON 표시) - 상수로 추출
- 페이지 사이즈 `50` - 이미 상수화됨 ✅

---

### L-5: 테스트 커버리지 부재

**문제:** 유닛 테스트 파일 없음

**수정 제안:**
```
src/lib/leaderboard/__tests__/
├── utils.test.ts
├── constants.test.ts
└── hooks.test.ts
```

---

### L-6: 모바일 터치 인터랙션

**위치:** `src/components/leaderboard/TopRankerShowcase.tsx`

```typescript
className={`
  // ...
  transition-all hover:scale-[1.02]  // hover만 있음
`}
```

**수정:** `active:scale-[0.98]` 추가

---

### L-7: Console 로깅 부재

**문제:** 개발/디버깅용 로깅 없음

**수정:** 개발 환경에서만 동작하는 로거 추가

---

### L-8: 코드 주석 부족

**위치:** 복잡한 로직이 있는 곳

**수정:** JSDoc 또는 인라인 주석 추가

---

## ✅ 잘 구현된 부분

1. **TypeScript 타입 정의**
   - `types.ts`에 명확한 인터페이스 정의
   - Enum 사용으로 티어 레벨 타입 안전성 확보

2. **컴포넌트 구조**
   - 관심사 분리가 잘 됨 (lib / hooks / components)
   - Barrel exports로 깔끔한 import

3. **메모이제이션**
   - `useMemo` 적절히 사용
   - 정렬/필터링 로직 최적화됨

4. **로딩 상태 처리**
   - 각 컴포넌트별 로딩 스켈레톤
   - Background refresh 인디케이터

5. **반응형 디자인**
   - 모바일/데스크톱 레이아웃 분리
   - 테이블 → 카드 전환

6. **보안**
   - XSS: React의 기본 이스케이핑으로 방지됨
   - 지갑 주소 마스킹 처리
   - dangerouslySetInnerHTML 사용 없음

---

## 📋 권장 수정 우선순위

| 순위 | 이슈 | 예상 소요 |
|------|------|----------|
| 1 | H-1: Multicall 최적화 | 4-6시간 |
| 2 | H-2: 에러 핸들링 | 2-3시간 |
| 3 | H-3: Tier 로직 통일 | 1-2시간 |
| 4 | M-2: 검색 범위 수정 | 2시간 |
| 5 | M-4: 리렌더링 최적화 | 1시간 |
| 6 | 나머지 Medium | 각 30분-1시간 |
| 7 | Low priority | 필요시 |

---

## 🔧 즉시 적용 가능한 Quick Fixes

```typescript
// 1. utils.ts - 미사용 파라미터 제거
export function getFOMOMessage(rank: number): string {
  if (rank === 1) return "🏆 당신이 1등입니다!";
  return `📊 당신보다 ${(rank - 1).toLocaleString()}명이 더 많이 스테이킹 중`;
}

// 2. EpochCountdown memo 적용
import { memo } from 'react';
const EpochCountdown = memo(function EpochCountdown(/* ... */) {
  // ...
});

// 3. 상수 추출
// constants.ts
export const MAX_CLAIM_EPOCHS = 52n;
export const EPOCH_DURATION_SECONDS = 7n * 24n * 60n * 60n;
export const TOP_RANKER_COUNT = 3;
```

---

**감사 완료일:** 2026-02-12  
**다음 감사 권장일:** 주요 기능 변경 시 또는 3개월 후
