import { useCallback } from 'react';
import { useGameState } from './hooks/useGameState';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { GameBoard } from './components/GameBoard';
import { ResultScreen } from './components/ResultScreen';
import type { BattleDecision, Card, CardMode } from './types/game';

export default function App() {
  const {
    state,
    dispatch,
    handleCreateAccount,
    handleConnectLace,
    handleImportMnemonic,
    handleClaimReward,
    cpuMakeMove,
    cpuMakeDecision,
  } = useGameState();

  // ── Onboarding ──
  function handleAccountReady(address: string, balance: number, mnemonic?: string) {
    dispatch({ type: 'SET_WALLET', address, balance, mnemonic });
    dispatch({ type: 'SET_PHASE', phase: 'mode-select' });
  }

  // ── Mode select ──
  function handleStartSolo(name: string) {
    dispatch({ type: 'SET_PLAYER_NAME', name });
    dispatch({ type: 'START_SOLO_GAME' });
  }

  // ── Game actions ──
  function handleSelectCard(card: Card) {
    dispatch({ type: 'SELECT_CARD', card });
  }

  function handleSetMode(mode: CardMode) {
    dispatch({ type: 'SET_MODE', mode });
  }

  function handleCommit() {
    dispatch({ type: 'COMMIT_MOVE' });
  }

  const handleCpuThinkDone = useCallback(() => {
    const { card, mode } = cpuMakeMove(state);
    dispatch({ type: 'CPU_MOVED', card, mode });
  }, [state, cpuMakeMove, dispatch]);

  const handleCpuDecisionDone = useCallback(() => {
    const decision = cpuMakeDecision(state);
    dispatch({ type: 'CPU_DECISION', decision });
  }, [state, cpuMakeDecision, dispatch]);

  function handlePlayerDecision(decision: BattleDecision) {
    dispatch({ type: 'PLAYER_DECISION', decision });
  }

  function handleZkpDone() {
    dispatch({ type: 'ZKP_DONE' });
  }

  function handleResolveRound() {
    dispatch({ type: 'RESOLVE_ROUND' });
  }

  function handleNextRound() {
    dispatch({ type: 'NEXT_ROUND' });
  }

  function handleReturnToLobby() {
    dispatch({ type: 'RETURN_TO_LOBBY' });
  }

  // Suppress unused warning — these are available for future wiring
  void handleCreateAccount;
  void handleConnectLace;
  void handleImportMnemonic;

  // ── Routing by phase ──
  const { phase } = state;

  if (phase === 'onboarding') {
    return <OnboardingScreen onAccountReady={handleAccountReady} />;
  }

  if (phase === 'mode-select') {
    return (
      <ModeSelectScreen
        walletAddress={state.walletAddress}
        walletBalance={state.walletBalance}
        initialName={state.playerName}
        onStartSolo={handleStartSolo}
      />
    );
  }

  if (phase === 'game-over') {
    return (
      <ResultScreen
        state={state}
        onClaimReward={handleClaimReward}
        onReturnToLobby={handleReturnToLobby}
      />
    );
  }

  // All game phases
  return (
    <GameBoard
      state={state}
      onSelectCard={handleSelectCard}
      onSetMode={handleSetMode}
      onCommit={handleCommit}
      onPlayerDecision={handlePlayerDecision}
      onCpuThinkDone={handleCpuThinkDone}
      onCpuDecisionDone={handleCpuDecisionDone}
      onZkpDone={handleZkpDone}
      onResolveRound={handleResolveRound}
      onNextRound={handleNextRound}
    />
  );
}
