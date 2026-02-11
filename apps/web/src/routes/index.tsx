import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
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
import { Plus, Users, Zap, Coins, Loader2, Gamepad2, Wallet, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createGame, startGame } from "@/lib/api";
import { useActiveGames, useFinishedGames, useMyBets } from "@/hooks/useGames";
import { ActiveGameCard, FinishedGameCard, MyBetCard } from "@/components/game/GameCard";
import { useI18n } from "@/i18n";
import { useNetwork } from "@/hooks/useNetwork";

export function LobbyPage() {
  const { t } = useI18n();
  const { network } = useNetwork();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { data: activeGames = [], isLoading: loadingActive, error: activeError } = useActiveGames();
  const { data: finishedData, isLoading: loadingFinished } = useFinishedGames();
  const { data: myBetsData, isLoading: loadingMyBets } = useMyBets(address);
  const finishedGames = finishedData?.games ?? [];
  const finishedTotal = finishedData?.total ?? 0;
  const myBets = myBetsData?.bets ?? [];
  const myBetsTotal = myBetsData?.total ?? 0;

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
    <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <img src="/prescio-icon.png" alt="Prescio" className="mx-auto mb-4 h-40 w-40 rounded-3xl" />
        <h2 className="mb-2 text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-monad-purple via-[#9B87FF] to-monad-purple bg-clip-text text-transparent">
            Prescio
          </span>
        </h2>
        <p className="text-lg text-gray-400">
          {t("tagline")}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {t("subtitle")}
        </p>

        {/* Built by kooroot badge */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-monad-purple/30 bg-monad-purple/5 px-4 py-1.5">
          <div className="h-2 w-2 rounded-full bg-monad-purple animate-pulse" />
          <span className="text-xs font-medium text-monad-purple">
            {t("builtBy")}
          </span>
        </div>
      </div>

      {/* Feature badges */}
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <Badge variant="outline" className="border-monad-purple/30 text-monad-purple px-3 py-1">
          <Users className="mr-1.5 h-3 w-3" />
          {t("badgeAgents")}
        </Badge>
        <Badge variant="outline" className="border-monad-purple/20 text-[#9B87FF] px-3 py-1">
          <Zap className="mr-1.5 h-3 w-3" />
          {network.name}
        </Badge>
        <Badge variant="outline" className="border-monad-purple/20 text-[#9B87FF] px-3 py-1">
          <Coins className="mr-1.5 h-3 w-3" />
          {t("badgeBets")}
        </Badge>
      </div>

      {/* Create Game Button + Stake to Boost + Dialog */}
      <div className="mb-10 flex items-center gap-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              className="bg-monad-purple hover:bg-monad-purple/80 text-white font-semibold px-8 monad-glow"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t("createGame")}
            </Button>
          </DialogTrigger>
        <DialogContent className="border-monad-border bg-monad-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-monad-purple" />
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
                <SelectTrigger id="botCount" className="border-monad-border bg-monad-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-monad-border bg-monad-card">
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
                <SelectTrigger id="impostorCount" className="border-monad-border bg-monad-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-monad-border bg-monad-card">
                  <SelectItem value="1">1 Impostor</SelectItem>
                  <SelectItem value="2">2 Impostors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as GameLanguage)}>
                <SelectTrigger id="language" className="border-monad-border bg-monad-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-monad-border bg-monad-card">
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                  <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                  <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                  <SelectItem value="zh">🇨🇳 中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-impostor">
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
              {t("cancel")}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-monad-purple hover:bg-monad-purple/80 text-white"
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

        {/* Stake to Boost CTA */}
        <Link to="/staking">
          <Button
            size="lg"
            variant="outline"
            className="border-monad-purple/50 text-monad-purple hover:bg-monad-purple/10 font-semibold px-6"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Stake to Boost
            <Badge className="ml-2 bg-monad-purple/20 text-monad-purple text-xs px-1.5 py-0.5">
              2.0x
            </Badge>
          </Button>
        </Link>
      </div>

      {/* Games Tabs */}
      <div className="w-full">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-3 bg-monad-card/50">
            <TabsTrigger value="active" className="data-[state=active]:bg-monad-purple/20">
              {t("inProgress")}
              {inProgressGames.length > 0 && (
                <Badge className="ml-2 bg-monad-purple/30 text-monad-purple text-xs px-1.5">
                  {inProgressGames.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mybets" className="data-[state=active]:bg-yellow-500/20">
              {t("myBets")}
              {myBetsTotal > 0 && (
                <Badge className="ml-2 bg-yellow-500/30 text-yellow-400 text-xs px-1.5">
                  {myBetsTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="finished" className="data-[state=active]:bg-[#27272A]/60">
              {t("completed")}
              {finishedTotal > 0 && (
                <Badge className="ml-2 bg-[#27272A]/50 text-gray-300 text-xs px-1.5">
                  {finishedTotal > 50 ? "50+" : finishedTotal}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Active Games Tab */}
          <TabsContent value="active" className="space-y-3">
            {loadingActive && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-monad-purple" />
              </div>
            )}

            {activeError && (
              <div className="rounded-lg border border-impostor/30 bg-impostor/10 p-4 text-center text-sm text-impostor">
                {t("failedToLoad")}
              </div>
            )}

            {!loadingActive && !activeError && activeGames.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-monad-border bg-monad-card/30 py-16">
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

          {/* My Bets Tab */}
          <TabsContent value="mybets" className="space-y-2">
            {!isConnected && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/5 py-16">
                <Wallet className="mb-3 h-10 w-10 text-yellow-500/50" />
                <p className="text-gray-400 font-medium">{t("connectToViewBets")}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("connectToViewBetsDesc")}
                </p>
              </div>
            )}

            {isConnected && loadingMyBets && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            )}

            {isConnected && !loadingMyBets && myBets.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-monad-border bg-monad-card/30 py-16">
                <div className="mb-3 text-4xl">🎰</div>
                <p className="text-gray-400 font-medium">{t("noBetsYet")}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {t("noBetsYetDesc")}
                </p>
              </div>
            )}

            {isConnected && myBets.map((bet) => (
              <MyBetCard key={bet.gameId} bet={bet} onWatch={handleWatch} />
            ))}
          </TabsContent>

          {/* Finished Games Tab */}
          <TabsContent value="finished" className="space-y-2">
            {loadingFinished && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}

            {!loadingFinished && finishedGames.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-monad-border bg-monad-card/30 py-16">
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
