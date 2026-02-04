import { useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, GAME_CODE_LENGTH } from "@prescio/common";

export function LobbyPage() {
  const [nickname, setNickname] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");

  const isValidNickname = nickname.length >= MIN_NICKNAME_LENGTH && nickname.length <= MAX_NICKNAME_LENGTH;
  const isValidCode = gameCode.length === GAME_CODE_LENGTH;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mb-4 text-6xl">🔮</div>
        <h2 className="mb-2 text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            Prescio
          </span>
        </h2>
        <p className="text-lg text-gray-400">
          Social deduction meets prediction markets.
          <br />
          Predict. Bet. Win.
        </p>
      </div>

      {/* Game Info */}
      <div className="mb-8 flex gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <span>👥</span> {MIN_PLAYERS}-{MAX_PLAYERS} Players
        </div>
        <div className="flex items-center gap-1">
          <span>⛓️</span> Monad Testnet
        </div>
        <div className="flex items-center gap-1">
          <span>💰</span> On-chain Bets
        </div>
      </div>

      {/* Nickname input */}
      <div className="mb-6 w-full max-w-sm">
        <label className="mb-2 block text-sm font-medium text-gray-300">
          Your Nickname
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, MAX_NICKNAME_LENGTH))}
          placeholder="Enter nickname..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          maxLength={MAX_NICKNAME_LENGTH}
        />
        <p className="mt-1 text-xs text-gray-500">
          {nickname.length}/{MAX_NICKNAME_LENGTH} characters
        </p>
      </div>

      {/* Action buttons */}
      {mode === "menu" && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            onClick={() => setMode("create")}
            disabled={!isValidNickname}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🎮 Create Game
          </button>
          <button
            onClick={() => setMode("join")}
            disabled={!isValidNickname}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🚪 Join Game
          </button>
        </div>
      )}

      {/* Create game */}
      {mode === "create" && (
        <div className="w-full max-w-sm">
          <button
            onClick={() => {
              // TODO: Create game via WebSocket
              console.log("Creating game as", nickname);
            }}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all hover:from-purple-500 hover:to-pink-500"
          >
            🚀 Create & Start Lobby
          </button>
          <button
            onClick={() => setMode("menu")}
            className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-6 py-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            ← Back
          </button>
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
            onChange={(e) => setGameCode(e.target.value.toUpperCase().slice(0, GAME_CODE_LENGTH))}
            placeholder="Enter game code..."
            className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-center text-xl font-mono tracking-widest text-white placeholder-gray-500 uppercase outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            maxLength={GAME_CODE_LENGTH}
          />
          <button
            onClick={() => {
              // TODO: Join game via WebSocket
              console.log("Joining game", gameCode, "as", nickname);
            }}
            disabled={!isValidCode}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🚪 Join Lobby
          </button>
          <button
            onClick={() => setMode("menu")}
            className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-6 py-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Recent games placeholder */}
      <div className="mt-12 w-full max-w-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-400">Active Games</h3>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center text-sm text-gray-500">
          No active games yet. Create one to get started!
        </div>
      </div>
    </div>
  );
}
