/**
 * Dummy Midnight blockchain service.
 * All functions simulate on-chain behavior without actual network calls.
 * Replace with real @midnight-ntwrk SDK calls in future phases.
 */

export function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

/** Deterministic fake TX hash from a seed string */
export function fakeTxHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const base = Math.abs(h).toString(16).padStart(8, '0');
  return `0x${base}${randomHex(56)}`;
}

// ── Wallet ─────────────────────────────────────────────────────────────────

export interface WalletAccount {
  address: string;
  /** Shielded YTTM balance — only the wallet holder can see this */
  shieldedBalance: number;
}

/** Dummy wallet connection — simulates Lace / Midnight wallet without real network */
export async function connectWalletDummy(): Promise<WalletAccount> {
  await delay(1200);
  return {
    address: `mn_addr_preprod1${randomHex(39)}`,
    shieldedBalance: 25,
  };
}

// ── ZKP ────────────────────────────────────────────────────────────────────

export interface ZKProof {
  proofId: string;
  commitment: string;
  timestamp: number;
}

export async function generateZKProof(_cardType: string, _roundId: string): Promise<ZKProof> {
  await delay(2000 + Math.random() * 1000);
  return {
    proofId: `zkp_${randomHex(16)}`,
    commitment: `0x${randomHex(64)}`,
    timestamp: Date.now(),
  };
}

// ── On-chain game (dummy) ───────────────────────────────────────────────────

export interface OnChainGameSession {
  contractAddress: string;
  deployTxHash: string;
}

/** Simulate deploying a janken contract — returns a fake contract address */
export async function deployGameContract(): Promise<OnChainGameSession> {
  await delay(1500);
  return {
    contractAddress: `mn_contract_preprod1${randomHex(35)}`,
    deployTxHash: fakeTxHash('deploy'),
  };
}

/** Simulate submitting a round TX on-chain */
export async function submitRoundOnChain(params: {
  contractAddress: string;
  roundNumber: number;
  action: 'commit' | 'reveal' | 'resolve';
}): Promise<string> {
  await delay(800);
  return fakeTxHash(`${params.contractAddress}-r${params.roundNumber}-${params.action}`);
}

// ── Shielded YTTM reward ────────────────────────────────────────────────────

export interface ShieldedRewardResult {
  txHash: string;
  /** Amount credited — visible only to the recipient (shielded) */
  amount: number;
}

/**
 * Claim victory reward as shielded YTTM.
 * The transfer is ZKP-shielded: third parties cannot see the amount or recipient.
 */
export async function claimShieldedReward(_address: string): Promise<ShieldedRewardResult> {
  await delay(1500);
  return {
    txHash: fakeTxHash(`reward-${_address}`),
    amount: 10,
  };
}

// ── Legacy aliases (kept for backward compat) ──────────────────────────────

export async function claimReward(_address: string): Promise<string> {
  const result = await claimShieldedReward(_address);
  return result.txHash;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
