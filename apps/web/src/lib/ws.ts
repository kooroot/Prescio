import type { ServerEvent, ClientEvent } from "@prescio/common";
import { parseEvent, serializeEvent } from "@prescio/common";

type EventHandler = (event: ServerEvent) => void;

const WS_BASE = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws`;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;
const PING_INTERVAL_MS = 25000;

interface WsClient {
  connect(gameId: string, address?: string): void;
  disconnect(): void;
  send(event: ClientEvent): void;
  on(handler: EventHandler): () => void;
  isConnected(): boolean;
}

function createWsClient(): WsClient {
  let ws: WebSocket | null = null;
  let handlers: Set<EventHandler> = new Set();
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let currentGameId: string | null = null;
  let currentAddress: string | undefined;
  let intentionalClose = false;

  function cleanup() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (intentionalClose || !currentGameId) return;

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      if (currentGameId) {
        connectInternal(currentGameId, currentAddress);
      }
    }, delay);
  }

  function connectInternal(gameId: string, address?: string) {
    cleanup();
    if (ws) {
      ws.onclose = null;
      ws.close();
    }

    const params = new URLSearchParams({ gameId });
    if (address) params.set("address", address);
    const url = `${WS_BASE}?${params}`;

    console.log(`[WS] Connecting to ${url}`);
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[WS] Connected");
      reconnectAttempts = 0;

      // Start ping
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING", payload: {} }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (e) => {
      try {
        const event = parseEvent(e.data as string) as ServerEvent;
        handlers.forEach((h) => h(event));
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };

    ws.onerror = (e) => {
      console.error("[WS] Error:", e);
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      cleanup();
      scheduleReconnect();
    };
  }

  return {
    connect(gameId: string, address?: string) {
      intentionalClose = false;
      currentGameId = gameId;
      currentAddress = address;
      reconnectAttempts = 0;
      connectInternal(gameId, address);
    },

    disconnect() {
      intentionalClose = true;
      currentGameId = null;
      currentAddress = undefined;
      cleanup();
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },

    send(event: ClientEvent) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(serializeEvent(event));
      } else {
        console.warn("[WS] Not connected, cannot send:", event);
      }
    },

    on(handler: EventHandler): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    isConnected() {
      return ws?.readyState === WebSocket.OPEN;
    },
  };
}

// Singleton
export const wsClient = createWsClient();
