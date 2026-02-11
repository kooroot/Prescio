import { useState, useMemo } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatEther, parseEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  Loader2,
  Coins,
  TrendingUp,
  Clock,
  AlertTriangle,
  Sparkles,
  Zap,
  Crown,
  Diamond,
  Award,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Check,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface TierInfo {
  name: string;
  minStake: bigint;
  bettingBoost: number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  glow: string;
}

const TIERS: TierInfo[] = [
  {
    name: "Bronze",
    minStake: parseEther("1000"),
    bettingBoost: 1.5,
    icon: <Award className="h-5 w-5" />,
    color: "text-amber-600",
    gradient: "from-amber-700 to-amber-900",
    glow: "shadow-amber-500/20",
  },
  {
    name: "Silver",
    minStake: parseEther("10000"),
    bettingBoost: 1.8,
    icon: <Coins className="h-5 w-5" />,
    color: "text-gray-300",
    gradient: "from-gray-400 to-gray-600",
    glow: "shadow-gray-400/20",
  },
  {
    name: "Gold",
    minStake: parseEther("50000"),
    bettingBoost: 2.0,
    icon: <Crown className="h-5 w-5" />,
    color: "text-yellow-400",
    gradient: "from-yellow-400 to-amber-600",
    glow: "shadow-yellow-400/30",
  },
  {
    name: "Diamond",
    minStake: parseEther("200000"),
    bettingBoost: 2.5,
    icon: <Diamond className="h-5 w-5" />,
    color: "text-cyan-300",
    gradient: "from-cyan-300 via-purple-400 to-pink-400",
    glow: "shadow-cyan-400/40",
  },
];

const UNSTAKE_PERIOD_DAYS = 7;
const EARLY_WITHDRAW_PENALTY = 5; // 5%

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data (Replace with actual contract hooks)
// ─────────────────────────────────────────────────────────────────────────────

const mockUserData = {
  stakedAmount: parseEther("55000"),
  pendingUnstake: parseEther("5000"),
  unstakeRequestTime: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
  pendingRewardsMON: parseEther("12.5"),
  pendingRewardsPRESCIO: parseEther("340"),
  prescioBalance: parseEther("100000"),
};

const mockProtocolStats = {
  totalStaked: parseEther("12500000"),
  totalStakers: 1247,
  apr: 18.5,
};

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

function formatNumber(value: bigint, decimals = 2): string {
  const num = parseFloat(formatEther(value));
  if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

function formatCountdown(targetTime: number): string {
  const remaining = targetTime - Date.now();
  if (remaining <= 0) return "Ready";
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function StakingStats() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-monad-purple/20 to-monad-purple/5 border border-monad-purple/20 p-4">
        <div className="absolute top-0 right-0 w-20 h-20 bg-monad-purple/10 rounded-full blur-2xl" />
        <p className="text-xs text-gray-400 mb-1">Total Staked</p>
        <p className="text-xl font-bold text-white font-mono">
          {formatNumber(mockProtocolStats.totalStaked)}
        </p>
        <p className="text-xs text-monad-purple mt-1">PRESCIO</p>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20 p-4">
        <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl" />
        <p className="text-xs text-gray-400 mb-1">Total Stakers</p>
        <p className="text-xl font-bold text-white font-mono">
          {mockProtocolStats.totalStakers.toLocaleString()}
        </p>
        <p className="text-xs text-cyan-400 mt-1">Users</p>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20 p-4">
        <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
        <p className="text-xs text-gray-400 mb-1">Est. APR</p>
        <p className="text-xl font-bold text-white font-mono">
          {mockProtocolStats.apr}%
        </p>
        <p className="text-xs text-green-400 mt-1">Variable</p>
      </div>
    </div>
  );
}

function CurrentStakeCard() {
  const currentTier = getCurrentTier(mockUserData.stakedAmount);
  const nextTier = getNextTier(mockUserData.stakedAmount);
  
  const progressToNext = nextTier
    ? Number((mockUserData.stakedAmount * 100n) / nextTier.minStake)
    : 100;

  return (
    <Card className="border-monad-border bg-gradient-to-br from-monad-card/80 to-monad-card/40 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-monad-purple via-cyan-400 to-pink-500" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-monad-purple" />
          My Staking Position
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Stake Amount */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-white font-mono">
              {formatNumber(mockUserData.stakedAmount)}
            </p>
            <p className="text-sm text-gray-400">PRESCIO Staked</p>
          </div>
          {currentTier && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${currentTier.gradient} shadow-lg ${currentTier.glow}`}>
              {currentTier.icon}
              <span className="font-bold text-white">{currentTier.name}</span>
            </div>
          )}
        </div>

        {/* Betting Boost */}
        <div className="flex items-center justify-between rounded-lg bg-monad-purple/10 border border-monad-purple/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-monad-purple" />
            <span className="text-sm text-gray-300">Betting Boost</span>
          </div>
          <span className="text-lg font-bold text-monad-purple">
            {currentTier ? `${currentTier.bettingBoost}x` : "1x"} Max Bet
          </span>
        </div>

        {/* Progress to Next Tier */}
        {nextTier && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Progress to {nextTier.name}</span>
              <span className={nextTier.color}>
                {formatNumber(nextTier.minStake - mockUserData.stakedAmount)} more
              </span>
            </div>
            <div className="h-2 bg-monad-dark rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${nextTier.gradient} transition-all duration-500`}
                style={{ width: `${Math.min(progressToNext, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StakeForm() {
  const [amount, setAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);

  const handleStake = async () => {
    setIsStaking(true);
    // TODO: Call contract
    setTimeout(() => setIsStaking(false), 2000);
  };

  const presetAmounts = ["1000", "10000", "50000", "100000"];

  return (
    <Card className="border-monad-border bg-monad-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-green-400" />
          Stake PRESCIO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Available Balance</span>
          <span className="text-white font-mono">
            {formatNumber(mockUserData.prescioBalance)} PRESCIO
          </span>
        </div>

        {/* Amount Input */}
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="pr-24 h-12 text-lg bg-monad-dark border-monad-border text-white font-mono"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAmount(formatEther(mockUserData.prescioBalance))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-monad-purple hover:text-monad-purple/80"
          >
            MAX
          </Button>
        </div>

        {/* Preset Amounts */}
        <div className="flex gap-2">
          {presetAmounts.map((preset) => (
            <Button
              key={preset}
              variant="outline"
              size="sm"
              onClick={() => setAmount(preset)}
              className="flex-1 border-monad-border hover:border-monad-purple hover:bg-monad-purple/10 text-xs"
            >
              {parseInt(preset).toLocaleString()}
            </Button>
          ))}
        </div>

        {/* Stake Button */}
        <Button
          onClick={handleStake}
          disabled={!amount || parseFloat(amount) <= 0 || isStaking}
          className="w-full h-12 bg-gradient-to-r from-monad-purple to-purple-600 hover:from-monad-purple/90 hover:to-purple-600/90 text-white font-bold text-lg shadow-lg shadow-monad-purple/25"
        >
          {isStaking ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Staking...
            </>
          ) : (
            <>
              <Coins className="h-5 w-5 mr-2" />
              Stake PRESCIO
            </>
          )}
        </Button>

        {/* Info Note */}
        <p className="text-xs text-gray-500 text-center">
          Staking is instant. Unstaking requires a 7-day waiting period.
        </p>
      </CardContent>
    </Card>
  );
}

function UnstakeForm() {
  const [amount, setAmount] = useState("");
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [showEarlyWithdraw, setShowEarlyWithdraw] = useState(false);

  const unstakeEndTime = mockUserData.unstakeRequestTime + UNSTAKE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const canWithdraw = Date.now() >= unstakeEndTime;
  const hasPendingUnstake = mockUserData.pendingUnstake > 0n;

  const handleUnstake = async () => {
    setIsUnstaking(true);
    setTimeout(() => setIsUnstaking(false), 2000);
  };

  const earlyWithdrawAmount = (mockUserData.pendingUnstake * BigInt(100 - EARLY_WITHDRAW_PENALTY)) / 100n;
  const penaltyAmount = mockUserData.pendingUnstake - earlyWithdrawAmount;

  return (
    <Card className="border-monad-border bg-monad-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <ArrowDownRight className="h-4 w-4 text-orange-400" />
          Unstake PRESCIO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Unstake Display */}
        {hasPendingUnstake && (
          <div className="rounded-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-orange-400" />
                <span className="text-sm text-gray-300">Pending Unstake</span>
              </div>
              <span className="font-bold text-white font-mono">
                {formatNumber(mockUserData.pendingUnstake)} PRESCIO
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {canWithdraw ? "Ready to withdraw!" : `Unlocks in ${formatCountdown(unstakeEndTime)}`}
              </span>
              <div className="flex gap-2">
                {!canWithdraw && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEarlyWithdraw(!showEarlyWithdraw)}
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Early Withdraw
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!canWithdraw}
                  className={canWithdraw 
                    ? "bg-green-500 hover:bg-green-600" 
                    : "bg-gray-600 cursor-not-allowed"
                  }
                >
                  {canWithdraw ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Withdraw
                    </>
                  ) : (
                    "Locked"
                  )}
                </Button>
              </div>
            </div>

            {/* Early Withdraw Warning */}
            {showEarlyWithdraw && !canWithdraw && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">5% Early Withdrawal Penalty</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">You will receive:</span>
                  <span className="text-white font-mono">
                    {formatNumber(earlyWithdrawAmount)} PRESCIO
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Penalty (redistributed to stakers):</span>
                  <span className="text-red-400 font-mono">
                    -{formatNumber(penaltyAmount)} PRESCIO
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full mt-2 bg-red-600 hover:bg-red-700"
                >
                  Confirm Early Withdraw
                </Button>
              </div>
            )}
          </div>
        )}

        {/* New Unstake Request */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Currently Staked</span>
            <span className="text-white font-mono">
              {formatNumber(mockUserData.stakedAmount)} PRESCIO
            </span>
          </div>

          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount to unstake"
              className="pr-24 h-12 text-lg bg-monad-dark border-monad-border text-white font-mono"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAmount(formatEther(mockUserData.stakedAmount))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-400 hover:text-orange-400/80"
            >
              MAX
            </Button>
          </div>

          <Button
            onClick={handleUnstake}
            disabled={!amount || parseFloat(amount) <= 0 || isUnstaking}
            variant="outline"
            className="w-full h-12 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 font-bold"
          >
            {isUnstaking ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 mr-2" />
                Request Unstake (7 day lock)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RewardsCard() {
  const [isClaiming, setIsClaiming] = useState<"mon" | "prescio" | null>(null);

  const handleClaim = async (type: "mon" | "prescio") => {
    setIsClaiming(type);
    setTimeout(() => setIsClaiming(null), 2000);
  };

  return (
    <Card className="border-monad-border bg-gradient-to-br from-monad-card/80 to-monad-card/40 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-monad-purple to-cyan-400" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Gift className="h-4 w-4 text-green-400" />
          Dual Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* MON Rewards */}
        <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                <span className="text-xs font-bold">M</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">MON Rewards</p>
                <p className="text-xs text-gray-400">From betting fees</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white font-mono">
                {formatNumber(mockUserData.pendingRewardsMON, 4)}
              </p>
              <p className="text-xs text-gray-400">≈ $42.50</p>
            </div>
          </div>
          <Button
            onClick={() => handleClaim("mon")}
            disabled={mockUserData.pendingRewardsMON === 0n || isClaiming === "mon"}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
          >
            {isClaiming === "mon" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Claim MON"
            )}
          </Button>
        </div>

        {/* PRESCIO Rewards */}
        <div className="rounded-xl bg-gradient-to-r from-monad-purple/10 to-pink-500/10 border border-monad-purple/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-monad-purple to-pink-500 flex items-center justify-center">
                <span className="text-xs font-bold">P</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">PRESCIO Rewards</p>
                <p className="text-xs text-gray-400">From early withdrawal penalties</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white font-mono">
                {formatNumber(mockUserData.pendingRewardsPRESCIO, 2)}
              </p>
              <p className="text-xs text-gray-400">≈ $12.00</p>
            </div>
          </div>
          <Button
            onClick={() => handleClaim("prescio")}
            disabled={mockUserData.pendingRewardsPRESCIO === 0n || isClaiming === "prescio"}
            className="w-full bg-gradient-to-r from-monad-purple to-pink-500 hover:from-monad-purple/90 hover:to-pink-500/90"
          >
            {isClaiming === "prescio" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Claim PRESCIO"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TierComparison() {
  const currentTier = getCurrentTier(mockUserData.stakedAmount);

  return (
    <Card className="border-monad-border bg-monad-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-monad-purple" />
          Tier Benefits
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TIERS.map((tier) => {
            const isActive = currentTier?.name === tier.name;
            const isLocked = !currentTier || TIERS.indexOf(tier) > TIERS.indexOf(currentTier);

            return (
              <div
                key={tier.name}
                className={`relative rounded-xl p-4 transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-br ${tier.gradient} shadow-lg ${tier.glow}`
                    : isLocked
                    ? "bg-monad-dark/50 border border-monad-border opacity-60"
                    : "bg-monad-dark border border-monad-border"
                }`}
              >
                {isActive && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className={`flex items-center gap-2 mb-3 ${isActive ? "text-white" : tier.color}`}>
                  {tier.icon}
                  <span className="font-bold">{tier.name}</span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs">
                    <span className={isActive ? "text-white/70" : "text-gray-500"}>Min Stake</span>
                    <p className={`font-mono font-bold ${isActive ? "text-white" : "text-gray-300"}`}>
                      {formatNumber(tier.minStake, 0)}
                    </p>
                  </div>
                  <div className="text-xs">
                    <span className={isActive ? "text-white/70" : "text-gray-500"}>Bet Boost</span>
                    <p className={`font-mono font-bold ${isActive ? "text-white" : "text-gray-300"}`}>
                      {tier.bettingBoost}x
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Benefits Summary */}
        <div className="mt-4 pt-4 border-t border-monad-border">
          <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-3">All Tiers Include</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-gray-300">
              <Check className="h-3 w-3 text-green-400" />
              <span>MON rewards from fees</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Check className="h-3 w-3 text-green-400" />
              <span>PRESCIO from penalties</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Check className="h-3 w-3 text-green-400" />
              <span>Governance voting</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Check className="h-3 w-3 text-green-400" />
              <span>Early access features</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export function StakingPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  return (
    <div className="min-h-screen bg-monad-dark">
      {/* Header with gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-monad-purple/20 via-transparent to-cyan-500/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-monad-purple/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <Coins className="h-10 w-10 text-monad-purple" />
                Staking
              </h1>
              <p className="text-gray-400">
                Stake PRESCIO to boost your betting limits and earn dual rewards
              </p>
            </div>
            {!isConnected && (
              <Button
                onClick={() => connect({ connector: injected() })}
                className="bg-monad-purple hover:bg-monad-purple/80"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Protocol Stats */}
          <StakingStats />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Position & Rewards */}
            <div className="lg:col-span-2 space-y-6">
              <CurrentStakeCard />
              <TierComparison />
            </div>

            {/* Right Column - Actions */}
            <div className="space-y-6">
              <Tabs defaultValue="stake" className="w-full">
                <TabsList className="w-full bg-monad-card/50 border border-monad-border">
                  <TabsTrigger value="stake" className="flex-1 data-[state=active]:bg-monad-purple">
                    Stake
                  </TabsTrigger>
                  <TabsTrigger value="unstake" className="flex-1 data-[state=active]:bg-monad-purple">
                    Unstake
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="stake" className="mt-4">
                  <StakeForm />
                </TabsContent>
                <TabsContent value="unstake" className="mt-4">
                  <UnstakeForm />
                </TabsContent>
              </Tabs>
              <RewardsCard />
            </div>
          </div>
        ) : (
          /* Not Connected State */
          <Card className="border-monad-border bg-monad-card/40 max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-monad-purple/20 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-monad-purple" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-6">
                Connect your wallet to view your staking position and start earning rewards
              </p>
              <Button
                onClick={() => connect({ connector: injected() })}
                className="bg-monad-purple hover:bg-monad-purple/80"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default StakingPage;
