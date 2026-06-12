function main(): void {
    for (const feed of FEEDS) {
        try {
            checkRssFeed(feed);
        } catch (error: any) {
            Logger.log(`フィード [${feed.url}] の処理中に例外が発生しました: ${error.message}`);
        }
    }
}

function checkRssFeed(feed: FeedConfig): void {
    const historyManager = new FeedHistoryManager(feed.id, feed.url);

    // RSS/Atom フィードを取得し、XML を解析します
    const response = UrlFetchApp.fetch(feed.url);
    const feedItems = parseFeed(response.getContentText());

    // 履歴管理の初期化（マイグレーションおよび新規フィード対応）
    historyManager.initialize(feedItems);

    // 新規フィードの場合は初回の重複送信を防ぐためにここで終了する
    if (historyManager.isNewFeed()) {
        return;
    }

    const unprocessedItems: FeedItem[] = [];

    for (const item of feedItems) {
        if (!item.guid) {
            Logger.log(`警告: アイテムに識別子(guidまたはlink)が存在しないため、スキップします。`);
            continue;
        }

        // 過去50件の GUID に含まれていなければ新しい配信とみなす
        if (!historyManager.isProcessed(item.guid)) {
            unprocessedItems.push(item);
        }
    }

    // 新しい配信がない場合は return
    if (unprocessedItems.length < 1) return;

    // 配列の要素の順番を破壊的に反転 (古い item から読み込まれるようにするため)
    unprocessedItems.reverse();

    for (const item of unprocessedItems) {
        if (!item.link) {
            Logger.log(`警告: 送信先URLが空のため、送信をスキップします。GUID: ${item.guid}`);
            // スキップしたアイテムも既読リストに加える
            historyManager.addGuid(item.guid);
            historyManager.save();
            continue;
        }
        Logger.log(item.link);
        const success = sendDiscord(feed.webhookUrl, item.link);
        
        if (success) {
            // 送信完了後にそのアイテムの GUID を追加して保存
            historyManager.addGuid(item.guid);
            historyManager.save();
        } else {
            // 送信失敗時は以降のアイテム処理を中断し、次回実行時に再試行する
            Logger.log(`警告: 送信に失敗したため、フィード [${feed.url}] の以降の処理を中断します。`);
            break;
        }
        
        // Discord レート制限対策のため待機
        Utilities.sleep(RETRY_DELAY_MS);
    }
}
