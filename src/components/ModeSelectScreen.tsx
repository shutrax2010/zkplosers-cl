import { useState } from 'react';

interface ModeSelectScreenProps {
  walletAddress: string;
  walletBalance: number;
  initialName?: string;
  onStartSolo: (name: string, onChainMode: boolean) => void;
  onStartMulti: (name: string, onChainMode: boolean) => void;
}

export function ModeSelectScreen({ walletAddress, walletBalance, initialName = '', onStartSolo, onStartMulti }: ModeSelectScreenProps) {
  const [name, setName]               = useState(initialName);
  const [onChainMode, setOnChainMode] = useState(false);

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 12)}...${walletAddress.slice(-6)}`
    : '—';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Title */}
      <div className="text-center mb-8 animate-fade-in-down">
        <div className="text-xs font-mono mb-2" style={{ color: '#06b6d4', letterSpacing: '4px' }}>
          MIDNIGHT // LOSER'S GAMBIT
        </div>
        <h1 className="font-orbitron text-3xl font-black" style={{ color: '#e2e8f0' }}>
          SELECT MODE
        </h1>
      </div>

      <div className="w-full max-w-lg space-y-6 animate-fade-in-up">
        {/* Wallet info */}
        <div className="panel panel-cyan p-4 flex justify-between items-center">
          <div>
            <div className="text-xs mb-1" style={{ color: '#94a3b8', letterSpacing: '2px' }}>CONNECTED WALLET</div>
            <div className="text-sm font-mono" style={{ color: '#06b6d4' }}>{shortAddr}</div>
          </div>
          <div className="text-right">
            <div className="text-xs mb-1" style={{ color: '#94a3b8', letterSpacing: '2px' }}>BALANCE</div>
            <div className="flex items-center gap-1 justify-end">
              <span className="font-orbitron font-bold" style={{ color: '#a78bfa' }}>{walletBalance} YTTM</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
                title="Shielded — balance is private (ZKP)"
              >
                🔐
              </span>
            </div>
          </div>
        </div>

        {/* Name input */}
        <div className="panel p-6">
          <label className="block text-xs mb-2 font-mono" style={{ color: '#94a3b8', letterSpacing: '2px' }}>
            OPERATIVE NAME
          </label>
          <input
            className="input-cyber"
            placeholder="Enter your callsign..."
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && name.trim() && onStartSolo(name.trim(), onChainMode)}
          />
        </div>

        {/* On-chain mode toggle */}
        <div
          className="panel p-4 flex items-center justify-between cursor-pointer"
          onClick={() => setOnChainMode(v => !v)}
          style={{ borderColor: onChainMode ? 'rgba(124,58,237,0.6)' : undefined, background: onChainMode ? 'rgba(124,58,237,0.07)' : undefined }}
        >
          <div>
            <div className="text-sm font-mono font-bold" style={{ color: onChainMode ? '#a78bfa' : '#94a3b8', letterSpacing: '2px' }}>
              ⛓ ON-CHAIN MODE
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              勝敗をスマートコントラクトで実行 · TX / コントラクトアドレスを表示
            </div>
            {onChainMode && (
              <div
                className="text-xs mt-1 px-2 py-0.5 rounded inline-block font-mono"
                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
              >
                DEMO — simulated on-chain
              </div>
            )}
          </div>
          <div
            className="rounded-full transition-all"
            style={{
              width: 40, height: 22, padding: 2,
              background: onChainMode ? '#7c3aed' : '#1e293b',
              border: `1px solid ${onChainMode ? '#7c3aed' : '#334155'}`,
              display: 'flex', alignItems: 'center',
            }}
          >
            <div
              className="rounded-full transition-all"
              style={{
                width: 16, height: 16,
                background: onChainMode ? '#fff' : '#475569',
                transform: onChainMode ? 'translateX(18px)' : 'translateX(0)',
              }}
            />
          </div>
        </div>

        {/* Mode buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            className="btn btn-primary btn-lg w-full flex-col py-8"
            disabled={!name.trim()}
            onClick={() => onStartSolo(name.trim(), onChainMode)}
            style={{ height: 'auto', letterSpacing: '3px' }}
          >
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-sm">SOLO OPERATIVE</div>
            <div className="text-xs mt-1 opacity-60" style={{ fontFamily: 'JetBrains Mono', letterSpacing: '1px', textTransform: 'none', fontWeight: 400 }}>
              vs CPU · {onChainMode ? 'On-Chain' : 'Off-Chain'}
            </div>
          </button>

          <button
            className="btn btn-ghost btn-lg w-full flex-col py-8"
            disabled={!name.trim()}
            onClick={() => onStartMulti(name.trim(), onChainMode)}
            style={{ height: 'auto', letterSpacing: '3px' }}
          >
            <div className="text-2xl mb-2">🌐</div>
            <div className="text-sm">MULTI-SYNC</div>
            <div className="text-xs mt-1 opacity-60" style={{ fontFamily: 'JetBrains Mono', letterSpacing: '1px', textTransform: 'none', fontWeight: 400 }}>
              Online PvP · {onChainMode ? 'On-Chain' : 'WebSocket'}
            </div>
          </button>
        </div>

        {/* Rules hint */}
        <div className="panel p-4 text-xs space-y-1" style={{ color: '#94a3b8', lineHeight: 1.7 }}>
          <div style={{ color: '#94a3b8', letterSpacing: '2px', marginBottom: '8px' }}>QUICK RULES</div>
          <div>• 3 rounds · 3 cards (グー / チョキ / パー / 負け犬×1)</div>
          <div>• <span style={{ color: '#a78bfa' }}>Public</span>: standard +1 VP ·  <span style={{ color: '#7c3aed' }}>Hidden</span>: risk/reward +3 or −1 VP</div>
          <div>• Most VP after 3 rounds wins <span style={{ color: '#a78bfa' }}>10 YTTM 🔐</span> (shielded)</div>
        </div>
      </div>
    </div>
  );
}
