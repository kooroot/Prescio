import { Phase, Role } from "@prescio/common";
import type { GameState, ChatMessage } from "@prescio/common";
import { ChatLog } from "./ChatLog";
import { GameResult } from "./GameResult";

interface GameBoardProps {
  game: GameState;
  chatMessages: ChatMessage[];
  lastVoteResult?: {
    votes: Record<string, number>;
    eliminatedId: string | null;
    skipped: boolean;
  } | null;
}

export function GameBoard({ game, chatMessages, lastVoteResult }: GameBoardProps) {
  switch (game.phase) {
    case Phase.LOBBY:
      return <LobbyView code={game.code} playerCount={game.players.length} />;

    case Phase.NIGHT:
      return <NightView round={game.round} />;

    case Phase.REPORT:
      return <ReportView />;

    case Phase.DISCUSSION:
      return (
        <div className="flex flex-col h-full">
          <ChatLog messages={chatMessages} />
        </div>
      );

    case Phase.VOTE:
      return (
        <div className="flex flex-col h-full">
          <div className="shrink-0 flex items-center justify-center gap-2 py-3 bg-orange-900/20 border-b border-orange-500/20">
            <span className="text-xl">🗳️</span>
            <span className="text-orange-300 font-semibold text-sm uppercase tracking-wider">
              Voting in progress...
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ChatLog messages={chatMessages} />
          </div>
        </div>
      );

    case Phase.RESULT:
      if (game.winner) {
        return (
          <GameResult
            winner={game.winner}
            players={game.players}
            killEvents={game.killEvents}
            rounds={game.round}
          />
        );
      }
      // Vote result phase (between rounds)
      return (
        <div className="flex flex-col h-full">
          {lastVoteResult && (
            <div className="shrink-0 py-3 px-4 bg-emerald-900/20 border-b border-emerald-500/20 text-center">
              <span className="text-emerald-300 text-sm">
                {lastVoteResult.skipped
                  ? "No one was ejected."
                  : lastVoteResult.eliminatedId
                    ? `${game.players.find((p) => p.id === lastVoteResult.eliminatedId)?.nickname ?? "Someone"} was ejected.`
                    : "Vote concluded."}
              </span>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <ChatLog messages={chatMessages} />
          </div>
        </div>
      );

    default:
      return (
        <div className="flex h-full items-center justify-center text-gray-500">
          Unknown phase
        </div>
      );
  }
}

// ─── Sub-views ────────────────────────────────────────

function LobbyView({ code, playerCount }: { code: string; playerCount: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl">🎮</div>
      <h2 className="text-2xl font-bold text-gray-200">Waiting for Game</h2>
      <p className="text-gray-400">
        Game <span className="font-mono text-purple-400">{code}</span> is in the lobby.
      </p>
      <p className="text-sm text-gray-500">{playerCount} players joined</p>
    </div>
  );
}

function NightView({ round }: { round: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-indigo-950/50 to-gray-950/50 rounded-lg">
      <div className="text-7xl animate-pulse">🌙</div>
      <h2 className="text-2xl font-bold text-purple-300">Night has fallen...</h2>
      <p className="text-gray-500 text-sm">Round {round} — The impostor is on the move</p>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"
            style={{ animationDelay: `${i * 300}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ReportView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-red-950/40 to-gray-950/50 rounded-lg">
      <div className="text-7xl animate-bounce">⚠️</div>
      <h2 className="text-3xl font-black text-red-400 uppercase tracking-wider">
        Body Reported!
      </h2>
      <p className="text-gray-400 text-sm">Emergency meeting called</p>
    </div>
  );
}
