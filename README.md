# feed2discord

RSSフィードの新着情報を取得し、Discord Webhookを使用してDiscordチャンネルへ自動転送するGoogle Apps Script (GAS) プロジェクトです。
TypeScript と clasp を用いたローカル開発環境でビルドおよび管理を行います。

## プロジェクト構成
- [src/](./src): TypeScript ソースコード
  - [src/code.ts](./src/code.ts): メイン処理（エントリーポイントは `main` 関数）
  - [src/config.ts](./src/config.ts): RSSフィードとDiscord Webhookのマッピングなどの設定
  - [src/util.ts](./src/util.ts): 送信処理やエラーハンドリングなどのユーティリティ
- [dist/](./dist): コンパイル後のJavaScript出力先（clasp を介してGASへデプロイされます）

## 前提条件
- Node.js (v18以降を推奨)
- npm
- Googleアカウント（Google Apps Scriptデプロイ用）
- 送信先DiscordチャンネルのWebhook URL

## セットアップ手順

### 1. 依存関係のインストール
プロジェクトのルートディレクトリで以下のコマンドを実行します。
```bash
npm install
```

### 2. clasp へのログイン
Googleアカウントで clasp にログインします。
```bash
npx clasp login
```

### 3. スクリプトの紐付けおよび設定ファイルの作成
1. [Google Apps Script](https://script.google.com/) で新規スクリプトを作成するか、既存のスクリプトIDを用意します。
2. `.clasp.json.example` をコピーして `.clasp.json` を作成し、`scriptId` に対象のスクリプトIDを設定します。
   ```json
   {
     "scriptId": "YOUR_SCRIPT_ID_HERE",
     "rootDir": "dist"
   }
   ```
3. `src/config.ts.example` をコピーして `src/config.ts` を作成します。

### 4. 設定の編集
`src/config.ts` を編集し、動作設定を行います。
取得対象のRSSフィードのURLと、転送先のDiscord Webhook URLを `LINK_MAP` に設定します。
なお、最大再試行回数や送信間遅延時間、Discordへの送信データ構造等のパラメータも `src/config.ts` 内で調整可能です。

```typescript
const LINK_MAP: Record<string, string> = {
    "https://example.com/rss.xml": "https://discord.com/api/webhooks/...",
};
```

## ビルドおよびデプロイ

### TypeScriptのビルド
TypeScriptファイルをビルドし、[dist/](./dist) にコンパイル後のJavaScriptを出力します。
```bash
npm run build
```

### GASへのデプロイ
ビルドと同時に、コンパイルされたコードをGoogle Apps Scriptへプッシュします。
```bash
npm run push
```

## 運用方法
1. Google Apps ScriptのWeb管理画面を開きます。
2. **トリガー** 設定画面から、`main` 関数を一定間隔（例: 5分おき、1時間おき等）で実行する時間手動型トリガーを追加します。
3. 初回実行時は、過去の投稿がすべてDiscordに再送されるのを防ぐため、最新のアイテムを自動的に既読状態（スクリプトプロパティへの保存）にして処理を終了します。2回目以降の実行から、新しい差分投稿のみが転送されるようになります。
