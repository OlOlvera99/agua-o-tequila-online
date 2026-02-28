import { GameRoom } from './GameRoom';
import type { GameSettings } from './types';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  createRoom(hostId: string, hostName: string, settings: Partial<GameSettings>): GameRoom {
    const room = new GameRoom(hostId, hostName, settings);
    this.rooms.set(room.id, room);
    return room;
  }

  getRoom(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  deleteRoom(id: string) {
    const room = this.rooms.get(id);
    if (room) room.destroy();
    this.rooms.delete(id);
  }

  removePlayer(socketId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) {
        room.removePlayer(socketId);
        return room;
      }
    }
    return undefined;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  /** Elimina salas inactivas por más de 1 hora */
  cleanup() {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    let cleaned = 0;

    for (const [id, room] of this.rooms.entries()) {
      if (now - room.lastActivity > ONE_HOUR || room.players.length === 0) {
        room.destroy();
        this.rooms.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Limpieza: ${cleaned} salas eliminadas. Activas: ${this.rooms.size}`);
    }
  }
}
