import { Phase } from "@prescio/common";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Users, Swords, Hash } from "lucide-react";
import type { GameListItem, HistoryGame } from "@/lib/api";

// ─── Phase badge colors ──────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  [Phase.LOBBY]: "bg-gray-600 text-gray-100",
  [Phase.NIGHT]: "bg-indigo-600 text-indigo-100",
  [Phase.REPORT]: "bg-red-600 text-red-100",
  [Phase.DISCUSSION]: "bg-yellow-600 text-yellow-100",
  [Phase.VOTE]: "bg-orange-600 text-orange-100",
  [Phase.RESULT]: "bg-emerald-600 text-emerald-100",
};

const PHASE_LABELS: Record<string, string> = {
  [Phase.LOBBY]: "Lobby",
  [Phase.NIGHT]: "Night",
  [Phase.REPORT]: "Report",
  [Phase.DISCUSSION]: "Discussion",
  [Phase.VOTE]: "Voting",
  [Phase.RESULT]: "Result",
};

function isLivePhase(phase: string): boolean {
  return phase !== Phase.LOBBY && phase !== Phase.RESULT;
}

// ─── Active Game Card ────────────────────────────────

interface ActiveGameCardProps {
  game: GameListItem;
  onWatch: (gameId: string) => void;
}

export function ActiveGameCard({ game, onWatch }: ActiveGameCardProps) {
  const live = isLivePhase(game.phase);
  const phaseColor = PHASE_COLORS[game.phase] ?? "bg-gray-600 text-gray-100";
  const phaseLabel = PHASE_LABELS[game.phase] ?? game.phase;

  return (
    <Card className="border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Hash className="h-4 w-4 text-gray-500" />
            <span className="font-mono text-purple-300">{game.code}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                LIVE
              </span>
            )}
            <Badge className={`${phaseColor} text-xs font-medium`}>
              {phaseLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {game.playerCount}/{game.maxPlayers}
            </span>
            {game.round > 0 && (
              <span className="flex items-center gap-1">
                <Swords className="h-3.5 w-3.5" />
                Round {game.round}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onWatch(game.id)}
            className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Watch
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Finished Game Card ──────────────────────────────

interface FinishedGameCardProps {
  game: HistoryGame;
  onWatch: (gameId: string) => void;
}

export function FinishedGameCard({ game, onWatch }: FinishedGameCardProps) {
  const winnerLabel = game.winner === "CREW" ? "Crew Won" : game.winner === "IMPOSTOR" ? "Impostor Won" : "Draw";
  const winnerColor = game.winner === "CREW" ? "bg-emerald-600/20 text-emerald-300" : game.winner === "IMPOSTOR" ? "bg-red-600/20 text-red-300" : "bg-gray-600/20 text-gray-300";

  const timeAgo = getTimeAgo(game.finishedAt);

  return (
    <Card className="border-gray-800 bg-gray-900/30 opacity-80 hover:opacity-100 transition-opacity">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-400">{game.code}</span>
            <Badge className={`${winnerColor} text-xs`}>
              {winnerLabel}
            </Badge>
            <span className="text-xs text-gray-500">
              {game.rounds} rounds · {game.playerCount} players
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">{timeAgo}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onWatch(game.id)}
              className="text-gray-500 hover:text-gray-300"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Utils ───────────────────────────────────────────

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
