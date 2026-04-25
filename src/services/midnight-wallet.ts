/**
 * Midnight blockchain wallet service.
 *
 * - Mnemonic: real BIP39 (bip39 npm package)
 * - Lace wallet: real DApp connector (window.midnight.mnLace)
 * - Address derivation: deterministic stub until @midnight-ntwrk/midnight-js-wallet
 *   is integrated with a live node. Replace deriveAddress() when ready.
 *
 * DApp Connector reference:
 *   https://docs.midnight.network/develop/tutorial/using-the-dapp-connector
 */

import * as bip39Lib from 'bip39';

// ── Lace DApp Connector types ──────────────────────────────────────────────
// Replace with: import type { ... } from '@midnight-ntwrk/dapp-connector-api'

interface MidnightEnabledAPI {
  state(): Promise<{ address: string }>;
  balances(): Promise<Record<string, bigint>>;
}

interface MidnightConnector {
  apiVersion: string;
  name: string;
  enable(): Promise<MidnightEnabledAPI>;
  isEnabled(): Promise<boolean>;
}

declare global {
  interface Window {
    midnight?: { mnLace?: MidnightConnector };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface WalletAccount {
  address: string;
  balance: number; // YTTM display units
  mnemonic: string;
  source: 'created' | 'imported' | 'lace';
}

/** Real BIP39 — 256 bits entropy = 24 words */
export function generateMnemonic(): string {
  return bip39Lib.generateMnemonic(256);
}

/** Validates BIP39 checksum + wordlist */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39Lib.validateMnemonic(mnemonic.trim().toLowerCase());
}

/** Create a new wallet from a generated mnemonic */
export async function createAccount(mnemonic: string): Promise<WalletAccount> {
  await delay(600);
  return {
    address: deriveAddress(mnemonic),
    balance: 100,
    mnemonic,
    source: 'created',
  };
}

/** Restore wallet from an existing mnemonic */
export async function importFromMnemonic(mnemonic: string): Promise<WalletAccount> {
  const normalized = mnemonic.trim().toLowerCase();
  if (!bip39Lib.validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic — please check all 24 words and their order.');
  }
  await delay(700);
  return {
    address: deriveAddress(normalized),
    balance: 50,
    mnemonic: normalized,
    source: 'imported',
  };
}

/** Connect to Lace wallet via the Midnight DApp Connector */
export async function connectLace(): Promise<WalletAccount> {
  const connector = window.midnight?.mnLace;
  if (!connector) {
    throw new LaceNotFoundError();
  }

  let api: MidnightEnabledAPI;
  try {
    api = await connector.enable();
  } catch (err) {
    throw new Error('Wallet connection was rejected by the user.');
  }

  const state = await api.state();

  let balance = 0;
  try {
    const balances = await api.balances();
    // tDUST / DUST are Midnight's native tokens; YTTM is the game token
    const raw = balances['tDUST'] ?? balances['DUST'] ?? BigInt(0);
    balance = Math.floor(Number(raw) / 1_000_000);
  } catch {
    // Balance fetch is best-effort
  }

  return { address: state.address, balance, mnemonic: '', source: 'lace' };
}

export function isLaceInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.midnight?.mnLace;
}

export class LaceNotFoundError extends Error {
  constructor() {
    super('Midnight Lace wallet extension is not installed.');
    this.name = 'LaceNotFoundError';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Deterministic Midnight-style address from mnemonic entropy.
 * TODO: replace with @midnight-ntwrk/midnight-js-wallet HD derivation
 *       (m/44'/789'/0'/0/0) once connected to a live node.
 */
function deriveAddress(mnemonic: string): string {
  const entropy = bip39Lib.mnemonicToEntropy(mnemonic);
  // Midnight addresses start with "mn1" — pad to 39 hex chars after prefix
  return `mn1${entropy.slice(0, 39).padEnd(39, '0')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
