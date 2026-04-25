import { useCallback, useEffect, useRef } from 'react';
import { useGameState } from './hooks/useGameState';
import { useMultiplayerSync } from './hooks/useMultiplayerSync';
import { OnboardingScreen } from './components/OnboardingScreen';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { RoomScreen } from './components/RoomScreen';
import { GameBoard } from './components/GameBoard';
import { ResultScreen } from './components/ResultScreen';
import { multiplayerWS } from './services/multiplayer-ws';
import type { BattleDecision, Card, CardMode } from './types/game';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001';

export default function App() {
  const { state, dispatch, handleClaimReward, cpuMakeMove, cpuMakeDecision } = useGameState();

  useMultiplayerSync(state, dispatch);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Disconnect WS when game ends
  useEffect(() => {
    if (state.phase === 'game-over' && state.gameMode === 'multi') {
      multiplayerWS.disconnect();
    }
  }, [state.phase, state.gameMode]);

  function handleAccountReady(address: string, balance: number) {
    dispatch({ type: 'SET_WALLET', address, balance });
    dispatch({ type: 'SET_PHASE', phase: 'mode-select' });
  }

  function handleStartSolo(name: string, onChainMode: boolean) {
    dispatch({ type: 'SET_PLAYER_NAME', name });
    dispatch({ type: 'START_SOLO_GAME', onChainMode });
  }

  function handleStartMulti(name: string, onChainMode: boolean) {
    dispatch({ type: 'SET_PLAYER_NAME', name });
    dispatch({ type: 'START_MULTI', onChainMode });
  }

  async function handleJoinRoom(roomId: string) {
    try {
      await multiplayerWS.connect(WS_URL);
      multiplayerWS.send({
        type: 'JOIN_ROOM',
        roomId,
        name: state.playerName,
        address: state.walletAddress,
      });
    } catch {
      alert('Could not connect to relay server.\nLocal dev: run "cd server && npm run dev" first.');
    }
  }

  function handleCancelRoom() {
    multiplayerWS.disconnect();
    dispatch({ type: 'RETURN_TO_LOBBY' });
  }

  function handleSelectCard(card: Card) { dispatch({ type: 'SELECT_CARD', card }); }
  function handleSetMode(mode: CardMode) { dispatch({ type: 'SET_MODE', mode }); }
  function handleCommit() { dispatch({ type: 'COMMIT_MOVE' }); }

  function handlePlayerDecision(decision: BattleDecision) {
    dispatch({ type: 'PLAYER_DECISION', decision });
    if (state.gameMode === 'multi') {
      multiplayerWS.send({ type: 'PLAYER_DECISION', decision });
    }
  }

  function handleZkpDone() { dispatch({ type: 'ZKP_DONE' }); }
  function handleResolveRound() { dispatch({ type: 'RESOLVE_ROUND' }); }
  function handleNextRound() {
    dispatch({ type: 'NEXT_ROUND' });
    if (state.gameMode === 'multi') {
      multiplayerWS.send({ type: 'READY_NEXT_ROUND' });
    }
  }
  function handleReturnToLobby() {
    multiplayerWS.disconnect();
    dispatch({ type: 'RETURN_TO_LOBBY' });
  }

  const handleCpuThinkDone = useCallback(() => {
    const { card, mode } = cpuMakeMove(stateRef.current);
    dispatch({ type: 'CPU_MOVED', card, mode });
  }, [cpuMakeMove, dispatch]);

  const handleCpuDecisionDone = useCallback(() => {
    const decision = cpuMakeDecision(stateRef.current);
    dispatch({ type: 'CPU_DECISION', decision });
  }, [cpuMakeDecision, dispatch]);

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
        onStartMulti={handleStartMulti}
      />
    );
  }

  if (phase === 'room-select' || phase === 'room-waiting') {
    return (
      <RoomScreen
        phase={phase}
        roomId={state.roomId}
        onJoinRoom={handleJoinRoom}
        onCancel={handleCancelRoom}
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
