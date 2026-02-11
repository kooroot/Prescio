import { useState, useMemo } from "react";
import { useAccount, useConnect, useReadContract, useReadContracts } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  Loader2,
  Zap,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Contract Config
// ─────────────────────────────────────────────────────────────────────────────

const STAKING_CONTRACT_ADDRESS = "0xa0742ffb1762FF3EA001793aCBA202f82244D983" as const;
const PRESCIO_TOKEN_ADDRESS = "0xffC86Ab0C36B0728BbF52164f6319762DA867777" as const;
const MONAD_MAINNET_CHAIN_ID = 143;

// ERC20 balanceOf ABI
const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Minimal ABI for reading staking data
const STAKING_ABI = [
  {
    inputs: [],
    name: "totalStaked",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getStakerCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "stakes",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockEnd", type: "uint256" },
      { internalType: "uint8", name: "lockType", type: "uint8" },
      { internalType: "uint256", name: "startTime", type: "uint256" },
      { internalType: "uint256", name: "lastClaimEpoch", type: "uint256" },
      { internalType: "uint256", name: "lastPrescioClaimEpoch", type: "uint256" },
      { internalType: "uint256", name: "firstEligibleEpoch", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getTier",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getPendingRewards",
    outputs: [
      { internalType: "uint256", name: "monRewards", type: "uint256" },
      { internalType: "uint256", name: "prescioRewards", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getUserWeight",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "currentEpoch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface TierInfo {
  name: string;
  minStake: bigint;
  bettingBoost: number;
  colorClass: string;
  bgClass: string;
  progressColor: string;
}

// Updated tier thresholds: Bronze 5M, Silver 20M, Gold 50M, Diamond 150M
const TIERS: TierInfo[] = [
  {
    name: "Bronze",
    minStake: parseEther("5000000"),
    bettingBoost: 1.1,
    colorClass: "text-amber-600",
    bgClass: "tier-bronze",
    progressColor: "bg-amber-600",
  },
  {
    name: "Silver",
    minStake: parseEther("20000000"),
    bettingBoost: 1.25,
    colorClass: "text-gray-400",
    bgClass: "tier-silver",
    progressColor: "bg-gray-400",
  },
  {
    name: "Gold",
    minStake: parseEther("50000000"),
    bettingBoost: 1.5,
    colorClass: "text-yellow-400",
    bgClass: "tier-gold",
    progressColor: "bg-yellow-400",
  },
  {
    name: "Diamond",
    minStake: parseEther("150000000"),
    bettingBoost: 2.0,
    colorClass: "text-cyan-400",
    bgClass: "tier-diamond",
    progressColor: "bg-cyan-400",
  },
];

// Tier enum mapping from contract
const TIER_ENUM_MAP: Record<number, TierInfo | null> = {
  0: null, // NONE
  1: TIERS[0], // BRONZE
  2: TIERS[1], // SILVER
  3: TIERS[2], // GOLD
  4: TIERS[3], // DIAMOND
};

const UNSTAKE_PERIOD_DAYS = 7;
const EARLY_WITHDRAW_PENALTY = 5; // 5%

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hooks for Contract Data
// ─────────────────────────────────────────────────────────────────────────────

function useProtocolStats() {
  const { data: totalStaked, isLoading: isLoadingTotalStaked } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    chainId: MONAD_MAINNET_CHAIN_ID,
  });

  const { data: stakerCount, isLoading: isLoadingStakerCount } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getStakerCount",
    chainId: MONAD_MAINNET_CHAIN_ID,
  });

  return {
    totalStaked: totalStaked ?? 0n,
    stakerCount: stakerCount ?? 0n,
    isLoading: isLoadingTotalStaked || isLoadingStakerCount,
  };
}

function useUserStakeData(address: Address | undefined) {
  const { data: stakeData, isLoading: isLoadingStake } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "stakes",
    args: address ? [address] : undefined,
    chainId: MONAD_MAINNET_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const { data: tierData, isLoading: isLoadingTier } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getTier",
    args: address ? [address] : undefined,
    chainId: MONAD_MAINNET_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const { data: pendingRewards, isLoading: isLoadingRewards } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getPendingRewards",
    args: address ? [address] : undefined,
    chainId: MONAD_MAINNET_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const stakedAmount = stakeData?.[0] ?? 0n;
  const lockEnd = stakeData?.[1] ?? 0n;
  const lockType = stakeData?.[2] ?? 0;
  const startTime = stakeData?.[3] ?? 0n;
  const exists = stakeData?.[7] ?? false;

  const tier = tierData !== undefined ? TIER_ENUM_MAP[tierData] : null;

  const pendingMON = pendingRewards?.[0] ?? 0n;
  const pendingPRESCIO = pendingRewards?.[1] ?? 0n;

  return {
    stakedAmount,
    lockEnd,
    lockType,
    startTime,
    exists,
    tier,
    tierNumber: tierData ?? 0,
    pendingMON,
    pendingPRESCIO,
    isLoading: isLoadingStake || isLoadingTier || isLoadingRewards,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getCurrentTier(stakedAmount: bigint): TierInfo | null {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (stakedAmount >= TIERS[i].minStake) {
      return TIERS[i];
    }
  }
  return null;
}

function getNextTier(stakedAmount: bigint): TierInfo | null {
  for (const tier of TIERS) {
    if (stakedAmount < tier.minStake) {
      return tier;
    }
  }
  return null;
}

// Format number with commas, no abbreviation
function formatFullNumber(value: bigint): string {
  const num = Math.floor(parseFloat(formatEther(value)));
  return num.toLocaleString();
}

function formatCountdown(targetTime: number): string {
  const remaining = targetTime - Date.now();
  if (remaining <= 0) return "Ready";
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS for tier backgrounds (inject via style tag or add to global CSS)
// ─────────────────────────────────────────────────────────────────────────────

const tierStyles = `
  .tier-bronze { 
    background: linear-gradient(to bottom right, rgba(180, 83, 9, 0.15), rgba(146, 64, 14, 0.08));
    border-color: rgba(217, 119, 6, 0.35);
  }
  .tier-silver { 
    background: linear-gradient(to bottom right, rgba(156, 163, 175, 0.15), rgba(107, 114, 128, 0.08));
    border-color: rgba(156, 163, 175, 0.35);
  }
  .tier-gold { 
    background: linear-gradient(to bottom right, rgba(234, 179, 8, 0.15), rgba(202, 138, 4, 0.08));
    border-color: rgba(234, 179, 8, 0.35);
  }
  .tier-diamond { 
    background: linear-gradient(to bottom right, rgba(34, 211, 238, 0.15), rgba(6, 182, 212, 0.08));
    border-color: rgba(34, 211, 238, 0.35);
  }
  .tab-active { 
    background: rgba(110, 84, 255, 0.1);
    color: #6E54FF;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function ProtocolStats() {
  const { totalStaked, stakerCount, isLoading } = useProtocolStats();

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4">
        <p className="text-xs text-[#A1A1AA] mb-1">Total Staked</p>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#A1A1AA]" />
            <span className="text-[#A1A1AA]">Loading...</span>
          </div>
        ) : (
          <>
            <p className="text-xl font-semibold text-white">{formatFullNumber(totalStaked)}</p>
            <p className="text-xs text-[#A1A1AA]">PRESCIO</p>
          </>
        )}
      </div>
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4">
        <p className="text-xs text-[#A1A1AA] mb-1">Total Stakers</p>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#A1A1AA]" />
            <span className="text-[#A1A1AA]">Loading...</span>
          </div>
        ) : (
          <>
            <p className="text-xl font-semibold text-white">{Number(stakerCount).toLocaleString()}</p>
            <p className="text-xs text-[#A1A1AA]">Users</p>
          </>
        )}
      </div>
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4">
        <p className="text-xs text-[#A1A1AA] mb-1">Est. APR</p>
        <p className="text-xl font-semibold text-green-400">-</p>
        <p className="text-xs text-[#A1A1AA]">Variable</p>
      </div>
    </div>
  );
}

function MyPositionCard({ address }: { address: Address }) {
  const { stakedAmount, tier, isLoading } = useUserStakeData(address);
  
  const currentTier = tier ?? getCurrentTier(stakedAmount);
  const nextTier = getNextTier(stakedAmount);
  
  const progressToNext = nextTier
    ? Number((stakedAmount * 100n) / nextTier.minStake)
    : 100;
  
  const amountToNext = nextTier
    ? nextTier.minStake - stakedAmount
    : 0n;

  // Get tier-specific classes
  const tierBgClass = currentTier?.bgClass || "";
  const tierColorClass = currentTier?.colorClass || "text-gray-400";
  const progressColorClass = currentTier?.progressColor || "bg-gray-400";

  if (isLoading) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6E54FF]" />
      </div>
    );
  }

  return (
    <div className={`${tierBgClass} border rounded-xl p-6`}>
      <h2 className={`text-sm font-medium ${tierColorClass} opacity-80 uppercase tracking-wide mb-4`}>
        My Position
      </h2>
      
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-3xl font-bold text-white mb-1">{formatFullNumber(stakedAmount)}</p>
          <p className="text-sm text-[#A1A1AA]">PRESCIO Staked</p>
        </div>
        {currentTier && (
          <div className={`flex items-center gap-2 px-3 py-1.5 ${tierBgClass} border rounded-lg`}>
            <svg className={`w-4 h-4 ${tierColorClass}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span className={`text-sm font-medium ${tierColorClass}`}>{currentTier.name}</span>
          </div>
        )}
      </div>
      
      {/* Betting Boost */}
      <div className="flex items-center justify-between p-3 bg-[#6E54FF]/5 border border-[#6E54FF]/10 rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#6E54FF]" />
          <span className="text-sm text-[#A1A1AA]">Betting Boost</span>
        </div>
        <span className="text-sm font-semibold text-[#6E54FF]">
          {currentTier ? `${currentTier.bettingBoost}x` : "1x"} Max Bet
        </span>
      </div>
      
      {/* Progress to Next Tier */}
      {nextTier && (
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-[#A1A1AA]">Progress to {nextTier.name}</span>
            <span className={nextTier.colorClass}>{formatFullNumber(amountToNext)} more needed</span>
          </div>
          <div className={`h-1.5 ${currentTier ? currentTier.progressColor.replace('bg-', 'bg-opacity-30 bg-') : 'bg-gray-900/30'} rounded-full overflow-hidden`}>
            <div 
              className={`h-full ${progressColorClass} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(progressToNext, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TierBenefitsTable({ address }: { address?: Address }) {
  const { tier } = useUserStakeData(address);
  const currentTier = tier;
  
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-6">
      <h2 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">Tier Benefits</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#27272A]">
              <th className="text-left py-3 px-2 text-[#A1A1AA] font-medium">Tier</th>
              <th className="text-right py-3 px-2 text-[#A1A1AA] font-medium">Min Stake</th>
              <th className="text-right py-3 px-2 text-[#A1A1AA] font-medium">Bet Boost</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => {
              const isCurrentTier = currentTier?.name === t.name;
              return (
                <tr 
                  key={t.name}
                  className={`border-b border-[#27272A]/50 ${isCurrentTier ? 'bg-yellow-500/5' : ''}`}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className={t.colorClass}>● {t.name}</span>
                      {isCurrentTier && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-right py-3 px-2 font-mono text-white">
                    {formatFullNumber(t.minStake)}
                  </td>
                  <td className="text-right py-3 px-2 font-mono text-white">
                    {t.bettingBoost}x
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 pt-4 border-t border-[#27272A]">
        <p className="text-xs text-[#A1A1AA] mb-2">All tiers include:</p>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-[#0E100F] px-2 py-1 rounded text-white">MON rewards</span>
          <span className="text-xs bg-[#0E100F] px-2 py-1 rounded text-white">PRESCIO from penalties</span>
          <span className="text-xs bg-[#0E100F] px-2 py-1 rounded text-white">Governance voting</span>
        </div>
      </div>
    </div>
  );
}

function StakeUnstakeTabs({ address }: { address: Address }) {
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { stakedAmount, lockEnd, isLoading } = useUserStakeData(address);

  const hasPendingUnstake = false; // TODO: Implement pending unstake tracking
  const pendingUnstake = 0n;
  const unstakeEndTime = Number(lockEnd) * 1000;

  // Get user's PRESCIO balance from token contract
  const { data: prescioBalanceData } = useReadContract({
    address: PRESCIO_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
    chainId: MONAD_MAINNET_CHAIN_ID,
  });
  const prescioBalance = prescioBalanceData ?? 0n;

  const handleAction = async () => {
    setIsProcessing(true);
    // TODO: Call contract stake/unstake
    setTimeout(() => setIsProcessing(false), 2000);
  };

  const setPresetAmount = (value: number) => {
    setAmount(value.toLocaleString());
  };

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl">
      {/* Tab Headers */}
      <div className="flex border-b border-[#27272A]">
        <button
          onClick={() => setActiveTab("stake")}
          className={`flex-1 py-3 text-sm font-medium text-center rounded-tl-xl transition-colors ${
            activeTab === "stake" 
              ? "tab-active" 
              : "text-[#A1A1AA] hover:text-white"
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => setActiveTab("unstake")}
          className={`flex-1 py-3 text-sm font-medium text-center rounded-tr-xl transition-colors ${
            activeTab === "unstake" 
              ? "tab-active" 
              : "text-[#A1A1AA] hover:text-white"
          }`}
        >
          Unstake
        </button>
      </div>
      
      {/* Stake Content */}
      {activeTab === "stake" && (
        <div className="p-4 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1AA]">Available</span>
            <span className="font-mono text-white">{formatFullNumber(prescioBalance)} PRESCIO</span>
          </div>
          
          <div className="relative">
            <Input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#0E100F] border-[#27272A] rounded-lg px-4 py-3 text-lg font-mono text-white focus:border-[#6E54FF] focus:ring-0"
            />
            <button 
              onClick={() => setAmount(formatEther(prescioBalance))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6E54FF] font-medium hover:text-[#9B87FF]"
            >
              MAX
            </button>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setPresetAmount(5000000)} className="flex-1 py-1.5 text-xs border border-[#27272A] rounded hover:border-[#6E54FF]/50 text-white">5M</button>
            <button onClick={() => setPresetAmount(20000000)} className="flex-1 py-1.5 text-xs border border-[#27272A] rounded hover:border-[#6E54FF]/50 text-white">20M</button>
            <button onClick={() => setPresetAmount(50000000)} className="flex-1 py-1.5 text-xs border border-[#27272A] rounded hover:border-[#6E54FF]/50 text-white">50M</button>
            <button onClick={() => setPresetAmount(100000000)} className="flex-1 py-1.5 text-xs border border-[#27272A] rounded hover:border-[#6E54FF]/50 text-white">100M</button>
          </div>
          
          <Button
            onClick={handleAction}
            disabled={!amount || isProcessing}
            className="w-full py-3 bg-[#6E54FF] hover:bg-[#6E54FF]/90 text-white font-medium rounded-lg transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Staking...
              </>
            ) : (
              "Stake PRESCIO"
            )}
          </Button>
          
          <p className="text-xs text-[#A1A1AA] text-center">
            Unstaking requires a 7-day waiting period
          </p>
        </div>
      )}
      
      {/* Unstake Content */}
      {activeTab === "unstake" && (
        <div className="p-4 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1AA]">Staked</span>
            <span className="font-mono text-white">
              {isLoading ? "..." : formatFullNumber(stakedAmount)} PRESCIO
            </span>
          </div>
          
          {/* Pending Unstake */}
          {hasPendingUnstake && (
            <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-[#A1A1AA]">Pending</span>
                </div>
                <span className="text-sm font-mono text-white">{formatFullNumber(pendingUnstake)} PRESCIO</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#A1A1AA]">Unlocks in {formatCountdown(unstakeEndTime)}</span>
                <button className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Early withdraw (5% fee)
                </button>
              </div>
            </div>
          )}
          
          <div className="relative">
            <Input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#0E100F] border-[#27272A] rounded-lg px-4 py-3 text-lg font-mono text-white focus:border-[#6E54FF] focus:ring-0"
            />
            <button 
              onClick={() => setAmount(formatEther(stakedAmount))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-400 font-medium hover:text-orange-300"
            >
              MAX
            </button>
          </div>
          
          <Button
            onClick={handleAction}
            disabled={!amount || isProcessing}
            variant="outline"
            className="w-full py-3 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 font-medium rounded-lg transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Request Unstake"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function RewardsCard({ address }: { address: Address }) {
  const [isClaimingMON, setIsClaimingMON] = useState(false);
  const [isClaimingPRESCIO, setIsClaimingPRESCIO] = useState(false);
  
  const { pendingMON, pendingPRESCIO, isLoading } = useUserStakeData(address);

  const handleClaimMON = async () => {
    setIsClaimingMON(true);
    // TODO: Call contract claimMonRewards
    setTimeout(() => setIsClaimingMON(false), 2000);
  };

  const handleClaimPRESCIO = async () => {
    setIsClaimingPRESCIO(true);
    // TODO: Call contract claimPrescioRewards
    setTimeout(() => setIsClaimingPRESCIO(false), 2000);
  };

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4">
      <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">Rewards</h3>
      
      {/* MON Rewards */}
      <div className="p-3 border border-[#27272A] rounded-lg mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">M</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">MON</p>
              <p className="text-xs text-[#A1A1AA]">From betting fees</p>
            </div>
          </div>
          <div className="text-right">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#A1A1AA]" />
            ) : (
              <p className="text-sm font-mono font-medium text-white">
                {parseFloat(formatEther(pendingMON)).toFixed(4)} MON
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={handleClaimMON}
          disabled={isClaimingMON || pendingMON === 0n}
          className="w-full py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium rounded-lg transition-colors"
          variant="ghost"
        >
          {isClaimingMON ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim MON"}
        </Button>
      </div>
      
      {/* PRESCIO Rewards */}
      <div className="p-3 border border-[#27272A] rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#6E54FF]/20 flex items-center justify-center">
              <span className="text-xs font-bold text-[#6E54FF]">P</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">PRESCIO</p>
              <p className="text-xs text-[#A1A1AA]">From penalties</p>
            </div>
          </div>
          <div className="text-right">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#A1A1AA]" />
            ) : (
              <p className="text-sm font-mono font-medium text-white">
                {Math.floor(parseFloat(formatEther(pendingPRESCIO))).toLocaleString()} PRESCIO
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={handleClaimPRESCIO}
          disabled={isClaimingPRESCIO || pendingPRESCIO === 0n}
          className="w-full py-2 bg-[#6E54FF]/10 text-[#6E54FF] hover:bg-[#6E54FF]/20 text-sm font-medium rounded-lg transition-colors"
          variant="ghost"
        >
          {isClaimingPRESCIO ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim PRESCIO"}
        </Button>
      </div>
    </div>
  );
}

function WalletNotConnected({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-8 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-[#6E54FF]/10 flex items-center justify-center mx-auto mb-4">
        <Wallet className="w-6 h-6 text-[#6E54FF]" />
      </div>
      <h3 className="font-medium text-white mb-2">Connect Wallet</h3>
      <p className="text-sm text-[#A1A1AA] mb-4">Connect your wallet to stake and earn rewards</p>
      <Button
        onClick={onConnect}
        className="px-6 py-2 bg-[#6E54FF] hover:bg-[#6E54FF]/90 text-white text-sm font-medium rounded-lg"
      >
        Connect Wallet
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export function StakingPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const handleConnect = () => {
    connect({ connector: injected() });
  };

  return (
    <>
      {/* Inject tier styles */}
      <style>{tierStyles}</style>
      
      <div className="bg-[#0E100F] text-white min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#6E54FF]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#6E54FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Staking</h1>
            </div>
            <p className="text-[#A1A1AA] text-sm">Stake PRESCIO to boost betting limits and earn rewards</p>
          </div>

          {/* Protocol Stats */}
          <ProtocolStats />

          {/* Main Grid */}
          {isConnected && address ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left: Position & Tiers */}
              <div className="lg:col-span-2 space-y-6">
                <MyPositionCard address={address} />
                <TierBenefitsTable address={address} />
              </div>

              {/* Right: Actions */}
              <div className="space-y-6">
                <StakeUnstakeTabs address={address} />
                <RewardsCard address={address} />
              </div>
            </div>
          ) : (
            <WalletNotConnected onConnect={handleConnect} />
          )}
        </div>
      </div>
    </>
  );
}

export default StakingPage;
