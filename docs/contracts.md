# Loser's Gambit — Midnight コントラクト仕様書

> **レビューステータス (2026-04-24)**  
> 公式サンプル (`example-bboard`, `example-counter`) との照合を実施。  
> `⚠️ 要確認` マークの箇所は本実装前に公式サンプルで検証が必要。  
> **2026-04-24 更新**: Compact 構文の重大な差異を §13 指摘事項 #15〜#19 として追記。

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [アカウント設計](#2-アカウント設計)
3. [オンチェーン / ZKP / オフチェーン データ分類](#3-オンチェーン--zkp--オフチェーン-データ分類)
4. [コントラクト責務マトリクス](#4-コントラクト責務マトリクス)
5. [トークン設計（YTTM）](#5-トークン設計yttm)
6. [ゲームコントラクト設計](#6-ゲームコントラクト設計)
7. [ZKP コミットメントスキーム](#7-zkp-コミットメントスキーム)
8. [VP 計算ロジック（オンチェーン）](#8-vp-計算ロジックオンチェーン)
9. [ウォレット統合](#9-ウォレット統合)
10. [トークン取得（Faucet）](#10-トークン取得faucet)
11. [ダミー実装 → 本番実装 対応表](#11-ダミー実装--本番実装-対応表)
12. [デプロイ手順](#12-デプロイ手順)
13. [公式ドキュメントとのレビュー指摘事項](#13-公式ドキュメントとのレビュー指摘事項)
14. [オンチェーンモード設計](#14-オンチェーンモード設計)

---

## 1. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│   OnboardingScreen  │  GameBoard  │  ResultScreen                  │
└──────────┬───────────────────┬───────────────────┬─────────────────┘
           │                   │                   │
    midnight-wallet.ts    midnight-dummy.ts    midnight-dummy.ts
    (BIP39 / Lace API)    → janken.compact     → yttm.compact
           │                   │                   │
           │           DApp SDK (TypeScript)        │
           │   ※ コントラクト間呼び出しは           │
           │     TypeScript レイヤーで orchestrate   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Midnight Blockchain                           │
│                                                                     │
│  ┌──────────────────────────┐    ┌──────────────────────────────┐   │
│  │     janken.compact       │    │       yttm.compact           │   │
│  │     (ゲームロジック)      │    │   (YTTM トークン管理)        │   │
│  │                          │    │                              │   │
│  │  - gameId / status       │    │  - mintReward()              │   │
│  │  - カード commitment      │    │  - balanceOf()  [shielded]   │   │
│  │  - ZKP 勝敗証明          │    │  - transfer()               │   │
│  │  - VP 集計               │    │  - totalSupply  [public]     │   │
│  └──────────────────────────┘    └──────────────────────────────┘   │
│                                                                     │
│   NIGHT (governance)  ──生成──▶  DUST (gas)                        │
└─────────────────────────────────────────────────────────────────────┘

         ↑ WebSocket (Multiplayer のみ)
┌────────────────────────┐
│   Matching Server      │  ← オフチェーン。Room ID マッチング専用。
│   (Node.js WS)         │     オンチェーンアカウントなし。
└────────────────────────┘

         ↑ HTTP (証明生成)
┌────────────────────────┐
│   Proof Server         │  ← localhost:6300 (ローカル専用)
│   (Docker / local)     │     秘密データはマシン外に出ない。
│                        │     ZKP 生成はすべてここで実行。
└────────────────────────┘
```

### コントラクトファイル構成（予定）

bboard 公式サンプルのプロジェクト構成を参考に、以下の構成を採用する。

```
zkp-demo1/
├── contract/                       ← Compact コントラクト（未作成）
│   ├── package.json
│   └── src/
│       ├── janken.compact          ← ゲームロジック本体
│       └── yttm.compact            ← YTTM トークン
├── api/                            ← Compact コンパイラ生成の TS バインディング + API
│   └── src/
│       ├── janken-api.ts
│       └── yttm-api.ts
├── src/                            ← フロントエンド (React)
│   ├── services/
│   │   ├── midnight-wallet.ts      ✅ 実装済み (BIP39 / Lace / 正規アドレス導出)
│   │   └── midnight-dummy.ts       ✅ 実装済み (オフチェーンダミー)
│   ├── logic/
│   │   └── game-logic.ts           ✅ 実装済み (VP 計算・カード勝敗)
│   └── hooks/
│       └── useGameState.ts         ✅ 実装済み
├── docs/
│   ├── contracts.md                ← 本ドキュメント
│   ├── spec.md                     ← ゲームルール仕様
│   ├── screens.md                  ← UI/UX 仕様
│   └── instraction-generate-address.md
├── .env.operator.local             ✅ Operator アカウント情報 (gitignore 済み)
└── .claude/settings.json           ← Midnight MCP 設定

ツールバージョン:
  Compact コンパイラ: compactc 0.30.0
  Proof Server: Docker (http://localhost:6300)
  ネットワーク: Preprod テストネット (固定)

使用 SDK パッケージ (node_modules/@midnight-ntwrk/):
  wallet-sdk               ← createKeystore
  wallet-sdk-hd            ← HDWallet, Roles, generateMnemonicWords
  wallet-sdk-address-format← UnshieldedAddress, ShieldedAddress, DustAddress, MidnightBech32m
  ledger-v8                ← ZswapSecretKeys, DustSecretKey (WASM)
```

---

## 2. アカウント設計

### 2.1 アカウント一覧

| アカウント種別 | 実体 | Midnight アドレス | 主な役割 |
|---|---|---|---|
| **Operator (システム)** | デプロイヤー | 標準公開鍵アドレス | コントラクトのデプロイ・初期設定 |
| **Player (ユーザー)** | ゲーム参加者 | ZswapCoinPublicKey ⚠️ (型名要確認) | ゲーム参加・カード提出・報酬受取 |
| **Matching Server** | オフチェーンサービス | なし (オンチェーン不要) | WebSocket ルームマッチング |

---

### 2.2 Operator アカウント

> **ステータス (2026-04-24)**: Mnemonic・Unshielded・Shielded アドレス生成済み。Faucet で tDUST 取得後にデプロイ可能。  
> Mnemonic は `.env.operator.local` に保存済み（gitignore 済み）。

```
役割:
  - yttm.compact と janken.compact を Preprod テストネットにデプロイする
  - yttm.compact の authorizedMinter を janken.compact アドレスに設定する
  - デプロイ後はゲームロジックに一切関与しない (trustless 設計)

セットアップ状況:
  ✅ BIP39 Mnemonic (24語) 生成済み — .env.operator.local に保存
  ✅ Unshielded アドレス生成済み
       mn_addr_preprod1slzcwxul9e42djm0rqd9zg38e53kwzqc9qwxg5s88juwy4qs8k9qa6j4h4
  ✅ Shielded アドレス生成済み
       mn_shield-addr_preprod1u0u84getncu7h38qdhywxm32n3st0v4elqhw8kushfzgc62w86qr6pyzdg0j0ahna5558jmkapzgecsjv285hsep7p7mu6lrxwyul3sr7ps9r
  ⬜ Faucet (https://faucet.preprod.midnight.network/) で tDUST 取得
       → Unshielded アドレス宛に受け取る
  ⬜ Explorer (https://explorer.preprod.midnight.network/) で残高確認
  ⬜ コントラクトデプロイ (Phase 3〜4 で実施)

保持データ:
  - Mnemonic / 秘密鍵 — .env.operator.local (gitignore 済み、絶対にコミット不可)
  - デプロイ用 DUST 残高 (ガス代)
  - デプロイ後に取得するコントラクトアドレス (環境変数に保存)
      VITE_JANKEN_CONTRACT=<デプロイ後に記入>
      VITE_YTTM_CONTRACT=<デプロイ後に記入>

振る舞い:
  - 一度デプロイすれば役割終了
  - ゲームへの参加権限なし
  - yttm の mint 権限は janken.compact に委譲済み
```

---

### 2.3 Player アカウント（ユーザー）

```
接続方法 (2026-04-24 更新):
  A) Connect Lace Wallet — Lace DApp Connector 経由（Lace 拡張が必要）
  B) Connect Wallet (Demo) — ダミー接続（フェイクアドレス生成、開発用）

  廃止: Mnemonic 生成によるアカウント作成、Mnemonic インポート

アドレス種別:
  - Shielded アドレス (mn_shield-addr_preprod1...): YTTM 残高や取引がプライベート
  - Unshielded アドレス (mn_addr_preprod1...): ゲーム参加・TX 署名用
  - DUST アドレス (mn_dust_preprod1...): ガス代支払い用

オンチェーン保持データ:
  - YTTM 残高 (yttm.compact の shielded balances に記録 — 第三者非公開)
  - ゲーム参加中の player 構造体 (janken.compact の ledger に記録)
      - totalVP: Int64         ← ラウンド終了後に更新
      - cardsRemaining: Uint64 ← コミット後にデクリメント

クライアント(ローカル)のみ保持データ:
  - ラウンドごとの nonce (random_bytes(32)) ← ZKP 生成に使用
  - 選択したカード種 (cardType) ← commitment 生成後は不要

振る舞い:
  1. joinGame(playerAddress)               → ゲームへ参加
  2. commitCard(commitment, mode)          → カードをコミット
  3. decideBattleFold(decision)            → Battle / Fold を選択
  4. revealPublicCard(cardType, nonce)     → 公開カードを開示
     revealHiddenCard(claimedOutcome, proof) → 秘匿カード結果を ZKP で証明
  5. claimShieldedReward(address)          → 勝者が YTTM を Shielded で受け取る
```

---

### 2.4 Matching Server（マルチプレイ用オフチェーンサービス）

詳細設計: `docs/multiplayer.md` を参照。

```
ホスティング: Render Web Service (Node.js 20)
  - URL: wss://losers-gambit-ws.onrender.com (予定)
  - Free プランで運用（30秒ごとの PING で スリープ防止）

役割:
  - Room ID (6文字英数字) をキーにプレイヤー2名をマッチング
  - WebSocket メッセージの中継（ゲームロジックは一切持たない）
  - コミット順序の強制（両者コミット完了前に reveal を中継しない）

Midnight 上のアカウント: なし
オンチェーン操作: なし

保持データ (メモリのみ — サーバー再起動でリセット):
  - roomId → Room { players[2], phase, roundState, timestamps }

主要メッセージ (Client → Server → Client):
  JOIN_ROOM      → ROOM_JOINED / GAME_STARTED
  COMMIT_MOVE    → OPPONENT_COMMITTED (mode のみ中継、commitment 値は中継しない)
  PLAYER_DECISION→ OPPONENT_DECISION
  REVEAL_PUBLIC  → OPPONENT_REVEALED_PUBLIC
  REVEAL_HIDDEN  → OPPONENT_REVEALED_HIDDEN
  ONCHAIN_TX     → OPPONENT_ONCHAIN_TX (オンチェーンモード時)
  READY_NEXT_ROUND → OPPONENT_READY_NEXT
  PING           → PONG

セキュリティ:
  - cardType はサーバーに送らない（commitment = hash のみ）
  - 両者コミット完了まで REVEAL を中継しない
  - Room タイムアウト: waiting 5分 / ゲーム中 30分
```

---

## 3. オンチェーン / ZKP / オフチェーン データ分類

### 3.1 データ分類マトリクス

| データ | 格納場所 | 可視性 | 更新タイミング |
|---|---|---|---|
| `gameId` | `janken.compact` ledger | **Public** | ゲーム作成時 |
| `gameStatus` | `janken.compact` ledger | **Public** | 各フェーズ遷移時 |
| `currentRound` | `janken.compact` ledger | **Public** | ラウンド終了時 |
| `player1.address` | `janken.compact` ledger | **Public** | joinGame() 時 |
| `player2.address` | `janken.compact` ledger | **Public** | joinGame() 時 |
| `player1.totalVP` | `janken.compact` ledger | **Public** | ラウンド解決後 |
| `player2.totalVP` | `janken.compact` ledger | **Public** | ラウンド解決後 |
| `commitment[round][player]` | `janken.compact` ledger | **Public** | commitCard() 時 |
| `cardMode[round][player]` | `janken.compact` ledger | **Public** | commitCard() 時 |
| `decision[round][player]` | `janken.compact` ledger | **Public** | decideBattleFold() 時 |
| `YTTM.totalSupply` | `yttm.compact` ledger | **Public** | mintReward() 時 |
| `YTTM.balances[address]` | `yttm.compact` ledger | **Shielded (ZKP)** | mint / transfer 時 |
| `revealedCards[round][player]` | `janken.compact` ledger | **Public** | revealPublicCard() 時 — 公開カードはチェーン上に記録 |
| `hiddenOutcomes[round][player]` | `janken.compact` ledger | **Public (BattleOutcome のみ)** | revealHiddenCard() 時 — cardType は非記録 |
| **cardType (実カード種)** | **ZKP witness (秘匿)** | **Private** | Proof Server の private witness。ledger には書かない |
| **nonce** | **ZKP witness (秘匿)** | **Private** | commitCard() 〜 revealHiddenCard() のクライアント保持 |
| Mnemonic / 秘密鍵 | クライアントローカル | **Private** | オンチェーンに送信しない |

### 3.2 ZKP の対象データ

#### ① カード秘匿モードの証明（janken.compact）

```
目的:
  「私は commitment に対応する有効なカードを持っており、
   カード種別は相手に明かさずに勝敗を証明できる」

Public input  (オンチェーンに公開):
  - commitment = persistentCommit(cardType, nonce)  ← SHA256 ではなく Midnight 固有関数

Private input (Proof Server の witness として処理):
  - cardType  (Rock / Scissors / Paper / Loser)
  - nonce     (random_bytes(32))

ZKP が証明すること:
  1. Binding   — persistentCommit(cardType, nonce) == commitment
  2. Hiding    — cardType はチェーン上に記録されない
  3. Validity  — cardType は有効な enum 値である
  4. Ownership — この nonce を知っているのは提出者だけ

ZKP 生成フロー:
  Client → Proof Server (localhost:6300) → ZK Proof を返す
  ※ 秘密データ (cardType, nonce) はネットワークに出ない
```

#### ② YTTM 残高の秘匿（yttm.compact）

```
ZKP により:
  - 残高の正確な値を開示せずに「X YTTM 以上保有」を証明できる
  - balanceOf() が shielded 残高を返すため外部から値は見えない
```

### 3.3 「秘匿カードは最後まで公開しない」の実現方法

```
revealResult() は ZKP proof を受け取り、
「commitment に対応するカードが存在し、勝敗が X である」ことを検証する。
cardType 自体は ledger に書き込まず、VP の増減結果のみを記録する。

チェーン上に残るもの:
  - commitment (persistentCommit の出力値) ← カード種は復元不可
  - VP の変動結果
  - Battle/Fold の選択

チェーン上に残らないもの:
  - cardType (Rock / Scissors / Paper / Loser)
  - nonce
```

---

## 4. コントラクト責務マトリクス

### 4.1 操作 → コントラクト対応表

| 操作 | 呼び出し元 | 対象コントラクト | 主な処理 | 状態変化 |
|---|---|---|---|---|
| ゲーム作成 | Player | `janken.compact` constructor | gameId 設定、ledger 初期化 | `WaitingForPlayers` |
| プレイヤー参加 | Player | `janken.compact` `joinGame()` | player 登録 | 2人揃ったら `RoundActive` |
| カードコミット | Player | `janken.compact` `commitCard()` | commitment をオンチェーンに記録 | 両者揃ったら次フェーズ |
| Battle/Fold 選択 | Player | `janken.compact` `decideBattleFold()` | 意思決定をオンチェーンに記録 | 両者揃ったら `Resolving` |
| 結果開示（公開モード） | Player | `janken.compact` `revealPublicCard()` | commitment 検証 → cardType を `revealedCards` に記録 | cardType がチェーン上で閲覧可能 |
| 結果開示（秘匿モード） | Player | `janken.compact` `revealHiddenCard()` | ZKP proof 検証 → `BattleOutcome` のみ `hiddenOutcomes` に記録 | cardType は非公開のまま |
| 報酬請求 (Step 1) | Player (勝者のみ) | `janken.compact` `claimReward()` | 勝者確認、status → Claimed | `Claimed` |
| 報酬請求 (Step 2) | TypeScript DApp | `yttm.compact` `mintReward()` | authorized minter 確認 → 残高加算 | totalSupply 増加 |

> ⚠️ **コントラクト間呼び出しの設計**  
> Compact の `call_contract()` は公式ドキュメントで未確認。  
> 現在の設計では **TypeScript DApp レイヤーが2コントラクトを順番に呼び出す** 方式を採用する。  
> 詳細は [§13 指摘事項 #1](#指摘事項-1-call_contract-は未確認) を参照。

### 4.2 コントラクト間の依存関係（改訂版）

```
【TypeScript DApp レイヤーが orchestrate する】

Player
  │
  ▼
TypeScript DApp
  │
  ├─── janken.compact.claimReward(winner)
  │       ↓ status → Claimed を確認
  │
  └─── yttm.compact.mintReward(winner, 10 YTTM)
          ↑
          authorized minter check (janken contract address == caller)
          ⚠️ TypeScript から呼ぶ場合、minter check の実現方法を要再設計
```

### 4.3 ゲーム状態遷移とコントラクト操作

```
[WaitingForPlayers]
  joinGame(p1)      → player1 登録
  joinGame(p2)      → player2 登録、status → RoundActive

[RoundActive]
  commitCard(p1, commitment, Public/Hidden)
  commitCard(p2, commitment, Public/Hidden)
  → 両者コミット済み:
      どちらかが Hidden → status → DecisionPhase
      両者 Public       → status → Resolving

[DecisionPhase]
  decideBattleFold(p1, Battle/Fold)
  decideBattleFold(p2, Battle/Fold)
  → 両者決断済み → status → Resolving

[Resolving]
  ── 公開モード (CardMode::Public) ──
  revealPublicCard(p1, cardType, nonce=zero)
    → commitment 検証 → ledger.revealedCards に cardType を記録
  revealPublicCard(p2, cardType, nonce=zero)
    → commitment 検証 → ledger.revealedCards に cardType を記録

  ── 秘匿モード (CardMode::Hidden) ──
  revealHiddenCard(p1, claimedOutcome, proof)
    → ZKP 検証: persistentCommit(myCard, myNonce) == myComm &&
                persistentCommit(oppCard, oppNonce) == oppComm &&
                _compareCards(myCard, oppCard) == claimedOutcome
    → ledger.hiddenOutcomes に BattleOutcome のみ記録 (cardType は書かない)
  revealHiddenCard(p2, claimedOutcome, proof)
    → 同上

  ── 混在 (片方 Public / 片方 Hidden) ──
  公開側: revealPublicCard() で cardType を記録
  秘匿側: revealHiddenCard() で proof を提出
          (ZKP の oppNonce = zero_bytes() とすることで
           公開カードの commitment から oppCard を特定可能)

  → 両者 reveal 済み:
      _resolveVP() で VP 計算
        両者公開:  revealedCards を直接比較
        秘匿あり:  hiddenOutcomes の BattleOutcome を使用
      ラウンド 3 完了 → status → GameOver
      ラウンド 1-2 完了 → status → RoundActive (次ラウンド)

[GameOver]
  claimReward(winnerAddress)  → status → Claimed
  ↓ (TypeScript で続けて呼び出し)
  yttm.mintReward(winner, 10_000_000n)
```

---

## 5. トークン設計（YTTM）

### 概要

| 項目 | 内容 |
|---|---|
| 名称 | YTTM (YTTLinks Token Midnight) |
| 用途 | ゲーム勝利報酬のみ |
| 発行量 | 勝利1回につき 10 YTTM |
| **プライバシー** | **Shielded（ZKP で残高・送金先を秘匿）— 第三者には非公開** |
| 発行権限 | `janken.compact` コントラクト（TypeScript レイヤーで orchestrate） |
| 現在の実装 | ダミー（walletBalance に +10 を加算するのみ） |
| Phase 3 以降 | `yttm.compact` の shielded mint に置き換え |

**Shielded の意味:**
- 残高の値は受取者（wallet holder）のみが確認できる
- 送金額・送金先は第三者から見えない（ZKP で証明）
- UI では `N YTTM 🔐` と表示し、「Shielded — あなたのみ閲覧可能」を明示

### Compact コントラクト（`yttm.compact`）

```compact
pragma language-version 1;

import CompactStandardLibrary;

// ─── オンチェーン状態 ────────────────────────────────────────────
ledger {
  // シールドされた残高マップ（ZKP で秘匿）
  // ⚠️ キー型 ZswapCoinPublicKey は要確認 — 公式サンプルで型名を検証すること
  balances: Map<ZswapCoinPublicKey, Uint64>;

  // 総供給量（公開）
  totalSupply: Uint64;

  // mint 権限を持つコントラクトアドレス
  authorizedMinter: ContractAddress;
}

// ─── 初期化 ────────────────────────────────────────────────────
constructor(minterAddress: ContractAddress): [] {
  ledger.totalSupply = 0n;
  ledger.authorizedMinter = minterAddress;
}

// ─── 報酬発行 ──────────────────────────────────────────────────
// ⚠️ own_address() の実在確認が必要
// ⚠️ TypeScript orchestration 方式の場合、このチェックの実現方法を再設計
export circuit mintReward(
  recipient: ZswapCoinPublicKey,
  amount: Uint64
): [] {
  assert own_address() == ledger.authorizedMinter,
    "Only the authorized game contract can mint";

  const current = ledger.balances.lookup(recipient).value_or(0n);
  ledger.balances.insert(recipient, current + amount);
  ledger.totalSupply = ledger.totalSupply + amount;
}

// ─── 残高照会（ZKP で証明、外部には秘匿）─────────────────────
export circuit balanceOf(
  owner: ZswapCoinPublicKey
): Uint64 {
  return ledger.balances.lookup(owner).value_or(0n);
}

// ─── 送金 ─────────────────────────────────────────────────────
export circuit transfer(
  from: ZswapCoinPublicKey,
  to: ZswapCoinPublicKey,
  amount: Uint64
): [] {
  const fromBalance = ledger.balances.lookup(from).value_or(0n);
  assert fromBalance >= amount, "Insufficient balance";

  ledger.balances.insert(from, fromBalance - amount);
  const toBalance = ledger.balances.lookup(to).value_or(0n);
  ledger.balances.insert(to, toBalance + amount);
}

// ─── 総供給量照会（公開） ──────────────────────────────────────
export circuit getTotalSupply(): Uint64 {
  return ledger.totalSupply;
}
```

---

## 6. ゲームコントラクト設計

### Compact コントラクト（`janken.compact`）

```compact
pragma language-version 1;

import CompactStandardLibrary;

// ─── 型定義 ────────────────────────────────────────────────────

enum CardType     { Rock, Scissors, Paper, Loser }
enum CardMode     { Public, Hidden }
enum BattleDecision { Battle, Fold }
enum GameStatus   { WaitingForPlayers, RoundActive, DecisionPhase, Resolving, GameOver, Claimed }
// ZKP 証明済み勝敗結果（提出プレイヤー視点: PWins = 自分が勝ち）
enum BattleOutcome { PWins, OWins, Draw }

struct Player {
  address: ZswapCoinPublicKey;   // ⚠️ 型名要確認
  totalVP: Int64;
  cardsRemaining: Uint64;
}

struct RoundCommitment {
  // commitment = persistentCommit(cardType, nonce)  ← SHA256 ではない
  commitment: Bytes<32>;
  mode: CardMode;
  revealed: Boolean;
}

// ─── オンチェーン状態 ────────────────────────────────────────────
ledger {
  gameId: Bytes<32>;
  status: GameStatus;
  currentRound: Uint64;
  totalRounds: Uint64;

  player1: Player;
  player2: Player;

  // ⚠️ ネストした Map は Compact でサポートされるが「Map値内でのみ」という制限あり
  // Map<Uint64, Map<Uint64, RoundCommitment>> の合法性を公式サンプルで検証すること
  commitments: Map<Uint64, Map<Uint64, RoundCommitment>>;
  decisions:   Map<Uint64, Map<Uint64, BattleDecision>>;

  // ── オンチェーン結果記録（Problem B 修正） ───────────────────────
  // key = round * 2 + playerIndex (0 or 1)
  // 公開カードの実手 — チェーン上から閲覧可能
  revealedCards:  Map<Uint64, CardType>;
  // 秘匿カードの ZKP 証明済み勝敗結果 — cardType は格納しない
  hiddenOutcomes: Map<Uint64, BattleOutcome>;

  yttmContract: ContractAddress;
}

// ─── コンストラクタ ──────────────────────────────────────────────
constructor(
  yttmContractAddress: ContractAddress,
  gameIdSeed: Bytes<32>
): [] {
  ledger.gameId = gameIdSeed;
  ledger.status = GameStatus::WaitingForPlayers;
  ledger.currentRound = 0n;
  ledger.totalRounds = 3n;
  ledger.yttmContract = yttmContractAddress;
}

// ─── プレイヤー参加 ──────────────────────────────────────────────
export circuit joinGame(playerAddress: ZswapCoinPublicKey): [] {
  assert ledger.status == GameStatus::WaitingForPlayers;

  if ledger.player1.address == default_value() {
    ledger.player1 = Player { address: playerAddress, totalVP: 0, cardsRemaining: 3n };
  } else {
    assert ledger.player2.address == default_value(), "Game is full";
    ledger.player2 = Player { address: playerAddress, totalVP: 0, cardsRemaining: 3n };
    ledger.status = GameStatus::RoundActive;
  }
}

// ─── カードコミット ──────────────────────────────────────────────
// 公開モード: commitment = persistentCommit(cardType, zero_bytes())
// 秘匿モード: commitment = persistentCommit(cardType, nonce) — nonce はクライアント保持
export circuit commitCard(
  playerIndex: Uint64,
  commitment: Bytes<32>,
  mode: CardMode
): [] {
  assert ledger.status == GameStatus::RoundActive;

  const round = ledger.currentRound;
  const roundCommitments = ledger.commitments.lookup(round)
    .value_or(Map::empty());

  assert !roundCommitments.lookup(playerIndex).is_some(), "Already committed";

  roundCommitments.insert(playerIndex, RoundCommitment {
    commitment,
    mode,
    revealed: false,
  });
  ledger.commitments.insert(round, roundCommitments);

  if roundCommitments.size() == 2n {
    _advanceAfterCommit(round);
  }
}

// ─── Battle / Fold 決断 ──────────────────────────────────────────
export circuit decideBattleFold(
  playerIndex: Uint64,
  decision: BattleDecision
): [] {
  assert ledger.status == GameStatus::DecisionPhase;

  const round = ledger.currentRound;
  const roundDecisions = ledger.decisions.lookup(round)
    .value_or(Map::empty());

  roundDecisions.insert(playerIndex, decision);
  ledger.decisions.insert(round, roundDecisions);

  if roundDecisions.size() == 2n {
    ledger.status = GameStatus::Resolving;
  }
}

// ─── 勝敗解決（公開モード）─────────────────────────────────────
// cardType を ledger に記録する → チェーン上から閲覧可能（Problem B 修正）
export circuit revealPublicCard(
  playerIndex: Uint64,
  cardType: CardType,   // 実際のカード種 — ledger に書き込む
  nonce: Bytes<32>      // 公開モードでは zero_bytes() を期待
): [] {
  assert ledger.status == GameStatus::Resolving;

  const round = ledger.currentRound;
  const comm = ledger.commitments.lookup(round)
    .unwrap().lookup(playerIndex).unwrap();

  assert !comm.revealed, "Already revealed";
  assert comm.mode == CardMode::Public, "Use revealHiddenCard for hidden mode";
  assert nonce == zero_bytes(), "Public mode must use zero nonce";
  // commitment 再計算して一致確認
  assert persistentCommit(cardType, nonce) == comm.commitment, "Commitment mismatch";

  // ✅ 公開カードは ledger に記録（チェーン上で閲覧可能）
  ledger.revealedCards.insert(round * 2n + playerIndex, cardType);
  _markRevealed(round, playerIndex);

  if _bothRevealed(round) {
    _resolveVP(round);
  }
}

// ─── 勝敗解決（秘匿モード）─────────────────────────────────────
// ZKP が BattleOutcome を証明する。cardType は ledger に書かない（Problem B 修正）
//
// ZKP circuit の入出力:
//   public inputs : myCommitment, oppCommitment, claimedOutcome
//   private inputs: myCardType, myNonce, oppCardType, oppNonce (Proof Server の witness)
//   circuit が証明すること:
//     1. persistentCommit(myCardType,  myNonce)  == myCommitment
//     2. persistentCommit(oppCardType, oppNonce) == oppCommitment
//        (公開モードの相手は oppNonce = zero_bytes() で一意に oppCardType が決まる)
//     3. _compareCards(myCardType, oppCardType)  == claimedOutcome
//
// ⚠️ verify_proof() の正確な API は公式サンプルで確認すること
export circuit revealHiddenCard(
  playerIndex: Uint64,
  claimedOutcome: BattleOutcome, // public — ZKP が正しさを証明する主張
  outcomeProof: Proof            // ⚠️ Proof 型名は要確認
): [] {
  assert ledger.status == GameStatus::Resolving;

  const round = ledger.currentRound;
  const myComm  = ledger.commitments.lookup(round)
    .unwrap().lookup(playerIndex).unwrap();
  const oppIdx  = 1n - playerIndex;
  const oppComm = ledger.commitments.lookup(round)
    .unwrap().lookup(oppIdx).unwrap();

  assert !myComm.revealed, "Already revealed";
  assert myComm.mode == CardMode::Hidden, "Use revealPublicCard for public mode";

  // ZKP 検証: claimedOutcome が myComm と oppComm に対して正しいことを証明
  // ⚠️ verify_proof() の正確なシグネチャは公式サンプルで確認すること
  assert verify_proof(
    outcomeProof,
    [myComm.commitment, oppComm.commitment, claimedOutcome]
  ), "Invalid ZKP proof";

  // ✅ cardType は書かない。BattleOutcome のみ記録
  ledger.hiddenOutcomes.insert(round * 2n + playerIndex, claimedOutcome);
  _markRevealed(round, playerIndex);

  if _bothRevealed(round) {
    _resolveVP(round);
  }
}

// ─── 内部: VP 計算（Problem B 修正版）──────────────────────────────
// 公開カード: revealedCards から取得して _compareCards() で比較
// 秘匿カード: hiddenOutcomes の BattleOutcome を直接使用
circuit _resolveVP(round: Uint64): [] {
  const m1 = _getMode(round, 0n);
  const m2 = _getMode(round, 1n);
  const d1 = _getDecision(round, 0n);
  const d2 = _getDecision(round, 1n);

  if d1 == BattleDecision::Fold || d2 == BattleDecision::Fold {
    _advanceRound();
    return;
  }

  // 勝者インデックスを決定: 0=player1勝ち, 1=player2勝ち, 2=引き分け
  const winner: Uint64 =
    if m1 == CardMode::Public && m2 == CardMode::Public {
      // 両者公開: revealedCards を直接比較（cardType は ledger に記録済み）
      const c1 = ledger.revealedCards.lookup(round * 2n + 0n).unwrap();
      const c2 = ledger.revealedCards.lookup(round * 2n + 1n).unwrap();
      _compareCards(c1, c2)
    } else {
      // 秘匿を含む: hiddenOutcomes を参照
      // player1 が Hidden なら player1 の outcome を使用
      // player1 が Public (player2 が Hidden) なら player2 の outcome を反転
      if m1 == CardMode::Hidden {
        const o1 = ledger.hiddenOutcomes.lookup(round * 2n + 0n).unwrap();
        if o1 == BattleOutcome::PWins { 0n }
        else if o1 == BattleOutcome::OWins { 1n }
        else { 2n }
      } else {
        const o2 = ledger.hiddenOutcomes.lookup(round * 2n + 1n).unwrap();
        // player2 視点の outcome を player1 視点に反転
        if o2 == BattleOutcome::PWins { 1n }
        else if o2 == BattleOutcome::OWins { 0n }
        else { 2n }
      }
    };

  if winner == 2n {
    // 引き分け
    ledger.player1.totalVP = ledger.player1.totalVP + 1;
    ledger.player2.totalVP = ledger.player2.totalVP + 1;
  } else {
    const loserIdx   = 1n - winner;
    const winnerMode = if winner == 0n { m1 } else { m2 };
    const loserMode  = if loserIdx == 0n { m1 } else { m2 };

    const winnerVP: Int64 =
      if winnerMode == CardMode::Hidden && loserMode == CardMode::Hidden { 3 }
      else { 1 };
    const loserVP: Int64 =
      if loserMode == CardMode::Hidden { -1 } else { 0 };

    if winner == 0n {
      ledger.player1.totalVP = ledger.player1.totalVP + winnerVP;
      ledger.player2.totalVP = ledger.player2.totalVP + loserVP;
    } else {
      ledger.player2.totalVP = ledger.player2.totalVP + winnerVP;
      ledger.player1.totalVP = ledger.player1.totalVP + loserVP;
    }
  }

  _advanceRound();
}

// ─── 内部: revealed フラグ更新 ─────────────────────────────────────
circuit _markRevealed(round: Uint64, playerIndex: Uint64): [] {
  const roundComms = ledger.commitments.lookup(round).unwrap();
  const comm = roundComms.lookup(playerIndex).unwrap();
  const updated = RoundCommitment {
    commitment: comm.commitment,
    mode:       comm.mode,
    revealed:   true,
  };
  roundComms.insert(playerIndex, updated);
  ledger.commitments.insert(round, roundComms);
}

// ─── 内部: カード比較 ─────────────────────────────────────────────
circuit _compareCards(a: CardType, b: CardType): Uint64 {
  if a == CardType::Loser { return 1n; }
  if b == CardType::Loser { return 0n; }
  if a == b { return 2n; }

  const aWins =
    (a == CardType::Rock     && b == CardType::Scissors) ||
    (a == CardType::Scissors && b == CardType::Paper)    ||
    (a == CardType::Paper    && b == CardType::Rock);

  return if aWins { 0n } else { 1n };
}

// ─── 報酬請求 ────────────────────────────────────────────────────
// claimReward 完了後、TypeScript DApp が yttm.mintReward() を呼ぶ
export circuit claimReward(claimerAddress: ZswapCoinPublicKey): [] {
  assert ledger.status == GameStatus::GameOver;

  const p1VP = ledger.player1.totalVP;
  const p2VP = ledger.player2.totalVP;
  assert p1VP != p2VP, "No reward for a draw";

  const winner = if p1VP > p2VP { ledger.player1.address }
                 else { ledger.player2.address };

  assert claimerAddress == winner, "Only the winner can claim";

  // ⚠️ call_contract() は未確認。TypeScript DApp レイヤーで mintReward() を続けて呼ぶ。
  ledger.status = GameStatus::Claimed;
}

// ─── ゲーム状態照会 ──────────────────────────────────────────────
export circuit getGameState(): (GameStatus, Int64, Int64, Uint64) {
  return (
    ledger.status,
    ledger.player1.totalVP,
    ledger.player2.totalVP,
    ledger.currentRound
  );
}
```

---

## 7. ZKP コミットメントスキーム

### 秘匿カード提出フロー（改訂版）

```
クライアント側（プライベート）    Proof Server (local)    オンチェーン
──────────────────────────────────────────────────────────────────────
myCardType = "Rock"
myNonce    = random_bytes(32)
                │
                ▼
myCommitment = persistentCommit(myCardType, myNonce)
                │                                ──────────────────▶ commitCard(myCommitment, Hidden)
                │  ← 相手もコミット (oppCommitment がチェーン上に公開)
                │
                ▼
witness data = {                  ──▶  ZKP 生成   ──▶ proof
  public inputs:                       (6300番ポート)
    myCommitment,                      ※秘密データは
    oppCommitment,                       外に出ない
    claimedOutcome,
  private inputs:
    myCardType, myNonce,
    oppCardType, oppNonce
  circuit が証明すること:
    1. persistentCommit(myCardType,  myNonce)  == myCommitment
    2. persistentCommit(oppCardType, oppNonce) == oppCommitment
    3. _compareCards(myCardType, oppCardType)  == claimedOutcome
}
                                              │
                                              ▼
                                   revealHiddenCard(
                                     playerIndex,
                                     claimedOutcome,  ← public
                                     proof            ← ZKP
                                   )
                                              │
                                         ZKP 検証 → 通過
                                         hiddenOutcomes に BattleOutcome のみ記録
                                         cardType はチェーンに書かない
```

### 公開カード提出フロー

```
クライアント側                                          オンチェーン
──────────────────────────────────────────────────────────────────────
myCardType = "Scissors"
myNonce    = zero_bytes()   ← 公開モードは nonce=0 で固定
                │
                ▼
myCommitment = persistentCommit(myCardType, zero_bytes())
                │                                ──────────────────▶ commitCard(myCommitment, Public)
                │
                ▼
revealPublicCard(playerIndex, myCardType, zero_bytes())
                                              │
                                         commitment 再計算して一致確認
                                         revealedCards に myCardType を記録
                                         ← チェーン上から閲覧可能
```

### ハッシュ関数（Midnight 固有）

| 関数名 | 用途 | 備考 |
|---|---|---|
| `persistentCommit(data, nonce)` | コミットメント生成 | Hiding + Binding 両立 |
| `persistentHash([...bytes])` | 汎用ハッシュ | 出力: 32バイト |
| `transientCommit()` | 一時的コミットメント | ledger 外での使用向け |

> SHA256 は Compact 組み込み関数ではないため使用しない。

### ZKP が証明すること

1. **Binding**: commitment に対応する `cardType` は 1 つだけである
2. **Hiding**: `cardType` そのものはオンチェーンに記録されない
3. **Completeness**: 正しい `nonce` を持つ者だけが valid proof を生成できる
4. **Validity**: `cardType` は有効な enum 値（0–3）の範囲内である

### クライアント実装（`midnight-dummy.ts` → 本番）

```typescript
// 現在（ダミー）
export async function generateZKProof(_cardType, _roundId) {
  await delay(2000);
  return { proofId: `zkp_${randomHex(16)}`, commitment: `0x${randomHex(64)}` };
}

// 本番実装（DApp SDK 経由で Proof Server を使用）
// ⚠️ createZKProof() という関数は存在しない。
//    Compact コンパイル済み API 経由で Proof Server (localhost:6300) を呼び出す。
import { JankenContract } from './contracts/janken-api'; // compactc 生成物

export async function submitHiddenCard(
  cardType: CardType,
  nonce: Uint8Array,
  commitment: Uint8Array
) {
  // Compact コンパイル済みの circuit API が Proof Server と通信して proof を生成
  const tx = await JankenContract.revealResult(
    playerIndex,
    cardType,    // private witness — Proof Server が処理
    nonce,       // private witness — Proof Server が処理
    commitment   // public input
  );
  // Proof Server が内部で ZKP を生成し tx に埋め込む
  return tx;
}
```

---

## 8. VP 計算ロジック（オンチェーン）

`src/logic/game-logic.ts` の実装がそのままオンチェーンに対応します。

### VP テーブル（spec.md 準拠）

| 状況 | 勝者 VP | 敗者 VP | 備考 |
|---|---|---|---|
| 公開 vs 公開 | +1 | 0 | 標準 |
| 秘匿(勝) vs 公開(負) | +1 | 0 | 秘匿ボーナスなし（相手が公開） |
| 公開(勝) vs 秘匿(負) | +1 | **-1** | 秘匿で負けたペナルティ |
| 秘匿 vs 秘匿 | **+3** | **-1** | ハイリスク・ハイリターン |
| フォールド（どちらかが） | 0 | 0 | ノーコンテスト |
| 引き分け | +1 | +1 | カード種が同一 |

### コード対応（`game-logic.ts:36-62`）

```typescript
// オンチェーン _resolveVP() に対応するオフチェーン実装
const winnerVP = winnerMode === 'hidden' && loserMode === 'hidden' ? 3 : 1;
const loserVP  = loserMode === 'hidden' ? -1 : 0;
```

---

## 9. ウォレット統合

### 現在の実装と正式 API の差異

| 処理 | 現在のコード (`midnight-wallet.ts`) | 正式 API |
|---|---|---|
| 接続 | `connector.enable()` | `connector.connect('preprod')` |
| アドレス取得 | `api.state().address` | `api.getShieldedAddresses()` — Bech32m 形式 |
| 残高取得 | `api.balances()['tDUST']` | `api.getDustBalance()` / `api.getShieldedBalances()` |
| TX 送信 | 未実装 | `api.balanceUnsealedTransaction(tx)` → `api.submitTransaction(tx)` |

### 正式な接続実装（`midnight-wallet.ts` 修正版）

```typescript
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export async function connectLace(): Promise<WalletAccount> {
  const connector = window.midnight?.mnLace;
  if (!connector) throw new LaceNotFoundError();

  // ✅ 確認済み: connect(networkId) が正式 API
  // ✅ 'preprod' は有効 (Mainnet は 2026-03-30 稼働開始)
  const api: ConnectedAPI = await connector.connect('preprod');

  const [shieldedAddrs, dustBalance] = await Promise.all([
    api.getShieldedAddresses(),   // ✅ 確認済み — Bech32m 形式
    api.getDustBalance(),          // ✅ 確認済み
  ]);

  return {
    address: shieldedAddrs[0],
    balance: Number(dustBalance) / 1_000_000,
    mnemonic: '',
    source: 'lace',
  };
}
```

### トランザクションフロー（コントラクト呼び出し）

```typescript
// ✅ balanceUnsealedTransaction + submitTransaction は確認済み
async function submitMove(cardType: CardType, mode: CardMode) {
  const api = await window.midnight.mnLace.connect('preprod');

  const unsealedTx = await JankenContract.commitCard(commitment, mode);
  const balancedTx = await api.balanceUnsealedTransaction(unsealedTx);
  await api.submitTransaction(balancedTx);
}
```

---

## 10. トークン取得（Faucet）

### tDUST（ガス代）の取得

```
1. Lace ウォレットをインストール

2. Lace の設定 → Midnight → ネットワーク を "Preprod" に変更

3. DUST アドレスをコピー（"mn1..." で始まるアドレス）

4. Faucet にアクセス（preprod 用）

5. アドレスを入力して tDUST を受け取る
```

### ネットワーク設定

```
【Preprod テストネット】  ← 本プロジェクトで常時使用。Mainnet への移行は行わない。
NODE RPC:   wss://rpc.preprod.midnight.network     ← Testnet-02 から移行
INDEXER:    https://indexer.preprod.midnight.network/api/v1/graphql
WS:         wss://indexer.preprod.midnight.network/api/v1/graphql
PROOF:      http://localhost:6300  ← ローカルのみ（秘密データを外に出さない）

【ローカル devnet（開発・単体テスト用）】
NODE RPC:   http://localhost:9944
INDEXER:    http://localhost:8088/api/v1/graphql
WS:         ws://localhost:8088/api/v1/graphql
PROOF:      http://localhost:6300

【廃止】
❌ Testnet-02 (wss://rpc.testnet-02.midnight.network) — Mainnet 移行に伴い廃止
❌ Mainnet — 本プロジェクトのスコープ外
```

### Proof Server のローカル起動（Docker）

```bash
# ✅ イメージ名修正: midnight-proof-server → proof-server
docker run --rm -p 6300:6300 \
  midnightntwrk/proof-server:8.0.3 \
  midnight-proof-server -v
```

> **注意**: Proof Server は必ずローカルで動かす。秘密データ（cardType, nonce）が
> 外部サーバーに送信されることはない。

---

## 11. ダミー実装 → 本番実装 対応表

| ファイル | 関数 | 現在 | 本番実装 |
|---|---|---|---|
| `midnight-dummy.ts` | `generateZKProof()` | 2秒 sleep | Compact コンパイル済み circuit API → Proof Server (localhost:6300) |
| `midnight-dummy.ts` | `submitMove()` | fake TX hash | `JankenContract.commitCard()` → `api.balanceUnsealedTransaction()` |
| `midnight-dummy.ts` | `claimReward()` | fake TX hash | `janken.claimReward()` → `yttm.mintReward()` (TypeScript で順次呼び出し) |
| `midnight-wallet.ts` | `connectLace()` | `enable()` (旧 API) | `connect('preprod')` (正式 API) |
| `midnight-wallet.ts` | `deriveAddress()` | entropy スライス | `@midnight-ntwrk/midnight-js-wallet` HD 導出 |
| **`midnight-onchain.ts`** | `deployGame()` | fake contractAddress | `midnight-cli deploy` + SDK コントラクトデプロイ |
| **`midnight-onchain.ts`** | `commitCard()` | fake TX hash | `JankenContract.commitCard()` → `api.balanceUnsealedTransaction()` |
| **`midnight-onchain.ts`** | `revealPublicCard()` | fake TX hash | `JankenContract.revealPublicCard()` |
| **`midnight-onchain.ts`** | `revealHiddenCard()` | fake outcome + TX hash | `JankenContract.revealHiddenCard()` + Proof Server ZKP 生成 |
| **`midnight-onchain.ts`** | `getContractState()` | fake ledger JSON | Indexer API GraphQL クエリ → ledger 状態取得 |

---

## 12. デプロイ手順

### 前提環境

```bash
# Compact コンパイラ
npm install -g @midnight-ntwrk/compact-compiler

# Midnight DApp SDK
npm install @midnight-ntwrk/midnight-js-contracts \
            @midnight-ntwrk/midnight-js-wallet

# Docker（Proof Server 用）
docker pull midnightntwrk/proof-server:8.0.3
```

### ステップ

```bash
# 1. Compact コントラクトをコンパイル
#    ⚠️ 出力ディレクトリ名は compactc の正確なシグネチャで確認すること
compactc src/contracts/yttm.compact   -o dist/contracts/yttm
compactc src/contracts/janken.compact -o dist/contracts/janken

# 2. Proof Server を起動（ローカル必須）
docker run -d -p 6300:6300 \
  midnightntwrk/proof-server:8.0.3 midnight-proof-server -v

# 3. yttm.compact をデプロイ
#    ⚠️ --contract フラグの正しい使い方は midnight-cli の最新ドキュメントを確認
midnight-cli deploy \
  --network preprod \
  --contract dist/contracts/yttm \
  --wallet <your-wallet-mnemonic>
# → YTTM_CONTRACT_ADDRESS が返る

# 4. janken.compact をデプロイ
midnight-cli deploy \
  --network preprod \
  --contract dist/contracts/janken \
  --constructor-args YTTM_CONTRACT_ADDRESS \
  --wallet <your-wallet-mnemonic>
# → JANKEN_CONTRACT_ADDRESS が返る

# 5. 環境変数に設定
VITE_JANKEN_CONTRACT=JANKEN_CONTRACT_ADDRESS
VITE_YTTM_CONTRACT=YTTM_CONTRACT_ADDRESS
VITE_MIDNIGHT_NETWORK=preprod
```

### 実装フェーズ計画

```
Phase 1（完了）   React UI + ダミーサービスで全画面動作確認（ソロモード）
Phase 1.5         オンチェーンモード UI + midnight-onchain.ts（ダミー実装）
                    - GameState に onChainMode / OnChainState を追加
                    - ModeSelectScreen に「On-chain モード」トグル
                    - GameBoard に TX ハッシュログ表示
                    - ResultScreen にコントラクトアドレス + Indexer ビューア
                    - midnight-onchain.ts (fake TX で全フロー疎通確認)
                  → 詳細は §14 参照
Phase 2           §13 の指摘事項を公式サンプルで検証・Compact 構文確定
Phase 3           janken.compact / yttm.compact 作成・ローカル devnet テスト
Phase 4           Preprod テストネットにデプロイ・Faucet で tDUST 取得・E2E テスト
Phase 5           midnight-onchain.ts を実際の SDK に置き換え
※ Mainnet デプロイは本プロジェクトのスコープ外（常に Preprod で運用）
```

---

## 13. 公式ドキュメントとのレビュー指摘事項

公式ドキュメント・Midnight MCP との照合結果。本実装前に確認が必要な項目。

---

### 指摘事項 #1: `call_contract()` は未確認

**影響**: `claimReward()` → `mintReward()` のコントラクト間呼び出し設計

**問題**:
- Compact 公式ドキュメントに `call_contract()` という関数が見当たらない
- コントラクト間の直接呼び出し方法が仕様書通りに動作しない可能性がある

**採用する代替設計**:
```
TypeScript DApp レイヤーで orchestrate する:

  // TypeScript で順次呼び出し
  await jankenContract.call.claimReward(winnerAddress);
  // janken が Claimed になったことを確認してから
  await yttmContract.call.mintReward(winnerAddress, 10_000_000n);
```

**課題**:
- `authorizedMinter` チェックを TypeScript レイヤーで維持する場合、
  「誰でも mintReward を呼べる」という脆弱性になる
- 解決策候補: janken の GameStatus == Claimed を yttm 側で ledger から読む
  または: YTTM の発行をゲームコントラクト内の ledger 更新で代替する

**対応**: Compact の `import` 構文と cross-contract call の公式サンプルを確認すること

---

### 指摘事項 #2: ハッシュ関数が SHA256 ではない

**影響**: commitment 生成・検証ロジック全体

**修正**:
```
誤: commitment = SHA256(cardType || nonce)
正: commitment = persistentCommit(cardType, nonce)
   または
   commitment = persistentHash([cardType_bytes, nonce])
```

仕様書・コメント内の SHA256 参照はすべて `persistentCommit` / `persistentHash` に読み替えること。

---

### 指摘事項 #3: `witness circuit` の用途が異なる

**影響**: `_resolveVP()`, `_compareCards()` の宣言方法

**問題**:
- Compact の `witness` は TypeScript DApp から呼ばれるコールバック（外部関数）として機能する
- `_resolveVP` のような内部ヘルパーを `witness circuit` で宣言すると意図しない動作になる可能性がある

**修正方針**:
```compact
// 誤: witness circuit _resolveVP(round: Uint64): [] { ... }
// 正: circuit _resolveVP(round: Uint64): [] { ... }  // 内部関数
```

**対応**: Compact の circuit 宣言種別（export / witness / circuit）を公式リファレンスで確認すること

---

### 指摘事項 #4: `Proof` 型が未確認

**影響**: `revealResult()` の引数型

**問題**:
- `Proof` という型名が Compact 公式ドキュメントで見つからない
- ZKP の proof data は Proof Server が生成・処理するため、型の扱いが異なる可能性がある

**対応**: 公式サンプルコード（`@midnight-ntwrk/midnight-js-contracts` の examples）で
`revealResult` 相当の circuit の型宣言を確認すること

---

### 指摘事項 #5: `ZswapCoinPublicKey` 型名が未確認

**影響**: Player アドレス型、YTTM balances のキー型

**問題**:
- 公式 API で `EncodedCoinPublicKey` の言及はあるが `ZswapCoinPublicKey` として
  明示的に定義されているかが不明

**対応**: Compact stdlib の型定義を確認し、正しいアドレス型に修正すること

---

### 指摘事項 #6: `createZKProof()` は存在しない

**影響**: `midnight-dummy.ts` の本番置き換え実装

**修正**:
```typescript
// 誤:
import { createZKProof } from '@midnight-ntwrk/compact-runtime';
await createZKProof({ circuitId, publicInputs, privateInputs });

// 正:
// Compact コンパイル済みの circuit API を使う。
// API 呼び出し時に Proof Server (localhost:6300) が自動的に proof を生成する。
// 開発者が直接 Proof Server を呼ぶコードを書く必要はない。
import { JankenContract } from './contracts/janken-api'; // compactc 生成物
const tx = await JankenContract.revealResult(playerIndex, cardType, nonce);
```

---

### 指摘事項 #7: Testnet-02 URL が廃止

**影響**: ネットワーク設定、MCP 設定

**修正**:
```
❌ 廃止: wss://rpc.testnet-02.midnight.network
✅ 使用: Preprod または Mainnet (2026-03-30 稼働)
```

`.claude/settings.json` の `MIDNIGHT_NETWORK: "undeployed"` はローカル devnet のため現状維持でよい。
テストネット接続時は preprod に切り替えること。

---

### 指摘事項 #8: Proof Server Docker イメージ名が違う

**修正**:
```bash
# 誤:
docker run midnightntwrk/midnight-proof-server:latest

# 正:
docker run midnightntwrk/proof-server:8.0.3 midnight-proof-server -v
```

---

---

### 指摘事項 #9: `_getRevealedCard()` 実装不能（Problem B）→ 修正済み

**影響**: `_resolveVP()` 内でのカード取得

**問題（旧設計）**:
- `revealResult()` は cardType を ledger に書き込まない設計だった
- `_resolveVP()` が `_getRevealedCard(round, playerIdx)` を呼んでも取得先が存在しない
- 両プレイヤーの sequential reveal 後にカード比較ができず、VP 計算が動かない

**修正（本仕様書に反映済み）**:
```
revealResult() を revealPublicCard() / revealHiddenCard() に分離:

  公開モード: revealPublicCard()
    → ledger.revealedCards に cardType を書き込む（チェーン上で閲覧可能）

  秘匿モード: revealHiddenCard()
    → ZKP が BattleOutcome を証明
    → ledger.hiddenOutcomes に BattleOutcome のみ書き込む（cardType は非記録）

  _resolveVP() の修正:
    両者公開: revealedCards から cardType を取得して _compareCards()
    秘匿あり: hiddenOutcomes の BattleOutcome を参照
```

**対応**: 本仕様書の §4.3 / §6 に修正済みコードを反映。

---

### 指摘事項 #10: `own_address()` と minter auth が一致しない（Problem A）

**影響**: `yttm.compact` の `mintReward()` 認証

**問題**:
```compact
// yttm.compact の mintReward()
assert own_address() == ledger.authorizedMinter,
  "Only the authorized game contract can mint";
```
- `own_address()` は **yttm コントラクト自身のアドレス** を返す
- `authorizedMinter` には **janken コントラクトのアドレス** が入っている
- 両者が一致することはないため、このアサーションは常に失敗する

**修正候補**:
```
案1: Compact に msg.sender 相当の API が存在するか確認。
     存在すれば sender == authorizedMinter でチェック。
     例: assert caller_address() == ledger.authorizedMinter, ...

案2: janken.compact の claimReward() 完了を yttm が確認する。
     janken.ledger.status を読む cross-contract read (実現可能性要確認)

案3: YTTM 発行ロジックを janken.compact に統合する。
     yttm.compact を廃止し、janken 側でシールド残高を管理。
```

**対応**: Phase 2 で公式サンプルを確認し、`caller_address()` 相当の API を特定すること。

---

### 指摘事項 #11: `transfer()` に from 認証がない（Problem C）

**影響**: `yttm.compact` の `transfer()` セキュリティ

**問題**:
```compact
export circuit transfer(
  from: ZswapCoinPublicKey,
  to: ZswapCoinPublicKey,
  amount: Uint64
): [] {
  // ← from が呼び出し元本人かを検証していない
  // 誰でも他人の残高を移動できる
  const fromBalance = ledger.balances.lookup(from).value_or(0n);
  ...
}
```

**修正**:
```compact
export circuit transfer(
  from: ZswapCoinPublicKey,
  to: ZswapCoinPublicKey,
  amount: Uint64
): [] {
  // caller_address() が from と一致するか確認（指摘事項 #10 の API 確認と連動）
  assert caller_address() == from, "Only the owner can transfer";
  ...
}
```

**対応**: `caller_address()` / `msg.sender` 相当の API 確認（指摘事項 #10 と同時に解決）。

---

### 指摘事項 #12: アドレス型が `Either<ZswapCoinPublicKey, ContractAddress>` の可能性（Problem D）

**影響**: Player アドレス型、YTTM balances のキー型

**問題**:
- OpenZeppelin の `compact-contracts` リポジトリで `Either<ZswapCoinPublicKey, ContractAddress>` が使用されている
- 単純な `ZswapCoinPublicKey` でプレイヤーアドレスを扱うと型エラーになる可能性

**対応**: Counter DApp や公式 examples のアドレス宣言を確認し、正しい型に修正すること。

---

### 指摘事項 #13: `const roundCommitments` への `insert()` 副作用（Problem E）

**影響**: `commitCard()` 内のローカル変数更新

**問題**:
```compact
const roundCommitments = ledger.commitments.lookup(round).value_or(Map::empty());
roundCommitments.insert(playerIndex, ...);  // ← const への insert
ledger.commitments.insert(round, roundCommitments);
```
Compact の不変束縛では、`insert()` が戻り値を返す形（新しい Map を返す）の可能性がある。

**修正候補**:
```compact
// insert() が新しい Map を返す場合
const updated = roundCommitments.insert(playerIndex, newEntry);
ledger.commitments.insert(round, updated);
```

**対応**: Compact の Map API（`insert()` の副作用 vs 戻り値）を公式リファレンスで確認すること。

---

### 指摘事項 #14: `Boolean` vs `Bool` 型名（Problem F）

**影響**: `RoundCommitment.revealed` フィールドの型名

**問題**: Compact の論理型が `Boolean` か `Bool` かが未確認。

**対応**: 公式 stdlib の型名リストを確認すること。

---

---

### 指摘事項 #15: `witness` 宣言構文の誤り（2026-04-24 追記）

**影響**: 本仕様書 §6 のすべての circuit コード

**問題**:  
本仕様書では `witness` を circuit パラメータのように書いているが、  
公式 bboard サンプルでは **モジュールレベルの関数宣言** として記述する。

```compact
// ❌ 本仕様書の誤った書き方（witness をパラメータ扱い）
export circuit revealHiddenCard(
  playerIndex: Uint64, claimedOutcome: BattleOutcome, outcomeProof: witness Proof
): [] { ... }

// ✅ 正しい書き方（モジュールレベルで宣言）
witness localSecretKey(): Bytes<32>;   // モジュールトップレベルに宣言

export circuit revealHiddenCard(
  playerIndex: Uint64, claimedOutcome: BattleOutcome
): [] {
  const sk = localSecretKey();  // circuit 内で呼び出す
  ...
}
```

**修正方針**: §6 の全 circuit から `witness` パラメータを除去し、  
モジュールトップレベルに `witness` 関数群を宣言する。

---

### 指摘事項 #16: `persistentCommit` vs `persistentHash`（2026-04-24 追記）

**影響**: §6 の commitment 生成・検証ロジック全体

**問題**:  
本仕様書では `persistentCommit(cardType, nonce)` を使用しているが、  
公式 bboard サンプルで確認できる組み込み関数は `persistentHash<T>([...])` のみ。  
`persistentCommit` が CompactStandardLibrary に存在するか未確認。

```compact
// bboard サンプルの実際の実装
export circuit publicKey(sk: Bytes<32>, sequence: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "bboard:pk:"), sequence, sk]);
}

// 本仕様書の commitment 相当は以下で実現できる可能性
witness cardType(): CardType;
witness nonce(): Bytes<32>;

export circuit commitCard(): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([cardType() as Bytes<32>, nonce()]);
}
```

**対応**: Compact 標準ライブラリリファレンスで `persistentCommit` の存在を確認。  
存在しない場合は `persistentHash` で代替実装する。

---

### 指摘事項 #17: `disclose()` によるレジャー書き込み（2026-04-24 追記）

**影響**: §6 の `revealPublicCard()` 等の ledger 書き込み

**問題**:  
Compact では witness 由来の秘匿値を ledger に書き込む際に `disclose()` が必要。  
bboard サンプルでは `owner = disclose(publicKey(...))` と明示している。  
本仕様書の `ledger.revealedCards.insert(...)` は `disclose()` なしで記述されており、  
コンパイルエラーまたは秘匿扱いになる可能性がある。

```compact
// ✅ 正しい書き方
ledger.revealedCards.insert(key, disclose(localCardType()));
```

**修正方針**: witness 由来の値を ledger に書く箇所すべてに `disclose()` を追加。

---

### 指摘事項 #18: `pragma` と `import` の欠落（2026-04-24 追記）

**影響**: §6 のすべての Compact コードサンプル

**問題**:  
公式サンプルのすべてのコントラクトは以下の2行で始まる。  
本仕様書のコードサンプルには記載がない。

```compact
pragma language_version >= 0.20;
import CompactStandardLibrary;
```

`CompactStandardLibrary` なしでは `persistentHash`, `pad`, `Counter`,  
`Maybe`, `none`, `some` などの組み込み型・関数が使用不可。

**修正方針**: §6 のコード先頭に2行を追加する。

---

### 指摘事項 #19: プロジェクト構造の変更（2026-04-24 追記）

**影響**: §1 コントラクトファイル構成 / §12 デプロイ手順

**問題**:  
本仕様書は `src/contracts/` 以下にコントラクトを置く構成だったが、  
公式 bboard サンプルは `contract/src/` + `api/` の **npm workspaces 構成** を採用している。

```
bboard/
├── contract/src/bboard.compact   ← Compact コンパイラの入力
├── api/src/                      ← Compact コンパイラが生成する TS バインディング
├── bboard-ui/src/                ← フロントエンド
└── bboard-cli/src/               ← CLI
```

Compact コンパイラ (`compactc 0.30.0`) が TypeScript バインディングを自動生成するため、  
バインディングを手書きする必要はない。

**修正方針**: §1 コントラクトファイル構成（更新済み）および §12 デプロイ手順を  
bboard 構成に合わせて改訂する。

---

### 指摘事項 対応優先度

| # | 項目 | 優先度 | 理由 |
|---|---|---|---|
| 15 | `witness` 宣言構文の誤り | **高** | コンパイルエラー確実。全 circuit の書き直しが必要 |
| 16 | `persistentCommit` vs `persistentHash` | **高** | commitment が一致しないと ZKP が壊れる |
| 17 | `disclose()` の欠落 | **高** | ledger 書き込みが無効になる可能性 |
| 1 | `call_contract()` / コントラクト間呼び出し | **高** | アーキテクチャに影響 |
| 9 | `_getRevealedCard()` 実装不能 | **高** | ✅ 本仕様書で修正済み（§4.3 / §6 参照） |
| 10 | `own_address()` / minter 認証 | **高** | mintReward() が常に失敗 |
| 11 | `transfer()` from 認証欠如 | **高** | セキュリティホール |
| 18 | `pragma` / `import` の欠落 | **中** | コンパイル不可 |
| 19 | プロジェクト構造の変更 | **中** | ✅ §1 更新済み。§12 は別途改訂 |
| 3 | `witness circuit` の使い方 | **中** | #15 と同じ問題 |
| 4 | `Proof` 型名 | **中** | コンパイルエラーになる可能性 |
| 5 | `ZswapCoinPublicKey` 型名 | **中** | ✅ SDK 調査で `ShieldedCoinPublicKey` と判明 |
| 12 | アドレス型の確認 | **中** | ✅ SDK 調査で UnshieldedAddress / ShieldedAddress と判明 |
| 13 | `insert()` の副作用 vs 戻り値 | **中** | Map 更新が反映されない可能性 |
| 2 | ハッシュ関数名 | **中** | #16 と統合 |
| 6 | `createZKProof()` の置き換え | **低** | ダミー実装フェーズでは影響なし |
| 7 | Testnet-02 URL 廃止 | **低** | ✅ Preprod URL に更新済み |
| 8 | Docker イメージ名 | **低** | Proof Server 起動時に修正すれば十分 |
| 14 | `Boolean` vs `Bool` 型名 | **低** | コンパイル時に判明 |

---

## 14. オンチェーンモード設計

ソロモードと並行してオンチェーンモードを追加する。  
ゲームの勝敗判定をスマートコントラクトが実行し、  
コントラクトアドレスからオンチェーン処理結果を閲覧できる。

---

### 14.1 モード比較

| 機能 | ソロモード（既存） | オンチェーンモード（新規） |
|---|---|---|
| カード比較 | `compareCards()` クライアント完結 | `janken.compact` が `_resolveVP()` で判定 |
| 公開カード | UI 表示のみ | `revealedCards` に ledger 記録 → Indexer で閲覧可 |
| 秘匿カード | 最後まで UI で非表示 | ZKP proof → `hiddenOutcomes` に BattleOutcome のみ記録 |
| VP 管理 | クライアント変数 | `janken.ledger.player1/2.totalVP` |
| 報酬 | `walletBalance += 10` ダミー | `claimReward()` TX → `mintReward()` TX |
| 結果確認 | なし | コントラクトアドレス + Indexer GraphQL クエリ |
| CPU の TX | なし | client が代理送信（ソロ on-chain 限定の制約） |

---

### 14.2 TypeScript 型定義の追加 (`src/types/game.ts`)

```typescript
// ゲームモード
export type GameMode = 'solo' | 'onchain';

// オンチェーン状態
export interface OnChainState {
  contractAddress: string | null;   // デプロイ済みコントラクトアドレス
  gameId: string | null;            // janken.ledger.gameId
  txHashes: string[];               // ラウンドごとの TX ハッシュ履歴
  indexerResult: object | null;     // Indexer API 応答 (ResultScreen 表示用)
}

// GameState への追加フィールド
// gameMode: GameMode;
// onChain: OnChainState;

// 追加 GamePhase
// | 'onchain-deploying'      // ゲーム開始時 — コントラクトを deploy 中
// | 'onchain-committing'     // commitCard TX 送信中
// | 'onchain-waiting-cpu'    // CPU 代理 TX 待ち
// | 'onchain-revealing'      // revealPublicCard / revealHiddenCard TX 送信中
// | 'onchain-settled'        // コントラクトが勝敗を確定済み
```

---

### 14.3 新サービス: `src/services/midnight-onchain.ts`

Phase 1.5 ではダミー実装。Phase 5 で実 SDK に置き換える。

```typescript
export interface OnChainGameSession {
  contractAddress: string;
  gameId: string;
}

// ゲームコントラクトをデプロイして gameId を取得
export async function deployGame(): Promise<OnChainGameSession>

// プレイヤーの joinGame TX を送信
export async function joinGame(params: {
  contractAddress: string;
  playerAddress: string;
}): Promise<{ txHash: string }>

// カードをコミット (commitCard TX)
export async function commitCard(params: {
  contractAddress: string;
  playerAddress: string;
  commitment: string;        // persistentCommit(cardType, nonce) の出力
  mode: CardMode;
}): Promise<{ txHash: string }>

// Battle / Fold 決断 TX
export async function decideBattleFold(params: {
  contractAddress: string;
  playerAddress: string;
  decision: BattleDecision;
}): Promise<{ txHash: string }>

// 公開カードを reveal (revealPublicCard TX)
export async function revealPublicCard(params: {
  contractAddress: string;
  playerAddress: string;
  cardType: CardType;
  nonce: string;             // zero_bytes() 相当
}): Promise<{ txHash: string }>

// 秘匿カードを reveal (revealHiddenCard TX + ZKP 生成)
export async function revealHiddenCard(params: {
  contractAddress: string;
  playerAddress: string;
  claimedOutcome: 'PWins' | 'OWins' | 'Draw';
  proof: string;             // Proof Server が生成した ZKP
}): Promise<{ txHash: string }>

// 勝者が報酬を請求 (claimReward TX → mintReward TX)
export async function claimOnChainReward(params: {
  contractAddress: string;
  winnerAddress: string;
}): Promise<{ txHash: string }>

// Indexer API でコントラクト ledger 状態を取得
// 本番: https://indexer.preprod.midnight.network/api/v1/graphql
export async function getContractState(
  contractAddress: string
): Promise<ContractLedgerState>

export interface ContractLedgerState {
  gameId: string;
  status: string;               // GameStatus
  currentRound: number;
  player1: { address: string; totalVP: number };
  player2: { address: string; totalVP: number };
  revealedCards: Record<string, string>;   // key="round_playerIdx", value=CardType
  hiddenOutcomes: Record<string, string>;  // key="round_playerIdx", value=BattleOutcome
  totalSupply: string;          // YTTM totalSupply
}
```

---

### 14.4 ゲームフロー（オンチェーン ソロモード）

```
[ゲーム開始] START_ONCHAIN_GAME
  phase: 'onchain-deploying'
  deployGame()           → contractAddress, gameId 取得
  joinGame(player)       → TX hash
  joinGame(cpu_proxy)    → TX hash  ← client が CPU の代理送信
  phase: 'card-select'

[Round N] カード選択
  Player: カード選択 + モード選択
  COMMIT_MOVE (onchain mode)
    phase: 'onchain-committing'
    commitCard(player, commitment, mode) → TX hash 表示
    commitCard(cpu, commitment, mode)   → TX hash 表示 (代理)
    ↓
    (Hidden あり) → phase: 'player-battle-fold' or 'cpu-battle-fold'
    (全員 Public) → phase: 'onchain-revealing'

  Battle/Fold 決断 (既存フロー)
    decideBattleFold(player, decision) → TX hash
    decideBattleFold(cpu, decision)    → TX hash (代理)

  RESOLVE_ROUND (onchain mode)
    phase: 'onchain-revealing'
    ── 公開カード ──
    revealPublicCard(player, cardType) → TX hash
    revealPublicCard(cpu, cardType)    → TX hash (代理)
    ── 秘匿カード ──
    ZKP 生成 (Proof Server: localhost:6300)
    revealHiddenCard(player, outcome, proof) → TX hash
    revealHiddenCard(cpu, outcome, proof)    → TX hash (代理)
    ↓
    コントラクトが _resolveVP() を実行 → TX receipt で VP 更新を確認
    phase: 'onchain-settled' → 'round-result'

[ゲーム終了]
  NEXT_ROUND × 3 → phase: 'game-over'
  claimOnChainReward(winner) → TX hash
  getContractState(contractAddress) → indexerResult 取得

[ResultScreen]
  コントラクトアドレス表示（コピーボタン付き）
  TX ハッシュリスト（ラウンドごと）
  Indexer ビューア:
    - 公開カードの手 (revealedCards) → 閲覧可能
    - 秘匿カードは BattleOutcome のみ → cardType は非表示
    - 各ラウンドの VP 変動
    - 最終スコア・勝者
```

---

### 14.5 UI 変更一覧

| コンポーネント | 変更内容 |
|---|---|
| `ModeSelectScreen` | "Solo" の下に「On-chain モード」トグルを追加 |
| `GameBoard` | `onchain-committing` / `onchain-revealing` 中のスピナー + TX ハッシュミニログ |
| `ResultScreen` | 「On-chain 結果」パネル: コントラクトアドレス / TX 履歴 / Indexer JSON ビューア |

---

### 14.6 制約と留意事項

| 項目 | 内容 |
|---|---|
| **CPU の代理送信** | ソロ on-chain モードでは CPU の TX を client が代理送信。対戦の公正性は保証されない（デモ用途として許容） |
| **Sequential reveal の問題** | Player 1 が先に reveal すると、Player 2 は相手のカードを見てから reveal 可能。真の多人数対戦では同時コミット + ZKP 必須 |
| **Proof Server 必須** | 秘匿モードは localhost:6300 の Proof Server が起動していないと ZKP 生成不可 |
| **ダミー実装の限界** | Phase 1.5 の fake TX では ZKP の検証は行わない。Phase 5 の実 SDK 置き換えで初めて検証が動く |
