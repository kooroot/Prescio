import { formatEther } from "viem";
import { Badge } from "@/components/ui/badge";
import type { Bet, Player } from "@prescio/common";
import { BetStatus } from "@prescio/common";

interface BetHistoryProps {
  bets: Bet[];
  players: Player[];
  isConnected: boolean;
}

function statusBadge(status: BetStatus) {
  switch (status) {
    case BetStatus.OPEN:
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]" variant="outline">Active</Badge>;
    case BetStatus.LOCKED:
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]" variant="outline">Locked</Badge>;
    case BetStatus.RESOLVED_WIN:
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]" variant="outline">Won ✓</Badge>;
    case BetStatus.RESOLVED_LOSS:
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]" variant="outline">Lost</Badge>;
    case BetStatus.CLAIMED:
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]" variant="outline">Claimed</Badge>;
    case BetStatus.CANCELLED:
      return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]" variant="outline">Cancelled</Badge>;
    default:
      return null;
  }
}

export function BetHistory({ bets, players, isConnected }: BetHistoryProps) {
  if (!isConnected) return null;

  if (bets.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-gray-500">No bets placed yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          My Bets
        </span>
        <span className="text-xs text-gray-500">
          {bets.length} bet{bets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {bets.map((bet) => {
        // Try to find the player by outcomeId (which is the player index as string)
        const playerIndex = parseInt(bet.outcomeId, 10);
        const player = !isNaN(playerIndex) ? players[playerIndex] : undefined;

        return (
          <div
            key={bet.id}
            className="flex items-center justify-between rounded-lg bg-gray-800/30 px-3 py-2"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-gray-200">
                {player?.nickname ?? `Player #${bet.outcomeId}`}
              </span>
              <span className="text-xs text-gray-500">
                {parseFloat(formatEther(BigInt(bet.amount.toString()))).toFixed(2)} MON
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              {statusBadge(bet.status)}
              {bet.potentialPayout && (
                <span className="text-[10px] text-gray-500">
                  → {parseFloat(formatEther(BigInt(bet.potentialPayout.toString()))).toFixed(2)} MON
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
