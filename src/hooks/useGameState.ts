import { useReducer, useCallback } from 'react';
import type { GameState, GamePhase, Card, CardMode, BattleDecision, RoundResult, CardType, RoundWinner } from '../types/game';
import { generateHand, resolveWinner, calculateVP, determineOverallWinner } from '../logic/game-logic';
import { claimShieldedReward, randomHex } from '../services/midnight-dummy';
import { cpuSelectCard, cpuSelectMode, cpuDecideBattleFold } from '../services/cpu-ai';

const INITIAL: GameState = {
  phase: 'onboarding',
  gameMode: 'solo',
  playerName: '',
  walletAddress: '',
  walletBalance: 0,
  onChainMode: false,
  onChainContractAddress: '',
  playerRole: null,
  roomId: '',
  opponentName: '',
  opponentAddress: '',
  opponentMode: null,
  opponentReady: false,
  opponentPublicCardPending: null,
  playerHand: [],
  cpuHand: [],
  playerTotalVP: 0,
  cpuTotalVP: 0,
  currentRound: 0,
  totalRounds: 3,
  roundResults: [],
  selectedCard: null,
  selectedMode: 'public',
  cpuSelectedCard: null,
  cpuSelectedMode: null,
  currentRoundResult: null,
  gameWinner: null,
  rewardClaimed: false,
};

export type Action =
  | { type: 'SET_WALLET'; address: string; balance: number }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'START_SOLO_GAME'; onChainMode: boolean }
  | { type: 'START_MULTI'; onChainMode: boolean }
  | { type: 'ROOM_JOINED'; role: 'player1' | 'player2'; roomId: string }
  | { type: 'GAME_STARTED'; role: 'player1' | 'player2'; opponentName: string; opponentAddress: string }
  | { type: 'OPPONENT_COMMITTED'; mode: CardMode }
  | { type: 'BOTH_COMMITTED'; round: number }
  | { type: 'OPPONENT_DECISION'; decision: BattleDecision }
  | { type: 'OPPONENT_REVEALED_PUBLIC'; cardType: CardType }
  | { type: 'OPPONENT_REVEALED_HIDDEN'; claimedOutcome: string; proof?: string }
  | { type: 'OPPONENT_READY_NEXT' }
  | { type: 'OPPONENT_LEFT' }
  | { type: 'SELECT_CARD'; card: Card }
  | { type: 'SET_MODE'; mode: CardMode }
  | { type: 'COMMIT_MOVE' }
  | { type: 'CPU_MOVED'; card: Card; mode: CardMode }
  | { type: 'PLAYER_DECISION'; decision: BattleDecision }
  | { type: 'CPU_DECISION'; decision: BattleDecision }
  | { type: 'ZKP_DONE' }
  | { type: 'RESOLVE_ROUND' }
  | { type: 'NEXT_ROUND' }
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'CLAIM_REWARD' }
  | { type: 'RETURN_TO_LOBBY' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_WALLET':
      return { ...state, walletAddress: action.address, walletBalance: action.balance };

    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };

    case 'START_SOLO_GAME':
      return {
        ...state,
        phase: 'card-select',
        gameMode: 'solo',
        onChainMode: action.onChainMode,
        onChainContractAddress: action.onChainMode ? `mn_contract_preprod1${randomHex(35)}` : '',
        playerHand: generateHand(),
        cpuHand: generateHand(),
        playerTotalVP: 0,
        cpuTotalVP: 0,
        currentRound: 0,
        roundResults: [],
        selectedCard: null,
        selectedMode: 'public',
        cpuSelectedCard: null,
        cpuSelectedMode: null,
        currentRoundResult: null,
        gameWinner: null,
        rewardClaimed: false,
        opponentName: 'CPU_ALPHA',
        opponentPublicCardPending: null,
      };

    case 'START_MULTI':
      return {
        ...state,
        phase: 'room-select',
        gameMode: 'multi',
        onChainMode: action.onChainMode,
        onChainContractAddress: '',
        roomId: '',
        playerRole: null,
        opponentName: '',
        opponentAddress: '',
        opponentPublicCardPending: null,
      };

    case 'ROOM_JOINED':
      return { ...state, phase: 'room-waiting', playerRole: action.role, roomId: action.roomId };

    case 'GAME_STARTED':
      return {
        ...state,
        phase: 'card-select',
        playerRole: action.role,
        opponentName: action.opponentName,
        opponentAddress: action.opponentAddress,
        onChainContractAddress: state.onChainMode ? `mn_contract_preprod1${randomHex(35)}` : '',
        playerHand: generateHand(),
        cpuHand: [],
        playerTotalVP: 0,
        cpuTotalVP: 0,
        currentRound: 0,
        roundResults: [],
        selectedCard: null,
        selectedMode: 'public',
        cpuSelectedCard: null,
        cpuSelectedMode: null,
        currentRoundResult: null,
        opponentMode: null,
        opponentReady: false,
        opponentPublicCardPending: null,
        gameWinner: null,
        rewardClaimed: false,
      };

    case 'OPPONENT_COMMITTED':
      return { ...state, opponentMode: action.mode };

    case 'BOTH_COMMITTED': {
      const myMode = state.selectedMode;
      const oppMode = state.opponentMode!;
      const phase: GamePhase =
        myMode === 'public' && oppMode === 'hidden' ? 'player-battle-fold' :
        myMode === 'hidden' && oppMode === 'public' ? 'waiting-opponent-decision' :
        myMode === 'hidden' ? 'zkp-generating' : 'revealing';
      return { ...state, opponentPublicCardPending: null, phase };
    }

    case 'OPPONENT_DECISION': {
      if (action.decision === 'fold') {
        const result = makeFoldResult(state, 'battle', 'fold', state.opponentMode ?? 'hidden');
        return {
          ...state,
          phase: 'round-result',
          currentRoundResult: result,
          roundResults: [...state.roundResults, result],
          playerHand: markCardUsed(state.playerHand, state.selectedCard!.id),
          opponentPublicCardPending: null,
        };
      }
      const needZkp = state.selectedMode === 'hidden';
      return { ...state, phase: needZkp ? 'zkp-generating' : 'revealing' };
    }

    case 'OPPONENT_REVEALED_PUBLIC': {
      if (state.phase !== 'revealing') {
        // Not in revealing yet: buffer the card
        return { ...state, opponentPublicCardPending: action.cardType };
      }
      // In revealing: resolve directly (both-public OR hidden-vs-public after sequential reveal)
      return resolveWithOpponentCard(state, action.cardType);
    }

    case 'OPPONENT_REVEALED_HIDDEN': {
      // proof contains actual card in dummy mode; Phase 3 will verify ZKP instead
      if (action.proof) {
        return resolveWithOpponentCard(state, action.proof as CardType);
      }
      return resolveWithClaimedOutcome(state, action.claimedOutcome);
    }

    case 'OPPONENT_READY_NEXT': {
      if (state.phase === 'waiting-next-round') {
        const nextRound = state.currentRound;
        if (nextRound >= state.totalRounds) {
          return {
            ...state, phase: 'game-over',
            gameWinner: determineOverallWinner(state.playerTotalVP, state.cpuTotalVP),
          };
        }
        return {
          ...state, phase: 'card-select',
          selectedCard: null, selectedMode: 'public',
          cpuSelectedCard: null, cpuSelectedMode: null,
          currentRoundResult: null, opponentMode: null,
          opponentReady: false, opponentPublicCardPending: null,
        };
      }
      return { ...state, opponentReady: true };
    }

    case 'OPPONENT_LEFT':
      if (state.phase === 'game-over') return state;
      return { ...state, phase: 'mode-select' };

    case 'SELECT_CARD':
      return { ...state, selectedCard: action.card };

    case 'SET_MODE':
      return { ...state, selectedMode: action.mode };

    case 'COMMIT_MOVE':
      if (state.gameMode === 'multi') return { ...state, phase: 'waiting-opponent-commit' };
      return { ...state, phase: 'cpu-thinking' };

    case 'CPU_MOVED':
      return {
        ...state,
        cpuSelectedCard: action.card,
        cpuSelectedMode: action.mode,
        phase: computeNextPhaseAfterCpu(state.selectedMode, action.mode),
      };

    case 'PLAYER_DECISION': {
      if (state.gameMode === 'multi') {
        if (action.decision === 'fold') {
          const result = makeFoldResult(state, 'fold', 'battle', state.opponentMode ?? 'hidden');
          return {
            ...state,
            phase: 'round-result',
            currentRoundResult: result,
            roundResults: [...state.roundResults, result],
            playerHand: markCardUsed(state.playerHand, state.selectedCard!.id),
            opponentPublicCardPending: null,
          };
        }
        // Battle: player=public, opponent=hidden → revealing
        return { ...state, phase: 'revealing' };
      }
      // Solo
      const needZkp = state.cpuSelectedMode === 'hidden' || state.selectedMode === 'hidden';
      const phase: GamePhase = action.decision === 'fold' ? 'round-result' : (needZkp ? 'zkp-generating' : 'revealing');
      return resolveIfFold(state, phase, 'player', action.decision);
    }

    case 'CPU_DECISION': {
      const needZkp = state.cpuSelectedMode === 'hidden' || state.selectedMode === 'hidden';
      const phase: GamePhase = action.decision === 'fold' ? 'round-result' : (needZkp ? 'zkp-generating' : 'revealing');
      return resolveIfFold(state, phase, 'cpu', action.decision);
    }

    case 'ZKP_DONE':
      return { ...state, phase: 'revealing' };

    case 'RESOLVE_ROUND': {
      const result = computeRoundResult(state);
      const playerVP = state.playerTotalVP + result.playerVP;
      const cpuVP = state.cpuTotalVP + result.cpuVP;
      return {
        ...state,
        phase: 'round-result',
        currentRoundResult: result,
        roundResults: [...state.roundResults, result],
        playerTotalVP: playerVP,
        cpuTotalVP: cpuVP,
        playerHand: markCardUsed(state.playerHand, state.selectedCard!.id),
        cpuHand: markCardUsed(state.cpuHand, state.cpuSelectedCard!.id),
      };
    }

    case 'NEXT_ROUND': {
      const nextRound = state.currentRound + 1;
      if (state.gameMode !== 'multi') {
        if (nextRound >= state.totalRounds) {
          return {
            ...state, phase: 'game-over', currentRound: nextRound,
            gameWinner: determineOverallWinner(state.playerTotalVP, state.cpuTotalVP),
          };
        }
        return {
          ...state, phase: 'card-select', currentRound: nextRound,
          selectedCard: null, selectedMode: 'public',
          cpuSelectedCard: null, cpuSelectedMode: null, currentRoundResult: null,
        };
      }
      // Multi: always wait for opponent before advancing (including final round)
      if (state.opponentReady) {
        if (nextRound >= state.totalRounds) {
          return {
            ...state, phase: 'game-over', currentRound: nextRound,
            gameWinner: determineOverallWinner(state.playerTotalVP, state.cpuTotalVP),
          };
        }
        return {
          ...state, phase: 'card-select', currentRound: nextRound,
          selectedCard: null, selectedMode: 'public',
          cpuSelectedCard: null, cpuSelectedMode: null,
          currentRoundResult: null, opponentMode: null,
          opponentReady: false, opponentPublicCardPending: null,
        };
      }
      return { ...state, phase: 'waiting-next-round', currentRound: nextRound, opponentPublicCardPending: null };
    }

    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'CLAIM_REWARD':
      return { ...state, rewardClaimed: true, walletBalance: state.walletBalance + 10 };

    case 'RETURN_TO_LOBBY':
      return {
        ...INITIAL,
        walletAddress: state.walletAddress,
        walletBalance: state.walletBalance,
        playerName: state.playerName,
        phase: 'mode-select',
      };

    default:
      return state;
  }
}

function buildMultiRoundState(state: GameState, cpuCard: Card, winner: RoundWinner): GameState {
  const cpuMode = state.opponentMode!;
  const playerCard = state.selectedCard!;
  const playerMode = state.selectedMode;
  const { playerVP, cpuVP, folded } = calculateVP({
    playerMode, cpuMode,
    playerDecision: 'battle', cpuDecision: 'battle',
    winner,
  });
  const result: RoundResult = {
    roundNumber: state.currentRound + 1,
    playerCard, playerMode, cpuCard, cpuMode,
    playerDecision: 'battle', cpuDecision: 'battle',
    winner, playerVP, cpuVP, folded,
  };
  return {
    ...state,
    phase: 'round-result',
    cpuSelectedCard: cpuCard,
    cpuSelectedMode: cpuMode,
    currentRoundResult: result,
    roundResults: [...state.roundResults, result],
    playerTotalVP: state.playerTotalVP + playerVP,
    cpuTotalVP: state.cpuTotalVP + cpuVP,
    playerHand: markCardUsed(state.playerHand, playerCard.id),
    opponentPublicCardPending: null,
  };
}

function resolveWithOpponentCard(state: GameState, cardType: CardType): GameState {
  const cpuCard: Card = { id: 'opp', type: cardType, used: true };
  return buildMultiRoundState(state, cpuCard, resolveWinner(state.selectedCard!.type, cardType));
}

function resolveWithClaimedOutcome(state: GameState, claimedOutcome: string): GameState {
  // sender uses PWins=they win, OWins=they lose; invert for local perspective
  const winner: RoundWinner =
    claimedOutcome === 'OWins' ? 'player' :
    claimedOutcome === 'PWins' ? 'cpu' : 'draw';
  return buildMultiRoundState(state, { id: 'opp-hidden', type: 'rock', used: true }, winner);
}

function computeNextPhaseAfterCpu(playerMode: string, cpuMode: string): GamePhase {
  if (playerMode === 'public' && cpuMode === 'hidden') return 'player-battle-fold';
  if (playerMode === 'hidden' && cpuMode === 'public') return 'cpu-battle-fold';
  const needZkp = playerMode === 'hidden' || cpuMode === 'hidden';
  return needZkp ? 'zkp-generating' : 'revealing';
}

function markCardUsed(hand: Card[], cardId: string) {
  return hand.map(c => c.id === cardId ? { ...c, used: true } : c);
}

function makeFoldResult(
  state: GameState,
  playerDecision: BattleDecision,
  cpuDecision: BattleDecision,
  cpuMode: CardMode,
): RoundResult {
  return {
    roundNumber: state.currentRound + 1,
    playerCard: state.selectedCard!,
    playerMode: state.selectedMode,
    cpuCard: { id: 'opp-fold', type: 'rock', used: true },
    cpuMode,
    playerDecision,
    cpuDecision,
    winner: null,
    playerVP: 0,
    cpuVP: 0,
    folded: true,
  };
}

function resolveIfFold(
  state: GameState,
  phase: GamePhase,
  decider: 'player' | 'cpu',
  decision: BattleDecision
): GameState {
  if (decision === 'fold') {
    const playerDecision: BattleDecision = decider === 'player' ? 'fold' : 'battle';
    const cpuDecision: BattleDecision    = decider === 'cpu'    ? 'fold' : 'battle';
    const result: RoundResult = {
      roundNumber: state.currentRound + 1,
      playerCard: state.selectedCard!,
      playerMode: state.selectedMode,
      cpuCard: state.cpuSelectedCard!,
      cpuMode: state.cpuSelectedMode!,
      playerDecision,
      cpuDecision,
      winner: null,
      playerVP: 0,
      cpuVP: 0,
      folded: true,
    };
    return {
      ...state,
      phase,
      currentRoundResult: result,
      roundResults: [...state.roundResults, result],
      playerHand: markCardUsed(state.playerHand, state.selectedCard!.id),
      cpuHand: markCardUsed(state.cpuHand, state.cpuSelectedCard!.id),
    };
  }
  return { ...state, phase };
}

function computeRoundResult(state: GameState): RoundResult {
  const playerCard = state.selectedCard!;
  const cpuCard = state.cpuSelectedCard!;
  const playerMode = state.selectedMode;
  const cpuMode = state.cpuSelectedMode!;
  const winner = resolveWinner(playerCard.type, cpuCard.type);
  const { playerVP, cpuVP, folded } = calculateVP({
    playerMode, cpuMode,
    playerDecision: 'battle', cpuDecision: 'battle',
    winner,
  });
  return {
    roundNumber: state.currentRound + 1,
    playerCard, playerMode, cpuCard, cpuMode,
    playerDecision: 'battle', cpuDecision: 'battle',
    winner, playerVP, cpuVP, folded,
  };
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const handleClaimReward = useCallback(async () => {
    await claimShieldedReward(state.walletAddress);
    dispatch({ type: 'CLAIM_REWARD' });
  }, [state.walletAddress]);

  const cpuMakeMove = useCallback((currentState: GameState) => {
    const card = cpuSelectCard(currentState.cpuHand);
    const mode = cpuSelectMode(card, currentState.currentRound, currentState.cpuTotalVP, currentState.playerTotalVP);
    return { card, mode };
  }, []);

  const cpuMakeDecision = useCallback((currentState: GameState): BattleDecision => {
    return cpuDecideBattleFold(
      currentState.cpuSelectedCard!,
      currentState.selectedMode,
      currentState.currentRound,
      currentState.cpuTotalVP,
    );
  }, []);

  return { state, dispatch, handleClaimReward, cpuMakeMove, cpuMakeDecision };
}
