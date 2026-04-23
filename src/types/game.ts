export type CardType = 'rock' | 'scissors' | 'paper' | 'loser';
export type CardMode = 'public' | 'hidden';
export type BattleDecision = 'battle' | 'fold';
export type RoundWinner = 'player' | 'cpu' | 'draw';

export const CARD_META: Record<CardType, { label: string; icon: string; jpLabel: string; color: string }> = {
  rock:     { label: 'GU',  icon: '✊', jpLabel: 'グー',   color: '#06b6d4' },
  scissors: { label: 'CHO', icon: '✌️',  jpLabel: 'チョキ', color: '#a78bfa' },
  paper:    { label: 'PA',  icon: '✋', jpLabel: 'パー',   color: '#34d399' },
  loser:    { label: 'INU', icon: '🐶', jpLabel: '負け犬', color: '#e11d48' },
};

export interface Card {
  id: string;
  type: CardType;
  used: boolean;
}

export interface RoundResult {
  roundNumber: number;
  playerCard: Card;
  playerMode: CardMode;
  cpuCard: Card;
  cpuMode: CardMode;
  playerDecision: BattleDecision;
  cpuDecision: BattleDecision;
  winner: RoundWinner | null;
  playerVP: number;
  cpuVP: number;
  folded: boolean;
}

export type GamePhase =
  | 'onboarding'
  | 'mode-select'
  | 'card-select'
  | 'cpu-thinking'
  | 'player-battle-fold'
  | 'cpu-battle-fold'
  | 'zkp-generating'
  | 'revealing'
  | 'round-result'
  | 'game-over';

export interface GameState {
  phase: GamePhase;
  playerName: string;
  walletAddress: string;
  walletBalance: number;
  mnemonic: string;

  playerHand: Card[];
  cpuHand: Card[];
  playerTotalVP: number;
  cpuTotalVP: number;
  currentRound: number;
  totalRounds: number;
  roundResults: RoundResult[];

  selectedCard: Card | null;
  selectedMode: CardMode;
  cpuSelectedCard: Card | null;
  cpuSelectedMode: CardMode | null;
  currentRoundResult: RoundResult | null;

  gameWinner: 'player' | 'cpu' | 'draw' | null;
  rewardClaimed: boolean;
}
