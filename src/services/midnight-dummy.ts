/**
 * Dummy Midnight blockchain service.
 * All functions simulate on-chain behavior without actual network calls.
 * Replace with real @midnight-ntwrk/midnight-js SDK calls for production.
 */

const DUMMY_WORDLIST = [
  'abandon','ability','able','about','above','absent','absorb','abstract',
  'absurd','abuse','access','accident','account','accuse','achieve','acid',
  'acoustic','acquire','across','action','actor','actress','actual','adapt',
  'add','addict','address','adjust','admit','adult','advance','advice',
  'aerobic','afford','afraid','again','agent','agree','ahead','aim',
  'air','airport','aisle','alarm','album','alcohol','alert','alien',
  'all','alley','allow','almost','alone','alpha','already','also',
];

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

export interface WalletAccount {
  address: string;
  balance: number;
  mnemonic: string;
}

export function generateMnemonic(): string {
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    words.push(DUMMY_WORDLIST[Math.floor(Math.random() * DUMMY_WORDLIST.length)]);
  }
  return words.join(' ');
}

export async function createAccount(mnemonic: string): Promise<WalletAccount> {
  await delay(800);
  return {
    address: `mn1${randomHex(38)}`,
    balance: 100,
    mnemonic,
  };
}

export async function connectLaceWallet(): Promise<WalletAccount> {
  await delay(1200);
  return {
    address: `mn1${randomHex(38)}`,
    balance: 250,
    mnemonic: '',
  };
}

export async function importMnemonic(mnemonic: string): Promise<WalletAccount> {
  await delay(900);
  const seed = mnemonic.split(' ').reduce((acc, w) => acc + w.charCodeAt(0), 0);
  const fakeHex = randomHex(38);
  return {
    address: `mn1${fakeHex}`,
    balance: 50 + (seed % 200),
    mnemonic,
  };
}

export interface ZKProof {
  proofId: string;
  commitment: string;
  timestamp: number;
}

export async function generateZKProof(_cardType: string, _roundId: string): Promise<ZKProof> {
  // Simulate ZKP generation latency (2-3 seconds)
  await delay(2000 + Math.random() * 1000);
  return {
    proofId: `zkp_${randomHex(16)}`,
    commitment: `0x${randomHex(64)}`,
    timestamp: Date.now(),
  };
}

export async function submitMove(_params: {
  roundId: string;
  commitment: string;
  mode: 'public' | 'hidden';
}): Promise<string> {
  await delay(500);
  return `tx_${randomHex(32)}`;
}

export async function claimReward(_address: string): Promise<string> {
  await delay(1500);
  return `tx_${randomHex(32)}`;
}

export function getMidnightContractAddress(): string {
  return `mn1contract${randomHex(28)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
