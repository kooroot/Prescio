import { Phase } from "@prescio/common";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Users, Swords, Hash, Target, Coins, Check } from "lucide-react";
import type { GameListItem, HistoryGame, MyBetGame } from "@/lib/api";

// ─── Phase badge colors ──────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  [Phase.LOBBY]: "bg-[#27272A] text-gray-200",
  [Phase.NIGHT]: "bg-monad-purple/80 text-white",
  [Phase.REPORT]: "bg-impostor/80 text-white",
  [Phase.DISCUSSION]: "bg-crew/80 text-white",
  [Phase.VOTE]: "bg-orange-600 text-orange-100",
  [Phase.RESULT]: "bg-alive/80 text-white",
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
    <Card className="border-monad-border bg-monad-card/50 hover:border-monad-purple/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Hash className="h-4 w-4 text-gray-500" />
            <span className="font-mono text-monad-purple">{game.code}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1.5 text-xs text-monad-purple">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-monad-purple opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-monad-purple" />
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
            className="border-monad-purple/30 text-monad-purple hover:bg-monad-purple/10 hover:text-[#9B87FF]"
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
  const winnerColor = game.winner === "CREW" ? "bg-crew/20 text-crew" : game.winner === "IMPOSTOR" ? "bg-impostor/20 text-impostor" : "bg-gray-600/20 text-gray-300";

  const timeAgo = getTimeAgo(game.finishedAt);

  return (
    <Card className="border-monad-border bg-monad-card/30 opacity-80 hover:opacity-100 transition-opacity">
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

// ─── My Bet Card ─────────────────────────────────────

interface MyBetCardProps {
  bet: MyBetGame;
  onWatch: (gameId: string) => void;
}

export function MyBetCard({ bet, onWatch }: MyBetCardProps) {
  const isActive = bet.finishedAt === null;
  // User wins if they correctly bet on an impostor
  // bet.bet.suspectWasImpostor tells us if the target was actually an impostor
  const isWinner = bet.winner !== null && bet.bet.suspectWasImpostor === true;
  const phaseColor = isActive 
    ? PHASE_COLORS[bet.phase] ?? "bg-gray-600 text-gray-100"
    : "bg-gray-600/50 text-gray-300";
  const phaseLabel = isActive 
    ? (PHASE_LABELS[bet.phase] ?? bet.phase)
    : "Finished";

  // Determine bet result status
  let betStatus: "pending" | "won" | "lost" | "claimed" = "pending";
  if (!isActive && bet.winner) {
    betStatus = bet.bet.claimed ? "claimed" : isWinner ? "won" : "lost";
  }

  const statusColors = {
    pending: "border-yellow-500/30 bg-yellow-500/5",
    won: "border-alive/30 bg-alive/5",
    lost: "border-impostor/30 bg-impostor/5",
    claimed: "border-gray-500/30 bg-gray-500/5",
  };

  return (
    <Card className={`${statusColors[betStatus]} hover:border-monad-purple/30 transition-colors`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-400">{bet.code}</span>
            <Badge className={`${phaseColor} text-xs`}>
              {phaseLabel}
            </Badge>
            {isActive && (
              <span className="flex items-center gap-1.5 text-xs text-monad-purple">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-monad-purple opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-monad-purple" />
                </span>
                LIVE
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onWatch(bet.gameId)}
            className="border-monad-purple/30 text-monad-purple hover:bg-monad-purple/10"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
        </div>

        {/* Bet details */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Target className="h-3.5 w-3.5 text-yellow-500" />
            <span>Bet on: </span>
            <span className="font-medium text-yellow-400">{bet.bet.suspectNickname}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Coins className="h-3.5 w-3.5 text-monad-purple" />
            <span className="font-mono text-monad-purple">{bet.bet.amount} MON</span>
          </div>
          {betStatus === "won" && (
            <Badge className="bg-alive/20 text-alive text-xs">
              🎉 Won!
            </Badge>
          )}
          {betStatus === "lost" && (
            <Badge className="bg-impostor/20 text-impostor text-xs">
              Lost
            </Badge>
          )}
          {betStatus === "claimed" && (
            <Badge className="bg-gray-500/20 text-gray-400 text-xs flex items-center gap-1">
              <Check className="h-3 w-3" /> Claimed
            </Badge>
          )}
        </div>

        {/* Time info */}
        {bet.finishedAt && (
          <div className="mt-2 text-xs text-gray-600">
            {getTimeAgo(bet.finishedAt)}
          </div>
        )}
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
