import { useEffect } from 'react';
import type { GameState, Card, CardMode, BattleDecision } from '../types/game';
import { CARD_META } from '../types/game';
import { CardComponent, FaceDownCard } from './CardComponent';
import { ZKPOverlay } from './ZKPOverlay';

interface GameBoardProps {
  state: GameState;
  onSelectCard: (card: Card) => void;
  onSetMode: (mode: CardMode) => void;
  onCommit: () => void;
  onPlayerDecision: (d: BattleDecision) => void;
  onCpuThinkDone: () => void;
  onCpuDecisionDone: () => void;
  onZkpDone: () => void;
  onResolveRound: () => void;
  onNextRound: () => void;
}

export function GameBoard({
  state,
  onSelectCard,
  onSetMode,
  onCommit,
  onPlayerDecision,
  onCpuThinkDone,
  onCpuDecisionDone,
  onZkpDone,
  onResolveRound,
  onNextRound,
}: GameBoardProps) {
  const {
    phase, gameMode, playerName, opponentName, playerHand, cpuHand,
    playerTotalVP, cpuTotalVP,
    currentRound, totalRounds,
    selectedCard, selectedMode,
    cpuSelectedCard, cpuSelectedMode,
    currentRoundResult,
    roundResults,
  } = state;

  const isSolo = gameMode === 'solo';
  const opponentLabel = isSolo ? 'CPU' : (opponentName || 'OPPONENT');

  useEffect(() => {
    if (!isSolo || phase !== 'cpu-thinking') return;
    const t = setTimeout(onCpuThinkDone, 1200 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [isSolo, phase, onCpuThinkDone]);

  useEffect(() => {
    if (!isSolo || phase !== 'cpu-battle-fold') return;
    const t = setTimeout(onCpuDecisionDone, 1000 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [isSolo, phase, onCpuDecisionDone]);

  useEffect(() => {
    if (!isSolo || phase !== 'revealing') return;
    const t = setTimeout(onResolveRound, 1200);
    return () => clearTimeout(t);
  }, [isSolo, phase, onResolveRound]);

  const canInteract = phase === 'card-select';
  const cpuRemainingCards = isSolo
    ? cpuHand.filter(c => !c.used).length
    : totalRounds - roundResults.length;
  const playerRemainingCards = playerHand.filter(c => !c.used).length;

  const vpDelta = (vp: number) => (
    <span style={{ color: vp > 0 ? '#34d399' : '#e11d48', fontWeight: 700 }}>
      {vp > 0 ? `+${vp}` : vp}
    </span>
  );

  return (
    // h-screen + overflow-hidden: 全体を画面高さに固定、スクロール無し
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', maxWidth: 600, margin: '0 auto', padding: '0 12px' }}
    >
      {/* ── Header (fixed height) ── */}
      <header className="flex-none flex items-center justify-between py-2 px-1">
        <div className="font-orbitron text-sm font-bold" style={{ color: '#7c3aed', letterSpacing: '3px' }}>
          LOSER'S GAMBIT
        </div>
        <div className="text-xs font-mono" style={{ color: '#94a3b8' }}>
          ROUND{' '}
          <span style={{ color: '#06b6d4', fontWeight: 700 }}>{currentRound + 1}</span>
          {' '}/ {totalRounds}
        </div>
      </header>

      <div className="flex-none divider-cyber" style={{ margin: '4px 0' }} />

      {/* ── CPU Area (fixed height) ── */}
      <section className="flex-none px-1 py-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs font-mono" style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '0.6rem' }}>OPPONENT</div>
            <div className="font-orbitron font-bold text-sm" style={{ color: '#e2e8f0' }}>{opponentName || 'CPU_ALPHA'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono" style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '0.6rem' }}>SCORE</div>
            <div className="font-orbitron font-bold text-base" style={{ color: cpuTotalVP < 0 ? '#e11d48' : '#a78bfa' }}>
              {cpuTotalVP >= 0 ? '+' : ''}{cpuTotalVP} VP
            </div>
          </div>
        </div>

        {/* CPU Hand */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: cpuRemainingCards }).map((_, i) => (
            <FaceDownCard key={i} size="sm" />
          ))}
          {Array.from({ length: 3 - cpuRemainingCards }).map((_, i) => (
            <div key={`used-${i}`} className="w-16 h-20 rounded opacity-10"
              style={{ border: '1px dashed #64748b' }} />
          ))}
        </div>

        {/* Opponent status — fixed height row to prevent layout shift */}
        <div className="flex justify-center mt-1" style={{ height: 18 }}>
          {phase === 'cpu-thinking' && (
            <span className="text-xs font-mono animate-fade-in" style={{ color: '#94a3b8' }}>
              Thinking<span className="animate-blink">...</span>
            </span>
          )}
          {phase === 'cpu-battle-fold' && (
            <span className="text-xs font-mono animate-fade-in" style={{ color: '#94a3b8' }}>
              Deciding<span className="animate-blink">...</span>
            </span>
          )}
          {phase === 'player-battle-fold' && (
            <span className="text-xs font-mono animate-fade-in" style={{ color: '#a78bfa' }}>
              Chose HIDDEN
            </span>
          )}
          {phase === 'waiting-opponent-commit' && (
            <span className="text-xs font-mono animate-fade-in" style={{ color: '#94a3b8' }}>
              Waiting<span className="animate-blink">...</span>
            </span>
          )}
          {phase === 'waiting-opponent-decision' && (
            <span className="text-xs font-mono animate-fade-in" style={{ color: '#94a3b8' }}>
              Deciding<span className="animate-blink">...</span>
            </span>
          )}
          {phase === 'revealing' && !isSolo && (
            <span className="text-xs font-mono animate-fade-in" style={{ color: '#06b6d4' }}>
              Revealing<span className="animate-blink">...</span>
            </span>
          )}
          {phase === 'card-select' && (
            <span className="text-xs font-mono" style={{ color: '#475569' }}>·</span>
          )}
        </div>
      </section>

      <div className="flex-none divider-cyber" style={{ margin: '4px 0' }} />

      {/* ── Battle Area (flex-1: absorbs remaining vertical space) ── */}
      <section className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-1 py-2">
        {/* Card slots */}
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs font-mono" style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '0.6rem' }}>CPU</div>
            <CpuCardSlot phase={phase} cpuSelectedCard={cpuSelectedCard} cpuSelectedMode={cpuSelectedMode} />
          </div>

          <div className="font-orbitron text-base font-black" style={{ color: '#64748b' }}>VS</div>

          <div className="flex flex-col items-center gap-1">
            <div className="text-xs font-mono" style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '0.6rem' }}>YOU</div>
            <PlayerCardSlot phase={phase} selectedCard={selectedCard} selectedMode={selectedMode} />
          </div>
        </div>

        {/* Round result */}
        {phase === 'round-result' && currentRoundResult && (
          <RoundResultDisplay result={currentRoundResult} vpDelta={vpDelta} opponentLabel={opponentLabel} />
        )}

        {/* Battle/Fold decision */}
        {phase === 'player-battle-fold' && (
          <div className="panel panel-purple p-4 text-center animate-fade-in-up w-full max-w-xs">
            <div className="text-xs font-mono mb-1" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
              {opponentLabel} CHOSE HIDDEN
            </div>
            <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>
              Battle for VP or Fold to avoid risk?
            </p>
            <div className="flex gap-3">
              <button className="btn btn-primary flex-1 btn-sm" onClick={() => onPlayerDecision('battle')}>
                ⚔ BATTLE
              </button>
              <button className="btn btn-ghost flex-1 btn-sm" onClick={() => onPlayerDecision('fold')}>
                🏳 FOLD
              </button>
            </div>
          </div>
        )}

        {phase === 'revealing' && (
          <div className="text-xs font-mono animate-fade-in" style={{ color: '#06b6d4', letterSpacing: '3px' }}>
            REVEALING...
          </div>
        )}
      </section>

      <div className="flex-none divider-cyber" style={{ margin: '4px 0' }} />

      {/* ── Player Area (fixed height) ── */}
      <section className="flex-none px-1 py-2 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace' }}>OPERATIVE</div>
            <div className="font-orbitron font-bold text-sm" style={{ color: '#e2e8f0' }}>{playerName}</div>
          </div>
          <div className="text-right">
            <div style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace' }}>SCORE</div>
            <div className="font-orbitron font-bold text-base" style={{ color: playerTotalVP < 0 ? '#e11d48' : '#06b6d4' }}>
              {playerTotalVP >= 0 ? '+' : ''}{playerTotalVP} VP
            </div>
          </div>
        </div>

        {/* Hand */}
        <div className="flex gap-2 justify-center mb-2">
          {playerHand.map(card => (
            <CardComponent
              key={card.id}
              card={card}
              selected={selectedCard?.id === card.id}
              mode={selectedCard?.id === card.id ? selectedMode : 'public'}
              disabled={!canInteract}
              onClick={() => canInteract && !card.used && onSelectCard(card)}
              size="md"
            />
          ))}
        </div>

        {/* Remaining count */}
        <div className="text-center mb-2">
          <span className="text-xs font-mono" style={{ color: '#64748b' }}>
            {playerRemainingCards} card{playerRemainingCards !== 1 ? 's' : ''} remaining
          </span>
        </div>

        {/* Mode toggle — prominent */}
        {canInteract && (
          <div className="mb-2">
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}
            >
              {/* PUBLIC */}
              <button
                onClick={() => onSetMode('public')}
                className="flex-1 flex flex-col items-center gap-0.5 transition-all duration-200"
                style={{
                  padding: '10px 8px',
                  background: selectedMode === 'public'
                    ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(6,182,212,0.1))'
                    : 'transparent',
                  borderRight: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: selectedMode === 'public'
                    ? 'inset 0 0 20px rgba(6,182,212,0.15)'
                    : 'none',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>👁</span>
                <span
                  className="font-orbitron font-bold"
                  style={{
                    fontSize: '0.7rem',
                    letterSpacing: '2px',
                    color: selectedMode === 'public' ? '#06b6d4' : '#64748b',
                  }}
                >
                  PUBLIC
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.55rem',
                    color: selectedMode === 'public' ? '#67e8f9' : '#475569',
                    letterSpacing: '0.5px',
                  }}
                >
                  公開 · +1 VP
                </span>
                {selectedMode === 'public' && (
                  <div
                    className="mt-1 rounded-full"
                    style={{ width: 24, height: 2, background: '#06b6d4', boxShadow: '0 0 6px #06b6d4' }}
                  />
                )}
              </button>

              {/* HIDDEN */}
              <button
                onClick={() => onSetMode('hidden')}
                className="flex-1 flex flex-col items-center gap-0.5 transition-all duration-200"
                style={{
                  padding: '10px 8px',
                  background: selectedMode === 'hidden'
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(124,58,237,0.1))'
                    : 'transparent',
                  boxShadow: selectedMode === 'hidden'
                    ? 'inset 0 0 20px rgba(124,58,237,0.2)'
                    : 'none',
                  animation: selectedMode === 'hidden' ? 'pulse-purple 2s ease-in-out infinite' : 'none',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🔐</span>
                <span
                  className="font-orbitron font-bold"
                  style={{
                    fontSize: '0.7rem',
                    letterSpacing: '2px',
                    color: selectedMode === 'hidden' ? '#a78bfa' : '#64748b',
                  }}
                >
                  HIDDEN
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.55rem',
                    color: selectedMode === 'hidden' ? '#c4b5fd' : '#475569',
                    letterSpacing: '0.5px',
                  }}
                >
                  秘匿 · ZKP
                </span>
                {selectedMode === 'hidden' && (
                  <div
                    className="mt-1 rounded-full"
                    style={{ width: 24, height: 2, background: '#7c3aed', boxShadow: '0 0 6px #7c3aed' }}
                  />
                )}
              </button>
            </div>

            {/* Mode hint */}
            <div className="text-center mt-1" style={{ height: 14 }}>
              <span className="font-mono" style={{ color: '#94a3b8', fontSize: '0.6rem' }}>
                {selectedMode === 'hidden'
                  ? selectedCard?.type === 'loser'
                    ? '⚠ Hidden LOSER: bluff · risk −1 VP on loss'
                    : 'Win = +3 VP · Lose = −1 VP · ZKP proof'
                  : 'Win = +1 VP · Cards shown after commit'}
              </span>
            </div>
          </div>
        )}

        {/* Commit button */}
        {canInteract && (
          <button
            className="btn btn-primary w-full"
            style={{ padding: '11px 0', fontSize: '0.85rem' }}
            disabled={!selectedCard}
            onClick={onCommit}
          >
            {selectedMode === 'hidden' ? '🔐 COMMIT (HIDDEN)' : '✊ COMMIT MOVE'}
          </button>
        )}

        {/* Next Round button */}
        {phase === 'round-result' && (
          <button className="btn btn-cyan w-full animate-fade-in-up" style={{ padding: '11px 0', fontSize: '0.85rem' }} onClick={onNextRound}>
            {currentRound + 1 >= totalRounds ? 'SEE FINAL RESULT →' : `ROUND ${currentRound + 2} →`}
          </button>
        )}

        {/* Multi: waiting for opponent to be ready */}
        {phase === 'waiting-next-round' && (
          <div className="text-center py-3 animate-fade-in">
            <span className="text-xs font-mono" style={{ color: '#94a3b8', letterSpacing: '2px' }}>
              Waiting for opponent<span className="animate-blink">...</span>
            </span>
          </div>
        )}

        {/* Multi: waiting for opponent to commit */}
        {phase === 'waiting-opponent-commit' && (
          <div className="text-center py-3 animate-fade-in">
            <span className="text-xs font-mono" style={{ color: '#a78bfa', letterSpacing: '2px' }}>
              Move committed · Waiting<span className="animate-blink">...</span>
            </span>
          </div>
        )}

        {/* Multi: waiting for opponent's battle/fold decision */}
        {phase === 'waiting-opponent-decision' && (
          <div className="panel panel-purple p-4 text-center animate-fade-in-up">
            <div className="text-xs font-mono" style={{ color: '#a78bfa', letterSpacing: '2px' }}>
              YOU CHOSE HIDDEN
            </div>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
              Opponent deciding<span className="animate-blink">...</span>
            </p>
          </div>
        )}
      </section>

      {phase === 'zkp-generating' && <ZKPOverlay onDone={onZkpDone} />}
    </div>
  );
}

/* ── Sub-components ── */

function CpuCardSlot({ phase, cpuSelectedCard, cpuSelectedMode }: {
  phase: string;
  cpuSelectedCard: Card | null;
  cpuSelectedMode: CardMode | null;
}) {
  if (!cpuSelectedCard || phase === 'card-select' || phase === 'cpu-thinking') {
    return (
      <div className="w-24 h-32 rounded-lg flex items-center justify-center"
        style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.5)' }}>
        <span className="text-2xl opacity-20">?</span>
      </div>
    );
  }

  const showRevealed = phase === 'revealing' || phase === 'round-result';
  if (!showRevealed) return <FaceDownCard size="md" />;

  // 秘匿カードは結果後も公開しない
  if (cpuSelectedMode === 'hidden') {
    return <CardComponent card={cpuSelectedCard} mode="hidden" size="md" />;
  }
  return <CardComponent card={cpuSelectedCard} mode="public" size="md" revealed />;
}

function PlayerCardSlot({ phase, selectedCard, selectedMode }: {
  phase: string;
  selectedCard: Card | null;
  selectedMode: CardMode;
}) {
  if (!selectedCard || phase === 'card-select') {
    return (
      <div className="w-24 h-32 rounded-lg flex items-center justify-center"
        style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.5)' }}>
        <span className="text-xs font-mono opacity-30">SELECT</span>
      </div>
    );
  }

  // 秘匿カードは結果後も公開しない
  if (selectedMode === 'hidden') {
    return <CardComponent card={selectedCard} mode="hidden" size="md" />;
  }

  const showRevealed = phase === 'revealing' || phase === 'round-result';
  return <CardComponent card={selectedCard} mode="public" size="md" revealed={showRevealed} />;
}

function RoundResultDisplay({
  result,
  vpDelta,
  opponentLabel,
}: {
  result: NonNullable<GameState['currentRoundResult']>;
  vpDelta: (vp: number) => React.ReactNode;
  opponentLabel: string;
}) {
  const { winner, playerVP, cpuVP, folded, playerCard, cpuCard } = result;

  const label = folded ? 'FOLD — No contest'
    : winner === 'draw' ? 'DRAW'
    : winner === 'player' ? 'YOU WIN'
    : 'YOU LOSE';

  const labelColor = folded ? '#94a3b8'
    : winner === 'draw' ? '#06b6d4'
    : winner === 'player' ? '#34d399'
    : '#e11d48';

  const playerMeta = CARD_META[playerCard.type];
  const cpuMeta    = CARD_META[cpuCard.type];

  return (
    <div className="panel p-3 text-center animate-reveal w-full max-w-xs">
      <div className="font-orbitron font-black text-lg mb-1" style={{ color: labelColor }}>{label}</div>

      {!folded && (
        <div className="flex justify-center gap-3 text-xs mb-2 font-mono items-center">
          <span style={{ color: '#94a3b8' }}>{opponentLabel}:</span>
          {result.cpuMode === 'hidden'
            ? <span style={{ color: '#a78bfa' }}>🔐 ???</span>
            : <span style={{ color: '#e2e8f0' }}>{cpuMeta.icon} {cpuMeta.label}</span>}
          <span style={{ color: '#64748b' }}>vs</span>
          <span style={{ color: '#94a3b8' }}>You:</span>
          {result.playerMode === 'hidden'
            ? <span style={{ color: '#a78bfa' }}>🔐 ???</span>
            : <span style={{ color: '#e2e8f0' }}>{playerMeta.icon} {playerMeta.label}</span>}
        </div>
      )}

      <div className="flex justify-center gap-6 text-xs font-mono">
        <span><span style={{ color: '#94a3b8' }}>You: </span>{playerVP === 0 ? <span style={{ color: '#94a3b8' }}>+0</span> : vpDelta(playerVP)}</span>
        <span><span style={{ color: '#94a3b8' }}>{opponentLabel}: </span>{cpuVP === 0 ? <span style={{ color: '#94a3b8' }}>+0</span> : vpDelta(cpuVP)}</span>
      </div>
    </div>
  );
}
