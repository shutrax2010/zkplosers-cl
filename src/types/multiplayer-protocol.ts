import type { CardType, CardMode, BattleDecision } from './game';

export type ClientMsg =
  | { type: 'JOIN_ROOM'; roomId: string; name: string; address: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'COMMIT_MOVE'; commitment: string; mode: CardMode }
  | { type: 'PLAYER_DECISION'; decision: BattleDecision }
  | { type: 'REVEAL_PUBLIC'; cardType: CardType }
  | { type: 'REVEAL_HIDDEN'; claimedOutcome: string; proof?: string }
  | { type: 'READY_NEXT_ROUND' }
  | { type: 'PING' };

export type ServerMsg =
  | { type: 'ROOM_JOINED'; role: 'player1' | 'player2'; roomId: string; waitingForOpponent: boolean }
  | { type: 'GAME_STARTED'; yourRole: 'player1' | 'player2'; opponent: { name: string; address: string } }
  | { type: 'OPPONENT_COMMITTED'; mode: CardMode }
  | { type: 'BOTH_COMMITTED'; round: number }
  | { type: 'OPPONENT_DECISION'; decision: BattleDecision }
  | { type: 'OPPONENT_REVEALED_PUBLIC'; cardType: CardType }
  | { type: 'OPPONENT_REVEALED_HIDDEN'; claimedOutcome: string; proof?: string }
  | { type: 'OPPONENT_READY_NEXT' }
  | { type: 'ROOM_ERROR'; code: string; message: string }
  | { type: 'OPPONENT_LEFT'; reason: 'disconnect' | 'leave' }
  | { type: 'PONG' };
