import { useState, useEffect } from 'react';
import { connectWalletDummy } from '../services/midnight-dummy';
import { connectLace, isLaceInstalled, LaceNotFoundError } from '../services/midnight-wallet';

interface OnboardingScreenProps {
  onAccountReady: (address: string, balance: number) => void;
}

export function OnboardingScreen({ onAccountReady }: OnboardingScreenProps) {
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [laceAvailable, setLaceAvailable] = useState(false);

  useEffect(() => {
    setLaceAvailable(isLaceInstalled());
    const t = setTimeout(() => setLaceAvailable(isLaceInstalled()), 1000);
    return () => clearTimeout(t);
  }, []);

  async function handleConnectLace() {
    setLoading(true);
    setError('');
    try {
      const account = await connectLace();
      onAccountReady(account.address, account.balance);
    } catch (e) {
      if (e instanceof LaceNotFoundError) {
        setError('Lace wallet not found. Install the extension and refresh.');
      } else {
        setError(e instanceof Error ? e.message : 'Connection failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectDummy() {
    setLoading(true);
    setError('');
    try {
      const account = await connectWalletDummy();
      onAccountReady(account.address, account.shieldedBalance);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in-down">
        <div className="text-xs font-mono mb-3" style={{ color: '#06b6d4', letterSpacing: '4px' }}>
          MIDNIGHT NETWORK // ZERO-KNOWLEDGE PROTOCOL
        </div>
        <h1 className="font-orbitron text-4xl md:text-5xl font-black mb-2" style={{ color: '#e2e8f0' }}>
          LOSER'S<br />
          <span style={{ color: '#7c3aed', textShadow: '0 0 30px rgba(124,58,237,0.8)' }}>GAMBIT</span>
        </h1>
        <p className="text-sm mt-3" style={{ color: '#94a3b8' }}>
          A strategic card battle on the Midnight blockchain
        </p>
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="panel panel-purple p-8">
          <h2 className="font-orbitron text-sm font-bold mb-6 text-center" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
            CONNECT WALLET
          </h2>

          {/* Lace status badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span
              className="rounded-full"
              style={{ width: 7, height: 7, background: laceAvailable ? '#34d399' : '#64748b', boxShadow: laceAvailable ? '0 0 6px #34d399' : 'none' }}
            />
            <span className="text-xs font-mono" style={{ color: laceAvailable ? '#34d399' : '#64748b' }}>
              {laceAvailable ? 'Lace wallet detected' : 'Lace wallet not detected'}
            </span>
          </div>

          <div className="space-y-3">
            {/* Lace Wallet */}
            <div>
              <button
                className="btn btn-cyan w-full btn-lg"
                onClick={handleConnectLace}
                disabled={loading || !laceAvailable}
                title={!laceAvailable ? 'Install the Midnight Lace wallet extension first' : ''}
              >
                {loading ? <Spinner /> : (
                  <span className="flex items-center gap-2 justify-center">
                    <LaceIcon />
                    Connect Lace Wallet
                  </span>
                )}
              </button>
              {!laceAvailable && (
                <p className="text-xs text-center mt-1" style={{ color: '#64748b' }}>
                  <a
                    href="https://www.lace.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#06b6d4', textDecoration: 'underline' }}
                  >
                    Install Lace wallet
                  </a>
                  {' '}to use this option
                </p>
              )}
            </div>

            <div className="divider-cyber" />

            {/* Demo connect (dummy) */}
            <button
              className="btn btn-primary w-full"
              onClick={handleConnectDummy}
              disabled={loading}
            >
              {loading ? <Spinner /> : 'Connect Wallet (Demo)'}
            </button>
            <p className="text-xs text-center" style={{ color: '#475569' }}>
              Demo mode — simulated wallet, no real blockchain
            </p>
          </div>

          {error && <ErrorBox message={error} />}
        </div>

        {/* ZKP badge */}
        <div className="flex items-center justify-center gap-3 mt-6 text-xs font-mono" style={{ color: '#475569' }}>
          <span>🔐 ZKP-Shielded</span>
          <span>·</span>
          <span>Midnight Preprod</span>
          <span>·</span>
          <span>YTTM Token</span>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="flex items-center gap-2 justify-center">
      <span
        className="animate-spin rounded-full inline-block"
        style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
      />
      Connecting...
    </span>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="mt-3 p-3 rounded text-xs font-mono animate-fade-in"
      style={{ background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.3)', color: '#fca5a5' }}
    >
      ⚠ {message}
    </div>
  );
}

function LaceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="16" cy="16" r="16" fill="#1D4ED8" />
      <path d="M10 22L16 10L22 22H10Z" fill="white" fillOpacity="0.9" />
    </svg>
  );
}
