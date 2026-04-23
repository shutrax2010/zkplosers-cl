import { useReducer, useCallback } from 'react';
import type { GameState, GamePhase, Card, CardMode, BattleDecision, RoundResult } from '../types/game';
import { generateHand, resolveWinner, calculateVP, determineOverallWinner } from '../logic/game-logic';
import { generateMnemonic, createAccount, connectLaceWallet, importMnemonic, claimReward } from '../services/midnight-dummy';
import { cpuSelectCard, cpuSelectMode, cpuDecideBattleFold } from '../services/cpu-ai';

const INITIAL: GameState = {
  phase: 'onboarding',
  playerName: '',
  walletAddress: '',
  walletBalance: 0,
  mnemonic: '',
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

type Action =
  | { type: 'SET_WALLET'; address: string; balance: number; mnemonic?: string }
  | { type: 'SET_PLAYER_NAME'; name: string }
  | { type: 'START_SOLO_GAME' }
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
      return { ...state, walletAddress: action.address, walletBalance: action.balance, mnemonic: action.mnemonic ?? '' };

    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };

    case 'START_SOLO_GAME':
      return {
        ...state,
        phase: 'card-select',
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
      };

    case 'SELECT_CARD':
      return { ...state, selectedCard: action.card };

    case 'SET_MODE':
      return { ...state, selectedMode: action.mode };

    case 'COMMIT_MOVE':
      return { ...state, phase: 'cpu-thinking' };

    case 'CPU_MOVED':
      return {
        ...state,
        cpuSelectedCard: action.card,
        cpuSelectedMode: action.mode,
        phase: computeNextPhaseAfterCpu(state, action.mode),
      };

    case 'PLAYER_DECISION': {
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
      const updatedPlayerHand = state.playerHand.map(c =>
        c.id === state.selectedCard!.id ? { ...c, used: true } : c
      );
      const updatedCpuHand = state.cpuHand.map(c =>
        c.id === state.cpuSelectedCard!.id ? { ...c, used: true } : c
      );
      return {
        ...state,
        phase: 'round-result',
        currentRoundResult: result,
        roundResults: [...state.roundResults, result],
        playerTotalVP: playerVP,
        cpuTotalVP: cpuVP,
        playerHand: updatedPlayerHand,
        cpuHand: updatedCpuHand,
      };
    }

    case 'NEXT_ROUND': {
      const nextRound = state.currentRound + 1;
      if (nextRound >= state.totalRounds) {
        return {
          ...state,
          phase: 'game-over',
          currentRound: nextRound,
          gameWinner: determineOverallWinner(state.playerTotalVP, state.cpuTotalVP),
        };
      }
      return {
        ...state,
        phase: 'card-select',
        currentRound: nextRound,
        selectedCard: null,
        selectedMode: 'public',
        cpuSelectedCard: null,
        cpuSelectedMode: null,
        currentRoundResult: null,
      };
    }

    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'CLAIM_REWARD':
      return { ...state, rewardClaimed: true, walletBalance: state.walletBalance + 10 };

    case 'RETURN_TO_LOBBY':
      return { ...INITIAL, walletAddress: state.walletAddress, walletBalance: state.walletBalance, playerName: state.playerName, phase: 'mode-select' };

    default:
      return state;
  }
}

function computeNextPhaseAfterCpu(state: GameState, cpuMode: CardMode): GamePhase {
  const playerMode = state.selectedMode;
  // Player is public, CPU is hidden → player decides battle/fold
  if (playerMode === 'public' && cpuMode === 'hidden') return 'player-battle-fold';
  // Player is hidden, CPU is public → CPU decides (handled externally after this)
  if (playerMode === 'hidden' && cpuMode === 'public') return 'cpu-battle-fold';
  // Both hidden or both public → go to zkp or reveal
  const needZkp = playerMode === 'hidden' || cpuMode === 'hidden';
  return needZkp ? 'zkp-generating' : 'revealing';
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
    const updatedPlayerHand = state.playerHand.map(c =>
      c.id === state.selectedCard!.id ? { ...c, used: true } : c
    );
    const updatedCpuHand = state.cpuHand.map(c =>
      c.id === state.cpuSelectedCard!.id ? { ...c, used: true } : c
    );
    return {
      ...state,
      phase,
      currentRoundResult: result,
      roundResults: [...state.roundResults, result],
      playerHand: updatedPlayerHand,
      cpuHand: updatedCpuHand,
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
    playerCard, playerMode,
    cpuCard, cpuMode,
    playerDecision: 'battle', cpuDecision: 'battle',
    winner, playerVP, cpuVP, folded,
  };
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const handleCreateAccount = useCallback(async () => {
    const mnemonic = generateMnemonic();
    const account = await createAccount(mnemonic);
    dispatch({ type: 'SET_WALLET', address: account.address, balance: account.balance, mnemonic });
    return mnemonic;
  }, []);

  const handleConnectLace = useCallback(async () => {
    const account = await connectLaceWallet();
    dispatch({ type: 'SET_WALLET', address: account.address, balance: account.balance });
  }, []);

  const handleImportMnemonic = useCallback(async (mnemonic: string) => {
    const account = await importMnemonic(mnemonic);
    dispatch({ type: 'SET_WALLET', address: account.address, balance: account.balance, mnemonic });
  }, []);

  const handleClaimReward = useCallback(async () => {
    await claimReward(state.walletAddress);
    dispatch({ type: 'CLAIM_REWARD' });
  }, [state.walletAddress]);

  const cpuMakeMove = useCallback((currentState: GameState) => {
    const card = cpuSelectCard(currentState.cpuHand);
    const mode = cpuSelectMode(card, currentState.currentRound, currentState.cpuTotalVP, currentState.playerTotalVP);
    return { card, mode };
  }, []);

  const cpuMakeDecision = useCallback((currentState: GameState): BattleDecision => {
    return cpuDecideBattleFold(currentState.cpuSelectedCard!, currentState.selectedMode, currentState.currentRound, currentState.cpuTotalVP);
  }, []);

  return {
    state,
    dispatch,
    handleCreateAccount,
    handleConnectLace,
    handleImportMnemonic,
    handleClaimReward,
    cpuMakeMove,
    cpuMakeDecision,
  };
}
