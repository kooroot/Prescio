import { useState, useEffect, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther, type Address, maxUint256 } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Wallet,
  Loader2,
  Zap,
  Clock,
  AlertTriangle,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Copy,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { MONAD_MAINNET_CHAIN_ID, monadMainnet } from "@/lib/wagmi";

// ─────────────────────────────────────────────────────────────────────────────
// Contract Config
// ─────────────────────────────────────────────────────────────────────────────

const STAKING_CONTRACT_ADDRESS = "0xa0742ffb1762FF3EA001793aCBA202f82244D983" as const;
const PRESCIO_TOKEN_ADDRESS = "0xffC86Ab0C36B0728BbF52164f6319762DA867777" as const;

// ERC20 ABI (balanceOf, allowance, approve)
const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Staking contract ABI (read + write functions)
const STAKING_ABI = [
  // Read functions
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
  // Write functions
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint8", name: "lockType", type: "uint8" },
    ],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "maxEpochs", type: "uint256" }],
    name: "claimMonRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "maxEpochs", type: "uint256" }],
    name: "claimPrescioRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "maxEpochs", type: "uint256" }],
    name: "claimAllRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "emergencyUnstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Lock type enum (matches contract)
const LockType = {
  FLEXIBLE: 0,    // 7 days
  FIXED_14D: 1,   // 14 days
  FIXED_30D: 2,   // 30 days
  FIXED_60D: 3,   // 60 days
  FIXED_90D: 4,   // 90 days
} as const;

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

// Transaction status types
type TxStatus = "idle" | "approving" | "staking" | "unstaking" | "claiming" | "success" | "error";

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
  const { data: stakeData, isLoading: isLoadingStake, refetch: refetchStake } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "stakes",
    args: address ? [address] : undefined,
    chainId: MONAD_MAINNET_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const { data: tierData, isLoading: isLoadingTier, refetch: refetchTier } = useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: "getTier",
    args: address ? [address] : undefined,
    chainId: MONAD_MAINNET_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const { data: pendingRewards, isLoading: isLoadingRewards, refetch: refetchRewards } = useReadContract({
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

  const refetch = useCallback(() => {
    refetchStake();
    refetchTier();
    refetchRewards();
  }, [refetchStake, refetchTier, refetchRewards]);

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
    refetch,
  };
}

function useTokenAllowance(owner: Address | undefined, spender: Address) {
  const { data: allowance, refetch } = useReadContract({
    address: PRESCIO_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    chainId: MONAD_MAINNET_CHAIN_ID,
    query: {
      enabled: !!owner,
    },
  });

  return { allowance: allowance ?? 0n, refetch };
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

// Parse input string to bigint (handles commas and decimals)
function parseInputAmount(input: string): bigint {
  try {
    const cleanedInput = input.replace(/,/g, "").trim();
    if (!cleanedInput || cleanedInput === "0") return 0n;
    // Handle decimal places
    const parts = cleanedInput.split(".");
    if (parts.length > 2) return 0n;
    const wholePart = parts[0] || "0";
    const decimalPart = (parts[1] || "").padEnd(18, "0").slice(0, 18);
    return BigInt(wholePart) * BigInt(10 ** 18) + BigInt(decimalPart);
  } catch {
    return 0n;
  }
}

// Validate numeric input
function isValidNumericInput(value: string): boolean {
  // Allow empty, numbers, single decimal point, and commas
  return /^[0-9,]*\.?[0-9]*$/.test(value);
}

// Get user-friendly error message
function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error occurred";
  
  const errorStr = String(error);
  
  // Contract-specific errors
  if (errorStr.includes("AlreadyStaked")) return "You already have an active stake. Unstake first to stake again.";
  if (errorStr.includes("NoStakeFound")) return "No active stake found for your address.";
  if (errorStr.includes("StillLocked")) return "Your stake is still locked. Wait until the lock period ends.";
  if (errorStr.includes("FixedLockNoEarlyExit")) return "Fixed lock stakes cannot be unstaked early. Use Emergency Unstake (50% penalty).";
  if (errorStr.includes("ZeroAmount")) return "Amount cannot be zero.";
  if (errorStr.includes("InsufficientStake")) return "Insufficient stake amount.";
  if (errorStr.includes("NothingToClaim")) return "No rewards available to claim.";
  if (errorStr.includes("InsufficientPrescioBalance")) return "Insufficient PRESCIO balance in the contract for rewards.";
  if (errorStr.includes("insufficient allowance")) return "Token approval required. Please approve first.";
  if (errorStr.includes("transfer amount exceeds balance")) return "Insufficient PRESCIO balance.";
  if (errorStr.includes("user rejected")) return "Transaction was rejected by user.";
  if (errorStr.includes("User denied")) return "Transaction was rejected by user.";
  
  // Generic errors
  if (errorStr.includes("reverted")) return "Transaction reverted. Please check your input and try again.";
  
  return "Transaction failed. Please try again.";
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS for tier backgrounds
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

function NetworkSwitchBanner() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  
  if (chainId === MONAD_MAINNET_CHAIN_ID) return null;
  
  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          <div>
            <p className="text-sm font-medium text-orange-400">Wrong Network</p>
            <p className="text-xs text-orange-400/70">Please switch to Monad Mainnet to use staking</p>
          </div>
        </div>
        <Button
          onClick={() => switchChain({ chainId: MONAD_MAINNET_CHAIN_ID })}
          disabled={isPending}
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
              Switching...
            </>
          ) : (
            "Switch Network"
          )}
        </Button>
      </div>
    </div>
  );
}

function TransactionStatus({ 
  status, 
  errorMessage, 
  onDismiss 
}: { 
  status: TxStatus; 
  errorMessage?: string;
  onDismiss: () => void;
}) {
  if (status === "idle") return null;
  
  const statusConfig = {
    approving: { icon: Loader2, bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", textColor: "text-blue-400", text: "Approving tokens...", animate: true },
    staking: { icon: Loader2, bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", textColor: "text-blue-400", text: "Staking PRESCIO...", animate: true },
    unstaking: { icon: Loader2, bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", textColor: "text-blue-400", text: "Unstaking...", animate: true },
    claiming: { icon: Loader2, bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", textColor: "text-blue-400", text: "Claiming rewards...", animate: true },
    success: { icon: CheckCircle2, bgColor: "bg-green-500/10", borderColor: "border-green-500/30", textColor: "text-green-400", text: "Transaction successful!", animate: false },
    error: { icon: AlertCircle, bgColor: "bg-red-500/10", borderColor: "border-red-500/30", textColor: "text-red-400", text: errorMessage || "Transaction failed", animate: false },
  }[status];
  
  if (!statusConfig) return null;
  
  const Icon = statusConfig.icon;
  const { bgColor, borderColor, textColor } = statusConfig;
  
  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-3 mb-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${textColor} ${statusConfig.animate ? 'animate-spin' : ''}`} />
          <span className={`text-sm ${textColor}`}>{statusConfig.text}</span>
        </div>
        {(status === "success" || status === "error") && (
          <button 
            onClick={onDismiss}
            className={`text-xs ${textColor} hover:underline`}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

// Monad Explorer URL (mainnet)
const MONAD_EXPLORER_URL = "https://monadexplorer.com";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Header() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  const handleViewExplorer = () => {
    if (address) {
      window.open(`${MONAD_EXPLORER_URL}/address/${address}`, "_blank");
    }
  };

  return (
    <header className="border-b border-[#27272A] bg-[#0E100F]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="https://prescio.fun" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/prescio-icon.png" alt="Prescio" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-semibold text-white">Prescio</span>
          </a>
          <span className="text-[#A1A1AA] text-sm">/</span>
          <span className="text-white text-sm font-medium">Staking</span>
        </div>
        
        <div className="flex items-center gap-3">
          <a 
            href="https://prescio.fun" 
            className="px-4 py-2 bg-[#6E54FF] hover:bg-[#6E54FF]/90 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Back to App
          </a>
          
          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[#18181B] border-[#27272A] hover:bg-[#27272A] text-white"
                >
                  <Wallet className="w-4 h-4 mr-2 text-[#6E54FF]" />
                  {truncateAddress(address)}
                  <ChevronDown className="w-4 h-4 ml-2 text-[#A1A1AA]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#18181B] border-[#27272A]">
                <DropdownMenuLabel className="text-[#A1A1AA]">
                  Connected Wallet
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#27272A]" />
                <DropdownMenuItem
                  onClick={handleCopyAddress}
                  className="cursor-pointer text-white focus:bg-[#27272A] focus:text-white"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Address
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleViewExplorer}
                  className="cursor-pointer text-white focus:bg-[#27272A] focus:text-white"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Explorer
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#27272A]" />
                <DropdownMenuItem
                  onClick={() => disconnect()}
                  className="cursor-pointer text-red-400 focus:bg-[#27272A] focus:text-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => connect({ connector: injected() })}
              size="sm"
              className="bg-[#6E54FF] hover:bg-[#6E54FF]/90 text-white"
            >
              <Wallet className="w-4 h-4 mr-1" />
              Connect
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

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
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  const chainId = useChainId();
  const isCorrectNetwork = chainId === MONAD_MAINNET_CHAIN_ID;
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  
  const { stakedAmount, lockEnd, lockType, startTime, exists, isLoading, refetch: refetchStake } = useUserStakeData(address);
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(address, STAKING_CONTRACT_ADDRESS);

  // Get user's PRESCIO balance from token contract
  const { data: prescioBalanceData, refetch: refetchBalance } = useReadContract({
    address: PRESCIO_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
    chainId: MONAD_MAINNET_CHAIN_ID,
  });
  const prescioBalance = prescioBalanceData ?? 0n;

  // Write contract hooks
  const { writeContract: writeApprove, data: approveHash, isPending: isApproving, error: approveError } = useWriteContract();
  const { writeContract: writeStake, data: stakeHash, isPending: isStaking, error: stakeError } = useWriteContract();
  const { writeContract: writeUnstake, data: unstakeHash, isPending: isUnstaking, error: unstakeError } = useWriteContract();
  
  // Wait for transaction receipts
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isLoading: isUnstakeConfirming, isSuccess: isUnstakeSuccess } = useWaitForTransactionReceipt({ hash: unstakeHash });

  // Parse amount
  const parsedAmount = parseInputAmount(amount);
  const needsApproval = parsedAmount > 0n && allowance < parsedAmount;

  // Calculate if stake is still locked
  const isLocked = exists && Number(lockEnd) * 1000 > Date.now();
  const isFlexibleLock = lockType === LockType.FLEXIBLE;

  // Validation
  const validateStakeInput = (): string | null => {
    if (!amount || amount.trim() === "") return "Enter an amount";
    if (parsedAmount === 0n) return "Amount must be greater than 0";
    if (parsedAmount > prescioBalance) return "Insufficient balance";
    if (exists) return "Already staked. Unstake first.";
    return null;
  };

  const validateUnstakeInput = (): string | null => {
    if (!exists) return "No active stake";
    if (isLocked && !isFlexibleLock) return "Fixed lock - use Emergency Unstake";
    return null;
  };

  const stakeValidationError = validateStakeInput();
  const unstakeValidationError = validateUnstakeInput();

  // Handle input change with validation
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isValidNumericInput(value)) {
      setAmount(value);
    }
  };

  // Effect to handle approve success -> trigger stake
  useEffect(() => {
    if (isApproveSuccess && txStatus === "approving") {
      refetchAllowance();
      // Small delay to ensure allowance is updated
      setTimeout(() => {
        handleStakeAfterApproval();
      }, 500);
    }
  }, [isApproveSuccess]);

  // Effect to handle stake success
  useEffect(() => {
    if (isStakeSuccess) {
      setTxStatus("success");
      setAmount("");
      refetchBalance();
      refetchStake();
      refetchAllowance();
    }
  }, [isStakeSuccess]);

  // Effect to handle unstake success
  useEffect(() => {
    if (isUnstakeSuccess) {
      setTxStatus("success");
      setAmount("");
      refetchBalance();
      refetchStake();
    }
  }, [isUnstakeSuccess]);

  // Effect to handle errors
  useEffect(() => {
    if (approveError) {
      setTxStatus("error");
      setErrorMessage(getErrorMessage(approveError));
    }
  }, [approveError]);

  useEffect(() => {
    if (stakeError) {
      setTxStatus("error");
      setErrorMessage(getErrorMessage(stakeError));
    }
  }, [stakeError]);

  useEffect(() => {
    if (unstakeError) {
      setTxStatus("error");
      setErrorMessage(getErrorMessage(unstakeError));
    }
  }, [unstakeError]);

  // Update status based on pending states
  useEffect(() => {
    if (isApproving || isApproveConfirming) {
      setTxStatus("approving");
    } else if (isStaking || isStakeConfirming) {
      setTxStatus("staking");
    } else if (isUnstaking || isUnstakeConfirming) {
      setTxStatus("unstaking");
    }
  }, [isApproving, isApproveConfirming, isStaking, isStakeConfirming, isUnstaking, isUnstakeConfirming]);

  const handleStakeAfterApproval = () => {
    setTxStatus("staking");
    writeStake({
      address: STAKING_CONTRACT_ADDRESS,
      abi: STAKING_ABI,
      functionName: "stake",
      args: [parsedAmount, LockType.FLEXIBLE], // Default to flexible (7 days)
      chainId: MONAD_MAINNET_CHAIN_ID,
    });
  };

  const handleStake = async () => {
    if (stakeValidationError || !isCorrectNetwork) return;
    
    setErrorMessage("");
    
    if (needsApproval) {
      // Need to approve first
      setTxStatus("approving");
      writeApprove({
        address: PRESCIO_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [STAKING_CONTRACT_ADDRESS, maxUint256], // Approve max for better UX
        chainId: MONAD_MAINNET_CHAIN_ID,
      });
    } else {
      // Already approved, stake directly
      handleStakeAfterApproval();
    }
  };

  const handleUnstake = async () => {
    if (unstakeValidationError || !isCorrectNetwork) return;
    
    setErrorMessage("");
    setTxStatus("unstaking");
    
    writeUnstake({
      address: STAKING_CONTRACT_ADDRESS,
      abi: STAKING_ABI,
      functionName: "unstake",
      args: [],
      chainId: MONAD_MAINNET_CHAIN_ID,
    });
  };

  const dismissStatus = () => {
    setTxStatus("idle");
    setErrorMessage("");
  };

  const setPresetAmount = (value: number) => {
    setAmount(value.toLocaleString());
  };

  const setMaxAmount = () => {
    if (activeTab === "stake") {
      setAmount(formatEther(prescioBalance));
    } else {
      setAmount(formatEther(stakedAmount));
    }
  };

  const isProcessing = isApproving || isApproveConfirming || isStaking || isStakeConfirming || isUnstaking || isUnstakeConfirming;

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl">
      {/* Tab Headers */}
      <div className="flex border-b border-[#27272A]">
        <button
          onClick={() => { setActiveTab("stake"); setAmount(""); dismissStatus(); }}
          className={`flex-1 py-3 text-sm font-medium text-center rounded-tl-xl transition-colors ${
            activeTab === "stake" 
              ? "tab-active" 
              : "text-[#A1A1AA] hover:text-white"
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => { setActiveTab("unstake"); setAmount(""); dismissStatus(); }}
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
          <TransactionStatus status={txStatus} errorMessage={errorMessage} onDismiss={dismissStatus} />
          
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1AA]">Available</span>
            <span className="font-mono text-white">{formatFullNumber(prescioBalance)} PRESCIO</span>
          </div>
          
          <div className="relative">
            <Input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              disabled={isProcessing}
              className="w-full bg-[#0E100F] border-[#27272A] rounded-lg px-4 py-3 text-lg font-mono text-white focus:border-[#6E54FF] focus:ring-0 disabled:opacity-50"
            />
            <button 
              onClick={setMaxAmount}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6E54FF] font-medium hover:text-[#9B87FF] disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          
          <div className="flex gap-2">
            {[5000000, 20000000, 50000000, 100000000].map((val) => (
              <button 
                key={val}
                onClick={() => setPresetAmount(val)} 
                disabled={isProcessing}
                className="flex-1 py-1.5 text-xs border border-[#27272A] rounded hover:border-[#6E54FF]/50 text-white disabled:opacity-50"
              >
                {(val / 1000000)}M
              </button>
            ))}
          </div>
          
          {needsApproval && parsedAmount > 0n && (
            <div className="text-xs text-[#A1A1AA] bg-[#0E100F] rounded-lg p-2 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              Token approval required before staking
            </div>
          )}
          
          <Button
            onClick={!isCorrectNetwork ? () => switchChain({ chainId: MONAD_MAINNET_CHAIN_ID }) : handleStake}
            disabled={isCorrectNetwork ? (!!stakeValidationError || isProcessing) : isSwitching}
            className="w-full py-3 bg-[#6E54FF] hover:bg-[#6E54FF]/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSwitching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Switching Network...
              </>
            ) : !isCorrectNetwork ? (
              "Switch to Monad Mainnet"
            ) : isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {txStatus === "approving" ? "Approving..." : "Staking..."}
              </>
            ) : needsApproval && parsedAmount > 0n ? (
              "Approve & Stake"
            ) : (
              stakeValidationError || "Stake PRESCIO"
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
          <TransactionStatus status={txStatus} errorMessage={errorMessage} onDismiss={dismissStatus} />
          
          <div className="flex justify-between text-sm">
            <span className="text-[#A1A1AA]">Staked</span>
            <span className="font-mono text-white">
              {isLoading ? "..." : formatFullNumber(stakedAmount)} PRESCIO
            </span>
          </div>
          
          {/* Lock Status */}
          {exists && isLocked && (
            <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-[#A1A1AA]">Locked Until</span>
                </div>
                <span className="text-sm font-mono text-white">
                  {formatCountdown(Number(lockEnd) * 1000)}
                </span>
              </div>
              {isFlexibleLock && (
                <p className="text-xs text-orange-400">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Early unstake incurs penalty (5-15%)
                </p>
              )}
              {!isFlexibleLock && (
                <p className="text-xs text-red-400">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Fixed lock - Emergency unstake only (50% penalty)
                </p>
              )}
            </div>
          )}
          
          <Button
            onClick={!isCorrectNetwork ? () => switchChain({ chainId: MONAD_MAINNET_CHAIN_ID }) : handleUnstake}
            disabled={isCorrectNetwork ? (!!unstakeValidationError || isProcessing) : isSwitching}
            variant="outline"
            className="w-full py-3 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSwitching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Switching Network...
              </>
            ) : !isCorrectNetwork ? (
              "Switch to Monad Mainnet"
            ) : isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              unstakeValidationError || "Unstake All"
            )}
          </Button>
          
          {!exists && (
            <p className="text-xs text-[#A1A1AA] text-center">
              You don't have any active stake
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RewardsCard({ address }: { address: Address }) {
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  const chainId = useChainId();
  const isCorrectNetwork = chainId === MONAD_MAINNET_CHAIN_ID;
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  
  const { pendingMON, pendingPRESCIO, isLoading, refetch } = useUserStakeData(address);

  // Write contract hooks for claiming
  const { writeContract: writeClaimMON, data: claimMONHash, isPending: isClaimingMON, error: claimMONError } = useWriteContract();
  const { writeContract: writeClaimPRESCIO, data: claimPRESCIOHash, isPending: isClaimingPRESCIO, error: claimPRESCIOError } = useWriteContract();
  
  // Wait for transaction receipts
  const { isLoading: isMONConfirming, isSuccess: isMONSuccess } = useWaitForTransactionReceipt({ hash: claimMONHash });
  const { isLoading: isPRESCIOConfirming, isSuccess: isPRESCIOSuccess } = useWaitForTransactionReceipt({ hash: claimPRESCIOHash });

  // Handle success
  useEffect(() => {
    if (isMONSuccess || isPRESCIOSuccess) {
      setTxStatus("success");
      refetch();
    }
  }, [isMONSuccess, isPRESCIOSuccess]);

  // Handle errors
  useEffect(() => {
    if (claimMONError) {
      setTxStatus("error");
      setErrorMessage(getErrorMessage(claimMONError));
    }
  }, [claimMONError]);

  useEffect(() => {
    if (claimPRESCIOError) {
      setTxStatus("error");
      setErrorMessage(getErrorMessage(claimPRESCIOError));
    }
  }, [claimPRESCIOError]);

  // Update status
  useEffect(() => {
    if (isClaimingMON || isMONConfirming || isClaimingPRESCIO || isPRESCIOConfirming) {
      setTxStatus("claiming");
    }
  }, [isClaimingMON, isMONConfirming, isClaimingPRESCIO, isPRESCIOConfirming]);

  const handleClaimMON = () => {
    if (!isCorrectNetwork) return;
    setErrorMessage("");
    setTxStatus("claiming");
    
    writeClaimMON({
      address: STAKING_CONTRACT_ADDRESS,
      abi: STAKING_ABI,
      functionName: "claimMonRewards",
      args: [52n], // Max 52 epochs (1 year)
      chainId: MONAD_MAINNET_CHAIN_ID,
    });
  };

  const handleClaimPRESCIO = () => {
    if (!isCorrectNetwork) return;
    setErrorMessage("");
    setTxStatus("claiming");
    
    writeClaimPRESCIO({
      address: STAKING_CONTRACT_ADDRESS,
      abi: STAKING_ABI,
      functionName: "claimPrescioRewards",
      args: [52n], // Max 52 epochs (1 year)
      chainId: MONAD_MAINNET_CHAIN_ID,
    });
  };

  const dismissStatus = () => {
    setTxStatus("idle");
    setErrorMessage("");
  };

  const isProcessingMON = isClaimingMON || isMONConfirming;
  const isProcessingPRESCIO = isClaimingPRESCIO || isPRESCIOConfirming;

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4">
      <h3 className="text-sm font-medium text-[#A1A1AA] uppercase tracking-wide mb-4">Rewards</h3>
      
      <TransactionStatus status={txStatus} errorMessage={errorMessage} onDismiss={dismissStatus} />
      
      {/* MON Rewards */}
      <div className="p-3 border border-[#27272A] rounded-lg mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/monad-icon.png" alt="MON" className="w-6 h-6 rounded-full" />
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
          onClick={!isCorrectNetwork ? () => switchChain({ chainId: MONAD_MAINNET_CHAIN_ID }) : handleClaimMON}
          disabled={isCorrectNetwork ? (isProcessingMON || pendingMON === 0n) : isSwitching}
          className="w-full py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          variant="ghost"
        >
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !isCorrectNetwork ? (
            "Switch to Monad"
          ) : isProcessingMON ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Claim MON"
          )}
        </Button>
      </div>
      
      {/* PRESCIO Rewards */}
      <div className="p-3 border border-[#27272A] rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/prescio-icon.png" alt="PRESCIO" className="w-6 h-6 rounded-full" />
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
          onClick={!isCorrectNetwork ? () => switchChain({ chainId: MONAD_MAINNET_CHAIN_ID }) : handleClaimPRESCIO}
          disabled={isCorrectNetwork ? (isProcessingPRESCIO || pendingPRESCIO === 0n) : isSwitching}
          className="w-full py-2 bg-[#6E54FF]/10 text-[#6E54FF] hover:bg-[#6E54FF]/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          variant="ghost"
        >
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !isCorrectNetwork ? (
            "Switch to Monad"
          ) : isProcessingPRESCIO ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Claim PRESCIO"
          )}
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
// Main App Component
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
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
        <Header />
        
        <main className="max-w-5xl mx-auto px-4 py-8">
          
          {/* Network Switch Banner */}
          {isConnected && <NetworkSwitchBanner />}
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <img src="/prescio-icon.png" alt="PRESCIO" className="w-10 h-10 rounded-xl" />
              <h1 className="text-2xl font-bold">PRESCIO Staking</h1>
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
        </main>
      </div>
    </>
  );
}
