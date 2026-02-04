import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phase } from "@prescio/common";
import type { GameLanguage } from "@prescio/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Users, Zap, Coins, Loader2, Gamepad2 } from "lucide-react";
import { createGame, startGame } from "@/lib/api";
import { useActiveGames, useFinishedGames } from "@/hooks/useGames";
import { ActiveGameCard, FinishedGameCard } from "@/components/game/GameCard";

export function LobbyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: activeGames = [], isLoading: loadingActive, error: activeError } = useActiveGames();
  const { data: finishedGames = [], isLoading: loadingFinished } = useFinishedGames();

  // Create game dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [botCount, setBotCount] = useState("5");
  const [impostorCount, setImpostorCount] = useState("1");
  const [language, setLanguage] = useState<GameLanguage>("en");

  // Create + auto-start mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createGame({
        botCount: Number(botCount),
        impostorCount: Number(impostorCount),
        language,
      });
      // Auto-start the game immediately
      await startGame(result.id, result.hostId);
      return result;
    },
    onSuccess: (result) => {
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["games"] });
      navigate({ to: "/game/$gameId", params: { gameId: result.id } });
    },
  });

  const handleWatch = (gameId: string) => {
    navigate({ to: "/game/$gameId", params: { gameId } });
  };

  // Filter active games into in-progress vs lobby
  const inProgressGames = activeGames.filter((g) => g.phase !== Phase.LOBBY);
  const lobbyGames = activeGames.filter((g) => g.phase === Phase.LOBBY);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mb-3 text-5xl">🔮</div>
        <h2 className="mb-2 text-4xl font-bold tracking-tight">
          <span className="gradient-text">Prescio</span>
        </h2>
        <p className="text-lg text-gray-400">
          Among Us × Prediction Market
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Watch AI agents deceive each other. Predict the impostor. Win.
        </p>
      </div>

      {/* Feature badges */}
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <Badge variant="outline" className="border-purple-500/30 text-purple-300 px-3 py-1">
          <Users className="mr-1.5 h-3 w-3" />
          AI Agents
        </Badge>
        <Badge variant="outline" className="border-pink-500/30 text-pink-300 px-3 py-1">
          <Zap className="mr-1.5 h-3 w-3" />
          Monad Testnet
        </Badge>
        <Badge variant="outline" className="border-orange-500/30 text-orange-300 px-3 py-1">
          <Coins className="mr-1.5 h-3 w-3" />
          On-chain Bets
        </Badge>
      </div>

      {/* Create Game Button + Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="mb-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold px-8"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create New Game
          </Button>
        </DialogTrigger>
        <DialogContent className="border-gray-800 bg-gray-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-purple-400" />
              New Game
            </DialogTitle>
            <DialogDescription>
              Configure your AI social deduction game.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Bot Count */}
            <div className="grid gap-2">
              <Label htmlFor="botCount">Number of Bots</Label>
              <Select value={botCount} onValueChange={setBotCount}>
                <SelectTrigger id="botCount" className="border-gray-700 bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-800">
                  <SelectItem value="5">5 Bots</SelectItem>
                  <SelectItem value="6">6 Bots</SelectItem>
                  <SelectItem value="7">7 Bots</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Total players including the host</p>
            </div>

            {/* Impostor Count */}
            <div className="grid gap-2">
              <Label htmlFor="impostorCount">Impostors</Label>
              <Select value={impostorCount} onValueChange={setImpostorCount}>
                <SelectTrigger id="impostorCount" className="border-gray-700 bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-800">
                  <SelectItem value="1">1 Impostor</SelectItem>
                  <SelectItem value="2">2 Impostors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as GameLanguage)}>
                <SelectTrigger id="language" className="border-gray-700 bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-800">
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                  <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                  <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                  <SelectItem value="zh">🇨🇳 中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-red-400">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to create game"}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  🚀 Create & Start
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Games Tabs */}
      <div className="w-full">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2 bg-gray-800/50">
            <TabsTrigger value="active" className="data-[state=active]:bg-purple-600/20">
              In Progress
              {inProgressGames.length > 0 && (
                <Badge className="ml-2 bg-purple-600/30 text-purple-300 text-xs px-1.5">
                  {inProgressGames.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="finished" className="data-[state=active]:bg-gray-600/20">
              Completed
              {finishedGames.length > 0 && (
                <Badge className="ml-2 bg-gray-600/30 text-gray-300 text-xs px-1.5">
                  {finishedGames.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Active Games Tab */}
          <TabsContent value="active" className="space-y-3">
            {loadingActive && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </div>
            )}

            {activeError && (
              <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-center text-sm text-red-400">
                Failed to load games. Is the server running?
              </div>
            )}

            {!loadingActive && !activeError && activeGames.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/30 py-16">
                <div className="mb-3 text-4xl">🎮</div>
                <p className="text-gray-400 font-medium">No active games</p>
                <p className="mt-1 text-sm text-gray-500">
                  Create a new game to get started!
                </p>
              </div>
            )}

            {/* Lobby games */}
            {lobbyGames.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 px-1">
                  Waiting in Lobby
                </h3>
                {lobbyGames.map((game) => (
                  <ActiveGameCard key={game.id} game={game} onWatch={handleWatch} />
                ))}
              </div>
            )}

            {/* In-progress games */}
            {inProgressGames.length > 0 && (
              <div className="space-y-2">
                {lobbyGames.length > 0 && (
                  <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 px-1 mt-4">
                    Live Games
                  </h3>
                )}
                {inProgressGames.map((game) => (
                  <ActiveGameCard key={game.id} game={game} onWatch={handleWatch} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Finished Games Tab */}
          <TabsContent value="finished" className="space-y-2">
            {loadingFinished && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}

            {!loadingFinished && finishedGames.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/30 py-16">
                <div className="mb-3 text-4xl">📜</div>
                <p className="text-gray-400 font-medium">No completed games yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Finished games will appear here.
                </p>
              </div>
            )}

            {finishedGames.map((game) => (
              <FinishedGameCard key={game.id} game={game} onWatch={handleWatch} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
