import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGame } from "@/lib/api";
import { useWebSocket } from "./useWebSocket";
import { Phase, Role } from "@prescio/common";
import type { ServerEvent, ServerPayloads } from "@prescio/common";
import type { GameState, ChatMessage } from "@prescio/common";

interface UseGameReturn {
  game: GameState | undefined;
  isLoading: boolean;
  error: Error | null;
  chatMessages: ChatMessage[];
  spectatorCount: number;
  timeRemaining: number;
  /** Real-time phase from WebSocket (more reliable than cached game.phase) */
  livePhase: Phase | null;
  /** Real-time round from WebSocket */
  liveRound: number | null;
  send: ReturnType<typeof useWebSocket>["send"];
}

/**
 * Single game Query + WS hook.
 * Fetches initial state via REST, then applies real-time WS updates.
 */
export function useGame(gameId: string): UseGameReturn {
  const queryClient = useQueryClient();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [livePhase, setLivePhase] = useState<Phase | null>(null);
  const [liveRound, setLiveRound] = useState<number | null>(null);

  const { data: game, isLoading, error } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const state = await fetchGame(gameId);
      // Initialize chat messages and timeRemaining from REST response
      setChatMessages(state.chatMessages ?? []);
      const tr = state.timeRemaining ?? 0;
      console.log("[useGame] Loaded game, timeRemaining:", tr, "phase:", state.phase);
      setTimeRemaining(tr);
      setLivePhase(state.phase);
      setLiveRound(state.round);
      return state;
    },
    enabled: !!gameId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "GAME_STATE": {
          const payload = event.payload as ServerPayloads["GAME_STATE"];
          setTimeRemaining(payload.timeRemaining);
          // Update live state immediately (most reliable)
          setLivePhase(payload.phase);
          setLiveRound(payload.round);
          // Update query cache with fresh player data
          queryClient.setQueryData<GameState>(["game", gameId], (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              phase: payload.phase,
              round: payload.round,
              alivePlayers: payload.alivePlayers,
              players: prev.players.map((p) => {
                const updated = payload.players.find((pp) => pp.id === p.id);
                return updated
                  ? { ...p, isAlive: updated.isAlive, isConnected: updated.isConnected }
                  : p;
              }),
            };
          });
          break;
        }

        case "PHASE_CHANGE": {
          const payload = event.payload as ServerPayloads["PHASE_CHANGE"];
          setTimeRemaining(payload.timeRemaining);
          // Update live state immediately (most reliable)
          setLivePhase(payload.phase);
          setLiveRound(payload.round);
          console.log(`[useGame] PHASE_CHANGE: ${payload.phase} round ${payload.round}`);
          queryClient.setQueryData<GameState>(["game", gameId], (prev) => {
            if (!prev) return prev;
            return { ...prev, phase: payload.phase, round: payload.round };
          });
          break;
        }

        case "CHAT_MESSAGE": {
          const msg = event.payload as ChatMessage;
          setChatMessages((prev) => [...prev, msg]);
          break;
        }

        case "PLAYER_KILLED": {
          const payload = event.payload as ServerPayloads["PLAYER_KILLED"];
          queryClient.setQueryData<GameState>(["game", gameId], (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === payload.playerId ? { ...p, isAlive: false } : p,
              ),
              alivePlayers: prev.alivePlayers.filter((id) => id !== payload.playerId),
              eliminatedPlayers: [...prev.eliminatedPlayers, payload.playerId],
              killEvents: [
                ...prev.killEvents,
                {
                  killerId: "",
                  targetId: payload.playerId,
                  round: payload.round,
                  timestamp: Date.now(),
                },
              ],
            };
          });
          break;
        }

        case "PLAYER_ELIMINATED": {
          const payload = event.payload as ServerPayloads["PLAYER_ELIMINATED"];
          queryClient.setQueryData<GameState>(["game", gameId], (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.id === payload.playerId ? { ...p, isAlive: false } : p,
              ),
              alivePlayers: prev.alivePlayers.filter((id) => id !== payload.playerId),
              eliminatedPlayers: [...prev.eliminatedPlayers, payload.playerId],
            };
          });
          break;
        }

        case "VOTE_CAST": {
          // Just note that someone voted (anonymous until result)
          break;
        }

        case "VOTE_RESULT": {
          const payload = event.payload as ServerPayloads["VOTE_RESULT"];
          queryClient.setQueryData<GameState>(["game", gameId], (prev) => {
            if (!prev) return prev;
            const votes = Object.entries(payload.votes).map(([targetId, _count]) => ({
              voterId: "",
              targetId,
              timestamp: Date.now(),
            }));
            return { ...prev, votes: [...prev.votes, ...votes] };
          });
          break;
        }

        case "GAME_OVER": {
          const payload = event.payload as ServerPayloads["GAME_OVER"];
          queryClient.setQueryData<GameState>(["game", gameId], (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              phase: Phase.RESULT,
              winner: payload.winner as GameState["winner"],
              // Reveal impostor roles
              players: prev.players.map((p) => ({
                ...p,
                role: payload.impostors.includes(p.id) ? Role.IMPOSTOR : Role.CREW,
              })),
            };
          });
          break;
        }

        case "SPECTATOR_COUNT": {
          const payload = event.payload as ServerPayloads["SPECTATOR_COUNT"];
          setSpectatorCount(payload.count);
          break;
        }

        default:
          break;
      }
    },
    [gameId, queryClient],
  );

  const { send } = useWebSocket({ gameId, onEvent: handleEvent });

  return {
    game,
    isLoading,
    error: error as Error | null,
    chatMessages,
    spectatorCount,
    timeRemaining,
    livePhase,
    liveRound,
    send,
  };
}
