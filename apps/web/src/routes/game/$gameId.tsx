import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useGame } from "@/hooks/useGame";
import { GameBoard } from "@/components/game/GameBoard";
import { PhaseIndicator } from "@/components/game/PhaseIndicator";
import { PlayerList } from "@/components/game/PlayerList";
import { BetPanel } from "@/components/betting/BetPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Eye, Hash, Loader2 } from "lucide-react";
import { Phase } from "@prescio/common";

export function GamePage() {
  const { gameId } = useParams({ from: "/game/$gameId" });
  const {
    game,
    isLoading,
    error,
    chatMessages,
    spectatorCount,
    timeRemaining,
  } = useGame(gameId);

  const [mobileTab, setMobileTab] = useState("game");

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-monad-purple" />
          <p className="text-gray-400 text-sm">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">😵</div>
          <h2 className="text-xl font-bold text-gray-200">Game not found</h2>
          <p className="mt-1 text-gray-500 text-sm">
            {error?.message ?? "The game may have ended or doesn't exist."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      {/* ─── Top bar: game info ────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Hash className="h-4 w-4" />
            <span className="font-mono text-lg text-monad-purple font-bold">
              {game.code}
            </span>
          </div>
          {spectatorCount > 0 && (
            <Badge className="bg-monad-card text-gray-400 border-monad-border" variant="outline">
              <Eye className="mr-1 h-3 w-3" />
              {spectatorCount}
            </Badge>
          )}
        </div>
        <PhaseIndicator
          phase={game.phase}
          timeRemaining={timeRemaining}
          round={game.round}
        />
      </div>

      {/* ─── Desktop: 2-column layout ─────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_320px] lg:gap-4">
        {/* Left: Game board + Chat */}
        <Card className="border-monad-border bg-monad-card/40 overflow-hidden">
          <CardContent className="p-0 h-[calc(100vh-180px)]">
            <GameBoard
              game={game}
              chatMessages={chatMessages}
            />
          </CardContent>
        </Card>

        {/* Right: Players + (future) Betting */}
        <div className="flex flex-col gap-4">
          <Card className="border-monad-border bg-monad-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2">
                👥 Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerList
                players={game.players}
                phase={game.phase}
                winner={game.winner}
                eliminatedPlayers={game.eliminatedPlayers}
                killEvents={game.killEvents}
              />
            </CardContent>
          </Card>

          {/* Betting panel */}
          {game.phase !== Phase.LOBBY && (
            <BetPanel
              gameId={gameId}
              players={game.players}
              phase={game.phase}
            />
          )}
        </div>
      </div>

      {/* ─── Mobile: Tabs layout ──────────────────────── */}
      <div className="lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab}>
          <TabsList className="w-full bg-monad-card border border-monad-border">
            <TabsTrigger value="game" className="flex-1 text-xs">
              🎮 Game
            </TabsTrigger>
            <TabsTrigger value="players" className="flex-1 text-xs">
              👥 Players
            </TabsTrigger>
            <TabsTrigger value="bet" className="flex-1 text-xs">
              🎰 Bet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="game" className="mt-3">
            <Card className="border-monad-border bg-monad-card/40 overflow-hidden">
              <CardContent className="p-0 h-[calc(100vh-280px)]">
                <GameBoard
                  game={game}
                  chatMessages={chatMessages}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players" className="mt-3">
            <Card className="border-monad-border bg-monad-card/40">
              <CardContent className="pt-4">
                <PlayerList
                  players={game.players}
                  phase={game.phase}
                  winner={game.winner}
                  eliminatedPlayers={game.eliminatedPlayers}
                  killEvents={game.killEvents}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bet" className="mt-3">
            {game.phase !== Phase.LOBBY ? (
              <BetPanel
                gameId={gameId}
                players={game.players}
                phase={game.phase}
              />
            ) : (
              <Card className="border-monad-border bg-monad-card/40 border-dashed">
                <CardContent className="py-12 text-center">
                  <span className="text-4xl">🎰</span>
                  <p className="mt-3 text-sm text-gray-500">
                    Betting opens when game starts
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
