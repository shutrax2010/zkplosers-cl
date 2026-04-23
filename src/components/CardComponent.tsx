import type { Card, CardMode } from '../types/game';
import { CARD_META } from '../types/game';

interface CardComponentProps {
  card: Card;
  selected?: boolean;
  mode?: CardMode;
  disabled?: boolean;
  faceDown?: boolean;
  revealed?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function CardComponent({
  card,
  selected = false,
  mode = 'public',
  disabled = false,
  faceDown = false,
  revealed = false,
  onClick,
  size = 'md',
}: CardComponentProps) {
  const meta = CARD_META[card.type];
  const isLoser = card.type === 'loser';
  const isHidden = mode === 'hidden' && !faceDown;

  const sizeClasses = {
    sm: 'w-16 h-20 text-2xl',
    md: 'w-24 h-32 text-3xl',
    lg: 'w-28 h-36 text-4xl',
  }[size];

  const labelSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  let cardClasses = 'game-card flex flex-col items-center justify-center gap-1 p-2 select-none';
  cardClasses += ` ${sizeClasses}`;

  if (card.used && !revealed) cardClasses += ' card-used';
  else if (disabled) cardClasses += ' card-disabled';
  else if (selected && isLoser) cardClasses += ' card-selected card-loser-selected';
  else if (selected) cardClasses += ' card-selected';
  else if (isHidden) cardClasses += ' card-hidden-mode';

  if (faceDown) {
    return (
      <div className={`${cardClasses}`} style={{ borderColor: 'rgba(100,116,139,0.4)', background: 'rgba(15,23,42,0.9)' }}>
        <div className="text-3xl opacity-50">?</div>
        <div className="text-xs opacity-40 font-mono">HIDDEN</div>
      </div>
    );
  }

  return (
    <div
      className={cardClasses}
      onClick={!card.used && !disabled ? onClick : undefined}
      style={
        selected && !isHidden
          ? { borderColor: meta.color, boxShadow: `0 0 16px ${meta.color}60, 0 0 32px ${meta.color}30` }
          : isHidden
          ? {}
          : isLoser
          ? { borderColor: 'rgba(225,29,72,0.4)' }
          : {}
      }
    >
      {isHidden ? (
        <>
          <div className="text-2xl" style={{ filter: 'blur(4px)' }}>{meta.icon}</div>
          <div className="text-xs font-orbitron" style={{ color: '#a78bfa', letterSpacing: '1px' }}>HIDDEN</div>
        </>
      ) : (
        <>
          <div className={`${size === 'sm' ? 'text-2xl' : 'text-3xl'} leading-none`}>{meta.icon}</div>
          <div
            className={`${labelSize} font-orbitron font-bold tracking-widest`}
            style={{ color: isLoser ? '#e11d48' : meta.color }}
          >
            {meta.label}
          </div>
          <div className="text-xs opacity-50 font-mono" style={{ fontSize: '0.6rem' }}>{meta.jpLabel}</div>
        </>
      )}
    </div>
  );
}

export function FaceDownCard({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-16 h-20', md: 'w-24 h-32', lg: 'w-28 h-36' }[size];
  return (
    <div
      className={`game-card flex flex-col items-center justify-center gap-1 ${sizeClasses}`}
      style={{ borderColor: 'rgba(100,116,139,0.3)', background: 'rgba(15,23,42,0.9)' }}
    >
      <div className="text-3xl opacity-30">?</div>
    </div>
  );
}
