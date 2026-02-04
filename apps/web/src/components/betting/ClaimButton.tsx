import { formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Check } from "lucide-react";
import { useClaim } from "@/hooks/useBetting";
import { ContractMarketState } from "@/hooks/useContract";

interface ClaimButtonProps {
  gameId: string;
  marketState: ContractMarketState;
  userBetAmount: bigint;
  userSuspectIndex: number;
  resolvedImpostorIndex: number;
  hasClaimed: boolean;
  totalPool: bigint;
  outcomeTotals: readonly bigint[];
  isConnected: boolean;
}

export function ClaimButton({
  gameId,
  marketState,
  userBetAmount,
  userSuspectIndex,
  resolvedImpostorIndex,
  hasClaimed,
  totalPool,
  outcomeTotals,
  isConnected,
}: ClaimButtonProps) {
  const { claim, isPending, isConfirming, isSuccess, error } = useClaim(gameId);

  // Only show if: game resolved, user placed a bet, user picked right
  if (!isConnected) return null;
  if (marketState !== ContractMarketState.RESOLVED) return null;
  if (userBetAmount === 0n) return null;
  if (userSuspectIndex !== resolvedImpostorIndex) return null;

  // Calculate estimated payout
  const winnerPool =
    userSuspectIndex < outcomeTotals.length
      ? outcomeTotals[userSuspectIndex]
      : 0n;

  const estimatedPayout =
    winnerPool > 0n
      ? (userBetAmount * totalPool * 95n) / (winnerPool * 100n) // 5% fee
      : 0n;

  if (hasClaimed || isSuccess) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
        <Check className="h-4 w-4 text-green-400" />
        <span className="text-sm font-medium text-green-400">
          Reward Claimed!
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-yellow-200">You won!</span>
        </div>
        <span className="text-sm font-mono font-bold text-yellow-400">
          ~{parseFloat(formatEther(estimatedPayout)).toFixed(3)} MON
        </span>
      </div>

      <Button
        onClick={() => claim()}
        disabled={isPending || isConfirming}
        className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isPending ? "Confirm in wallet…" : "Claiming…"}
          </>
        ) : (
          <>
            <Trophy className="mr-2 h-4 w-4" />
            Claim Reward
          </>
        )}
      </Button>

      {error && (
        <p className="text-xs text-red-400 text-center">
          {(error as Error).message?.slice(0, 80)}
        </p>
      )}
    </div>
  );
}
