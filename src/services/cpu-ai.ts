import type { Card, CardMode, BattleDecision } from '../types/game';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function cpuSelectCard(availableCards: Card[]): Card {
  const unused = availableCards.filter(c => !c.used);
  // Slightly prefer non-loser cards
  const nonLoser = unused.filter(c => c.type !== 'loser');
  if (nonLoser.length > 0 && Math.random() > 0.2) return pick(nonLoser);
  return pick(unused);
}

export function cpuSelectMode(card: Card, round: number, cpuVP: number, playerVP: number): CardMode {
  // CPU is more likely to go Hidden when losing or in later rounds
  const losing = cpuVP < playerVP;
  const lateGame = round >= 2;
  const isLoser = card.type === 'loser';

  // Never go hidden with loser in round 1
  if (isLoser && round === 0) return 'public';

  // Bluff with loser: go hidden to scare opponent
  if (isLoser && Math.random() < 0.4) return 'hidden';

  let hiddenChance = 0.25;
  if (losing) hiddenChance += 0.2;
  if (lateGame) hiddenChance += 0.1;

  return Math.random() < hiddenChance ? 'hidden' : 'public';
}

export function cpuDecideBattleFold(
  cpuCard: Card,
  playerMode: CardMode,
  round: number,
  cpuVP: number,
): BattleDecision {
  // CPU folds when player is hidden and CPU's card is weak
  const isWeak = cpuCard.type === 'loser';
  const isLate = round >= 2;

  // If already losing badly, take the fight
  if (cpuVP <= -2) return 'battle';

  let foldChance = 0.25;
  if (isWeak) foldChance += 0.35;
  if (isLate && !isWeak) foldChance -= 0.1;
  if (playerMode === 'hidden') foldChance += 0.05;

  return Math.random() < foldChance ? 'fold' : 'battle';
}
