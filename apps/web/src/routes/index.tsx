import { useState } from "react";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  MAX_NICKNAME_LENGTH,
  MIN_NICKNAME_LENGTH,
  GAME_CODE_LENGTH,
} from "@prescio/common";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, DoorOpen, Users, Zap, Coins } from "lucide-react";

export function LobbyPage() {
  const [nickname, setNickname] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");

  const isValidNickname =
    nickname.length >= MIN_NICKNAME_LENGTH &&
    nickname.length <= MAX_NICKNAME_LENGTH;
  const isValidCode = gameCode.length === GAME_CODE_LENGTH;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mb-4 text-6xl">🔮</div>
        <h2 className="mb-2 text-4xl font-bold tracking-tight">
          <span className="gradient-text">Prescio</span>
        </h2>
        <p className="text-lg text-gray-400">
          Among Us × Prediction Market
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Social deduction meets on-chain betting. Predict. Bet. Win.
        </p>
      </div>

      {/* Feature badges */}
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <Badge variant="outline" className="border-purple-500/30 text-purple-300 px-3 py-1">
          <Users className="mr-1.5 h-3 w-3" />
          {MIN_PLAYERS}-{MAX_PLAYERS} Players
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

      {/* Nickname input */}
      <Card className="mb-6 w-full max-w-sm border-gray-800 bg-gray-900/50">
        <CardContent className="pt-6">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Your Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) =>
              setNickname(e.target.value.slice(0, MAX_NICKNAME_LENGTH))
            }
            placeholder="Enter nickname..."
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            maxLength={MAX_NICKNAME_LENGTH}
          />
          <p className="mt-1 text-xs text-gray-500">
            {nickname.length}/{MAX_NICKNAME_LENGTH} characters
          </p>
        </CardContent>
      </Card>

      {/* Action buttons */}
      {mode === "menu" && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button
            onClick={() => setMode("create")}
            disabled={!isValidNickname}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold"
          >
            <Gamepad2 className="mr-2 h-5 w-5" />
            Create Game
          </Button>
          <Button
            onClick={() => setMode("join")}
            disabled={!isValidNickname}
            variant="outline"
            size="lg"
            className="w-full border-gray-600 bg-gray-800 hover:bg-gray-700 text-white font-semibold"
          >
            <DoorOpen className="mr-2 h-5 w-5" />
            Join Game
          </Button>
        </div>
      )}

      {/* Create game */}
      {mode === "create" && (
        <div className="w-full max-w-sm">
          <Button
            onClick={() => {
              // TODO: Create game via API + WebSocket
              console.log("Creating game as", nickname);
            }}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold"
          >
            🚀 Create & Start Lobby
          </Button>
          <Button
            onClick={() => setMode("menu")}
            variant="ghost"
            className="mt-3 w-full text-gray-400 hover:text-white"
          >
            ← Back
          </Button>
        </div>
      )}

      {/* Join game */}
      {mode === "join" && (
        <div className="w-full max-w-sm">
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Game Code
          </label>
          <input
            type="text"
            value={gameCode}
            onChange={(e) =>
              setGameCode(
                e.target.value.toUpperCase().slice(0, GAME_CODE_LENGTH)
              )
            }
            placeholder="Enter game code..."
            className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-center text-xl font-mono tracking-widest text-white uppercase placeholder-gray-500 outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            maxLength={GAME_CODE_LENGTH}
          />
          <Button
            onClick={() => {
              // TODO: Join game via WebSocket
              console.log("Joining game", gameCode, "as", nickname);
            }}
            disabled={!isValidCode}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold"
          >
            🚪 Join Lobby
          </Button>
          <Button
            onClick={() => setMode("menu")}
            variant="ghost"
            className="mt-3 w-full text-gray-400 hover:text-white"
          >
            ← Back
          </Button>
        </div>
      )}

      {/* Active games */}
      <div className="mt-12 w-full max-w-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-400">
          Active Games
        </h3>
        <Card className="border-gray-800 bg-gray-900/30">
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-sm text-gray-500">
              No active games yet. Create one to get started!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
