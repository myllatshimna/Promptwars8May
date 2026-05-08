import { WebSocket } from 'ws';
import { Trip } from '../types/Trip';

export class WebSocketManager {
  private connections: Map<string, WebSocket[]> = new Map();

  /**
   * Registers a new client connection.
   */
  public connect(userId: string, connection: WebSocket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }
    this.connections.get(userId)?.push(connection);
    console.log(
      `[WebSocketManager] Client connected for User ID: ${userId}. Total connections: ${this.connections.get(userId)?.length}`,
    );

    connection.on('close', () => {
      this.disconnect(userId, connection);
    });
  }

  /**
   * Pushes real-time Trip updates to the specific user.
   */
  public pushTripUpdate(userId: string, trip: Trip) {
    const userConnections = this.connections.get(userId);

    if (!userConnections || userConnections.length === 0) {
      console.log(`[WebSocketManager] No active connections for User ID: ${userId}. Update not sent.`);
      return;
    }

    const payload = JSON.stringify({
      type: 'TRIP_UPDATED',
      timestamp: new Date().toISOString(),
      data: trip,
    });

    userConnections.forEach((conn) => {
      try {
        if (conn.readyState === WebSocket.OPEN) {
          conn.send(payload);
          console.log(`[WebSocketManager] Pushed update to a connection for User ID: ${userId}`);
        }
      } catch (error) {
        console.error(`[WebSocketManager] Failed to send update`, error);
      }
    });
  }

  /**
   * Removes a disconnected client.
   */
  private disconnect(userId: string, connection: WebSocket) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      this.connections.set(
        userId,
        userConnections.filter((c) => c !== connection),
      );
      console.log(
        `[WebSocketManager] Client disconnected for User ID: ${userId}. Remaining: ${this.connections.get(userId)?.length}`,
      );
    }
  }
}
