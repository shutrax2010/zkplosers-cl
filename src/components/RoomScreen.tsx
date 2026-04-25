import { useState } from 'react';

interface RoomScreenProps {
  phase: 'room-select' | 'room-waiting';
  roomId: string;
  onJoinRoom: (roomId: string) => void;
  onCancel: () => void;
}

function randomRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function RoomScreen({ phase, roomId, onJoinRoom, onCancel }: RoomScreenProps) {
  const [inputId, setInputId] = useState('');
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setInputId(randomRoomId());
  }

  function handleJoin() {
    const id = inputId.trim().toUpperCase();
    if (id.length >= 4) onJoinRoom(id);
  }

  function handleCopy() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (phase === 'room-waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="text-xs font-mono mb-2" style={{ color: '#06b6d4', letterSpacing: '4px' }}>
              MULTI-SYNC
            </div>
            <h1 className="font-orbitron text-2xl font-black" style={{ color: '#e2e8f0' }}>
              AWAITING OPPONENT
            </h1>
          </div>

          <div className="panel panel-purple p-6 text-center">
            <div className="text-xs font-mono mb-3" style={{ color: '#94a3b8', letterSpacing: '3px' }}>
              YOUR ROOM ID
            </div>
            <div
              className="font-orbitron text-4xl font-black mb-4 tracking-widest animate-pulse"
              style={{ color: '#a78bfa', letterSpacing: '8px' }}
            >
              {roomId}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleCopy}
              style={{ fontSize: '0.75rem' }}
            >
              {copied ? '✓ Copied!' : '📋 Copy Room ID'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm font-mono mb-1" style={{ color: '#94a3b8' }}>
              Share this code with your opponent
            </p>
            <div className="flex justify-center gap-1 mt-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: '#7c3aed',
                    animation: `blink 1.2s ${i * 0.4}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          </div>

          <button className="btn btn-ghost w-full" onClick={onCancel}>
            ✕ Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 animate-fade-in-up">
        <div className="text-center">
          <div className="text-xs font-mono mb-2" style={{ color: '#06b6d4', letterSpacing: '4px' }}>
            MULTI-SYNC
          </div>
          <h1 className="font-orbitron text-2xl font-black" style={{ color: '#e2e8f0' }}>
            JOIN OR HOST
          </h1>
        </div>

        <div className="panel p-6 space-y-4">
          <div>
            <label className="block text-xs font-mono mb-2" style={{ color: '#94a3b8', letterSpacing: '2px' }}>
              ROOM ID
            </label>
            <div className="flex gap-2">
              <input
                className="input-cyber flex-1 uppercase tracking-widest"
                placeholder="ABC123"
                value={inputId}
                onChange={e => setInputId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                maxLength={6}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.1rem' }}
              />
              <button
                className="btn btn-ghost btn-sm px-3"
                onClick={handleGenerate}
                title="Generate random Room ID (host)"
                style={{ fontSize: '0.7rem', letterSpacing: '1px' }}
              >
                🎲 NEW
              </button>
            </div>
            <p className="text-xs mt-1 font-mono" style={{ color: '#475569' }}>
              Enter a code to join · or generate one to host
            </p>
          </div>

          <button
            className="btn btn-primary w-full"
            disabled={inputId.trim().length < 4}
            onClick={handleJoin}
          >
            ⚡ JOIN ROOM
          </button>
        </div>

        <button className="btn btn-ghost w-full" onClick={onCancel}>
          ← Back
        </button>
      </div>
    </div>
  );
}
