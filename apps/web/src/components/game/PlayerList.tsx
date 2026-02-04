import { Phase, Role } from "@prescio/common";
import type { Player } from "@prescio/common";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skull, UserX } from "lucide-react";

interface PlayerListProps {
  players: Player[];
  phase: Phase;
  winner: Role | null;
  eliminatedPlayers: string[];
  killEvents: Array<{ targetId: string; round: number }>;
}

const AVATAR_COLORS = [
  "bg-red-600",
  "bg-blue-600",
  "bg-green-600",
  "bg-yellow-600",
  "bg-purple-600",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-orange-600",
  "bg-lime-600",
  "bg-teal-600",
];

function getPlayerColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function PlayerList({
  players,
  phase,
  winner,
  eliminatedPlayers,
  killEvents,
}: PlayerListProps) {
  const gameOver = winner !== null || phase === Phase.RESULT;

  // Sort: alive first, then dead
  const sorted = [...players].sort((a, b) => {
    if (a.isAlive && !b.isAlive) return -1;
    if (!a.isAlive && b.isAlive) return 1;
    return 0;
  });

  function getDeathCause(playerId: string): "killed" | "ejected" | null {
    if (killEvents.some((e) => e.targetId === playerId)) return "killed";
    if (eliminatedPlayers.includes(playerId)) return "ejected";
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Players
        </h3>
        <span className="text-xs text-gray-500">
          {players.filter((p) => p.isAlive).length} / {players.length} alive
        </span>
      </div>

      {sorted.map((player) => {
        const dead = !player.isAlive;
        const deathCause = dead ? getDeathCause(player.id) : null;
        const color = getPlayerColor(player.id);

        return (
          <div
            key={player.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
              dead
                ? "opacity-50 bg-monad-dark/30"
                : "bg-monad-card/30 hover:bg-monad-card/50"
            }`}
          >
            <Avatar className={`h-8 w-8 ${dead ? "grayscale" : color}`}>
              <AvatarFallback
                className={`${dead ? "bg-gray-700 text-gray-400" : `${color} text-white`} text-xs font-bold`}
              >
                {getInitials(player.nickname)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium truncate ${
                    dead ? "text-gray-500 line-through" : "text-gray-200"
                  }`}
                >
                  {player.nickname}
                </span>

                {/* Role badge — only after game over */}
                {gameOver && player.role && (
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${
                      player.role === Role.IMPOSTOR
                        ? "bg-impostor/20 text-impostor border-impostor/30"
                        : "bg-crew/20 text-crew border-crew/30"
                    }`}
                    variant="outline"
                  >
                    {player.role === Role.IMPOSTOR ? "IMPOSTOR" : "CREW"}
                  </Badge>
                )}
              </div>

              {dead && deathCause && (
                <div className="flex items-center gap-1 text-[10px] text-gray-600">
                  {deathCause === "killed" ? (
                    <>
                      <Skull className="h-3 w-3" /> Killed
                    </>
                  ) : (
                    <>
                      <UserX className="h-3 w-3" /> Ejected
                    </>
                  )}
                </div>
              )}
            </div>

            {!dead && !player.isConnected && (
              <span className="h-2 w-2 rounded-full bg-yellow-500" title="Disconnected" />
            )}
            {!dead && player.isConnected && (
              <span className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
            )}
          </div>
        );
      })}
    </div>
  );
}
