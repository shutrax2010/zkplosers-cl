# Midnight Janken "Loser's Gambit" 画面仕様書

## 1. 全体デザイン・テーマ
- **コンセプト:** Midnight Cyber-Noir
- **カラー:** 背景: #020617 (Dark Navy), アクセント: #7c3aed (Purple), #06b6d4 (Cyan), #e11d48 (Crimson)
- **フォント:** モノスペース、または近未来的なサンセリフ体。

---

## 2. 画面一覧

### 2.0 オンボーディング画面 (Onboarding Screen)
初回起動時、またはウォレット未接続時に表示。

**アカウント作成機能は廃止。"Connect Wallet" のみ提供する。**

- **タイトル:** LOSER'S GAMBIT（ロゴ・キャッチコピー）
- **Lace 検出バッジ:** Lace Wallet の有無をインジケータで表示。
- **Connect Lace Wallet ボタン:** Lace Wallet 拡張が検出されている場合のみ有効。
  - Lace DApp Connector API 経由でウォレット接続。
- **Connect Wallet (Demo) ボタン:** Lace がなくても利用可能なダミー接続。
  - フェイクアドレスと初期残高（25 YTTM）を生成して次画面へ遷移。
- **フッター:** `🔐 ZKP-Shielded · Midnight Preprod · YTTM Token`

> 廃止した機能: Create New Account（Mnemonic 生成）、Import Mnemonic

---

### 2.1 モード選択画面 (Mode & Profile Screen)
オンボーディング完了後に表示。

- **ウォレット情報バー:**
  - 接続済みアドレス（短縮表示）
  - YTTM 残高 + 🔐 Shielded バッジ（第三者には非公開であることを示す）
- **OPERATIVE NAME 入力:** 対戦で使うニックネーム。
- **⛓ ON-CHAIN MODE トグル:**
  - OFF（デフォルト）: オフチェーンで完結。
  - ON: 勝敗をスマートコントラクトで実行（現在はダミー）。
  - ON 時は「DEMO — simulated on-chain」バッジを表示。
- **モード選択ボタン:**
  - `SOLO OPERATIVE`: CPU 対戦。
    - サブテキストに「On-Chain」/ 「Off-Chain」を反映。
  - `MULTI-SYNC`: オンライン対戦 → クリックで Room 選択画面へ遷移（Phase 2 で有効化）。
- **QUICK RULES パネル:** ルール概要。報酬を「10 YTTM 🔐 (shielded)」と表示。

---

### 2.2 メインゲームボード (Game Board)
対戦のメイン画面。上下に分かれたレイアウト。

- **対戦相手エリア（上部）:**
  - 相手のアドレス、残り手札枚数（裏向きアイコン）、現在の累計VP。
  - ステータスインジケータ（「思考中...」「選択済み」）。
- **バトルエリア（中央）:**
  - **ラウンド数表示:** (例: Round 2 / 3)。
  - **On-Chain Mode インジケータ:** ⛓ バッジ（オンチェーンモード時）。
  - **中央スロット:** 提出されたカードが置かれる場所。最初は裏向き。
  - **アクション通知:** 相手が「秘匿」を選んだ際、「BATTLE or FOLD?」の選択肢が出現。
- **プレイヤーエリア（下部）:**
  - **手札スロット:** 配られた3枚のカードを表示。
  - **モードスイッチ:** カード選択時に「Public (公開)」か「Hidden (秘匿)」をトグルで選択。
  - **決定ボタン:** 「Commit Move」。
  - **フォールドボタン:** 相手が秘匿を選択した際にアクティブ化。
- **ZKP生成オーバーレイ:**
  - 「秘匿」選択後の証明生成中に表示。「Generating Proof...」の進捗アニメーション。

---

### 2.3 リザルト画面 (Result Screen)
ゲーム終了時の結果表示。

- **勝敗表示:** `VICTORY` / `DEFEAT` / `DRAW` を中央に大きく表示。
  - オンチェーンモード時: ⛓ ON-CHAIN バッジを付記。
- **VPスコアボード:** 3ラウンドそれぞれの内訳を表示。
  - 秘匿カードは 🔐[H] 表示（カード種は非公開のまま）。
- **報酬受取 (Claim):**
  - 勝者の場合、`Claim Shielded YTTM` ボタンを表示。
  - `🔐 Shielded — 第三者には非公開 (ZKP)` ラベルを付記。
  - 受け取り後: 「10 YTTM を受け取りました 🔐 / 残高: N YTTM (Shielded — あなたのみ閲覧可能)」
- **On-Chain 結果パネル（オンチェーンモード時のみ）:**
  - トグルで開閉可能。
  - CONTRACT ADDRESS（フェイク）
  - ラウンドごとの TX ログ（commit / reveal TX ハッシュ）
  - 報酬 TX（claimed 後に追記）
  - 「View on Explorer (Demo mode)」リンク（無効）
  - 「DEMO: TX hashes are simulated. Real on-chain mode coming in Phase 3.」注記
- **ナビゲーション:** `← Return to Lobby` ボタン。

---

### 2.1.5 Room 選択画面 (Room Screen) — Phase 2

MULTI-SYNC を選択後に表示。

**状態 1: Room ID 入力**
- `ROOM ID` フィールド（6文字英数字）
- ランダム生成ボタン（自分がホストする場合）
- `⛓ ON-CHAIN MODE` トグル（Solo 画面と同じ）
- `[JOIN ROOM]` ボタン

**状態 2: 対戦相手待ち**
- `YOUR ROOM ID: ABC123` + コピーボタン
- 「Share this code with your opponent」
- 点滅アニメーション
- `[CANCEL]` ボタン

**状態 3: 相手接続完了**
- `OPPONENT: {name}` / `ADDRESS: {short addr}`
- 自動でゲームボードへ遷移

---

## 3. インタラクション・SE
- **クリック/ホバー:** 電子的な短いSE。
- **秘匿（Hidden）選択:** 低音の警告音と、カードが紫色に発光する視覚効果。
- **負け犬カード:** 敗北のリスクを想起させる赤色のパルスエフェクト。
- **マッチング成功:** 画面が振動し、グリッド背景が高速移動する演出。

---

## 4. 画面遷移フロー
```
[Onboarding]
  Connect Wallet (Demo) / Connect Lace Wallet
    ↓
[Mode Select]
  Operative Name 入力 + On-Chain Mode ON/OFF
  → SOLO OPERATIVE ボタン ────────────────────┐
  → MULTI-SYNC ボタン (Phase 2)               │
    ↓                                          │
[Room Screen] (Phase 2)                        │
  Room ID 入力 / ランダム生成                   │
  → JOIN ROOM → 対戦相手待ち                   │
    ↓ (相手接続)                               │
[Game Board] ◄─────────────────────────────────┘
  Round 1 → Round 2 → Round 3
  (マルチ: WS で相手とリアルタイム同期)
    ↓
[Result Screen]
  Claim Shielded YTTM (勝者)
  On-Chain 結果パネル (オンチェーンモード時)
  → Return to Lobby → [Mode Select]
```
