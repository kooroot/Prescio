import type { Player } from "@prescio/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VoteResultProps {
  votes: Record<string, number>; // targetId → count
  eliminatedId: string | null;
  skipped: boolean;
  players: Player[];
  gameOver: boolean;
}

export function VoteResult({
  votes,
  eliminatedId,
  skipped,
  players,
  gameOver,
}: VoteResultProps) {
  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  // Sort by vote count descending
  const sorted = Object.entries(votes).sort(([, a], [, b]) => b - a);

  return (
    <Card className="border-monad-border bg-monad-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-gray-200 flex items-center gap-2">
          🗳️ Vote Result
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map(([targetId, count]) => {
          const player = getPlayer(targetId);
          const name = targetId === "skip" ? "Skip Vote" : (player?.nickname ?? targetId);
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isEliminated = targetId === eliminatedId;

          return (
            <div key={targetId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span
                  className={`font-medium ${
                    isEliminated ? "text-red-400" : "text-gray-300"
                  }`}
                >
                  {name}
                  {isEliminated && (
                    <Badge className="ml-2 bg-impostor/20 text-impostor text-[10px]" variant="outline">
                      EJECTED
                    </Badge>
                  )}
                </span>
                <span className="text-gray-500 text-xs">
                  {count} vote{count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-monad-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isEliminated ? "bg-impostor" : "bg-monad-purple"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {skipped && (
          <p className="text-center text-sm text-gray-500 italic pt-2">
            No one was ejected. (Skipped)
          </p>
        )}

        {eliminatedId && gameOver && (
          <div className="text-center pt-2">
            {(() => {
              const eliminated = getPlayer(eliminatedId);
              if (!eliminated?.role) return null;
              const wasImpostor = eliminated.role === "IMPOSTOR";
              return (
                <p
                  className={`text-sm font-medium ${
                    wasImpostor ? "text-impostor" : "text-crew"
                  }`}
                >
                  {eliminated.nickname} was{" "}
                  {wasImpostor ? "an Impostor!" : "not an Impostor."}
                </p>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
