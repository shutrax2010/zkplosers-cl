# Loser's Gambit — 画面仕様書

> **更新:** 2026-04-25

---

## 1. 全体デザイン・テーマ

- **コンセプト:** Midnight Cyber-Noir
- **カラー:**
  - 背景: `#020617`（Dark Navy）
  - アクセント: `#7c3aed`（Purple）/ `#06b6d4`（Cyan）/ `#e11d48`（Crimson）
  - テキスト: `#e2e8f0`（メイン）/ `#94a3b8`（サブ）
- **フォント:** Orbitron（見出し）/ JetBrains Mono（データ・ラベル）

---

## 2. 画面一覧

### 2.0 オンボーディング画面 (Onboarding Screen)

初回起動時、またはウォレット未接続時に表示。

- **タイトル:** LOSER'S GAMBIT（ロゴ・キャッチコピー）
- **Lace 検出バッジ:** Lace Wallet の有無をインジケータで表示
- **Connect Lace Wallet ボタン:** Lace 拡張が検出されている場合のみ有効
  - Lace DApp Connector API 経由でウォレット接続
- **Connect Wallet (Demo) ボタン:** Lace がなくても利用可能
  - フェイクアドレスと初期残高（25 YTTM）を生成して次画面へ遷移
- **フッター:** `🔐 ZKP-Shielded · Midnight Preprod · YTTM Token`

---

### 2.1 モード選択画面 (Mode Select Screen)

オンボーディング完了後に表示。

- **ウォレット情報バー:**
  - 接続済みアドレス（短縮表示）
  - YTTM 残高 + 🔐 Shielded バッジ
- **OPERATIVE NAME 入力:** 対戦で使うニックネーム
- **⛓ ON-CHAIN MODE トグル:**
  - OFF（デフォルト）: オフチェーンで完結
  - ON: 勝敗をスマートコントラクトで実行（現在はダミー）
  - ON 時は「DEMO — simulated on-chain」バッジを表示
- **モード選択ボタン:**
  - `SOLO OPERATIVE`: CPU 対戦 → Game Board へ遷移
  - `MULTI-SYNC`: オンライン対戦 → Room Screen へ遷移
- **QUICK RULES パネル:** ルール概要、報酬「10 YTTM 🔐 (shielded)」表示

---

### 2.1.5 ルーム画面 (Room Screen)

MULTI-SYNC 選択後に表示。2 つの状態を持つ。

**状態 1: Room ID 入力（room-select フェーズ）**

- `ROOM ID` テキストフィールド（英数字）
- ランダム生成ボタン（ダイス🎲アイコン）
- `[JOIN ROOM]` ボタン
- `[← BACK]` ボタン

**状態 2: 対戦相手待ち（room-waiting フェーズ）**

- `YOUR ROOM ID: XXXXXX` + コピーボタン
- 「Share this code with your opponent」テキスト
- 点滅アニメーション（Waiting...）
- `[CANCEL]` ボタン → モード選択に戻る

相手が接続すると `GAME_STARTED` を受信し、自動で Game Board へ遷移。

---

### 2.2 ゲームボード (Game Board)

対戦のメイン画面。縦スクロールなし・画面内に収まる固定レイアウト。

**ヘッダー（上部）**

- タイトルロゴ（LOSER'S GAMBIT）
- ラウンド表示: `ROUND N / 3`

**相手エリア**

- OPPONENT ラベル + 相手名
- SCORE: 相手の累計 VP
- 裏向きカード残枚数（使用済みはグレーの点線枠）
- ステータステキスト（Thinking... / Deciding... / Waiting... など）

**バトルエリア（中央）**

- 相手カードスロット / VS / 自分カードスロット
  - コミット前: `?` プレースホルダー
  - コミット後: 公開=カード表示、秘匿=裏向きカード
  - Reveal 後: 公開カードのみ表示（秘匿は 🔐 のまま）
- ラウンド結果パネル（`round-result` フェーズ）: 下記参照
- Battle/Fold 選択パネル（`player-battle-fold` フェーズ）

**プレイヤーエリア（下部）**

- OPERATIVE ラベル + 自分名
- SCORE: 自分の累計 VP
- 手札 3 枚（使用済みは半透明）
- モード切り替え（PUBLIC / HIDDEN トグル）
  - PUBLIC: 👁 公開 · +1 VP
  - HIDDEN: 🔐 秘匿 · ZKP（Win=+3VP、Lose=−1VP）
- `COMMIT MOVE` / `COMMIT (HIDDEN)` ボタン
- `ROUND N+1 →` / `SEE FINAL RESULT →` ボタン（`round-result` フェーズ）
- Multi 待機メッセージ（`waiting-opponent-commit` / `waiting-next-round`）

**ZKP オーバーレイ**

秘匿選択時に全画面オーバーレイで表示。`Generating ZKP Proof...` アニメーション。

**ラウンド結果パネル**

| 状況 | 表示 | カラー |
|---|---|---|
| 自分が勝ち | **YOU WIN** | Cyan `#34d399` |
| 自分が負け | **YOU LOSE** | Crimson `#e11d48` |
| 引き分け | **DRAW** | Cyan `#06b6d4` |
| フォールド | **FOLD — No contest** | Gray `#94a3b8` |

- カード種別（公開の場合はアイコン＋ラベル、秘匿は 🔐 ???）
- VP 変動（You: +N / {相手名}: +N）

---

### 2.3 リザルト画面 (Result Screen)

ゲーム終了時の結果表示。

**メイン勝敗表示**

- `VICTORY` / `DEFEAT` / `DRAW` を大きく表示（カラー・アニメーション付き）
- ON-CHAIN MODE 時は ⛓ バッジを付記
- 自分 VP vs 相手 VP のスコアボード

**ラウンド詳細カード（3 枚）**

各ラウンドをパネル形式で表示:

```
┌─────────────────────────────────────┐
│ ROUND 1                      [WIN]  │
│                                     │
│  [YOU]       VS      [{相手名}]     │
│  ✊ GU              🔐 HIDDEN      │
│  PUBLIC             HIDDEN          │
│                                     │
│  You +1 VP  |  {相手名} -1 VP      │
└─────────────────────────────────────┘
```

- 結果バッジ: WIN（緑）/ LOSE（赤）/ DRAW（シアン）/ FOLD（グレー）
- 秘匿カードは 🔐 HIDDEN 表示（カード種は非公開のまま）
- FOLD 時: 「あなたがフォールド」/ 「{相手名}がフォールド」— 不戦引き分け

**報酬受取（勝者のみ）**

- `Claim Shielded YTTM` ボタン（+10 YTTM）
- `🔐 Shielded — 第三者には非公開 (ZKP)` ラベル
- 受取後: 「10 YTTM を受け取りました 🔐 / 残高: N YTTM」

**On-Chain 結果パネル（オンチェーンモード時のみ）**

トグルで開閉。CONTRACT ADDRESS・TX ログ（commit / reveal）・報酬 TX を表示。
「DEMO: TX hashes are simulated.」注記あり。

**ナビゲーション:** `← Return to Lobby` ボタン

---

## 3. インタラクション

- **カード選択:** クリックでカードをハイライト。HIDDEN モードでカードが紫に発光。
- **負け犬カード:** 赤色パルスエフェクト（リスクの視覚的警告）。
- **ZKP 生成:** 全画面オーバーレイ + プログレスアニメーション。
- **ラウンド結果:** `animate-reveal` クラスでフェードイン。
- **マッチング成功:** GAME_STARTED 受信後にゲームボードへ自動遷移。

---

## 4. 画面遷移フロー

```
[Onboarding]
  Connect Wallet (Demo) / Connect Lace Wallet
    ↓
[Mode Select]
  Operative Name 入力 + On-Chain Mode ON/OFF
  → SOLO OPERATIVE ─────────────────────────┐
  → MULTI-SYNC                               │
      ↓                                      │
  [Room Screen]                              │
    Room ID 入力 → JOIN ROOM                 │
      ↓ (room-waiting)                       │
    対戦相手待ち                              │
      ↓ (GAME_STARTED 受信)                  │
[Game Board] ◄────────────────────────────────┘
  Round 1 → Round 2 → Round 3
  (Multi: WS でリアルタイム同期)
  両プレイヤーが READY_NEXT_ROUND を送信して次ラウンドへ
    ↓ (3ラウンド完了 + 両者 SEE FINAL RESULT クリック)
[Result Screen]
  Claim Shielded YTTM（勝者）
  On-Chain 結果パネル（オンチェーンモード時）
  → Return to Lobby → [Mode Select]
```
