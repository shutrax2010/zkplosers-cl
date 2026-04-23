# CLAUDE.md — Project Instructions

## Git / Commit ルール

**明示的に指示があるまでコミットしない。**

- ユーザーから「コミットして」「pushして」などの明示的な指示があった場合のみ `git commit` / `git push` を実行する。
- コード変更・ファイル生成後に自動でコミットしない。
- `git add` のみ行う場合も事前に確認する。

## プロジェクト概要

Midnight ブロックチェーン（ZKP）を活用した通信対戦型じゃんけんゲーム「Loser's Gambit」。

- **Tech Stack:** React + TypeScript + Vite + Tailwind CSS
- **仕様書:** `spec.md`（ゲームルール・VP設計・対戦フロー）
- **画面仕様:** `screens.md`（UI/UX・画面遷移）
- **Midnight MCP設定:** `.claude/settings.json` / `midnight-mcp-config.json`

## 現在の実装状況

- [x] シングルプレイモード（vs CPU）— 完全動作
- [x] オンボーディング（Mnemonic生成・Lace接続・Import）— ダミー実装
- [x] VP計算・カード勝敗ロジック（`src/logic/game-logic.ts`）
- [x] ZKP生成アニメーション（ダミー）
- [x] 秘匿カードは最後まで公開しない
- [ ] マルチプレイモード（WebSocket）— 未実装
- [ ] 実際のMidnight SDK連携（`src/services/midnight-dummy.ts` を置き換え）
