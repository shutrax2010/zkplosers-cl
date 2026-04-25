import { useState } from 'react';
import type { GameState, RoundResult } from '../types/game';
import { CARD_META } from '../types/game';
import { fakeTxHash } from '../services/midnight-dummy';

interface ResultScreenProps {
  state: GameState;
  onClaimReward: () => Promise<void>;
  onReturnToLobby: () => void;
}

export function ResultScreen({ state, onClaimReward, onReturnToLobby }: ResultScreenProps) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed]   = useState(state.rewardClaimed);
  const [showOnChain, setShowOnChain] = useState(false);

  const { gameWinner, playerName, opponentName, playerTotalVP, cpuTotalVP, roundResults, onChainMode, onChainContractAddress } = state;
  const opponentLabel = opponentName || 'CPU';

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
            {onChainMode && (
              <span
                className="ml-2 px-2 py-0.5 rounded text-xs"
                style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}
              >
                ⛓ ON-CHAIN
              </span>
            )}
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
              <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>{opponentLabel}</div>
              <div className="font-orbitron font-bold text-2xl" style={{ color: '#a78bfa' }}>
                {cpuTotalVP >= 0 ? '+' : ''}{cpuTotalVP}
              </div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>VP</div>
            </div>
          </div>
        </div>

        {/* Round breakdown */}
        <div>
          <div className="text-xs font-mono mb-3" style={{ color: '#94a3b8', letterSpacing: '3px' }}>
            ROUND BREAKDOWN
          </div>
          <div className="space-y-3">
            {roundResults.map((r) => (
              <RoundCard key={r.roundNumber} result={r} opponentLabel={opponentLabel} />
            ))}
          </div>
        </div>

        {/* Reward section — Shielded YTTM */}
        {isVictory && !claimed && (
          <div className="panel panel-purple p-5 text-center animate-fade-in">
            <div className="text-xs font-mono mb-2" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
              VICTORY REWARD
            </div>
            <div className="font-orbitron text-3xl font-black mb-1" style={{ color: '#fbbf24' }}>
              +10 YTTM
            </div>
            <div
              className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded mb-4"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              🔐 Shielded — 第三者には非公開 (ZKP)
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
              ) : 'Claim Shielded YTTM'}
            </button>
          </div>
        )}

        {claimed && isVictory && (
          <div className="panel p-4 text-center animate-reveal" style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.05)' }}>
            <div className="font-orbitron font-bold" style={{ color: '#fbbf24' }}>
              ✓ 10 YTTM を受け取りました 🔐
            </div>
            <div className="text-xs mt-1 font-mono" style={{ color: '#94a3b8' }}>
              残高: {state.walletBalance} YTTM (Shielded — あなたのみ閲覧可能)
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

        {/* On-chain results panel */}
        {onChainMode && (
          <div
            className="panel p-5"
            style={{ borderColor: 'rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.05)' }}
          >
            <button
              className="w-full flex items-center justify-between text-xs font-mono mb-3"
              style={{ color: '#a78bfa', letterSpacing: '2px' }}
              onClick={() => setShowOnChain(v => !v)}
            >
              <span>⛓ ON-CHAIN RESULTS</span>
              <span>{showOnChain ? '▲' : '▼'}</span>
            </button>

            {showOnChain && (
              <div className="space-y-3 text-xs font-mono animate-fade-in">
                {/* Contract address */}
                <div>
                  <div style={{ color: '#64748b', marginBottom: 2 }}>CONTRACT ADDRESS</div>
                  <div
                    className="p-2 rounded truncate"
                    style={{ background: 'rgba(0,0,0,0.3)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}
                    title={onChainContractAddress}
                  >
                    {onChainContractAddress}
                  </div>
                  <button
                    className="text-xs mt-1 opacity-40 cursor-not-allowed"
                    disabled
                    style={{ color: '#94a3b8' }}
                  >
                    View on Explorer (Demo mode)
                  </button>
                </div>

                {/* TX log per round */}
                <div>
                  <div style={{ color: '#64748b', marginBottom: 4 }}>TRANSACTION LOG</div>
                  <div className="space-y-2">
                    {roundResults.map((r) => (
                      <div key={r.roundNumber} className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <div style={{ color: '#a78bfa' }}>Round {r.roundNumber}</div>
                        <div style={{ color: '#475569' }}>
                          commit: <span style={{ color: '#94a3b8' }}>{fakeTxHash(`commit-r${r.roundNumber}`).slice(0, 20)}...</span>
                        </div>
                        <div style={{ color: '#475569' }}>
                          reveal: <span style={{ color: '#94a3b8' }}>{fakeTxHash(`reveal-r${r.roundNumber}`).slice(0, 20)}...</span>
                        </div>
                      </div>
                    ))}
                    {claimed && (
                      <div className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,191,36,0.2)' }}>
                        <div style={{ color: '#fbbf24' }}>Reward (Shielded)</div>
                        <div style={{ color: '#475569' }}>
                          mintReward: <span style={{ color: '#94a3b8' }}>{fakeTxHash('reward-claim').slice(0, 20)}...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="text-center text-xs p-2 rounded"
                  style={{ background: 'rgba(251,191,36,0.08)', color: '#92400e', border: '1px solid rgba(251,191,36,0.2)' }}
                >
                  DEMO: TX hashes are simulated. Real on-chain mode coming in Phase 3.
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-ghost w-full" onClick={onReturnToLobby}>
          ← Return to Lobby
        </button>
      </div>
    </div>
  );
}

function RoundCard({ result, opponentLabel }: { result: RoundResult; opponentLabel: string }) {
  const { roundNumber, winner, playerVP, cpuVP, folded, playerCard, playerMode, cpuCard, cpuMode, playerDecision } = result;

  const tag = folded ? 'FOLD' : winner === 'draw' ? 'DRAW' : winner === 'player' ? 'WIN' : 'LOSE';
  const tagColor = folded ? '#94a3b8' : winner === 'draw' ? '#06b6d4' : winner === 'player' ? '#34d399' : '#e11d48';

  const pMeta = CARD_META[playerCard.type];
  const cMeta = CARD_META[cpuCard.type];

  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs" style={{ color: '#64748b', letterSpacing: '2px' }}>
          ROUND {roundNumber}
        </span>
        <span
          className="font-orbitron font-bold text-sm px-3 py-0.5 rounded"
          style={{
            color: tagColor,
            border: `1px solid ${tagColor}55`,
            background: `${tagColor}15`,
            letterSpacing: '3px',
          }}
        >
          {tag}
        </span>
      </div>

      {/* Card matchup */}
      {!folded ? (
        <div className="flex items-center gap-3">
          {/* Player */}
          <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <div className="text-xs font-mono mb-2" style={{ color: '#64748b', letterSpacing: '1px' }}>YOU</div>
            {playerMode === 'hidden' ? (
              <>
                <div className="text-3xl mb-1">🔐</div>
                <div className="text-xs font-mono" style={{ color: '#a78bfa' }}>HIDDEN</div>
              </>
            ) : (
              <>
                <div className="text-3xl mb-1">{pMeta.icon}</div>
                <div className="font-orbitron font-bold text-sm" style={{ color: pMeta.color }}>{pMeta.label}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#475569' }}>PUBLIC</div>
              </>
            )}
          </div>

          <div className="font-orbitron text-xs font-bold flex-none" style={{ color: '#475569' }}>VS</div>

          {/* Opponent */}
          <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
            <div className="text-xs font-mono mb-2 truncate" style={{ color: '#64748b', letterSpacing: '1px' }}>{opponentLabel}</div>
            {cpuMode === 'hidden' ? (
              <>
                <div className="text-3xl mb-1">🔐</div>
                <div className="text-xs font-mono" style={{ color: '#a78bfa' }}>HIDDEN</div>
              </>
            ) : (
              <>
                <div className="text-3xl mb-1">{cMeta.icon}</div>
                <div className="font-orbitron font-bold text-sm" style={{ color: cMeta.color }}>{cMeta.label}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#475569' }}>PUBLIC</div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs font-mono py-2" style={{ color: '#94a3b8' }}>
          {playerDecision === 'fold' ? 'あなたがフォールド' : `${opponentLabel} がフォールド`} — 不戦引き分け
        </div>
      )}

      {/* VP result */}
      <div
        className="flex justify-around text-xs font-mono pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span>
          <span style={{ color: '#64748b' }}>You </span>
          <span style={{ color: playerVP > 0 ? '#34d399' : playerVP < 0 ? '#e11d48' : '#94a3b8', fontWeight: 700 }}>
            {playerVP >= 0 ? `+${playerVP}` : playerVP} VP
          </span>
        </span>
        <span style={{ color: '#334155' }}>|</span>
        <span>
          <span style={{ color: '#64748b' }}>{opponentLabel} </span>
          <span style={{ color: cpuVP > 0 ? '#a78bfa' : cpuVP < 0 ? '#e11d48' : '#94a3b8', fontWeight: 700 }}>
            {cpuVP >= 0 ? `+${cpuVP}` : cpuVP} VP
          </span>
        </span>
      </div>
    </div>
  );
}
