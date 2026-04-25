import type { WebSocket } from 'ws';
import type { ServerMsg, CardMode } from './protocol.js';

interface PlayerSlot {
  ws: WebSocket;
  name: string;
  address: string;
  committed: boolean;
  mode: CardMode | null;
}

interface Room {
  id: string;
  players: [PlayerSlot | null, PlayerSlot | null];
  round: number;
  readyNext: [boolean, boolean];
  createdAt: number;
  bothCommittedSent: boolean;
}

const rooms = new Map<string, Room>();
const ROOM_TIMEOUT_MS = 30 * 60 * 1000;

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function opponent(room: Room, index: 0 | 1): PlayerSlot | null {
  return room.players[index === 0 ? 1 : 0];
}

export function joinRoom(roomId: string, ws: WebSocket, name: string, address: string): void {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      players: [null, null],
      round: 0,
      readyNext: [false, false],
      createdAt: Date.now(),
      bothCommittedSent: false,
    };
    rooms.set(roomId, room);
  }

  if (!room.players[0]) {
    room.players[0] = { ws, name, address, committed: false, mode: null };
    send(ws, { type: 'ROOM_JOINED', role: 'player1', roomId, waitingForOpponent: true });
    return;
  }

  if (!room.players[1]) {
    room.players[1] = { ws, name, address, committed: false, mode: null };
    send(ws, { type: 'ROOM_JOINED', role: 'player2', roomId, waitingForOpponent: false });
    send(room.players[0].ws, {
      type: 'GAME_STARTED', yourRole: 'player1',
      opponent: { name, address },
    });
    send(ws, {
      type: 'GAME_STARTED', yourRole: 'player2',
      opponent: { name: room.players[0].name, address: room.players[0].address },
    });
    return;
  }

  send(ws, { type: 'ROOM_ERROR', code: 'ROOM_FULL', message: 'Room is full' });
}

export function findRoomByWs(ws: WebSocket): { room: Room; index: 0 | 1 } | null {
  for (const room of rooms.values()) {
    if (room.players[0]?.ws === ws) return { room, index: 0 };
    if (room.players[1]?.ws === ws) return { room, index: 1 };
  }
  return null;
}

export function removePlayer(ws: WebSocket, reason: 'disconnect' | 'leave' = 'disconnect'): void {
  const found = findRoomByWs(ws);
  if (!found) return;
  const { room, index } = found;
  const opp = opponent(room, index);
  if (opp) send(opp.ws, { type: 'OPPONENT_LEFT', reason });
  room.players[index] = null;
  if (!room.players[0] && !room.players[1]) rooms.delete(room.id);
}

export function markCommitted(ws: WebSocket, mode: CardMode): void {
  const found = findRoomByWs(ws);
  if (!found) return;
  const { room, index } = found;
  const me = room.players[index]!;
  const opp = opponent(room, index);

  me.committed = true;
  me.mode = mode;

  if (opp) send(opp.ws, { type: 'OPPONENT_COMMITTED', mode });

  if (opp?.committed && !room.bothCommittedSent) {
    room.bothCommittedSent = true;
    send(me.ws, { type: 'BOTH_COMMITTED', round: room.round });
    send(opp.ws, { type: 'BOTH_COMMITTED', round: room.round });
  }
}

export function resetRound(ws: WebSocket): void {
  const found = findRoomByWs(ws);
  if (!found) return;
  const { room, index } = found;
  room.players[index]!.committed = false;
  room.players[index]!.mode = null;
  room.readyNext[index] = true;

  if (room.readyNext[0] && room.readyNext[1]) {
    room.round++;
    room.bothCommittedSent = false;
    room.readyNext = [false, false];
  }
}

export function relayToOpponent(ws: WebSocket, msg: ServerMsg): void {
  const found = findRoomByWs(ws);
  if (!found) return;
  const { room, index } = found;
  const opp = opponent(room, index);
  if (opp) send(opp.ws, msg);
}

export function isCommitted(ws: WebSocket): boolean {
  const found = findRoomByWs(ws);
  if (!found) return false;
  return found.room.players[found.index]?.committed ?? false;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TIMEOUT_MS) rooms.delete(id);
  }
}, 5 * 60 * 1000);
