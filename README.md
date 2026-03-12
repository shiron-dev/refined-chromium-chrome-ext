# Chrome Extension Template (React + TypeScript)

Chrome Extension (Manifest V3) を React + TypeScript で作るためのテンプレートです。

このテンプレートには、最小の実装例として以下を含みます。

- `background`:
  - 拡張機能アイコンクリック時に content script へメッセージ送信
- `content script`:
  - メッセージ受信でページのハイライト ON/OFF を切り替え
  - 画面右下に小さなステータスバナーを表示

## セットアップ

```bash
pnpm install
pnpm build
```

開発時:

```bash
pnpm dev
```

## Chrome への読み込み

1. `pnpm build` を実行
2. Chrome で `chrome://extensions` を開く
3. 「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」で `build/client` を指定

## テンプレート利用時に変更する項目

- `public/manifest.json`
  - `name`
  - `description`
  - `host_permissions`
  - `content_scripts[].matches`
  - `action.default_title`
- `src/content_scripts/main.tsx`
  - 対象サイト向けの DOM 処理
- `src/backgrounds/background.ts`
  - メッセージ種別やトリガー
- アイコン (`public/icon*.png`)

## GitHub で Template Repository にする

GitHub 上でこのリポジトリを開き、
`Settings` -> `General` -> `Template repository` を ON にしてください。

その後 `Use this template` から新規リポジトリを作成できます。
