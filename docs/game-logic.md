# Loser's Gambit — ゲームロジック設計書

> **実装参照:** `src/logic/game-logic.ts`, `src/hooks/useGameState.ts`
> **更新:** 2026-04-25

---

## 目次

1. [カード仕様](#1-カード仕様)
2. [手札生成](#2-手札生成)
3. [カード勝敗判定](#3-カード勝敗判定)
4. [バトルモード](#4-バトルモード)
5. [Decision Phase — Battle / Fold](#5-decision-phase--battle--fold)
6. [VP 計算ロジック](#6-vp-計算ロジック)
7. [全シナリオ別ラウンド結果](#7-全シナリオ別ラウンド結果)
8. [総合勝敗判定](#8-総合勝敗判定)
9. [ラウンド状態遷移](#9-ラウンド状態遷移)

---

## 1. カード仕様

### 1.1 カード種別

| CardType | ラベル | アイコン | 色 | 特性 |
|---|---|---|---|---|
| `rock` | GU | ✊ | cyan `#06b6d4` | 通常カード |
| `scissors` | CHO | ✌️ | purple `#a78bfa` | 通常カード |
| `paper` | PA | ✋ | green `#34d399` | 通常カード |
| `loser` | INU | 🐶 | crimson `#e11d48` | 必敗カード |

### 1.2 強さ関係

```
Rock → Scissors → Paper → Rock（循環）

Loser → 全カードに負ける（例外: Loser vs Loser = 引き分け）
```

---

## 2. 手札生成

### 2.1 生成ルール

```
手札 = [
  Loser × 1   （固定）,
  非Loser × 1  （Rock / Scissors / Paper からランダム）,
  非Loser × 1  （Rock / Scissors / Paper からランダム）,
]
→ Fisher-Yates シャッフルで順番をランダム化
```

### 2.2 特性

- 手札は常に 3 枚、うち Loser は必ず 1 枚
- 非Loser 2 枚は重複あり（Rock/Rock も発生しうる）
- 各カードは使い切り（used フラグで管理）
- Solo/Multi ともに同じロジックで生成。Multi ではそれぞれのクライアントが独立して生成

---

## 3. カード勝敗判定

### 3.1 比較テーブル

| A \\ B | Rock | Scissors | Paper | Loser |
|:---:|:---:|:---:|:---:|:---:|
| **Rock** | Draw | **A** | B | **A** |
| **Scissors** | B | Draw | **A** | **A** |
| **Paper** | **A** | B | Draw | **A** |
| **Loser** | B | B | B | Draw |

### 3.2 アルゴリズム（`compareCards`）

```typescript
function compareCards(a, b): 'a' | 'b' | 'draw' {
  if (a === b)       return 'draw';
  if (a === 'loser') return 'b';      // Loser は常に負け
  if (b === 'loser') return 'a';      // 相手が Loser なら勝ち
  const wins = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
  return wins[a] === b ? 'a' : 'b';
}
```

---

## 4. バトルモード

各カード提出時に「公開」または「秘匿」を選択する。

| モード | 効果 | VP への影響 |
|---|---|---|
| **Public（公開）** | カードを相手に公開して対戦 | 勝っても +1 VP のみ。負けても -1 なし |
| **Hidden（秘匿）** | カードを伏せて対戦 (Phase 3: ZKP 証明) | 勝てば高得点。負ければ -1 ペナルティ |

> **Phase 2 (現在):** Hidden でも proof (実カード種) を WS 経由で共有。  
> **Phase 3:** ZKP proof に置き換え。相手のカードは最後まで不明。

---

## 5. Decision Phase — Battle / Fold

### 5.1 発生条件

```
myMode ≠ oppMode
 └─ myMode=public  && oppMode=hidden  → 自分が Battle/Fold を選択（player-battle-fold フェーズ）
 └─ myMode=hidden  && oppMode=public  → 相手が選択するのを待つ（waiting-opponent-decision フェーズ）

myMode === oppMode
 └─ 両公開 / 両秘匿 → Decision Phase なし、直接 Reveal へ
```

### 5.2 選択肢と意味

| 選択 | 効果 | 戦略的意図 |
|---|---|---|
| **Battle（対戦）** | そのまま勝負。Hidden の VP リスクを受け入れる | 相手の秘匿カードが弱いと読んだとき |
| **Fold（降り）** | ラウンドを棄権。双方 0 VP | 相手の秘匿カードが強そうなとき、または自分の -1 ペナルティを回避したいとき |

### 5.3 フォールド後の処理

フォールドが発生した場合、**カード開示なし**でラウンドが終了する。

```typescript
result = {
  winner: null,
  playerVP: 0, cpuVP: 0,
  folded: true,
  // cpuCard は "opp-fold" プレースホルダー（表示不要）
}
```

---

## 6. VP 計算ロジック

### 6.1 全パターン表

| 状況 | 勝者 VP | 敗者 VP | folded |
|:---|:---:|:---:|:---:|
| フォールド（どちらかが選択） | 0 | 0 | ✓ |
| 引き分け（どのモードでも） | +1 | +1 | ✗ |
| 勝者=public、敗者=public | +1 | 0 | ✗ |
| 勝者=hidden、敗者=public | +1 | 0 | ✗ |
| 勝者=public、敗者=hidden | +1 | **-1** | ✗ |
| 勝者=hidden、敗者=hidden | **+3** | **-1** | ✗ |

### 6.2 計算アルゴリズム（`calculateVP`）

```
入力: playerMode, oppMode, playerDecision, oppDecision, winner

1. fold 判定
   if (playerDecision=fold OR oppDecision=fold)
     → playerVP=0, cpuVP=0, folded=true

2. draw 判定
   if winner=draw
     → playerVP=+1, cpuVP=+1

3. 通常勝敗
   winnerMode = (winner=player) ? playerMode : cpuMode
   loserMode  = (winner=player) ? cpuMode : playerMode

   winnerVP = (winnerMode=hidden AND loserMode=hidden) ? +3 : +1
   loserVP  = (loserMode=hidden) ? -1 : 0

   (winner=player) ? playerVP=winnerVP, cpuVP=loserVP
                   : playerVP=loserVP,  cpuVP=winnerVP
```

### 6.3 ペナルティの発生条件

```
-1 VP が発生するのは: 「秘匿」を選択したプレイヤーが負けた場合
                      （フォールドで終わった場合は -1 なし）

フォールドのメリット: -1 ペナルティを回避できる
フォールドのデメリット: 本来勝てていた場合でも +1 VP を得られない
```

---

## 7. 全シナリオ別ラウンド結果

### シナリオ 1: 両公開 (Public vs Public)

```
両者が REVEAL_PUBLIC を送信
→ 両クライアントが compareCards でローカル解決
→ winner の決定 → calculateVP(public, public, battle, battle, winner)
```

| winner | playerVP | cpuVP |
|:---:|:---:|:---:|
| player | +1 | 0 |
| cpu | 0 | -0 (0) |
| draw | +1 | +1 |

### シナリオ 2: 公開(自) vs 秘匿(相手) — Battle

```
自分: REVEAL_PUBLIC を即時送信
相手: 自分の公開カードを受け取り → REVEAL_HIDDEN { claimedOutcome, proof } を送信
自分: OPPONENT_REVEALED_HIDDEN を受信 → proof でローカル解決
→ calculateVP(public, hidden, battle, battle, winner)
```

| winner | playerVP | cpuVP |
|:---:|:---:|:---:|
| player | +1 | **-1** |
| cpu | 0 | +1 |
| draw | +1 | +1 |

### シナリオ 3: 公開(自) vs 秘匿(相手) — Fold（自分が降り）

```
自分: PLAYER_DECISION { fold } を送信 → ラウンド即終了
→ playerVP=0, cpuVP=0, folded=true
（カード開示なし）
```

### シナリオ 4: 秘匿(自) vs 公開(相手) — Battle

```
自分: ZKP 生成中に相手の REVEAL_PUBLIC を受信（または生成完了後）
→ resolveWinner(myCard, oppCard) で claimedOutcome 計算
→ REVEAL_HIDDEN { claimedOutcome, proof: myCard } を送信
→ ローカルで解決
→ calculateVP(hidden, public, battle, battle, winner)
```

| winner | playerVP | cpuVP |
|:---:|:---:|:---:|
| player | +1 | 0 |
| cpu | **-1** | +1 |
| draw | +1 | +1 |

### シナリオ 5: 秘匿(自) vs 公開(相手) — Fold（相手が降り）

```
相手: PLAYER_DECISION { fold } を送信
自分: OPPONENT_DECISION { fold } を受信 → ラウンド即終了
→ playerVP=0, cpuVP=0, folded=true
（自分のカードは公開しない）
```

### シナリオ 6: 両秘匿 (Hidden vs Hidden)

```
両者が ZKP 生成完了後に REVEAL_HIDDEN { proof: myCard } を即時送信
双方: OPPONENT_REVEALED_HIDDEN { proof } を受信 → proof でローカル解決
→ calculateVP(hidden, hidden, battle, battle, winner)
```

| winner | playerVP | cpuVP |
|:---:|:---:|:---:|
| player | **+3** | **-1** |
| cpu | **-1** | **+3** |
| draw | +1 | +1 |

---

## 8. 総合勝敗判定

### 8.1 ルール

```
3 ラウンド終了後、合計 VP を比較する。

playerTotalVP > cpuTotalVP  → player が勝者
playerTotalVP < cpuTotalVP  → cpu (opponent) が勝者
playerTotalVP === cpuTotalVP → 引き分け
```

### 8.2 VP の範囲

```
1 ラウンドの最小 VP: -1（秘匿で負け）
1 ラウンドの最大 VP: +3（両秘匿で勝利）

3 ラウンドの最小合計: -3
3 ラウンドの最大合計: +9
```

### 8.3 勝者への報酬

```
勝者: 10 YTTM トークン（Shielded Token）を付与
引き分け: 報酬なし（仕様上。Phase 3 で変更の可能性あり）
敗者: 報酬なし
```

> **現在:** `claimShieldedReward()` はダミー実装（ローカルの walletBalance に +10）。  
> **Phase 3:** `yttm.compact` の `mintReward()` に置き換え。

---

## 9. ラウンド状態遷移

### 9.1 Solo モード

```
card-select
  ↓ [COMMIT_MOVE]
cpu-thinking
  ↓ [CPU_MOVED]
  ├─ playerMode=public, cpuMode=hidden  → player-battle-fold
  │    ├─ fold    → round-result (folded)
  │    └─ battle  → zkp-generating → revealing → round-result
  ├─ playerMode=hidden, cpuMode=public  → cpu-battle-fold
  │    ├─ (cpu) fold   → round-result (folded)
  │    └─ (cpu) battle → zkp-generating → revealing → round-result
  ├─ both public                        → revealing → round-result
  └─ both hidden                        → zkp-generating → revealing → round-result

round-result
  ├─ nextRound < totalRounds → card-select (round++)
  └─ nextRound >= totalRounds → game-over
```

### 9.2 Multiplayer モード

```
card-select
  ↓ [COMMIT_MOVE → waiting-opponent-commit]
  ↓ [BOTH_COMMITTED 受信]
  ├─ myMode=public,  oppMode=hidden  → player-battle-fold
  │    ├─ fold    → round-result (folded)
  │    └─ battle  → revealing
  ├─ myMode=hidden, oppMode=public   → waiting-opponent-decision
  │    ├─ OPPONENT_DECISION{fold}  → round-result (folded)
  │    └─ OPPONENT_DECISION{battle} → zkp-generating → revealing
  ├─ both public                     → revealing
  └─ both hidden                     → zkp-generating → revealing

revealing
  ├─ myMode=public
  │    → REVEAL_PUBLIC 送信
  │    → OPPONENT_REVEALED_PUBLIC 受信 → round-result
  ├─ myMode=hidden, oppMode=public
  │    → OPPONENT_REVEALED_PUBLIC 受信後に REVEAL_HIDDEN 送信
  │    → round-result
  └─ myMode=hidden, oppMode=hidden
       → REVEAL_HIDDEN 即時送信
       → OPPONENT_REVEALED_HIDDEN 受信 (proof) → round-result

round-result
  ├─ nextRound < totalRounds
  │    → READY_NEXT_ROUND 送信
  │    → OPPONENT_READY_NEXT 受信まで waiting-next-round
  │    → card-select (round++)
  └─ nextRound >= totalRounds → game-over → WS 切断
```

---

## 付録: 関数シグネチャ一覧

| 関数 | 入力 | 出力 | 備考 |
|---|---|---|---|
| `generateHand()` | なし | `Card[3]` | Loser 必ず1枚 |
| `compareCards(a, b)` | CardType × 2 | `'a' \| 'b' \| 'draw'` | |
| `resolveWinner(player, cpu)` | CardType × 2 | `RoundWinner` | player/cpu/draw |
| `calculateVP(params)` | modes, decisions, winner | `{ playerVP, cpuVP, folded }` | |
| `determineOverallWinner(pvp, cvp)` | number × 2 | `'player' \| 'cpu' \| 'draw'` | |
