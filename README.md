# feed2discord

RSSおよびAtomフィードの新着情報を取得し、Discord Webhookを使用してDiscordチャンネルへ自動転送するGoogle Apps Script (GAS) プロジェクト。

## プロジェクト構成

| パス | 説明 |
| :--- | :--- |
| [src/code.ts](./src/code.ts) | エントリーポイント（`main` 関数）およびフィード処理ループ |
| [src/config.ts](./src/config.ts) | フィード配信元・転送先Webhook等の各種設定 |
| [src/history.ts](./src/history.ts) | スクリプトプロパティを用いた既読履歴の管理（重複送信防止） |
| [src/parser.ts](./src/parser.ts) | RSS / AtomフィードのXML解析処理 |
| [src/util.ts](./src/util.ts) | DiscordへのWebhook送信処理（再試行・待機処理を含む） |
| `dist/` | コンパイル後のJavaScript出力ディレクトリ（GASデプロイ対象） |

## 前提条件

- Node.js (v18以降推奨)
- npm
- clasp (Google Apps Script CLI)

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. claspへのログイン
```bash
npx clasp login
```

### 3. 設定ファイルの作成
1. `.clasp.json.example` をコピーして `.clasp.json` を作成し、`scriptId` に対象のスクリプトIDを設定。
2. `src/config.ts.example` をコピーして `src/config.ts` を作成。

### 4. 配信設定の編集
`src/config.ts` の `FEEDS` 配列に対象フィードとDiscord Webhookの対応を設定する。

```typescript
const FEEDS: FeedConfig[] = [
    {
        id: "example_feed",
        url: "https://example.com/feed.xml",
        webhookUrl: "https://discord.com/api/webhooks/..."
    }
];
```

## ビルドおよびデプロイ

### TypeScriptのビルド
```bash
npm run build
```

### GASへのデプロイ
```bash
npm run push
```

## 運用方法

1. Google Apps ScriptのWeb管理画面にて、`main` 関数を一定間隔（例: 5分～1時間ごと）で実行する時間手動型トリガーを追加。
2. 初回実行時：過去の投稿の重複送信を防ぐため、全アイテムを既読状態（スクリプトプロパティ）に記録して終了。
3. 2回目以降：新規に検知したアイテムのみをDiscordへ転送。
