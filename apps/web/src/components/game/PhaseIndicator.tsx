import { useEffect, useState } from "react";
import { Phase } from "@prescio/common";
import { Badge } from "@/components/ui/badge";

interface PhaseIndicatorProps {
  phase: Phase;
  timeRemaining: number;
  round: number;
}

const PHASE_CONFIG: Record<
  Phase,
  { icon: string; label: string; color: string; bg: string }
> = {
  [Phase.LOBBY]: {
    icon: "🏠",
    label: "Lobby",
    color: "text-gray-300",
    bg: "bg-gray-700/50",
  },
  [Phase.NIGHT]: {
    icon: "🌙",
    label: "Night",
    color: "text-purple-300",
    bg: "bg-purple-900/50",
  },
  [Phase.REPORT]: {
    icon: "⚠️",
    label: "Report",
    color: "text-red-300",
    bg: "bg-red-900/50",
  },
  [Phase.DISCUSSION]: {
    icon: "💬",
    label: "Discussion",
    color: "text-blue-300",
    bg: "bg-blue-900/50",
  },
  [Phase.VOTE]: {
    icon: "🗳️",
    label: "Voting",
    color: "text-orange-300",
    bg: "bg-orange-900/50",
  },
  [Phase.RESULT]: {
    icon: "📊",
    label: "Result",
    color: "text-emerald-300",
    bg: "bg-emerald-900/50",
  },
};

export function PhaseIndicator({ phase, timeRemaining, round }: PhaseIndicatorProps) {
  const [countdown, setCountdown] = useState(timeRemaining);
  const config = PHASE_CONFIG[phase];

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown > 0]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timerStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const isUrgent = countdown > 0 && countdown <= 10;

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-4 py-3 ${config.bg} border border-white/5`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <div className={`text-sm font-bold uppercase tracking-wider ${config.color}`}>
            {config.label}
          </div>
          {round > 0 && (
            <div className="text-xs text-gray-500">Round {round}</div>
          )}
        </div>
      </div>

      {countdown > 0 && phase !== Phase.LOBBY && phase !== Phase.RESULT && (
        <Badge
          className={`font-mono text-lg px-3 py-1 ${
            isUrgent
              ? "bg-red-600 text-white animate-pulse"
              : "bg-gray-800 text-gray-200"
          }`}
        >
          {timerStr}
        </Badge>
      )}
    </div>
  );
}
