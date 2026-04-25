# Loser's Gambit — 仕様書

> **更新:** 2026-04-25

---

## 目次

1. [概要](#1-概要)
2. [ゲームモード](#2-ゲームモード)
3. [勝利点 (VP) 設計](#3-勝利点-vp-設計)
4. [ゲームルール詳細](#4-ゲームルール詳細)
5. [戦略的インセンティブ](#5-戦略的インセンティブ)
6. [対戦フロー](#6-対戦フロー)
7. [トークン仕様 (YTTM)](#7-トークン仕様-yttm)
8. [実装フェーズ](#8-実装フェーズ)
9. [デプロイ設定 (Render)](#9-デプロイ設定-render)

---

## 1. 概要

Midnight ブロックチェーンの ZKP を活用した、3ラウンド制の戦略的カードバトル「Loser's Gambit」。

- **Tech Stack:** React + TypeScript + Vite + Tailwind CSS
- **バックエンド:** Node.js + Express + WebSocket（ws）
- **ブロックチェーン:** Midnight Preprod テストネット（ZKP シールドトークン）

---

## 2. ゲームモード

### 2.1 シングルプレイ (Solo)

CPU を相手に対戦。ルール習得・練習用。CPU の思考・決断はローカルで処理。

### 2.2 マルチプレイ (Multiplayer)

WebSocket リレーサーバーを介したリアルタイム対戦。

- **ルーム制:** プレイヤーが Room ID を入力して同じルームに入室
- **ロール:** `player1`（先着）/ `player2`（後着）
- **プロトコル:** 詳細は `docs/multiplayer.md` 参照

### 2.3 オンチェーンモード

各ゲームモードに「On-Chain Mode」チェックボックスを追加。

| 設定 | 動作 |
|---|---|
| Off（デフォルト） | オフチェーンで完結。TX なし。 |
| On | 勝敗ロジックをスマートコントラクトで実行。TX ハッシュ・コントラクトアドレスを表示。 |

- **現在はダミー実装**（フェイク TX ハッシュ・コントラクトアドレスを生成）。
- Phase 3 で実際の Midnight コントラクト呼び出しに置き換え予定。

---

## 3. 勝利点 (VP) 設計

各ラウンドの対戦モードと結果に応じ、以下の通り VP を付与する。

| 状況 | 勝者 (A) | 敗者 (B) | 設計意図 |
|:---|:---:|:---:|:---|
| **公開 vs 公開** | +1 VP | 0 | 標準的な対戦。 |
| **秘匿(A) vs 公開(B) — Battle** | +1 VP | 0 | A は秘匿の恩恵（手札バレ防止）を得るが加点は標準的。 |
| **公開(A) vs 秘匿(B) — Battle** | +1 VP | **−1 VP** | B は秘匿のリスク（敗北ペナルティ）を負う。 |
| **秘匿 vs 秘匿 — Both Battle** | **+3 VP** | **−1 VP** | 互いにリスクを負った決着。勝者は高得点。 |
| **フォールド（どちらかが選択）** | 0 VP | 0 VP | 不戦引き分け。ペナルティなし。 |
| **引き分け** | +1 VP | +1 VP | 同じ手を出した場合。 |

- **ペナルティ:** 「秘匿」を選択して負けた場合は常に **−1 VP**。
- **フォールドのメリット:** −1 VP ペナルティを回避できる。
- **フォールドのデメリット:** 本来勝てていた場合でも +VP を得られない。

---

## 4. ゲームルール詳細

### 4.1 手札

- 4 種（グー・チョキ・パー・負け犬）からランダムに 3 枚（「負け犬」は必ず 1 枚）。
- 各カードは使い切り。Solo / Multi ともに同じロジックで生成。

### 4.2 カード強さ関係

```
Rock → Scissors → Paper → Rock（循環）
Loser → 全カードに負ける（Loser vs Loser = 引き分け）
```

### 4.3 対戦モードの選択

1. **公開 (Public):** カードをオープンにして対戦。勝っても +1 VP のみ。
2. **秘匿 (Hidden):** カードを伏せて対戦（ZKP で証明）。勝てば高得点・負ければ −1 VP。

### 4.4 フォールドのルール

相手が「秘匿」を選択した場合のみ、もう一方が「Battle」か「Fold」を選択できる。

- 自分が公開・相手が秘匿 → 自分が Battle/Fold を選択
- 自分が秘匿・相手が公開 → 相手が Battle/Fold を選択するのを待つ

### 4.5 ラウンド結果表示

| 状況 | 表示 |
|---|---|
| 自分が勝ち | **YOU WIN** |
| 自分が負け | **YOU LOSE** |
| 引き分け | **DRAW** |
| フォールド | **FOLD — No contest** |

### 4.6 総合勝敗

3 ラウンド終了後、合計 VP を比較。

```
自分の VP > 相手の VP  → VICTORY
自分の VP < 相手の VP  → DEFEAT
自分の VP = 相手の VP  → DRAW
```

---

## 5. 戦略的インセンティブ

- **「秘匿」のジレンマ:**
  - 高得点を狙いたいが、相手に「勝てない」と判断されてフォールドされると、本来「公開」なら得られた +1 VP すら得られなくなる。
  - そのため、あえて「公開」して確実に 1 点を取るか、欲張って「秘匿」にするかの選択が生まれる。
- **ブラフとしての「秘匿」:**
  - 自分が「負け犬」の時に「秘匿」で出し、相手を怖がらせてフォールドさせれば、実質的な負けを 0 点（不戦引き分け）に持ち込める。

---

## 6. 対戦フロー

### 6.1 画面遷移

```
Onboarding → Mode Select → [Solo: Game] / [Multi: Room Select → Room Waiting → Game] → Result
```

### 6.2 画面一覧

各画面の詳細仕様は `docs/screens.md` 参照。

| 画面 | 概要 |
|---|---|
| Onboarding | Lace Wallet 接続 / デモウォレット接続 |
| Mode Select | Solo / Multi・プレイヤー名・オンチェーン設定 |
| Room Select / Waiting | ルーム参加・相手待ち（Multi のみ） |
| Game Board | 3ラウンド対戦メイン画面（Card Select → Decision → ZKP → Reveal → Round Result） |
| Result | 総合勝敗・VP スコア・各ラウンド詳細・報酬請求 |

### 6.3 マルチプレイ同期仕様

- 両プレイヤーが「次ラウンド」ボタンを押すまで次のラウンドに進まない（最終ラウンド後も同様）。
- どちらかが途中切断した場合はモードセレクトに戻る（ゲーム終了後の切断は無視）。
- 詳細プロトコル: `docs/multiplayer.md`

---

## 7. トークン仕様 (YTTM)

- **種別:** Midnight Shielded Token（ZKP による秘匿）
- **取得方法:** ゲーム勝利時のみ mint（スマートコントラクトが発行）
- **付与量:** 勝利時 **+10 YTTM**
- **可視性:** 第三者には残高・送金額が見えない。受取者のみ確認可能。
- **現在の実装:** ダミー（ローカルの `walletBalance` に +10 加算）。Phase 3 で `yttm.compact` の `mintReward()` に置き換え予定。

---

## 8. 実装フェーズ

| フェーズ | 内容 | 状況 |
|---|---|---|
| **Phase 1** | シングルプレイ・VP ロジック・UI 基盤 | ✅ 完了 |
| **Phase 2** | マルチプレイ WebSocket・ZKP アニメーション・Render デプロイ | ✅ 完了 |
| **Phase 3** | 実際の Midnight ZKP 証明・`yttm.compact` 連携 | 未着手 |

### Phase 2 完了内容

- [x] WebSocket リレーサーバー（`server/`）
- [x] マルチプレイ通信プロトコル（`REVEAL_PUBLIC` / `REVEAL_HIDDEN`、`player1/player2`）
- [x] ZKP レース条件対策（`opponentPublicCardPending` バッファ）
- [x] ラウンド結果を自分視点で表示（YOU WIN / YOU LOSE / DRAW）
- [x] リザルト画面のラウンド詳細カード（カード・モード・VP を大きく表示）
- [x] Render へのシングルサービスデプロイ

---

## 9. デプロイ設定 (Render)

### 9.1 構成

フロントエンド（React）とバックエンド（WebSocket リレー）を **1つの Web Service** で運用。

Express が Vite ビルド成果物（`dist/`）を静的配信し、WebSocket を同一ポートで処理する。

```
https://zkplosers-cl.onrender.com
  ├── HTTP  → Express → dist/ (React SPA)
  └── WS    → WebSocketServer → リレー処理
```

### 9.2 Render Web Service 設定

| 設定項目 | 値 |
|---|---|
| **Service Type** | Web Service |
| **Repository** | `zkplosers-cl` |
| **Branch** | `master` |
| **Root Directory** | （空欄） |
| **Build Command** | `npm install && npm run build && cd server && npm install && npm run build` |
| **Start Command** | `node server/dist/index.js` |
| **Plan** | Free |

### 9.3 環境変数

| Key | Value | 用途 |
|---|---|---|
| `PORT` | `10000` | Render がリッスンするポート |
| `VITE_WS_URL` | `wss://zkplosers-cl.onrender.com` | フロントエンドの WS 接続先（ビルド時に埋め込み） |

> **注意:** `VITE_WS_URL` は Vite ビルド時に静的に埋め込まれる。変更後は再デプロイが必要。

### 9.4 ローカル開発

```bash
# フロントエンド
npm run dev          # http://localhost:5173

# WebSocket リレーサーバー（別ターミナル）
cd server && npm run dev   # ws://localhost:3001
```

ローカルでは `VITE_WS_URL` を設定しない場合、`ws://localhost:3001` にフォールバック。

### 9.5 `render.yaml`（Blueprint）

リポジトリ内の `render.yaml` を使って Render Blueprint からワンクリックデプロイ可能。

```yaml
services:
  - type: web
    name: zkplosers-cl
    runtime: node
    buildCommand: npm install && npm run build && cd server && npm install && npm run build
    startCommand: node server/dist/index.js
    envVars:
      - key: PORT
        value: 10000
      - key: VITE_WS_URL
        value: wss://zkplosers-cl.onrender.com
    plan: free
```

### 9.6 Free プランの制約

- 15 分間リクエストがないとサービスがスリープする
- スリープ後の初回アクセスは起動に数十秒かかる
- WebSocket 接続は持続しないため、再接続ロジックが必要（Phase 3 課題）
