# Prescio Staking Leaderboard 기획서

> **Version:** 1.0  
> **작성일:** 2026-02-12  
> **상태:** Draft  

---

## 1. 개요

### 1.1 목표
스테이킹한 유저들의 순위를 실시간으로 보여주고, 경쟁심과 FOMO를 유발하여 스테이킹 참여율을 높이는 리더보드 기능 구현

### 1.2 핵심 가치
- **투명성**: 온체인 데이터 기반 실시간 순위
- **동기부여**: 티어 승급을 위한 명확한 목표 제시
- **사회적 증거**: 다른 유저들의 스테이킹 활동 가시화
- **보상 기대**: 예상 리워드 계산으로 참여 유도

---

## 2. 리더보드 UI 구성

### 2.1 전체 레이아웃

```
┌────────────────────────────────────────────────────────────────┐
│  🏆 STAKING LEADERBOARD                        [실시간 업데이트] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              📊 리더보드 통계 요약                        │  │
│  │  Total Stakers: 1,234    Total Staked: 5.2B PRESCIO    │  │
│  │  Epoch Rewards: 100 MON + 500K PRESCIO   Epoch: #42    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               🎯 내 순위 카드 (하이라이트)                  │  │
│  │  #147 / 1,234     💎 Diamond     152,500,000 PRESCIO   │  │
│  │  예상 리워드: 0.8 MON + 4,050 PRESCIO                   │  │
│  │  📈 당신보다 146명이 더 많이 스테이킹 중                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    🏅 TOP 랭커 쇼케이스                   │  │
│  │  🥇 0x1a2b...3c4d  💎 Diamond  450,000,000  ≈2.5 MON   │  │
│  │  🥈 0x5e6f...7g8h  💎 Diamond  380,000,000  ≈2.1 MON   │  │
│  │  🥉 0x9i0j...1k2l  💎 Diamond  320,000,000  ≈1.8 MON   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    📋 전체 리더보드                        │  │
│  │  [티어 필터: All ▼]  [정렬: Amount ▼]  [검색: 0x...]     │  │
│  │                                                          │  │
│  │  #    지갑          티어      스테이킹       예상 리워드    │  │
│  │  ─────────────────────────────────────────────────────   │  │
│  │  1    0x1a...3c    💎Diamond  450,000,000   ≈2.5 MON    │  │
│  │  2    0x5e...7g    💎Diamond  380,000,000   ≈2.1 MON    │  │
│  │  3    0x9i...1k    💎Diamond  320,000,000   ≈1.8 MON    │  │
│  │  ...                                                     │  │
│  │  147  0xYO...UR    💎Diamond  152,500,000   ≈0.8 MON  ← │  │
│  │  ...                                                     │  │
│  │                                                          │  │
│  │  [< 이전]  Page 1 of 25  [다음 >]                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 컴포넌트 상세

#### 2.2.1 내 순위 카드 (MyRankCard)
| 요소 | 설명 |
|------|------|
| 순위 | 전체 스테이커 중 현재 순위 (#147 / 1,234) |
| 지갑 주소 | 마스킹된 주소 표시 (0x1a2b...3c4d) |
| 티어 배지 | 아이콘 + 색상 + 티어명 |
| 스테이킹 금액 | 풀 숫자 (콤마 포함) |
| 예상 리워드 | MON + PRESCIO 듀얼 표시 |
| FOMO 메시지 | "당신보다 X명이 더 많이 스테이킹 중" |

#### 2.2.2 TOP 랭커 쇼케이스 (TopRankerShowcase)
- **상위 3명** 특별 디자인
  - 🥇 Gold Crown (1등)
  - 🥈 Silver Crown (2등)
  - 🥉 Bronze Crown (3등)
- 애니메이션 효과: 순위 변동 시 슬라이드
- 실시간 업데이트 인디케이터

#### 2.2.3 전체 리더보드 테이블 (LeaderboardTable)
| 컬럼 | 타입 | 정렬 가능 |
|------|------|----------|
| 순위 (#) | number | ✓ |
| 지갑 주소 | string (마스킹) | ✓ |
| 티어 | enum + badge | ✓ |
| 스테이킹 금액 | bigint | ✓ |
| 가중치 (Weight) | bigint | ✓ |
| 예상 MON 리워드 | number | ✓ |
| 예상 PRESCIO 리워드 | number | ✓ |

### 2.3 티어별 시각 디자인

```css
/* 티어 색상 정의 */
Bronze:   #B45309 (amber-600)    - 테두리, 배경 그라데이션
Silver:   #9CA3AF (gray-400)     - 테두리, 배경 그라데이션
Gold:     #EAB308 (yellow-400)   - 테두리, 배경 그라데이션, 빛 효과
Diamond:  #22D3EE (cyan-400)     - 테두리, 배경 그라데이션, 반짝임 효과
```

#### 티어별 하이라이트 스타일
```typescript
const tierStyles = {
  bronze: {
    bg: 'bg-gradient-to-r from-amber-600/10 to-transparent',
    border: 'border-amber-600/30',
    badge: 'bg-amber-600/20 text-amber-500',
    glow: 'none'
  },
  silver: {
    bg: 'bg-gradient-to-r from-gray-400/10 to-transparent',
    border: 'border-gray-400/30',
    badge: 'bg-gray-400/20 text-gray-300',
    glow: 'none'
  },
  gold: {
    bg: 'bg-gradient-to-r from-yellow-400/10 to-transparent',
    border: 'border-yellow-400/30',
    badge: 'bg-yellow-400/20 text-yellow-400',
    glow: 'shadow-[0_0_15px_rgba(234,179,8,0.3)]'
  },
  diamond: {
    bg: 'bg-gradient-to-r from-cyan-400/10 to-transparent',
    border: 'border-cyan-400/30',
    badge: 'bg-cyan-400/20 text-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]'
  }
};
```

---

## 3. 예상 리워드 계산

### 3.1 계산 공식

현재 epoch의 리워드 풀을 유저의 가중치 비율에 따라 분배:

```typescript
// 유저의 예상 리워드 계산
interface RewardEstimate {
  monRewards: bigint;
  prescioRewards: bigint;
}

function calculateEstimatedRewards(
  userWeight: bigint,
  totalWeight: bigint,
  epochMonRewards: bigint,
  epochPrescioRewards: bigint
): RewardEstimate {
  if (totalWeight === 0n) {
    return { monRewards: 0n, prescioRewards: 0n };
  }
  
  return {
    monRewards: (epochMonRewards * userWeight) / totalWeight,
    prescioRewards: (epochPrescioRewards * userWeight) / totalWeight
  };
}
```

### 3.2 가중치 계산 (컨트랙트 기준)

티어별 보상 배수가 적용된 가중 스테이킹 수량:

```solidity
// 컨트랙트: PrescioStaking.sol
tierRewardMultiplierBps[0] = 10000;  // Bronze: 1.0x
tierRewardMultiplierBps[1] = 12500;  // Silver: 1.25x
tierRewardMultiplierBps[2] = 15000;  // Gold: 1.5x
tierRewardMultiplierBps[3] = 20000;  // Diamond: 2.0x

// 가중 스테이킹 = amount * multiplier / 10000
function _getWeightedAmount(uint256 _amount, uint8 _tier) internal view returns (uint256) {
    if (_amount == 0 || _tier == 0) return _amount;
    return (_amount * tierRewardMultiplierBps[_tier - 1]) / BPS_DENOMINATOR;
}
```

### 3.3 리워드 표시 형식

```typescript
// 듀얼 리워드 표시 컴포넌트
function RewardDisplay({ monRewards, prescioRewards }: RewardEstimate) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-purple-400">
        ≈{formatEther(monRewards).slice(0, 6)} MON
      </span>
      <span className="text-gray-500">+</span>
      <span className="text-blue-400">
        {formatNumber(prescioRewards)} PRESCIO
      </span>
    </div>
  );
}
```

---

## 4. FOMO 요소

### 4.1 순위 기반 메시지

```typescript
interface FOMOMessages {
  rankBased: (rank: number, total: number) => string;
  tierProgress: (current: Tier, next: Tier | null, amountNeeded: bigint) => string;
  recentActivity: (recentStakers: number) => string;
}

const fomoMessages: FOMOMessages = {
  // "당신보다 X명이 더 많이 스테이킹 중"
  rankBased: (rank, total) => {
    if (rank === 1) return "🏆 당신이 1등입니다!";
    return `📊 당신보다 ${rank - 1}명이 더 많이 스테이킹 중`;
  },
  
  // "Diamond 티어까지 X PRESCIO 남음"
  tierProgress: (current, next, amountNeeded) => {
    if (!next) return "🎉 최고 티어 달성!";
    return `💎 ${next.name} 티어까지 ${formatNumber(amountNeeded)} PRESCIO 남음`;
  },
  
  // "지난 24시간 동안 X명이 새로 스테이킹"
  recentActivity: (count) => {
    return `🔥 지난 24시간 동안 ${count}명이 새로 스테이킹!`;
  }
};
```

### 4.2 실시간 업데이트 애니메이션

```typescript
// 순위 변동 애니메이션
interface RankChangeAnimation {
  type: 'up' | 'down' | 'new' | 'none';
  delta: number;
}

// CSS 애니메이션 클래스
const rankChangeAnimations = {
  up: 'animate-slide-up bg-green-500/10',
  down: 'animate-slide-down bg-red-500/10',
  new: 'animate-pulse bg-purple-500/20',
  none: ''
};

// 새로운 스테이킹 발생 시 토스트 알림
function NewStakeToast({ address, amount, tier }: StakeEvent) {
  return (
    <div className="animate-slide-in-right">
      🎉 {maskAddress(address)}님이 {formatNumber(amount)} PRESCIO를 스테이킹!
    </div>
  );
}
```

### 4.3 티어 승급 알림

```typescript
// 티어 경계에 가까워지면 표시
function TierProgressBanner({ 
  currentAmount, 
  nextTierThreshold, 
  nextTierName 
}: TierProgressProps) {
  const progress = Number((currentAmount * 100n) / nextTierThreshold);
  const remaining = nextTierThreshold - currentAmount;
  
  if (progress >= 90) {
    return (
      <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 p-4 rounded-lg animate-pulse">
        <p className="text-lg font-bold">
          🔥 {nextTierName}까지 단 {formatNumber(remaining)} PRESCIO!
        </p>
        <p className="text-sm text-gray-400">
          지금 스테이킹하고 보상 배수를 높이세요!
        </p>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-cyan-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }
  return null;
}
```

---

## 5. 기술 스펙

### 5.1 온체인 데이터 소스

#### 컨트랙트 정보
- **Staking Contract:** `0xa0742ffb1762FF3EA001793aCBA202f82244D983`
- **Network:** Monad Mainnet (Chain ID: TBD)
- **Token:** PRESCIO (`0xffC86Ab0C36B0728BbF52164f6319762DA867777`)

#### 필요한 컨트랙트 함수

```typescript
// 1. 전체 스테이커 수
function getStakerCount() external view returns (uint256);

// 2. 인덱스로 스테이커 주소 조회 (배열 순회용)
function stakers(uint256 index) external view returns (address);

// 3. 특정 주소의 스테이킹 정보
function stakes(address user) external view returns (
  uint256 amount,
  uint256 lockEnd,
  uint8 lockType,
  uint256 startTime,
  uint256 lastClaimEpoch,
  uint256 lastPrescioClaimEpoch,
  uint256 firstEligibleEpoch,
  bool exists
);

// 4. 유저 티어 조회
function getTier(address user) external view returns (uint8);

// 5. 유저 가중치 조회
function getUserWeight(address user) external view returns (uint256);

// 6. 총 가중치
function totalWeight() external view returns (uint256);

// 7. 총 스테이킹량
function totalStaked() external view returns (uint256);

// 8. 현재 에폭 정보
function getCurrentEpochInfo() external view returns (
  uint256 epochNumber,
  uint256 monRewards,
  uint256 prescioRewards,
  uint256 weight,
  uint256 startTime,
  bool finalized
);

// 9. 유저 pending 리워드
function getPendingRewards(address user) external view returns (
  uint256 monRewards,
  uint256 prescioRewards
);
```

### 5.2 데이터 인덱싱 전략

#### Option A: 온체인 직접 조회 (소규모)
```typescript
// 스테이커 수가 적을 때 (< 1000명)
async function fetchAllStakers() {
  const count = await stakingContract.getStakerCount();
  const stakers: StakerInfo[] = [];
  
  for (let i = 0; i < count; i++) {
    const address = await stakingContract.stakers(i);
    const stake = await stakingContract.stakes(address);
    const tier = await stakingContract.getTier(address);
    const weight = await stakingContract.getUserWeight(address);
    
    stakers.push({
      address,
      amount: stake.amount,
      tier,
      weight
    });
  }
  
  return stakers.sort((a, b) => Number(b.amount - a.amount));
}
```

#### Option B: Multicall 최적화
```typescript
import { multicall } from '@wagmi/core';

async function fetchLeaderboard() {
  const count = await stakingContract.getStakerCount();
  
  // Batch 1: 모든 주소 가져오기
  const addressCalls = Array.from({ length: Number(count) }, (_, i) => ({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'stakers',
    args: [BigInt(i)]
  }));
  
  const addresses = await multicall(config, { contracts: addressCalls });
  
  // Batch 2: 모든 스테이킹 정보
  const stakeCalls = addresses.map(addr => ({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'stakes',
    args: [addr.result]
  }));
  
  // Batch 3: 모든 티어 & 가중치
  const tierCalls = addresses.map(addr => ({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getTier',
    args: [addr.result]
  }));
  
  const [stakes, tiers] = await Promise.all([
    multicall(config, { contracts: stakeCalls }),
    multicall(config, { contracts: tierCalls })
  ]);
  
  // 조합 및 정렬
  return addresses.map((addr, i) => ({
    address: addr.result,
    amount: stakes[i].result.amount,
    tier: tiers[i].result,
    // ...
  })).sort((a, b) => Number(b.amount - a.amount));
}
```

#### Option C: 인덱서 서비스 (대규모, 추천)
```typescript
// SubQuery 또는 The Graph 사용
const LEADERBOARD_QUERY = gql`
  query GetLeaderboard($first: Int!, $skip: Int!, $orderBy: String!) {
    stakers(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: desc
      where: { amount_gt: "0" }
    ) {
      id
      address
      amount
      tier
      weight
      stakedAt
      lastUpdated
    }
  }
`;

// 실시간 구독
const STAKING_EVENTS = gql`
  subscription OnStakingEvent {
    stakingEvents(orderBy: timestamp, orderDirection: desc, first: 10) {
      id
      type  # STAKE | UNSTAKE | TIER_CHANGE
      address
      amount
      tier
      timestamp
    }
  }
`;
```

### 5.3 프론트엔드 컴포넌트 구조

```
src/
├── components/
│   └── leaderboard/
│       ├── index.ts                    # 배럴 export
│       ├── LeaderboardPage.tsx         # 메인 페이지 컴포넌트
│       ├── LeaderboardStats.tsx        # 통계 요약 카드
│       ├── MyRankCard.tsx              # 내 순위 카드
│       ├── TopRankerShowcase.tsx       # TOP 3 쇼케이스
│       ├── LeaderboardTable.tsx        # 전체 리더보드 테이블
│       ├── LeaderboardRow.tsx          # 테이블 행 컴포넌트
│       ├── TierBadge.tsx               # 티어 배지
│       ├── RewardEstimate.tsx          # 예상 리워드 표시
│       ├── FOMOBanner.tsx              # FOMO 메시지 배너
│       ├── RankChangeIndicator.tsx     # 순위 변동 표시
│       └── NewStakeToast.tsx           # 새 스테이킹 알림
│
├── hooks/
│   └── leaderboard/
│       ├── useLeaderboard.ts           # 리더보드 데이터 훅
│       ├── useMyRank.ts                # 내 순위 조회 훅
│       ├── useEstimatedRewards.ts      # 예상 리워드 계산 훅
│       └── useStakingEvents.ts         # 실시간 이벤트 훅
│
├── lib/
│   └── leaderboard/
│       ├── types.ts                    # 타입 정의
│       ├── constants.ts                # 상수 (티어 정보 등)
│       ├── utils.ts                    # 유틸리티 함수
│       └── queries.ts                  # GraphQL 쿼리
│
└── styles/
    └── leaderboard.css                 # 리더보드 전용 스타일
```

### 5.4 타입 정의

```typescript
// lib/leaderboard/types.ts

export enum TierLevel {
  NONE = 0,
  BRONZE = 1,
  SILVER = 2,
  GOLD = 3,
  DIAMOND = 4
}

export interface TierInfo {
  level: TierLevel;
  name: string;
  minStake: bigint;
  bettingBoost: number;
  rewardMultiplier: number;
  colorClass: string;
  bgClass: string;
}

export interface StakerInfo {
  address: `0x${string}`;
  amount: bigint;
  tier: TierLevel;
  weight: bigint;
  rank: number;
  estimatedMON: bigint;
  estimatedPRESCIO: bigint;
}

export interface LeaderboardData {
  stakers: StakerInfo[];
  totalStakers: number;
  totalStaked: bigint;
  totalWeight: bigint;
  epochInfo: EpochInfo;
  lastUpdated: Date;
}

export interface EpochInfo {
  epochNumber: bigint;
  monRewards: bigint;
  prescioRewards: bigint;
  totalWeight: bigint;
  startTime: bigint;
  endTime: bigint;
  finalized: boolean;
}

export interface RankChange {
  type: 'up' | 'down' | 'new' | 'none';
  delta: number;
  timestamp: Date;
}
```

### 5.5 훅 구현 예시

```typescript
// hooks/leaderboard/useLeaderboard.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { multicall } from '@wagmi/core';

interface UseLeaderboardOptions {
  page?: number;
  pageSize?: number;
  tierFilter?: TierLevel | null;
  sortBy?: 'amount' | 'weight' | 'rank';
  refreshInterval?: number;
}

export function useLeaderboard(options: UseLeaderboardOptions = {}) {
  const {
    page = 1,
    pageSize = 50,
    tierFilter = null,
    sortBy = 'amount',
    refreshInterval = 30000 // 30초마다 갱신
  } = options;

  const queryClient = useQueryClient();

  // 전체 스테이커 수 조회
  const { data: stakerCount } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getStakerCount',
  });

  // 에폭 정보 조회
  const { data: epochInfo } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getCurrentEpochInfo',
  });

  // 리더보드 데이터 조회
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', tierFilter, sortBy],
    queryFn: async () => {
      if (!stakerCount) return null;
      
      // Multicall로 모든 데이터 조회
      const stakers = await fetchAllStakersWithMulticall(Number(stakerCount));
      
      // 정렬 및 필터링
      let filtered = stakers;
      if (tierFilter !== null) {
        filtered = stakers.filter(s => s.tier === tierFilter);
      }
      
      filtered.sort((a, b) => {
        if (sortBy === 'weight') return Number(b.weight - a.weight);
        return Number(b.amount - a.amount);
      });
      
      // 순위 부여
      return filtered.map((s, i) => ({ ...s, rank: i + 1 }));
    },
    enabled: !!stakerCount,
    refetchInterval: refreshInterval,
    staleTime: refreshInterval / 2,
  });

  // 페이지네이션
  const paginatedData = useMemo(() => {
    if (!leaderboardQuery.data) return [];
    const start = (page - 1) * pageSize;
    return leaderboardQuery.data.slice(start, start + pageSize);
  }, [leaderboardQuery.data, page, pageSize]);

  // 예상 리워드 계산
  const withRewards = useMemo(() => {
    if (!epochInfo || !paginatedData.length) return paginatedData;
    
    const [_, monRewards, prescioRewards, totalWeight] = epochInfo;
    
    return paginatedData.map(staker => ({
      ...staker,
      estimatedMON: totalWeight > 0n 
        ? (monRewards * staker.weight) / totalWeight 
        : 0n,
      estimatedPRESCIO: totalWeight > 0n
        ? (prescioRewards * staker.weight) / totalWeight
        : 0n
    }));
  }, [paginatedData, epochInfo]);

  return {
    stakers: withRewards,
    totalStakers: Number(stakerCount ?? 0),
    totalPages: Math.ceil((leaderboardQuery.data?.length ?? 0) / pageSize),
    currentPage: page,
    isLoading: leaderboardQuery.isLoading,
    error: leaderboardQuery.error,
    refetch: leaderboardQuery.refetch,
    epochInfo: epochInfo ? {
      epochNumber: epochInfo[0],
      monRewards: epochInfo[1],
      prescioRewards: epochInfo[2],
      totalWeight: epochInfo[3],
      startTime: epochInfo[4],
      finalized: epochInfo[5]
    } : null
  };
}
```

```typescript
// hooks/leaderboard/useMyRank.ts
export function useMyRank(address: `0x${string}` | undefined) {
  const { stakers, totalStakers, epochInfo } = useLeaderboard();
  
  const myRank = useMemo(() => {
    if (!address || !stakers.length) return null;
    
    const myStaker = stakers.find(
      s => s.address.toLowerCase() === address.toLowerCase()
    );
    
    if (!myStaker) return null;
    
    const stakersAbove = stakers.filter(s => s.amount > myStaker.amount).length;
    
    return {
      ...myStaker,
      rank: stakersAbove + 1,
      totalStakers,
      stakersAbove,
      percentile: ((totalStakers - stakersAbove) / totalStakers) * 100
    };
  }, [address, stakers, totalStakers]);

  // FOMO 메시지 생성
  const fomoMessage = useMemo(() => {
    if (!myRank) return null;
    
    if (myRank.rank === 1) {
      return "🏆 당신이 1등입니다! 왕좌를 지키세요!";
    }
    
    return `📊 당신보다 ${myRank.stakersAbove}명이 더 많이 스테이킹 중`;
  }, [myRank]);

  // 다음 티어까지 남은 금액
  const nextTierInfo = useMemo(() => {
    if (!myRank) return null;
    
    const nextTier = TIERS.find(t => t.minStake > myRank.amount);
    if (!nextTier) return null;
    
    return {
      tier: nextTier,
      amountNeeded: nextTier.minStake - myRank.amount,
      progress: Number((myRank.amount * 100n) / nextTier.minStake)
    };
  }, [myRank]);

  return {
    myRank,
    fomoMessage,
    nextTierInfo
  };
}
```

---

## 6. 구현 로드맵

### Phase 1: 기본 리더보드 (1주)
- [ ] 컴포넌트 구조 설계
- [ ] 온체인 데이터 조회 훅 구현
- [ ] 기본 리더보드 테이블 UI
- [ ] 티어 배지 및 스타일링
- [ ] 페이지네이션

### Phase 2: 내 순위 & 예상 리워드 (3일)
- [ ] MyRankCard 컴포넌트
- [ ] 예상 리워드 계산 로직
- [ ] 듀얼 리워드 표시

### Phase 3: FOMO 요소 (3일)
- [ ] FOMO 메시지 시스템
- [ ] 티어 승급 진행 바
- [ ] Top 3 쇼케이스

### Phase 4: 실시간 업데이트 (1주)
- [ ] 이벤트 리스너 구현
- [ ] 순위 변동 애니메이션
- [ ] 새 스테이킹 토스트
- [ ] 웹소켓/폴링 전략

### Phase 5: 성능 최적화 (3일)
- [ ] Multicall 최적화
- [ ] 캐싱 전략
- [ ] 가상 스크롤 (대규모 리스트)
- [ ] 인덱서 연동 (옵션)

---

## 7. 와이어프레임 설명

### 7.1 데스크톱 레이아웃

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header (기존 헤더 재사용)                                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     리더보드 통계 요약                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │
│  │  │ Total    │  │ Stakers  │  │ Epoch    │  │ Time     │      │  │
│  │  │ Staked   │  │          │  │ Rewards  │  │ Left     │      │  │
│  │  │ 5.2B     │  │ 1,234    │  │ 100 MON  │  │ 3d 12h   │      │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │      내 순위 카드        │  │        TOP 3 쇼케이스            │  │
│  │                         │  │                                 │  │
│  │  #147 / 1,234          │  │  🥇 0x1a2b...  450M   2.5 MON  │  │
│  │  💎 Diamond            │  │  🥈 0x5e6f...  380M   2.1 MON  │  │
│  │  152,500,000 PRESCIO   │  │  🥉 0x9i0j...  320M   1.8 MON  │  │
│  │                         │  │                                 │  │
│  │  ≈0.8 MON + 4,050 PRSC │  └─────────────────────────────────┘  │
│  │                         │                                       │
│  │  📊 당신보다 146명이...  │                                       │
│  │  💎 Diamond까지 완료!   │                                       │
│  └─────────────────────────┘                                       │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [All Tiers ▼]  [Sort: Amount ▼]            [🔍 Search...]   │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │  #    Address       Tier      Staked        Est. Rewards      │  │
│  │  ─────────────────────────────────────────────────────────────│  │
│  │  1    0x1a2b..3c4d  💎Diamond  450,000,000  ≈2.5 MON          │  │
│  │  2    0x5e6f..7g8h  💎Diamond  380,000,000  ≈2.1 MON          │  │
│  │  3    0x9i0j..1k2l  💎Diamond  320,000,000  ≈1.8 MON          │  │
│  │  4    0xmn4o..5p6q  🥇Gold     95,000,000   ≈0.5 MON          │  │
│  │  5    0xrs7t..8u9v  🥇Gold     78,000,000   ≈0.4 MON          │  │
│  │  ...                                                          │  │
│  │  147  0xYOUR..ADDR  💎Diamond  152,500,000  ≈0.8 MON    ← YOU │  │
│  │  ...                                                          │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │              [◀ Prev]  Page 1 of 25  [Next ▶]                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 모바일 레이아웃

```
┌──────────────────────────┐
│  🏆 Leaderboard    ≡     │
├──────────────────────────┤
│                          │
│  ┌────────────────────┐  │
│  │    내 순위 카드     │  │
│  │                    │  │
│  │  #147 / 1,234     │  │
│  │  💎 Diamond       │  │
│  │  152.5M PRESCIO   │  │
│  │                    │  │
│  │  ≈0.8 MON         │  │
│  │  +4,050 PRESCIO   │  │
│  │                    │  │
│  │  📊 146명이 더...   │  │
│  └────────────────────┘  │
│                          │
│  ┌────────────────────┐  │
│  │     TOP 3          │  │
│  │  🥇 0x1a.. 450M    │  │
│  │  🥈 0x5e.. 380M    │  │
│  │  🥉 0x9i.. 320M    │  │
│  └────────────────────┘  │
│                          │
│  [All ▼] [Amount ▼]      │
│                          │
│  ┌────────────────────┐  │
│  │ #1 💎 0x1a2b..3c4d │  │
│  │ 450,000,000 ≈2.5MON│  │
│  ├────────────────────┤  │
│  │ #2 💎 0x5e6f..7g8h │  │
│  │ 380,000,000 ≈2.1MON│  │
│  ├────────────────────┤  │
│  │ ...                │  │
│  ├────────────────────┤  │
│  │ #147 💎 YOU        │  │
│  │ 152,500,000 ≈0.8MON│  │
│  └────────────────────┘  │
│                          │
│  [◀]  1 / 25  [▶]        │
│                          │
└──────────────────────────┘
```

---

## 8. 참고 사항

### 8.1 티어 임계값 (현재 설정)

| 티어 | 최소 스테이킹 | 베팅 부스트 | 보상 배수 |
|------|--------------|------------|----------|
| Bronze | 5,000,000 PRESCIO | 1.1x | 1.0x |
| Silver | 20,000,000 PRESCIO | 1.25x | 1.25x |
| Gold | 50,000,000 PRESCIO | 1.5x | 1.5x |
| Diamond | 150,000,000 PRESCIO | 2.0x | 2.0x |

### 8.2 에폭 정보
- 에폭 기간: 7일
- 리워드: MON + PRESCIO 듀얼
- 가중치 기반 분배

### 8.3 주의사항
- 가스비 최적화를 위한 Multicall 필수
- 대규모 스테이커 수 대비 인덱서 고려
- 실시간 업데이트는 RPC 비용 고려하여 폴링 간격 조정

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-02-12 | 초안 작성 |
