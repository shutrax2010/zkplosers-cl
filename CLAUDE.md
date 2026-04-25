# CLAUDE.md — Project Instructions

## Git / Commit ルール

**明示的に指示があるまでコミットしない。**

- ユーザーから「コミットして」「pushして」などの明示的な指示があった場合のみ `git commit` / `git push` を実行する。
- コード変更・ファイル生成後に自動でコミットしない。
- `git add` のみ行う場合も事前に確認する。

## プロジェクト概要

Midnight ブロックチェーン（ZKP）を活用した通信対戦型じゃんけんゲーム「Loser's Gambit」。

- **Tech Stack:** React + TypeScript + Vite + Tailwind CSS
- **Midnight MCP設定:** `.claude/settings.json` / `midnight-mcp-config.json`

## Midnight ネットワークポリシー

**Midnight は常に Preprod テストネットで運用する。Mainnet への移行は行わない。**

- デプロイ先: `preprod` 固定
- Lace Wallet 接続: `connector.connect('preprod')`
- VITE_MIDNIGHT_NETWORK=preprod
- Mainnet デプロイは本プロジェクトのスコープ外

## 現在の実装状況

- [x] シングルプレイモード（vs CPU）— 完全動作
- [x] オンボーディング（Mnemonic生成・Lace接続・Import）— bip39 実装済み
- [x] VP計算・カード勝敗ロジック（`src/logic/game-logic.ts`）
- [x] ZKP生成アニメーション（ダミー）
- [x] 秘匿カードは最後まで公開しない
- [x] マルチプレイモード（WebSocket リレーサーバー `server/`）— 実装済み
- [x] Render シングルサービスデプロイ（`https://zkplosers-cl.onrender.com`）
- [ ] 実際のMidnight ZKP証明・SDK連携（`src/services/midnight-dummy.ts` を置き換え）

## 仕様書・設計書

- `docs/spec.md` — ゲームルール・VP設計・デプロイ設定
- `docs/game-logic.md` — カード比較・VP計算・状態遷移の詳細ロジック
- `docs/multiplayer.md` — WebSocket プロトコル・通信状態マシン
- `docs/screens.md` — UI/UX・画面仕様
