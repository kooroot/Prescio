import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import type { Player } from "@prescio/common";

interface OddsBarProps {
  player: Player;
  percentage: number;
  staked: string;
  isSelected: boolean;
  highlight: boolean;
  onClick: () => void;
}

function OddsBar({ player, percentage, staked, isSelected, highlight, onClick }: OddsBarProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-lg p-2.5 transition-all duration-300 border
        ${isSelected
          ? "border-purple-500 bg-purple-500/10"
          : "border-transparent hover:border-gray-700 bg-gray-800/30 hover:bg-gray-800/50"
        }
        ${highlight ? "ring-1 ring-yellow-400/50" : ""}
        ${!player.isAlive ? "opacity-40 pointer-events-none" : "cursor-pointer"}
      `}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200 truncate max-w-[120px]">
            {player.nickname}
          </span>
          {!player.isAlive && (
            <span className="text-[10px] text-red-400">💀</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`
            text-xs font-bold tabular-nums
            ${percentage > 30 ? "text-red-400" : percentage > 15 ? "text-yellow-400" : "text-green-400"}
          `}>
            {percentage.toFixed(1)}%
          </span>
          <span className="text-[10px] text-gray-500">
            {parseFloat(staked).toFixed(2)} MON
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isSelected
              ? "bg-purple-500"
              : percentage > 30
                ? "bg-red-500/70"
                : percentage > 15
                  ? "bg-yellow-500/70"
                  : "bg-green-500/70"
          }`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
    </button>
  );
}

interface OddsDisplayProps {
  players: Player[];
  outcomeTotals: readonly bigint[];
  totalPool: bigint;
  selectedIndex: number | null;
  onSelectPlayer: (index: number) => void;
}

export function OddsDisplay({
  players,
  outcomeTotals,
  totalPool,
  selectedIndex,
  onSelectPlayer,
}: OddsDisplayProps) {
  const [highlightedIndices, setHighlightedIndices] = useState<Set<number>>(new Set());
  const prevTotalsRef = useRef<readonly bigint[]>([]);

  // Detect odds changes and highlight
  useEffect(() => {
    const prev = prevTotalsRef.current;
    if (prev.length === 0) {
      prevTotalsRef.current = outcomeTotals;
      return;
    }

    const changed = new Set<number>();
    for (let i = 0; i < outcomeTotals.length; i++) {
      if (prev[i] !== outcomeTotals[i]) {
        changed.add(i);
      }
    }

    if (changed.size > 0) {
      setHighlightedIndices(changed);
      const timer = setTimeout(() => setHighlightedIndices(new Set()), 2000);
      prevTotalsRef.current = outcomeTotals;
      return () => clearTimeout(timer);
    }

    prevTotalsRef.current = outcomeTotals;
  }, [outcomeTotals]);

  const totalPoolNum = totalPool > 0n ? Number(totalPool) : 1;

  return (
    <div className="flex flex-col gap-1">
      {/* Pool header */}
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Odds
        </span>
        <span className="text-xs font-mono text-purple-400">
          Pool: {parseFloat(formatEther(totalPool)).toFixed(2)} MON
        </span>
      </div>

      {/* Player odds bars */}
      {players.map((player, index) => {
        const staked = index < outcomeTotals.length ? outcomeTotals[index] : 0n;
        const percentage =
          totalPool > 0n ? (Number(staked) / totalPoolNum) * 100 : 0;

        return (
          <OddsBar
            key={player.id}
            player={player}
            percentage={percentage}
            staked={formatEther(staked)}
            isSelected={selectedIndex === index}
            highlight={highlightedIndices.has(index)}
            onClick={() => onSelectPlayer(index)}
          />
        );
      })}
    </div>
  );
}
