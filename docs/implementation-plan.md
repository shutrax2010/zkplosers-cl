# Loser's Gambit — Phase 3 実装計画

> **作成:** 2026-04-27  
> **対象:** ダミー実装 → Midnight Blockchain / ZKP 本番連携

---

## 前提状況

| 項目 | 状態 |
|---|---|
| Phase 1 (シングルプレイ・VP ロジック) | ✅ 完了 |
| Phase 2 (マルチプレイ・Render デプロイ) | ✅ 完了 |
| Operator アカウント (Mnemonic・アドレス) | ✅ 生成済み `.env.operator.local` |
| Compact コントラクト設計 | ✅ `docs/contracts.md` に設計済み |
| tDUST 残高 (ガス代) | ⬜ Faucet 未取得 |
| `contract/` ディレクトリ (Compact ファイル) | ⬜ 未作成 |
| TypeScript API バインディング | ⬜ 未生成 |
| Proof Server (Docker) | ⬜ 未起動・未検証 |

---

## 実装ステップ一覧

```
Step 1: 環境・ツール検証          ← まずここから
Step 2: yttm.compact 実装・デプロイ
Step 3: janken.compact 実装・デプロイ
Step 4: ZKP / Proof Server 統合
Step 5: TypeScript SDK バインディング作成
Step 6: midnight-dummy.ts の置き換え
Step 7: フロントエンド配線
Step 8: 結合テスト・Render 再デプロイ
```

---

## Step 1 — 環境・ツール検証

**目的:** 公式サンプルを実際に動かし、`contracts.md` の ⚠️ 要確認項目を解消する。

### 1-1. ツール準備

```bash
# Compact コンパイラのバージョン確認
compactc --version   # 期待: 0.30.0

# Proof Server を Docker で起動
docker run -p 6300:6300 midnightnetwork/proof-server:latest

# Preprod 接続確認
curl https://indexer.preprod.midnight.network/api/v1/blocks?limit=1
```

### 1-2. 公式サンプルで構文確認（⚠️ 要確認項目の解消）

`example-bboard` / `example-counter` を clone してビルド・実行し、以下を確認する。

| 確認項目 | 現在の仮定 | 確認内容 |
|---|---|---|
| Shielded 残高のキー型 | `ZswapCoinPublicKey` | 実際の型名 |
| `own_address()` の存在 | 存在すると仮定 | Circuit 内で呼び出せるか |
| `verify_proof()` のシグネチャ | 仮定のシグネチャ | 引数の順序・型 |
| `Proof` 型名 | `Proof` と仮定 | 正式な型名 |
| `Map::empty()` 構文 | Compact 0.30 で有効と仮定 | コンパイル通過確認 |
| `persistentCommit()` の有無 | 組み込み関数と仮定 | CompactStandardLibrary に存在するか |
| TypeScript バインディング生成方法 | `compactc` の出力 | 生成物の構造確認 |

### 1-3. Faucet で tDUST 取得

1. Faucet: https://faucet.preprod.midnight.network/
2. Operator の **Unshielded アドレス** に送金  
   `mn_addr_preprod1slzcwxul9e42djm0rqd9zg38e53kwzqc9qwxg5s88juwy4qs8k9qa6j4h4`
3. Explorer で残高確認: https://explorer.preprod.midnight.network/

---

## Step 2 — `yttm.compact` 実装・デプロイ

**目的:** YTTM シールドトークンコントラクトを Preprod にデプロイする。

### 2-1. コントラクトファイル作成

```
zkp-demo1/
└── contract/
    ├── package.json
    └── src/
        └── yttm.compact    ← docs/contracts.md §5 の設計をベースに実装
```

Step 1 で確認した正しい構文に修正してから実装する。

### 2-2. コンパイル & TypeScript バインディング生成

```bash
cd contract
compactc src/yttm.compact --output api/src/
# 生成物: api/src/yttm.cjs (コントラクトバイト), api/src/yttm-api.ts (TS バインディング)
```

### 2-3. デプロイスクリプト作成・実行

```typescript
// scripts/deploy-yttm.ts
import { yttmApi } from '../api/src/yttm-api';
// Operator ウォレットで deployTx → contractAddress を取得
// 取得した contractAddress を .env に記録
// VITE_YTTM_CONTRACT=mn_contract_preprod1xxxxx
```

---

## Step 3 — `janken.compact` 実装・デプロイ

**目的:** ゲームロジックコントラクトを Preprod にデプロイする。

### 3-1. コントラクトファイル作成

```
contract/src/
└── janken.compact   ← docs/contracts.md §6 の設計をベースに実装
```

依存: `VITE_YTTM_CONTRACT`（Step 2 で取得）が必要。

### 3-2. コンパイル & デプロイ

```bash
compactc src/janken.compact --output api/src/
# scripts/deploy-janken.ts を実行
# VITE_JANKEN_CONTRACT=mn_contract_preprod1xxxxx を記録
```

### 3-3. yttm の authorizedMinter を janken に設定

```typescript
// janken.compact がデプロイされたら、yttm.compact の minter を更新
await yttm.setAuthorizedMinter(jankenContractAddress);
```

---

## Step 4 — ZKP / Proof Server 統合

**目的:** 秘匿カードの ZKP 証明生成を実装する。

### 4-1. Proof Server API 仕様確認

```
Proof Server: http://localhost:6300 (開発時)
エンドポイント: POST /prove
入力: { circuit: "revealHiddenCard", publicInputs: [...], privateWitness: {...} }
出力: { proof: "0x..." }
```

### 4-2. Commitment スキーム実装

`janken.compact` の `persistentCommit(cardType, nonce)` に対応する TypeScript 実装。

```typescript
// src/services/zkp-service.ts
export async function generateCommitment(cardType: CardType, nonce: Uint8Array): Promise<string> {
  // Compact の persistentCommit() と同じハッシュロジックを TypeScript で再現
  // SDK の commitment ユーティリティを使用
}

export async function generateHiddenCardProof(params: {
  myCardType: CardType;
  myNonce: Uint8Array;
  oppCardType: CardType;  // public card の場合
  oppNonce: Uint8Array;   // public card の場合は zero_bytes
  myCommitment: string;
  oppCommitment: string;
  claimedOutcome: BattleOutcome;
}): Promise<string> {
  // Proof Server に POST して proof を取得
}
```

### 4-3. ZKPOverlay コンポーネントの接続

現在はアニメーションのみ。`onDone` コールバック前に実際の proof 生成を実行する。

```typescript
// ZKPOverlay: アニメーション中に generateHiddenCardProof() を並行実行
// proof 完成 → onDone(proof) でゲームステートに渡す
```

---

## Step 5 — TypeScript SDK バインディング作成

**目的:** `api/` 層を整備し、フロントエンドから型安全にコントラクトを呼び出せるようにする。

### 5-1. API レイヤー設計

```typescript
// api/src/janken-api.ts  (compactc 生成物 + 手書きラッパー)
export interface JankenApi {
  joinGame(playerAddress: string): Promise<{ txHash: string }>;
  commitCard(commitment: string, mode: CardMode): Promise<{ txHash: string }>;
  decideBattleFold(decision: BattleDecision): Promise<{ txHash: string }>;
  revealPublicCard(cardType: CardType, nonce: Uint8Array): Promise<{ txHash: string }>;
  revealHiddenCard(claimedOutcome: BattleOutcome, proof: string): Promise<{ txHash: string }>;
  claimReward(): Promise<{ txHash: string }>;
  getGameState(): Promise<OnChainGameState>;
}

// api/src/yttm-api.ts
export interface YttmApi {
  balanceOf(address: string): Promise<bigint>;  // shielded — ZKP で証明
  mintReward(recipient: string, amount: bigint): Promise<{ txHash: string }>;
}
```

### 5-2. SDK パッケージ統合

インストール済みの `@midnight-ntwrk/` パッケージを活用:

| パッケージ | 用途 |
|---|---|
| `wallet-sdk` | `createKeystore` — ウォレット鍵管理 |
| `wallet-sdk-hd` | `HDWallet` — BIP39 HD 鍵導出 |
| `wallet-sdk-address-format` | `UnshieldedAddress` / `ShieldedAddress` — アドレス変換 |
| `ledger-v8` | `ZswapSecretKeys` / `DustSecretKey` — WASM 署名 |

---

## Step 6 — `midnight-dummy.ts` の置き換え

**目的:** ダミー実装を本番 SDK 呼び出しに段階的に切り替える。

`docs/contracts.md §11` の対応表に従い、以下の順序で置き換える。

| 関数 | ダミー実装 | 本番実装 |
|---|---|---|
| `connectWalletDummy()` | フェイクアドレス生成 | Lace DApp Connector (既に `midnight-wallet.ts` に実装済み) |
| `generateZKProof()` | 2秒 delay | Proof Server POST → proof string |
| `deployGameContract()` | フェイクアドレス | `jankenApi.deploy()` |
| `submitRoundOnChain()` | フェイク TX ハッシュ | `jankenApi.commitCard()` / `revealPublicCard()` など |
| `claimShieldedReward()` | `walletBalance +10` | `yttmApi.mintReward()` |

**置き換え方針:** オンチェーンモード OFF 時はダミー継続。ON 時のみ本番を呼ぶ。

```typescript
// src/services/midnight-service.ts (新規)
export async function claimShieldedReward(address: string, onChain: boolean) {
  if (!onChain) return midnight_dummy.claimShieldedReward(address);
  return yttmApi.mintReward(address, 10_000_000n);
}
```

---

## Step 7 — フロントエンド配線

**目的:** UI とオンチェーン処理を結合する。

### 7-1. `useGameState.ts` への onChain フロー追加

```
card-select
  ↓ COMMIT_MOVE (onChain=true)
    → jankenApi.commitCard(commitment, mode)  ← TX 送信・待機
  ↓ ZKP生成 (秘匿の場合)
    → zkpService.generateHiddenCardProof()    ← Proof Server
  ↓ REVEAL
    → jankenApi.revealHiddenCard(outcome, proof)  ← TX 送信
```

### 7-2. TX ハッシュの表示

`ResultScreen` の On-Chain パネルに実際の TX ハッシュを表示する。

### 7-3. ウォレット残高の同期

`yttmApi.balanceOf(address)` を結果画面で呼び出し、シールド残高を更新。

---

## Step 8 — 結合テスト・Render 再デプロイ

### 8-1. ローカルテスト環境

```
┌──────────────────────────────────────────────┐
│ ローカル開発環境                              │
│                                              │
│  npm run dev          → http://localhost:5173 │
│  cd server && npm dev → ws://localhost:3001   │
│  docker run proof-server → http://localhost:6300 │
│                                              │
│  ↕ Preprod テストネット                      │
│  janken.compact / yttm.compact               │
└──────────────────────────────────────────────┘
```

### 8-2. テストシナリオ

1. Solo オンチェーン: `commitCard` → `revealPublicCard` → `claimReward`
2. Solo ZKP: `commitCard (hidden)` → `generateProof` → `revealHiddenCard`
3. Multi オンチェーン: 2クライアントで上記フロー

### 8-3. Render 更新

Proof Server はローカル専用のため、Render 本番ではオンチェーンモードを制限するか、  
別途 Proof Server のホスティングを検討する。

```
本番: オンチェーンモード → Proof Server ホスティングが必要
暫定: 本番はオンチェーンモード OFF のみ / Proof Server は開発者ローカルのみ
```

---

## 未解決事項・リスク

| 項目 | リスク | 対処方針 |
|---|---|---|
| Compact 0.30.0 の構文差異 | `Map::empty()` / `verify_proof()` が異なる | Step 1 で公式サンプル実行して先に確認 |
| Shielded 残高の型名 | `ZswapCoinPublicKey` が実際と異なる | `contracts.md §13` の指摘事項を公式で確認 |
| Proof Server の本番ホスティング | Render Free プランで動くか不明 | Phase 3 では開発環境のみとし、Phase 4 で検討 |
| マルチプレイ + オンチェーンの同期 | TX 完了待機中に WS タイムアウト | タイムアウト設定の見直し / ONCHAIN_TX メッセージ活用 |
| tDUST の継続調達 | Faucet のレート制限 | テスト用の節約設計（ラウンドごとの TX を最小化） |

---

## 実装優先順位

```
必須 (Phase 3 MVP):
  Step 1 → Step 2 → Step 3 → Step 6 (commitCard/revealPublicCard のみ) → Step 7 (公開のみ)

追加:
  Step 4 → Step 6 (ZKP 部分) → Step 7 (秘匿対応)  ← ZKP の本番証明

後回し:
  Step 8-3 (Render 本番 Proof Server)              ← Phase 4
```
