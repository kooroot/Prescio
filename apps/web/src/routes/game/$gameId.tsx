import { useParams } from "@tanstack/react-router";

export function GamePage() {
  const { gameId } = useParams({ from: "/game/$gameId" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">
        Game: <span className="text-purple-400 font-mono">{gameId}</span>
      </h1>
      <p className="mt-2 text-gray-400">
        Game spectator view — coming in the next step.
      </p>
    </div>
  );
}
