import type { Card, CardMode, CardType, BattleDecision, RoundWinner } from '../types/game';

let cardSeq = 0;
const nextId = () => `card-${++cardSeq}`;

export function generateHand(): Card[] {
  const nonLoser: CardType[] = ['rock', 'scissors', 'paper'];
  const pick = () => nonLoser[Math.floor(Math.random() * 3)];
  const hand: Card[] = [
    { id: nextId(), type: 'loser',  used: false },
    { id: nextId(), type: pick(),   used: false },
    { id: nextId(), type: pick(),   used: false },
  ];
  // Fisher-Yates shuffle
  for (let i = hand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hand[i], hand[j]] = [hand[j], hand[i]];
  }
  return hand;
}

export function compareCards(a: CardType, b: CardType): 'a' | 'b' | 'draw' {
  if (a === b) return 'draw';
  if (a === 'loser') return 'b';
  if (b === 'loser') return 'a';
  const wins: Record<CardType, CardType> = { rock: 'scissors', scissors: 'paper', paper: 'rock', loser: 'rock' };
  return wins[a] === b ? 'a' : 'b';
}

export function resolveWinner(playerType: CardType, cpuType: CardType): RoundWinner {
  const result = compareCards(playerType, cpuType);
  if (result === 'draw') return 'draw';
  return result === 'a' ? 'player' : 'cpu';
}

export function calculateVP(params: {
  playerMode: CardMode;
  cpuMode: CardMode;
  playerDecision: BattleDecision;
  cpuDecision: BattleDecision;
  winner: RoundWinner;
}): { playerVP: number; cpuVP: number; folded: boolean } {
  const { playerMode, cpuMode, playerDecision, cpuDecision, winner } = params;

  if (playerDecision === 'fold' || cpuDecision === 'fold') {
    return { playerVP: 0, cpuVP: 0, folded: true };
  }

  if (winner === 'draw') {
    return { playerVP: 1, cpuVP: 1, folded: false };
  }

  const winnerMode = winner === 'player' ? playerMode : cpuMode;
  const loserMode  = winner === 'player' ? cpuMode : playerMode;

  const winnerVP = winnerMode === 'hidden' && loserMode === 'hidden' ? 3 : 1;
  const loserVP  = loserMode === 'hidden' ? -1 : 0;

  return winner === 'player'
    ? { playerVP: winnerVP, cpuVP: loserVP, folded: false }
    : { playerVP: loserVP, cpuVP: winnerVP, folded: false };
}

export function determineOverallWinner(
  playerVP: number,
  cpuVP: number
): 'player' | 'cpu' | 'draw' {
  if (playerVP > cpuVP) return 'player';
  if (cpuVP > playerVP) return 'cpu';
  return 'draw';
}
