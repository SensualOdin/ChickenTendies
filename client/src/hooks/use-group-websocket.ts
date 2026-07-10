import { useEffect, useRef, useState } from "react";
import { isNative } from "@/lib/platform";
import type { WSMessage } from "@shared/schema";

type Options = {
  groupId: string | undefined;
  memberId: string | undefined;
  onMessage: (msg: WSMessage) => void;
  // Shown in logs to disambiguate which page opened the socket.
  label?: string;
};

const MAX_RECONNECT_ATTEMPTS = 10;
const NATIVE_WS_HOST = "wss://chickentinders.onrender.com";

function buildWsUrl(groupId: string, memberId: string): string {
  if (isNative()) {
    return `${NATIVE_WS_HOST}/ws?groupId=${groupId}&memberId=${memberId}`;
  }
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const url = new URL(apiUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${url.host}/ws?groupId=${groupId}&memberId=${memberId}`;
  }
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.host}/ws?groupId=${groupId}&memberId=${memberId}`;
}

// Shared real-time channel for the swipe / matches / lobby pages.
// Handles connection, reconnect with exponential backoff, and clean teardown.
// `onMessage` is held in a ref so the socket doesn't rebuild on every render.
export function useGroupWebSocket({ groupId, memberId, onMessage, label = "Group" }: Options) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!groupId || !memberId) return;

    let activeSocket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let closedIntentionally = false;

    const connect = () => {
      const wsUrl = buildWsUrl(groupId, memberId);
      const s = new WebSocket(wsUrl);
      activeSocket = s;

      s.onopen = () => {
        console.log(`[${label}] WebSocket connected`);
        reconnectAttempts = 0;
        setConnected(true);
      };

      s.onmessage = (event) => {
        try {
          const parsed: WSMessage = JSON.parse(event.data);
          onMessageRef.current(parsed);
        } catch (err) {
          console.error(`[${label}] Failed to parse WS message`, err);
        }
      };

      s.onclose = () => {
        setConnected(false);
        if (closedIntentionally) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        reconnectAttempts++;
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
        console.log(
          `[${label}] WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`,
        );
        reconnectTimeout = setTimeout(connect, delay);
      };

      s.onerror = (err) => {
        console.error(`[${label}] WebSocket error`, err);
      };

      setSocket(s);
    };

    connect();

    return () => {
      closedIntentionally = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (activeSocket && activeSocket.readyState <= WebSocket.OPEN) {
        activeSocket.close();
      }
      setSocket(null);
      setConnected(false);
    };
  }, [groupId, memberId, label]);

  return { socket, connected };
}
