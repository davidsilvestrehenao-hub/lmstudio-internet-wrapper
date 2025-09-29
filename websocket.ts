import type { ServerWebSocket } from "bun";
import { logger } from "./logger";
import { config } from "./config";
import { EventEmitter } from "events";

// We don't need WSData type anymore since we're using the connection map to track IDs

export class WebSocketManager extends EventEmitter {
  // Use ServerWebSocket<unknown> so the manager accepts Bun's websocket with any data generic
  private connections: Map<string, ServerWebSocket<unknown>> = new Map();
  private heartbeatInterval: number = 30000; // 30 seconds
  private retryAttempts: Map<string, number> = new Map();

  constructor() {
    super();
    this.setupHeartbeat();
  }

  addConnection(id: string, ws: ServerWebSocket<unknown>) {
    this.connections.set(id, ws);
    this.retryAttempts.set(id, 0);
    logger.info(`WebSocket client connected`, { id });

    // Setup ping/pong and auto-cleanup
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        clearInterval(pingInterval);
        this.handleDisconnect(id);
      }
    }, this.heartbeatInterval);
  }

  private handleDisconnect(id: string) {
    this.connections.delete(id);
    logger.info(`WebSocket client disconnected`, { id });

    const attempts = this.retryAttempts.get(id) || 0;
    if (attempts < config.maxRetries) {
      this.retryAttempts.set(id, attempts + 1);
      this.emit("retry", id);
    }
  }

  private handleError(id: string, error: Error) {
    logger.error(`WebSocket error`, { id, error: error.message });
    const ws = this.connections.get(id);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", error: error.message }));
    }
  }

  private async handleMessage(id: string, data: string | Buffer) {
    try {
      const message = JSON.parse(data.toString());
      this.emit("message", id, message);
    } catch (error) {
      this.handleError(
        id,
        error instanceof Error ? error : new Error("Failed to parse message"),
      );
    }
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.connections.forEach((ws, id) => {
        if (ws.readyState !== 1) {
          this.handleDisconnect(id);
        }
      });
    }, this.heartbeatInterval);
  }

  broadcast(message: unknown) {
    const payload = JSON.stringify(message);
    this.connections.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    });
  }

  send(id: string, message: unknown) {
    const ws = this.connections.get(id);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  close(id: string) {
    const ws = this.connections.get(id);
    if (ws) {
      ws.close();
      this.connections.delete(id);
    }
  }

  closeAll() {
    this.connections.forEach((ws) => ws.close());
    this.connections.clear();
  }
}

export const wsManager = new WebSocketManager();
