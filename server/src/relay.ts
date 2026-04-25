import type { WebSocket } from 'ws';
import type { ClientMsg } from './protocol.js';
import { joinRoom, markCommitted, resetRound, relayToOpponent, isCommitted, removePlayer } from './rooms.js';

export function handleMessage(ws: WebSocket, raw: string): void {
  let msg: ClientMsg;
  try {
    msg = JSON.parse(raw) as ClientMsg;
  } catch {
    return;
  }

  switch (msg.type) {
    case 'JOIN_ROOM':
      joinRoom(msg.roomId, ws, msg.name, msg.address);
      break;

    case 'LEAVE_ROOM':
      removePlayer(ws, 'leave');
      break;

    case 'COMMIT_MOVE':
      markCommitted(ws, msg.mode);
      break;

    case 'PLAYER_DECISION':
      relayToOpponent(ws, { type: 'OPPONENT_DECISION', decision: msg.decision });
      break;

    case 'REVEAL_PUBLIC':
      if (!isCommitted(ws)) return;
      relayToOpponent(ws, { type: 'OPPONENT_REVEALED_PUBLIC', cardType: msg.cardType });
      break;

    case 'REVEAL_HIDDEN':
      if (!isCommitted(ws)) return;
      relayToOpponent(ws, { type: 'OPPONENT_REVEALED_HIDDEN', claimedOutcome: msg.claimedOutcome, proof: msg.proof });
      break;

    case 'READY_NEXT_ROUND':
      resetRound(ws);
      relayToOpponent(ws, { type: 'OPPONENT_READY_NEXT' });
      break;

    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG' }));
      break;
  }
}
