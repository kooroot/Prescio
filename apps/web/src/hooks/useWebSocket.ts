import { useEffect, useRef, useCallback } from "react";
import { wsClient } from "@/lib/ws";
import type { ServerEvent } from "@prescio/common";

type EventHandler = (event: ServerEvent) => void;

interface UseWebSocketOptions {
  gameId: string;
  onEvent?: EventHandler;
  address?: string;
}

/**
 * WebSocket hook for a single game.
 * - Connects to the game WS on mount
 * - Sends JOIN_SPECTATE automatically
 * - Forwards all server events to onEvent callback
 * - Sends LEAVE_SPECTATE + disconnects on cleanup
 */
export function useWebSocket({ gameId, onEvent, address }: UseWebSocketOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!gameId) return;

    // Connect
    wsClient.connect(gameId, address);

    // Send JOIN_SPECTATE once connected
    // Small delay to ensure connection is established
    const joinTimer = setTimeout(() => {
      wsClient.send({ type: "JOIN_SPECTATE", payload: { gameId } });
    }, 200);

    // Subscribe to events
    const unsub = wsClient.on((event) => {
      onEventRef.current?.(event);
    });

    return () => {
      clearTimeout(joinTimer);
      unsub();
      // Send leave before disconnect
      if (wsClient.isConnected()) {
        wsClient.send({ type: "LEAVE_SPECTATE", payload: { gameId } });
      }
      wsClient.disconnect();
    };
  }, [gameId, address]);

  const send = useCallback(
    (event: Parameters<typeof wsClient.send>[0]) => {
      wsClient.send(event);
    },
    [],
  );

  return { send, isConnected: wsClient.isConnected };
}
