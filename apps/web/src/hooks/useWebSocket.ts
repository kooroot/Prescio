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
 * - JOIN_SPECTATE is sent automatically by wsClient on connection
 * - Forwards all server events to onEvent callback
 * - Sends LEAVE_SPECTATE + disconnects on cleanup
 */
export function useWebSocket({ gameId, onEvent, address }: UseWebSocketOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!gameId) return;

    // Connect (JOIN_SPECTATE is sent automatically on connection)
    wsClient.connect(gameId, address);

    // Subscribe to events
    const unsub = wsClient.on((event) => {
      onEventRef.current?.(event);
    });

    return () => {
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
