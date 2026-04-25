import { useEffect, useRef, type Dispatch } from 'react';
import type { GameState, GamePhase, RoundWinner } from '../types/game';
import type { Action } from './useGameState';
import type { ServerMsg } from '../types/multiplayer-protocol';
import { multiplayerWS } from '../services/multiplayer-ws';
import { resolveWinner } from '../logic/game-logic';

function toClaimedOutcome(winner: RoundWinner): string {
  if (winner === 'player') return 'PWins';
  if (winner === 'cpu') return 'OWins';
  return 'Draw';
}

export function useMultiplayerSync(state: GameState, dispatch: Dispatch<Action>) {
  const prevPhaseRef = useRef<GamePhase>(state.phase);
  // Always up-to-date ref for use inside WS message handlers (closure captures stale state)
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;

  // Inbound: WS messages → dispatch
  useEffect(() => {
    if (state.gameMode !== 'multi') return;

    const unsub = multiplayerWS.onMessage((msg: ServerMsg) => {
      switch (msg.type) {
        case 'ROOM_JOINED':
          dispatch({ type: 'ROOM_JOINED', role: msg.role, roomId: msg.roomId });
          break;

        case 'GAME_STARTED':
          dispatch({
            type: 'GAME_STARTED',
            role: msg.yourRole,
            opponentName: msg.opponent.name,
            opponentAddress: msg.opponent.address,
          });
          break;

        case 'OPPONENT_COMMITTED':
          dispatch({ type: 'OPPONENT_COMMITTED', mode: msg.mode });
          break;

        case 'BOTH_COMMITTED':
          dispatch({ type: 'BOTH_COMMITTED', round: msg.round });
          break;

        case 'OPPONENT_DECISION':
          dispatch({ type: 'OPPONENT_DECISION', decision: msg.decision });
          break;

        case 'OPPONENT_REVEALED_PUBLIC': {
          const s = stateRef.current;
          if (s.selectedMode === 'hidden' && s.phase === 'revealing') {
            // Sequential reveal: I'm hidden, opponent's public card just arrived.
            // Compute outcome and send REVEAL_HIDDEN before resolving locally.
            const winner = resolveWinner(s.selectedCard!.type, msg.cardType);
            const claimedOutcome = toClaimedOutcome(winner);
            multiplayerWS.send({ type: 'REVEAL_HIDDEN', claimedOutcome, proof: s.selectedCard!.type });
          }
          dispatch({ type: 'OPPONENT_REVEALED_PUBLIC', cardType: msg.cardType });
          break;
        }

        case 'OPPONENT_REVEALED_HIDDEN':
          dispatch({ type: 'OPPONENT_REVEALED_HIDDEN', claimedOutcome: msg.claimedOutcome, proof: msg.proof });
          break;

        case 'OPPONENT_READY_NEXT':
          dispatch({ type: 'OPPONENT_READY_NEXT' });
          break;

        case 'OPPONENT_LEFT':
          dispatch({ type: 'OPPONENT_LEFT' });
          break;
      }
    });

    return unsub;
  }, [state.gameMode, dispatch]);

  // Outbound: phase transitions → send WS messages
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;

    if (state.gameMode !== 'multi') return;

    // Committed — send our mode to server
    if (state.phase === 'waiting-opponent-commit' && prev !== 'waiting-opponent-commit') {
      multiplayerWS.send({
        type: 'COMMIT_MOVE',
        commitment: 'dummy',
        mode: state.selectedMode,
      });
    }

    // Revealing — send our card based on mode
    if (state.phase === 'revealing' && prev !== 'revealing') {
      const myMode = state.selectedMode;
      const oppMode = state.opponentMode;

      if (myMode === 'public') {
        // Public card: send immediately (both-public OR public-vs-hidden)
        multiplayerWS.send({ type: 'REVEAL_PUBLIC', cardType: state.selectedCard!.type });

      } else if (oppMode === 'hidden') {
        // Both hidden: send REVEAL_HIDDEN immediately with proof (dummy mode)
        // claimedOutcome is unknown without opponent's card; use 'Draw' as placeholder
        multiplayerWS.send({
          type: 'REVEAL_HIDDEN',
          claimedOutcome: 'Draw',
          proof: state.selectedCard!.type,
        });

      } else {
        // I'm hidden, opponent is public: sequential reveal
        // Check if opponent's public card already arrived during ZKP
        const pending = state.opponentPublicCardPending;
        if (pending !== null) {
          const winner = resolveWinner(state.selectedCard!.type, pending);
          const claimedOutcome = toClaimedOutcome(winner);
          multiplayerWS.send({ type: 'REVEAL_HIDDEN', claimedOutcome, proof: state.selectedCard!.type });
          // Dispatch to resolve the round now that we have both cards
          dispatch({ type: 'OPPONENT_REVEALED_PUBLIC', cardType: pending });
        }
        // If no pending: wait for OPPONENT_REVEALED_PUBLIC (WS handler above will send + dispatch)
      }
    }
  }, [state.phase, state.gameMode, state.selectedMode, state.opponentMode, state.selectedCard, state.opponentPublicCardPending, dispatch]);
}
