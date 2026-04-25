import type { ClientMsg, ServerMsg } from '../types/multiplayer-protocol';

type MessageHandler = (msg: ServerMsg) => void;

class MultiplayerWS {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.startPing();
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMsg;
          for (const h of this.handlers) h(msg);
        } catch {
          // ignore malformed
        }
      };

      ws.onerror = () => reject(new Error('WebSocket connection failed'));

      ws.onclose = () => {
        this.stopPing();
        this.ws = null;
      };
    });
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startPing() {
    this.pingTimer = setInterval(() => this.send({ type: 'PING' }), 25_000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export const multiplayerWS = new MultiplayerWS();
