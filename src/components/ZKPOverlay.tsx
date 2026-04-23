import { useEffect, useState } from 'react';

interface ZKPOverlayProps {
  onDone: () => void;
}

const STEPS = [
  'Initializing circuit...',
  'Building witness...',
  'Generating proof...',
  'Verifying constraints...',
  'Proof complete.',
];

export function ZKPOverlay({ onDone }: ZKPOverlayProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepDuration = 400;
    const totalDuration = 2400;
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 100));
    }, totalDuration / 50);

    const stepIntervals = STEPS.map((_, i) =>
      setTimeout(() => setStep(i), i * stepDuration)
    );

    const done = setTimeout(onDone, totalDuration);

    return () => {
      clearInterval(progressInterval);
      stepIntervals.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{ background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div className="panel panel-purple p-8 w-full max-w-md mx-4 text-center">
        {/* Spinning ring */}
        <div className="flex justify-center mb-6">
          <div
            className="animate-spin rounded-full"
            style={{
              width: 64, height: 64,
              border: '3px solid rgba(124,58,237,0.2)',
              borderTopColor: '#7c3aed',
              borderRightColor: '#06b6d4',
            }}
          />
        </div>

        <h2
          className="font-orbitron text-lg font-bold mb-2"
          style={{ color: '#a78bfa', letterSpacing: '3px' }}
        >
          ZKP GENERATION
        </h2>

        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
          Zero-Knowledge Proof — Midnight Network
        </p>

        {/* Step log */}
        <div
          className="text-left mb-6 p-4 rounded"
          style={{ background: 'rgba(0,0,0,0.4)', fontFamily: 'JetBrains Mono, monospace' }}
        >
          {STEPS.slice(0, step + 1).map((s, i) => (
            <div key={i} className="text-xs mb-1 animate-fade-in" style={{ color: i === step ? '#a78bfa' : '#64748b' }}>
              <span style={{ color: i < step ? '#34d399' : i === step ? '#7c3aed' : '#64748b' }}>
                {i < step ? '✓' : i === step ? '>' : '·'}
              </span>
              {' '}{s}
              {i === step && <span className="animate-blink ml-1">_</span>}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-2" style={{ background: 'rgba(124,58,237,0.2)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
              boxShadow: '0 0 8px rgba(124,58,237,0.8)',
            }}
          />
        </div>
        <div className="text-xs text-right" style={{ color: '#94a3b8' }}>{progress}%</div>
      </div>
    </div>
  );
}
