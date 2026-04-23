import { useState } from 'react';
import type { GameState } from '../types/game';
import { CARD_META } from '../types/game';

interface ResultScreenProps {
  state: GameState;
  onClaimReward: () => Promise<void>;
  onReturnToLobby: () => void;
}

export function ResultScreen({ state, onClaimReward, onReturnToLobby }: ResultScreenProps) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(state.rewardClaimed);

  const { gameWinner, playerName, playerTotalVP, cpuTotalVP, roundResults } = state;

  const isVictory = gameWinner === 'player';
  const isDraw    = gameWinner === 'draw';

  async function handleClaim() {
    setClaiming(true);
    await onClaimReward();
    setClaiming(false);
    setClaimed(true);
  }

  const resultLabel = isVictory ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';
  const resultColor = isVictory ? '#06b6d4' : isDraw ? '#a78bfa' : '#e11d48';
  const resultAnim  = isVictory ? 'animate-victory' : isDraw ? '' : 'animate-defeat';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 animate-slide-up">

        {/* Main result */}
        <div className="text-center">
          <div className="text-xs font-mono mb-3" style={{ color: '#94a3b8', letterSpacing: '4px' }}>
            GAME OVER
          </div>
          <h1
            className={`font-orbitron text-5xl md:text-6xl font-black mb-4 ${resultAnim}`}
            style={{ color: resultColor, letterSpacing: '4px' }}
          >
            {resultLabel}
          </h1>
          <div className="flex justify-center gap-12 font-mono text-sm">
            <div className="text-center">
              <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>YOU</div>
              <div className="font-orbitron font-bold text-2xl" style={{ color: '#06b6d4' }}>
                {playerTotalVP >= 0 ? '+' : ''}{playerTotalVP}
              </div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>VP</div>
            </div>
            <div className="text-center self-end pb-4" style={{ color: '#64748b', fontSize: '1.2rem' }}>vs</div>
            <div className="text-center">
              <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>CPU</div>
              <div className="font-orbitron font-bold text-2xl" style={{ color: '#a78bfa' }}>
                {cpuTotalVP >= 0 ? '+' : ''}{cpuTotalVP}
              </div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>VP</div>
            </div>
          </div>
        </div>

        {/* Round breakdown */}
        <div className="panel panel-cyan p-5">
          <div className="text-xs font-mono mb-4" style={{ color: '#94a3b8', letterSpacing: '3px' }}>
            ROUND BREAKDOWN
          </div>
          <div className="space-y-3">
            {roundResults.map((r) => {
              const pMeta = CARD_META[r.playerCard.type];
              const cMeta = CARD_META[r.cpuCard.type];
              const winnerLabel = r.folded ? 'Fold' : r.winner === 'player' ? '← Win' : r.winner === 'cpu' ? 'Loss →' : 'Draw';
              const winnerColor = r.folded ? '#94a3b8' : r.winner === 'player' ? '#34d399' : r.winner === 'cpu' ? '#e11d48' : '#06b6d4';

              return (
                <div key={r.roundNumber} className="flex items-center justify-between text-xs font-mono">
                  <div style={{ color: '#94a3b8', width: 60 }}>R{r.roundNumber}</div>

                  {/* プレイヤーカード：秘匿なら非公開 */}
                  <div className="flex items-center gap-1">
                    {r.playerMode === 'hidden' ? (
                      <span style={{ color: '#a78bfa' }}>🔐[H]</span>
                    ) : (
                      <>
                        <span style={{ color: '#e2e8f0' }}>{pMeta.icon}</span>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>[P]</span>
                      </>
                    )}
                  </div>

                  <div style={{ color: winnerColor, width: 50, textAlign: 'center', fontWeight: 700 }}>
                    {winnerLabel}
                  </div>

                  {/* CPUカード：秘匿なら非公開 */}
                  <div className="flex items-center gap-1">
                    {r.cpuMode === 'hidden' ? (
                      <span style={{ color: '#a78bfa' }}>[H]🔐</span>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>[P]</span>
                        <span style={{ color: '#e2e8f0' }}>{cMeta.icon}</span>
                      </>
                    )}
                  </div>

                  <div className="text-right" style={{ width: 70 }}>
                    <span style={{ color: r.playerVP > 0 ? '#34d399' : r.playerVP < 0 ? '#e11d48' : '#94a3b8' }}>
                      {r.playerVP >= 0 ? `+${r.playerVP}` : r.playerVP}
                    </span>
                    <span style={{ color: '#64748b' }}> / </span>
                    <span style={{ color: r.cpuVP > 0 ? '#a78bfa' : r.cpuVP < 0 ? '#e11d48' : '#94a3b8' }}>
                      {r.cpuVP >= 0 ? `+${r.cpuVP}` : r.cpuVP}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reward section */}
        {isVictory && !claimed && (
          <div className="panel panel-purple p-5 text-center animate-fade-in">
            <div className="text-xs font-mono mb-2" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
              VICTORY REWARD
            </div>
            <div className="font-orbitron text-3xl font-black mb-4" style={{ color: '#fbbf24' }}>
              +10 YTTM
            </div>
            <button
              className="btn btn-primary btn-lg w-full"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  Claiming...
                </span>
              ) : 'Claim YTTM Tokens'}
            </button>
          </div>
        )}

        {claimed && isVictory && (
          <div className="panel p-4 text-center animate-reveal" style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.05)' }}>
            <div className="font-orbitron font-bold" style={{ color: '#fbbf24' }}>
              ✓ Reward claimed! 10 YTTM received.
            </div>
            <div className="text-xs mt-1 font-mono" style={{ color: '#94a3b8' }}>
              Balance: {state.walletBalance} YTTM
            </div>
          </div>
        )}

        {!isVictory && (
          <div className="panel p-4 text-center" style={{ borderColor: 'rgba(225,29,72,0.2)' }}>
            <div className="text-sm font-mono" style={{ color: '#94a3b8' }}>
              {isDraw ? 'No reward for a draw. Try again!' : `Better luck next time, ${playerName}.`}
            </div>
          </div>
        )}

        <button className="btn btn-ghost w-full" onClick={onReturnToLobby}>
          ← Return to Lobby
        </button>
      </div>
    </div>
  );
}
