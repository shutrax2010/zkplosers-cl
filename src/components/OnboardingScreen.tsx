import { useState } from 'react';
import { generateMnemonic } from '../services/midnight-dummy';

interface OnboardingScreenProps {
  onAccountReady: (address: string, balance: number, mnemonic?: string) => void;
}

export function OnboardingScreen({ onAccountReady }: OnboardingScreenProps) {
  const [view, setView] = useState<'main' | 'create' | 'import'>('main');
  const [mnemonic, setMnemonic] = useState('');
  const [importInput, setImportInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateAccount() {
    setLoading(true);
    const m = generateMnemonic();
    setMnemonic(m);
    setView('create');
    setLoading(false);
  }

  async function handleConfirmCreate() {
    setLoading(true);
    await delay(800);
    const address = `mn1${randomHex(38)}`;
    onAccountReady(address, 100, mnemonic);
    setLoading(false);
  }

  async function handleConnectLace() {
    setLoading(true);
    await delay(1200);
    const address = `mn1${randomHex(38)}`;
    onAccountReady(address, 250);
    setLoading(false);
  }

  async function handleImport() {
    const words = importInput.trim().split(/\s+/);
    if (words.length !== 24) {
      setError('Please enter exactly 24 words.');
      return;
    }
    setLoading(true);
    setError('');
    await delay(900);
    const address = `mn1${randomHex(38)}`;
    onAccountReady(address, 50, importInput.trim());
    setLoading(false);
  }

  function copyMnemonic() {
    navigator.clipboard.writeText(mnemonic).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-in-down">
        <div className="text-xs font-mono mb-3" style={{ color: '#06b6d4', letterSpacing: '4px' }}>
          MIDNIGHT NETWORK // ZERO-KNOWLEDGE PROTOCOL
        </div>
        <h1 className="font-orbitron text-4xl md:text-5xl font-black mb-2 animate-flicker" style={{ color: '#e2e8f0' }}>
          LOSER'S<br />
          <span style={{ color: '#7c3aed', textShadow: '0 0 30px rgba(124,58,237,0.8)' }}>GAMBIT</span>
        </h1>
        <p className="text-sm mt-3" style={{ color: '#94a3b8' }}>
          A strategic card battle on the Midnight blockchain
        </p>
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        {view === 'main' && (
          <div className="panel panel-purple p-8">
            <h2 className="font-orbitron text-sm font-bold mb-6 text-center" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
              ACCOUNT ACCESS
            </h2>

            <div className="space-y-4">
              <button
                className="btn btn-primary w-full btn-lg"
                onClick={handleCreateAccount}
                disabled={loading}
              >
                {loading ? '...' : '+ Create New Account'}
              </button>

              <div className="divider-cyber" />

              <button
                className="btn btn-cyan w-full"
                onClick={handleConnectLace}
                disabled={loading}
              >
                Connect Lace Wallet
              </button>

              <button
                className="btn btn-ghost w-full btn-sm"
                onClick={() => setView('import')}
              >
                Import Mnemonic
              </button>
            </div>

            <p className="text-xs text-center mt-6" style={{ color: '#94a3b8' }}>
              [DEMO MODE] — Blockchain interactions are simulated
            </p>
          </div>
        )}

        {view === 'create' && (
          <div className="panel panel-purple p-8 animate-fade-in">
            <h2 className="font-orbitron text-sm font-bold mb-2" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
              SECURE YOUR MNEMONIC
            </h2>
            <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>
              Write down these 24 words in order. This is your only recovery method.
            </p>

            <div
              className="p-4 rounded mb-4"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              <div className="grid grid-cols-4 gap-2">
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="text-xs font-mono" style={{ color: '#e2e8f0' }}>
                    <span style={{ color: '#94a3b8' }}>{i + 1}.</span> {word}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <button className="btn btn-ghost btn-sm flex-1" onClick={copyMnemonic}>
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </button>
            </div>

            <div className="divider-cyber" />

            <button
              className="btn btn-primary w-full mt-4"
              onClick={handleConfirmCreate}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'I have saved my mnemonic →'}
            </button>

            <button className="btn btn-ghost w-full btn-sm mt-2" onClick={() => setView('main')}>
              ← Back
            </button>
          </div>
        )}

        {view === 'import' && (
          <div className="panel panel-purple p-8 animate-fade-in">
            <h2 className="font-orbitron text-sm font-bold mb-4" style={{ color: '#a78bfa', letterSpacing: '3px' }}>
              IMPORT MNEMONIC
            </h2>

            <textarea
              className="input-cyber mb-2 resize-none"
              rows={4}
              placeholder="Enter your 24-word mnemonic phrase..."
              value={importInput}
              onChange={e => { setImportInput(e.target.value); setError(''); }}
              style={{ fontSize: '0.8rem' }}
            />

            {error && (
              <p className="text-xs mb-3" style={{ color: '#e11d48' }}>{error}</p>
            )}

            <button
              className="btn btn-primary w-full mb-2"
              onClick={handleImport}
              disabled={loading || !importInput.trim()}
            >
              {loading ? 'Importing...' : 'Import Account'}
            </button>

            <button className="btn btn-ghost w-full btn-sm" onClick={() => { setView('main'); setError(''); setImportInput(''); }}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function randomHex(n: number) {
  return Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}
