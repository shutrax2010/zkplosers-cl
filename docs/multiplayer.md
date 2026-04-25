# Loser's Gambit — WebSocket マルチプレイヤー設計書

> **ステータス**: 設計フェーズ（未実装）  
> **ホスティング**: Render (Web Service)  
> **更新**: 2026-04-24

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [サーバー設計](#2-サーバー設計)
3. [WebSocket メッセージプロトコル](#3-websocket-メッセージプロトコル)
4. [ゲームフロー詳細](#4-ゲームフロー詳細)
5. [セキュリティ設計](#5-セキュリティ設計)
6. [フロントエンド変更設計](#6-フロントエンド変更設計)
7. [Render デプロイ設計](#7-render-デプロイ設計)
8. [実装フェーズ計画](#8-実装フェーズ計画)

---

## 1. アーキテクチャ概要

```
┌─────────────────────────┐        ┌─────────────────────────┐
│  Player A (Browser)     │        │  Player B (Browser)     │
│                         │        │                         │
│  React + useMultiplayer │◄──WS──►│  React + useMultiplayer │
│  midnight-wallet.ts     │        │  midnight-wallet.ts     │
└────────────┬────────────┘        └────────────┬────────────┘
             │ WebSocket                         │ WebSocket
             │                                   │
             └──────────────┬────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Render Web Service   │
                │   (Node.js WS Server)  │
                │                        │
                │   役割:                 │
                │   - Room マッチング     │
                │   - メッセージ中継      │
                │   - コミット順序の強制  │
                │   ゲームロジック: なし  │
                └───────────────────────┘

             オンチェーンモード時 (追加):
             ┌──────────────────────────────────────┐
             │         Midnight Blockchain           │
             │  Player A → janken.compact ← Player B│
             │  TX ハッシュは WebSocket で共有       │
             └──────────────────────────────────────┘
```

### 設計原則

| 原則 | 内容 |
|---|---|
| **サーバーはリレーのみ** | 勝敗ロジックはクライアント（オフチェーン）またはコントラクト（オンチェーン）が持つ |
| **cardType はサーバーに送らない** | サーバーが受け取るのは commitment（ハッシュ）のみ |
| **コミット後に reveal** | 両者がコミットするまでサーバーは REVEAL メッセージを中継しない |
| **ステートレス設計** | サーバーはゲームの VP を計算しない。Room の進行フェーズのみ管理 |

---

## 2. サーバー設計

### ファイル構成

```
server/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        ← Express + WebSocket サーバー起動・Render 設定
    ├── protocol.ts     ← メッセージ型定義 (ClientMsg / ServerMsg)
    ├── rooms.ts        ← Room 管理（作成・参加・削除・タイムアウト）
    └── relay.ts        ← メッセージ受信 → 検証 → 中継ロジック
```

### Room の内部状態

```typescript
interface PlayerConn {
  ws: WebSocket;
  name: string;
  address: string;
  index: 0 | 1;           // player1 = 0, player2 = 1
  lastPing: number;
}

interface RoundState {
  committed:  [boolean, boolean];  // 両者がコミット済みか
  decided:    [boolean, boolean];  // 両者が Battle/Fold 決断済みか
  revealed:   [boolean, boolean];  // 両者が reveal 済みか
  readyNext:  [boolean, boolean];  // 次ラウンド準備完了か
}

type RoomPhase =
  | 'waiting'       // 2人目待ち
  | 'round-active'  // カード選択中
  | 'decision'      // Battle/Fold 決断中
  | 'resolving'     // Reveal 中
  | 'game-over';    // ゲーム終了

interface Room {
  id: string;
  players: [PlayerConn | null, PlayerConn | null];
  phase: RoomPhase;
  round: number;          // 0-indexed (0, 1, 2)
  roundState: RoundState;
  createdAt: number;
  lastActivity: number;
}
```

### Room ライフサイクル

```
Player A が roomId を入力
  → JOIN_ROOM { roomId: "ABC123", name: "...", address: "mn_addr_..." }
  → Room が存在しない: 新規作成 → player1 として登録 → ROOM_JOINED (waiting)

Player B が同じ roomId を入力
  → JOIN_ROOM { roomId: "ABC123", name: "...", address: "mn_addr_..." }
  → Room が存在・player2 枠が空: 参加 → GAME_STARTED を両者に送信

【タイムアウト処理】
  - waiting 状態で 5 分経過: Room 削除
  - ゲーム中に一方が切断: 60 秒待機 → 再接続なければ相手に OPPONENT_LEFT → Room 削除
  - 全体タイムアウト: 30 分で強制終了
```

---

## 3. WebSocket メッセージプロトコル

### 型定義

```typescript
// ── Client → Server ──────────────────────────────────────────────

type ClientMsg =
  | { type: 'JOIN_ROOM';        roomId: string; name: string; address: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'COMMIT_MOVE';      commitment: string; mode: 'public' | 'hidden' }
  | { type: 'PLAYER_DECISION';  decision: 'battle' | 'fold' }
  | { type: 'REVEAL_PUBLIC';    cardType: 'rock' | 'scissors' | 'paper' | 'loser' }
  | { type: 'REVEAL_HIDDEN';    claimedOutcome: 'PWins' | 'OWins' | 'Draw'; proof?: string }
  | { type: 'ONCHAIN_TX';       action: string; txHash: string }  // オンチェーンモード時
  | { type: 'READY_NEXT_ROUND' }
  | { type: 'PING' };

// ── Server → Client ──────────────────────────────────────────────

type ServerMsg =
  // 接続・マッチング
  | { type: 'ROOM_JOINED';       role: 'player1' | 'player2'; waitingForOpponent: boolean }
  | { type: 'OPPONENT_JOINED';   opponentName: string; opponentAddress: string }
  | { type: 'GAME_STARTED';      yourRole: 'player1' | 'player2';
                                  opponent: { name: string; address: string } }
  | { type: 'OPPONENT_LEFT';     reason: 'disconnect' | 'leave' }
  | { type: 'ROOM_ERROR';        code: 'ROOM_FULL' | 'ROOM_NOT_FOUND' | 'ALREADY_IN_ROOM'; message: string }

  // ゲーム進行
  | { type: 'OPPONENT_COMMITTED'; mode: 'public' | 'hidden' }
                                  // ⚠️ mode のみ中継。commitment 値は相手に送らない
  | { type: 'BOTH_COMMITTED';     round: number }
                                  // 両者コミット完了の合図。Decision Phase の判断用
  | { type: 'OPPONENT_DECISION';  decision: 'battle' | 'fold' }
  | { type: 'OPPONENT_REVEALED_PUBLIC';  cardType: string }
  | { type: 'OPPONENT_REVEALED_HIDDEN';  claimedOutcome: string }
  | { type: 'OPPONENT_READY_NEXT' }

  // オンチェーンモード
  | { type: 'OPPONENT_ONCHAIN_TX'; action: string; txHash: string }

  // システム
  | { type: 'PONG' };
```

### プロトコル上の重要ルール

| ルール | 理由 |
|---|---|
| `COMMIT_MOVE` の `commitment` はサーバーが**対戦相手に中継しない** | commitment = ハッシュ値でも情報漏洩を防ぐ |
| サーバーは `mode` だけを相手に中継 | 相手が秘匿かどうかは公開情報 |
| `BOTH_COMMITTED` は両者コミット後にのみ送信 | 先にコミットした方が相手の mode を見てから reveal するのを防ぐ |
| `REVEAL_PUBLIC.cardType` はサーバー経由で中継 | オフチェーンモードでは相手のカードをサーバー経由で受け取る |
| `REVEAL_HIDDEN.proof` はオプション | ダミー実装では空でもよい |

---

## 4. ゲームフロー詳細

### フェーズ遷移図

```
[Waiting]
  Player A → JOIN_ROOM
    → サーバー: ROOM_JOINED { waitingForOpponent: true }
  Player B → JOIN_ROOM
    → サーバー: GAME_STARTED (両者へ)

[Round N: Card Selection]
  ラウンド開始時にカードや公開/秘匿の状態、通信状態のクリアと確認を行う
  両者が独立してカード選択 + モード選択
  Player A → COMMIT_MOVE { commitment: "0x...", mode: "hidden" }
    → サーバー: Player B へ OPPONENT_COMMITTED { mode: "hidden" }
    → サーバー: (B がまだコミットしていない場合) 何もしない
  Player B → COMMIT_MOVE { commitment: "0x...", mode: "public" }
    → サーバー: Player A へ OPPONENT_COMMITTED { mode: "public" }
    → 両者コミット完了 → 両者へ BOTH_COMMITTED { round: 0 }

[Decision Phase] ← どちらかが "hidden" の場合のみ
  BOTH_COMMITTED を受け取ったクライアントが
  「どちらかが hidden か」を自分で判断して Battle/Fold UI を表示
  
  Player A → PLAYER_DECISION { decision: "battle" }
    → サーバー: Player B へ OPPONENT_DECISION { decision: "battle" }
  Player B → PLAYER_DECISION { decision: "battle" }
    → サーバー: Player A へ OPPONENT_DECISION { decision: "battle" }

[Resolving]
  ── 公開カードの場合 ──
  Player A → REVEAL_PUBLIC { cardType: "rock" }
    → サーバー: Player B へ OPPONENT_REVEALED_PUBLIC { cardType: "rock" }
  Player B → REVEAL_PUBLIC { cardType: "scissors" }
    → サーバー: Player A へ OPPONENT_REVEALED_PUBLIC { cardType: "scissors" }
  → 両クライアントがローカルで VP を計算

  ── 秘匿カードの場合 ──
  Player A → REVEAL_HIDDEN { claimedOutcome: "PWins" }
    → サーバー: Player B へ OPPONENT_REVEALED_HIDDEN { claimedOutcome: "PWins" }
  (ダミー段階: クライアントが claimedOutcome を信頼して VP 計算)
  (Phase 3以降: ZKP proof を含めて両者が on-chain で検証)

[Next Round / Game Over]
  Player A → READY_NEXT_ROUND
    → サーバー: Player B へ OPPONENT_READY_NEXT
  Player B → READY_NEXT_ROUND
    → サーバー: Player A へ OPPONENT_READY_NEXT
  → 両者 ready → クライアントが Round N+1 を開始

[Game Over — On-Chain Mode]
  Player A → ONCHAIN_TX { action: "claimReward", txHash: "0x..." }
    → サーバー: Player B へ OPPONENT_ONCHAIN_TX { action: "claimReward", txHash: "0x..." }
```

### オフチェーン vs オンチェーン の差分

| ステップ | オフチェーンモード | オンチェーンモード |
|---|---|---|
| コミット | ローカルで commitment 生成 → WS 送信 | Midnight TX → txHash を ONCHAIN_TX で共有 |
| Resolve | 両者の cardType を比較してローカル計算 | janken.compact が計算 → Indexer で確認 |
| Reward | claimShieldedReward() ダミー | claimReward() → yttm.compact |
| サーバー関与 | 同じ（中継のみ） | 同じ（TX ハッシュも中継するだけ） |

---

## 5. セキュリティ設計

### サーバーが守るルール

```
1. COMMIT 前に REVEAL を受け取った場合 → 無視（両者コミット前は中継しない）
2. Room が満員（2人）の状態で3人目が JOIN_ROOM → ROOM_ERROR: ROOM_FULL
3. 自分への OPPONENT_* メッセージは送り返さない
4. cardType の値が有効な enum 値か確認 (rock | scissors | paper | loser)
5. roomId は 6文字英数字 のみ許容（SQL injection / path traversal 対策）
```

### クライアントが守るルール

```
1. nonce はラウンドごとにランダム生成（再利用禁止）
2. commitment = hash(cardType + nonce) をローカルで生成（サーバーに cardType を送らない）
3. 相手の claimedOutcome を盲目的に信頼しない（Phase 3 以降: ZKP proof で検証）
4. 秘匿カードは ResultScreen でも非表示のまま
```

### Room ID の設計

```typescript
// 6文字英数字: 36^6 = 2,176,782,336 通り
// 同時接続 1000 Room でも衝突確率 < 0.00005%
function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
```

---

## 6. フロントエンド変更設計

### 新規ファイル

```
src/
├── services/
│   └── multiplayer-ws.ts       ← WebSocket クライアントサービス
├── hooks/
│   └── useMultiplayerGame.ts   ← マルチプレイ用ゲーム状態 hook
└── components/
    └── RoomScreen.tsx           ← Room ID 入力 + 対戦相手待ち画面
```

### `src/services/multiplayer-ws.ts` 設計

```typescript
export class MultiplayerWS {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Function> = new Map();

  connect(url: string): Promise<void>
  send(msg: ClientMsg): void
  on<T extends ServerMsg['type']>(type: T, handler: (msg: Extract<ServerMsg, {type: T}>) => void): void
  off(type: string): void
  disconnect(): void
  ping(): void  // 30秒ごとに呼び出して Render のスリープを防止
}
```

### `src/types/game.ts` への追加

```typescript
export type GameMode = 'solo' | 'multiplayer';
export type PlayerRole = 'player1' | 'player2';

// GameState への追加フィールド
interface GameState {
  // ... 既存フィールド ...
  gameMode: GameMode;
  playerRole: PlayerRole | null;    // multiplayer 時のみ
  roomId: string;                    // multiplayer 時のみ
  opponentName: string;
  opponentAddress: string;
  opponentCommitted: boolean;        // 相手がコミット済みか
  opponentReady: boolean;            // 相手が次ラウンド準備完了か
}
```

### `src/components/RoomScreen.tsx` 設計

```
[状態 1: Room ID 入力]
  OPERATIVE NAME フィールド
  ROOM ID フィールド (6文字 / ランダム生成ボタン)
  ⛓ ON-CHAIN MODE トグル
  [JOIN ROOM] ボタン

[状態 2: 対戦相手待ち]
  YOUR ROOM ID: ABC123 (コピーボタン)
  「Share this code with your opponent」
  ...アニメーション（点滅）...
  [CANCEL] ボタン

[状態 3: 接続完了]
  OPPONENT: {opponentName}
  ADDRESS: {short address}
  ゲームボードへ自動遷移
```

### `src/App.tsx` への追加

```typescript
// 新規ハンドラ
function handleStartMultiplayer(name: string, roomId: string, onChainMode: boolean) {
  dispatch({ type: 'SET_PLAYER_NAME', name });
  dispatch({ type: 'START_MULTIPLAYER', roomId, onChainMode });
}

// phase に 'room-select' と 'room-waiting' を追加
```

### useGameState への追加アクション

```typescript
type Action =
  // ... 既存 ...
  | { type: 'START_MULTIPLAYER'; roomId: string; onChainMode: boolean }
  | { type: 'OPPONENT_JOINED'; name: string; address: string; role: PlayerRole }
  | { type: 'OPPONENT_COMMITTED'; mode: CardMode }
  | { type: 'OPPONENT_DECISION'; decision: BattleDecision }
  | { type: 'OPPONENT_REVEALED_PUBLIC'; cardType: CardType }
  | { type: 'OPPONENT_REVEALED_HIDDEN'; claimedOutcome: 'PWins' | 'OWins' | 'Draw' }
  | { type: 'OPPONENT_LEFT' }
  | { type: 'OPPONENT_READY_NEXT' };
```

---

## 7. Render デプロイ設計

### サービス設定

| 項目 | 値 |
|---|---|
| サービス種別 | **Web Service**（Static Site ではない — WS upgrade が必要） |
| Runtime | Node.js 20 |
| Root Directory | `server/` |
| Build Command | `npm install && npm run build` |
| Start Command | `node dist/index.js` |
| Port | `process.env.PORT`（Render が自動注入） |
| Plan | Free（制約あり → 下記参照） |
| Health Check Path | `/health` |

### Free プランの制約と対策

| 制約 | 内容 | 対策 |
|---|---|---|
| 非アクティブで 15 分後にスリープ | リクエストがないとインスタンスが停止 | クライアントから 30 秒ごとに PING を送信 |
| コールドスタート時間 | スリープ後の初回接続で 30〜60 秒かかる | UI に「Connecting to server...」スピナー表示 |
| 月間 750 時間の無料枠 | 1インスタンスなら 31 日間常時稼働可能 | 問題なし |
| 永続ストレージなし | Room 状態はメモリのみ | 設計通り（再起動でリセット） |

### `server/src/index.ts` の骨格

```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { handleConnection } from './relay';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Health check — Render のロードバランサー用
app.get('/health', (_, res) => res.json({ ok: true }));

// CORS — フロントエンドのオリジンを許可
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN ?? '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  next();
});

wss.on('connection', (ws, req) => {
  handleConnection(ws, req);
});

// WebSocket upgrade を Express から委譲
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req);
  });
});

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  console.log(`WS server running on :${PORT}`);
});
```

### 環境変数

| 変数 | 説明 | 設定場所 |
|---|---|---|
| `PORT` | Render が自動注入 | Render 側で自動 |
| `FRONTEND_ORIGIN` | フロントエンドの URL (CORS) | Render Dashboard → Environment |
| `ROOM_TIMEOUT_MS` | Room のタイムアウト（デフォルト 1800000 = 30分） | Render Dashboard |

### フロントエンド側の環境変数

```
# .env.local (開発)
VITE_WS_URL=ws://localhost:3001

# Render / 本番
VITE_WS_URL=wss://your-app.onrender.com
```

### `server/package.json`

```json
{
  "name": "losers-gambit-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/ws": "^8.5.13",
    "tsx": "^4.19.0",
    "typescript": "^5.7.2"
  }
}
```

---

## 8. 実装フェーズ計画

### Phase 2.0 — サーバー基盤（WebSocket + Render）

```
[ ] server/ ディレクトリ作成
[ ] Express + ws セットアップ
[ ] Room 管理 (rooms.ts) 実装
[ ] メッセージ中継 (relay.ts) 実装
[ ] Render へデプロイ・動作確認
[ ] PING/PONG keep-alive 実装
```

### Phase 2.1 — フロントエンド: Room 接続

```
[ ] multiplayer-ws.ts 実装
[ ] RoomScreen.tsx 実装（Room ID 入力・待機）
[ ] ModeSelectScreen に「MULTI-SYNC」ボタンを有効化
[ ] GameState に multiplayer フィールド追加
[ ] useMultiplayerGame hook 実装
```

### Phase 2.2 — フロントエンド: ゲームフロー接続

```
[ ] COMMIT_MOVE を WS 経由で送信
[ ] 相手の OPPONENT_COMMITTED を受け取って UI 更新
[ ] PLAYER_DECISION の WS 連携
[ ] REVEAL_PUBLIC / REVEAL_HIDDEN の WS 連携
[ ] READY_NEXT_ROUND の WS 連携
[ ] OPPONENT_LEFT 時の処理（再接続 UI）
```

### Phase 2.3 — オンチェーンモード × マルチプレイ

```
[ ] ONCHAIN_TX メッセージの送受信
[ ] ResultScreen の On-Chain パネルに相手の TX ハッシュも表示
[ ] 両者が janken.compact の同一インスタンスに参加する設計
```

### Phase 3 — Midnight 本番統合（別途）

```
[ ] ダミー → 実 Midnight TX に置き換え
[ ] ZKP proof の生成・検証
[ ] yttm.compact の shielded mintReward 連携
```

---

## 9. ゲームフロー状態機械

### 9.1 クライアント側 Phase 一覧

| Phase | 説明 | 次の Phase へのトリガー |
|---|---|---|
| `onboarding` | ウォレット接続 | SET_WALLET → `mode-select` |
| `mode-select` | Solo/Multi 選択 | START_MULTI → `room-select` |
| `room-select` | Room ID 入力 | JOIN_ROOM 送信 → `room-waiting` |
| `room-waiting` | 対戦相手待ち | GAME_STARTED 受信 → `card-select` |
| `card-select` | カード + モード選択 | COMMIT_MOVE → `waiting-opponent-commit` |
| `waiting-opponent-commit` | 相手のコミット待ち | BOTH_COMMITTED 受信 → 分岐 |
| `player-battle-fold` | 自分(公開)が Battle/Fold 選択 | PLAYER_DECISION → 分岐 |
| `waiting-opponent-decision` | 相手の Battle/Fold 待ち | OPPONENT_DECISION 受信 → 分岐 |
| `zkp-generating` | ZKP 生成アニメーション | ZKP_DONE → `revealing` |
| `revealing` | カード開示 + 勝敗解決 | 両者開示完了 → `round-result` |
| `round-result` | ラウンド結果表示 | NEXT_ROUND → `waiting-next-round` or `game-over` |
| `waiting-next-round` | 相手の次ラウンド準備待ち | OPPONENT_READY_NEXT → `card-select` |
| `game-over` | 総合結果 + 報酬 | RETURN_TO_LOBBY → `mode-select` |

### 9.2 BOTH_COMMITTED 後の Phase 分岐

```
BOTH_COMMITTED { round } を受信
  ↓ state.selectedMode (myMode) と state.opponentMode (oppMode) を参照

  myMode=public,  oppMode=hidden   → player-battle-fold
  myMode=hidden,  oppMode=public   → waiting-opponent-decision
  myMode=public,  oppMode=public   → revealing
  myMode=hidden,  oppMode=hidden   → zkp-generating
```

> **同期保証:** TCP 順序により OPPONENT_COMMITTED は必ず BOTH_COMMITTED より先に届く。
> BOTH_COMMITTED 受信時点で state.opponentMode は確実に設定済み。

### 9.3 サーバー側 Round 状態

```typescript
interface RoundState {
  bothCommittedSent: boolean;   // BOTH_COMMITTED の二重送信防止
  readyNext: [boolean, boolean]; // 両者 READY_NEXT_ROUND 済みか
  round: number;                 // 0-indexed。両者 readyNext 完了で +1
}
```

---

## 10. シナリオ別シーケンス図

### 10.1 ゲーム開始フロー

```
Player A                      Server                       Player B
  │                             │                             │
  │── JOIN_ROOM(roomId, A) ───►│                             │
  │◄── ROOM_JOINED             │                             │
  │    (player1, waiting=true) │                             │
  │                             │◄─── JOIN_ROOM(roomId, B) ──│
  │                             │──── ROOM_JOINED ───────────►│
  │                             │     (player2, waiting=false)│
  │◄── GAME_STARTED ───────────│                             │
  │    (player1, opp=B)        │──── GAME_STARTED ──────────►│
  │                             │     (player2, opp=A)        │
  │ [card-select phase]         │              [card-select phase]
```

### 10.2 ラウンド開始（コミットフロー）

両者が独立してカード選択・提出。先後の順序は問わない。

```
Player A (先にコミット)        Server              Player B (後にコミット)
  │                             │                             │
  │── COMMIT_MOVE(hidden) ────►│                             │
  │[waiting-opponent-commit]    │── OPPONENT_COMMITTED ──────►│
  │                             │   (mode=hidden)             │
  │                             │◄─── COMMIT_MOVE(public) ───│
  │◄── OPPONENT_COMMITTED ─────│              [waiting-opp-commit]
  │    (mode=public)            │                             │
  │◄── BOTH_COMMITTED(round=0) │─── BOTH_COMMITTED(round=0) ►│
  │[→ waiting-opp-decision]    │         [→ player-battle-fold]
```

### 10.3 Decision Phase フロー

**ケース: A=秘匿, B=公開 → B が Battle/Fold を選択**

```
Player A (hidden)              Server              Player B (public)
[waiting-opp-decision]                             [player-battle-fold]
  │                             │◄─── PLAYER_DECISION(battle)│
  │◄── OPPONENT_DECISION ───── │                             │
  │    (battle)                 │                             │
  │[→ zkp-generating]           │                   [→ revealing]
```

**ケース: B が Fold を選択**

```
Player A (hidden)              Server              Player B (public)
[waiting-opp-decision]                             [player-battle-fold]
  │                             │◄─── PLAYER_DECISION(fold) ─│
  │◄── OPPONENT_DECISION ───── │                             │
  │    (fold)                   │               [→ round-result(folded)]
  │[→ round-result(folded)]     │
```

### 10.4 Reveal フロー — 両公開 (Public vs Public)

```
Player A (public)              Server              Player B (public)
[revealing]                                        [revealing]
  │── REVEAL_PUBLIC(rock) ────►│                             │
  │                             │── OPPONENT_REVEALED_PUBLIC ►│
  │                             │   (cardType=rock)           │
  │                             │◄─── REVEAL_PUBLIC(scissors)│
  │◄── OPPONENT_REVEALED_PUBLIC│                             │
  │    (cardType=scissors)      │                             │
  │[→ resolveWithOpponentCard]  │     [→ resolveWithOpponentCard]
  │[→ round-result]             │                 [→ round-result]
```

### 10.5 Reveal フロー — 秘匿(A) vs 公開(B): シーケンシャルリビール

```
Player A (hidden)              Server              Player B (public)
[zkp-generating]                                   [revealing]
  │                             │◄─── REVEAL_PUBLIC(rock) ───│
  │◄── OPPONENT_REVEALED_PUBLIC│                             │
  │    (cardType=rock)          │                             │
  │ ⚠ ZKP 中のため pending     │                             │
  │   に格納して待機            │                             │
  │                             │                             │
  ZKP 完了                      │                             │
  │[→ revealing]                │                             │
  │                             │                             │
  pending 検出:                  │                             │
  resolveWinner(scissors, rock) │                             │
  claimedOutcome = 'PWins'      │                             │
  │── REVEAL_HIDDEN ──────────►│                             │
  │   (PWins, proof=scissors)   │── OPPONENT_REVEALED_HIDDEN ►│
  │[→ round-result: A wins]     │   (claimedOutcome=PWins)    │
                                                [→ round-result: A(=opponent) wins = B loses]
```

> **ZKP タイミング保証:**
> - B の REVEAL_PUBLIC は A の ZKP 中に届く可能性がある
> - `opponentPublicCardPending` に格納し、ZKP 完了 → `revealing` 移行時に処理
> - A が先に revealing に入った場合は WS ハンドラ内でリアルタイム処理

### 10.6 Reveal フロー — 両秘匿 (Hidden vs Hidden)

```
Player A (hidden)              Server              Player B (hidden)
[zkp-generating → revealing]              [zkp-generating → revealing]
  │── REVEAL_HIDDEN ──────────►│                             │
  │   (claimedOutcome=*, proof=rock)                         │
  │                             │◄─── REVEAL_HIDDEN ─────────│
  │                             │     (claimedOutcome=*, proof=scissors)
  │                             │── OPPONENT_REVEALED_HIDDEN ►│
  │◄── OPPONENT_REVEALED_HIDDEN│     (proof=scissors)        │
  │    (proof=scissors)         │                             │
  │[resolveWithProof(rock,scissors)]  [resolveWithProof(scissors,rock)]
  │[→ round-result: A wins]     │         [→ round-result: B loses]
```

> **Phase 2 (ダミー):** `proof` に実際のカード種を含める。受信側は `proof` で解決。  
> **Phase 3:** `proof` は ZKP 証明に置き換え。サーバー経由でカード種は漏洩しない。  
> **claimedOutcome は Phase 2 では 'Draw' のプレースホルダー**（proof を使うため不使用）。

### 10.7 ラウンド終了 → 次ラウンド開始フロー

```
Player A                       Server                       Player B
[round-result]                                            [round-result]
  │── READY_NEXT_ROUND ───────►│                             │
  │[→ waiting-next-round]      │── OPPONENT_READY_NEXT ──────►│
  │                             │                             │
  │                             │◄─── READY_NEXT_ROUND ───────│
  │◄── OPPONENT_READY_NEXT ────│     [A がすでに waiting なら]│
  │[→ card-select (round++)]   │──── OPPONENT_READY_NEXT ────►│
  │                             │     (B が waiting の場合)    │
                                                 [→ card-select (round++)]
```

> **サーバー処理:** 両者 READY_NEXT_ROUND 完了時に `room.round++`、`bothCommittedSent=false` リセット。

### 10.8 ゲーム終了フロー

```
Player A                       Server                       Player B
[round-result (3rd round)]                    [round-result (3rd round)]
  │── READY_NEXT_ROUND ───────►│                             │
  │                             │── OPPONENT_READY_NEXT ──────►│
  │                             │◄─── READY_NEXT_ROUND ───────│
  │◄── OPPONENT_READY_NEXT ────│                             │
  │                             │                             │
  │ currentRound >= totalRounds │         currentRound >= totalRounds
  │[→ game-over]                │                   [→ game-over]
  │                             │                             │
  WS disconnect()               │                   WS disconnect()
```

> `OPPONENT_LEFT` が game-over フェーズ中に届いても無視する（正常切断のため）。

---

## 11. 同期保証と競合状態対策

### 11.1 TCP 順序保証

同一 WebSocket 接続上のメッセージは TCP によって順序が保証される。

| 保証される順序 | 理由 |
|---|---|
| `OPPONENT_COMMITTED` → `BOTH_COMMITTED` | サーバーが同一接続へ順番に送信 |
| `GAME_STARTED` → ゲーム開始 | JOIN_ROOM 完了後に送信 |
| `OPPONENT_READY_NEXT` の配信順 | TCP 保証 |

### 11.2 ZKP 競合状態 (opponentPublicCardPending)

**問題:** 公開プレイヤーが Reveal を送信した時点で、秘匿プレイヤーはまだ ZKP 生成中の場合がある。

**対策:**
```
state.opponentPublicCardPending: CardType | null

OPPONENT_REVEALED_PUBLIC を受信:
  phase = 'revealing' かつ myMode = 'hidden'
    → WS ハンドラ内で REVEAL_HIDDEN 送信 → dispatch で解決
  phase ≠ 'revealing' (ZKP 中など)
    → opponentPublicCardPending に格納

phase → 'revealing' 遷移時 (useMultiplayerSync outbound effect):
  myMode = 'hidden' かつ oppMode = 'public' かつ pending ≠ null
    → REVEAL_HIDDEN 送信 → dispatch OPPONENT_REVEALED_PUBLIC で解決
  pending = null
    → OPPONENT_REVEALED_PUBLIC の到着を待機（WS ハンドラが処理）
```

### 11.3 useMultiplayerSync の stateRef パターン

WS メッセージハンドラはクロージャで古い state を参照する問題がある。

```typescript
const stateRef = useRef<GameState>(state);
stateRef.current = state; // 毎レンダーで更新

// WS ハンドラ内: stateRef.current で最新 state を参照
```

### 11.4 OPPONENT_LEFT の安全処理

```
phase = 'game-over' で OPPONENT_LEFT を受信
  → 無視（正常切断）

phase ≠ 'game-over' で OPPONENT_LEFT を受信
  → mode-select に戻る（相手の異常切断）
```

### 11.5 ラウンド状態リセット

各ラウンド開始時に以下をリセットする:

| 項目 | リセット契機 |
|---|---|
| `selectedCard`, `selectedMode` | `NEXT_ROUND` または `OPPONENT_READY_NEXT` |
| `opponentMode` | 同上 |
| `opponentReady` | 同上 |
| `opponentPublicCardPending` | `BOTH_COMMITTED` 受信時（フェーズ移行時） |
| サーバー: `committed`, `mode` | `READY_NEXT_ROUND` 受信時 |
| サーバー: `bothCommittedSent` | 両者 `READY_NEXT_ROUND` 完了時 |

---

## 付録: WebSocket URL 設計

| 環境 | URL |
|---|---|
| ローカル開発 | `ws://localhost:3001` |
| Render (本番) | `wss://losers-gambit-ws.onrender.com` |

接続確立シーケンス:
```
Client                         Server
  │ WS connect                   │
  │ ──────────────────────────► │
  │                   PONG       │ ← サーバーが接続確認 PONG を送信
  │ ◄────────────────────────── │
  │ JOIN_ROOM { roomId, ... }    │
  │ ──────────────────────────► │
  │           ROOM_JOINED        │
  │ ◄────────────────────────── │
```
