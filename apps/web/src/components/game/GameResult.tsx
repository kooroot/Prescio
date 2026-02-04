import { Role } from "@prescio/common";
import type { Player, KillEvent } from "@prescio/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

interface GameResultProps {
  winner: Role;
  players: Player[];
  killEvents: KillEvent[];
  rounds: number;
}

export function GameResult({ winner, players, killEvents, rounds }: GameResultProps) {
  const navigate = useNavigate();
  const isImpostorWin = winner === Role.IMPOSTOR;

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  return (
    <div className="space-y-4">
      {/* Winner banner */}
      <Card
        className={`border-2 ${
          isImpostorWin
            ? "border-impostor/50 bg-impostor/10"
            : "border-crew/50 bg-crew/10"
        }`}
      >
        <CardContent className="py-8 text-center">
          <div className="text-5xl mb-3">{isImpostorWin ? "🔪" : "🛡️"}</div>
          <h2
            className={`text-3xl font-black uppercase tracking-wider ${
              isImpostorWin ? "text-impostor" : "text-crew"
            }`}
          >
            {isImpostorWin ? "Impostor Wins!" : "Crew Wins!"}
          </h2>
          <p className="mt-2 text-gray-400">
            Game ended after {rounds} round{rounds !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* All player roles */}
      <Card className="border-monad-border bg-monad-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400 uppercase tracking-wider">
            Player Roles Revealed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-md px-3 py-2 bg-monad-dark/40"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      player.isAlive ? "text-gray-200" : "text-gray-500 line-through"
                    }`}
                  >
                    {player.nickname}
                  </span>
                  {!player.isAlive && (
                    <span className="text-[10px] text-gray-600">☠️</span>
                  )}
                </div>
                <Badge
                  className={`text-xs ${
                    player.role === Role.IMPOSTOR
                      ? "bg-impostor/20 text-impostor border-impostor/40"
                      : "bg-crew/20 text-crew border-crew/40"
                  }`}
                  variant="outline"
                >
                  {player.role === Role.IMPOSTOR ? "🔪 IMPOSTOR" : "👷 CREW"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kill timeline */}
      {killEvents.length > 0 && (
        <Card className="border-monad-border bg-monad-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 uppercase tracking-wider">
              Kill Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {killEvents.map((event, idx) => {
                const target = getPlayer(event.targetId);
                const killer = getPlayer(event.killerId);
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-sm rounded-md px-3 py-1.5 bg-monad-dark/30"
                  >
                    <Badge className="bg-gray-700 text-gray-400 text-[10px] px-1.5">
                      R{event.round}
                    </Badge>
                    <span className="text-gray-500">
                      {killer ? (
                        <>
                          <span className="text-impostor">{killer.nickname}</span>
                          {" killed "}
                          <span className="text-gray-300">{target?.nickname ?? "Unknown"}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-300">{target?.nickname ?? "Unknown"}</span>
                          {" was killed"}
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back to lobby */}
      <div className="flex justify-center pt-2">
        <Button
          size="lg"
          onClick={() => navigate({ to: "/" })}
          className="bg-monad-purple hover:bg-monad-purple/80 text-white font-semibold px-8"
        >
          Back to Lobby
        </Button>
      </div>
    </div>
  );
}
