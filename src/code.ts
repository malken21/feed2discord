function main(): void {
    for (const feed of FEEDS) {
        try {
            checkRssFeed(feed);
        } catch (error: any) {
            Logger.log(`フィード [${feed.url}] の処理中に例外が発生しました: ${error.message}`);
        }
    }
}

// XML要素から安全にテキストを取得するヘルパー関数 (名前空間対応)
function getElementTextSafe(
    xmlElement: GoogleAppsScript.XML_Service.Element | null, 
    childElementName: string, 
    xmlNamespace?: GoogleAppsScript.XML_Service.Namespace
): string {
    if (!xmlElement) return '';
    const childElement = xmlNamespace ? xmlElement.getChild(childElementName, xmlNamespace) : xmlElement.getChild(childElementName);
    return childElement ? childElement.getText().trim() : '';
}

function checkRssFeed(feed: FeedConfig): void {
    // スクリプトプロパティから前回読み取った過去の GUID リストを取得
    const scriptProperties = PropertiesService.getScriptProperties();
    const processedGuidsKey = `lastGuids-${feed.id}`;
    let processedGuidsJson = scriptProperties.getProperty(processedGuidsKey);
    let processedGuids: string[] = [];
    let isNewFeed = false;

    // 新キーが存在しない場合のマイグレーション処理
    if (!processedGuidsJson) {
        const legacyGuidsKey = `lastGuids-${feed.url}`;
        const legacyGuidsJson = scriptProperties.getProperty(legacyGuidsKey);

        if (legacyGuidsJson) {
            // lastGuids-${url} からの移行
            processedGuidsJson = legacyGuidsJson;
            scriptProperties.setProperty(processedGuidsKey, legacyGuidsJson);
            scriptProperties.deleteProperty(legacyGuidsKey);
        }
    }

    // RSS フィードを取得し、XML を解析します
    const response = UrlFetchApp.fetch(feed.url);
    const xmlDocument = XmlService.parse(response.getContentText());

    // ルート要素と名前空間の取得
    const rootElement = xmlDocument.getRootElement();
    const xmlNamespace = rootElement.getNamespace();

    // 各配信アイテムを処理します
    const channelElement = xmlNamespace ? rootElement.getChild('channel', xmlNamespace) : rootElement.getChild('channel');
    if (!channelElement) {
        Logger.log(`フィード [${feed.url}] に channel 要素が見つかりません。`);
        return;
    }
    const feedItems = xmlNamespace ? channelElement.getChildren('item', xmlNamespace) : channelElement.getChildren('item');

    if (processedGuidsJson) {
        try {
            processedGuids = JSON.parse(processedGuidsJson);
            if (!Array.isArray(processedGuids)) {
                processedGuids = [];
            }
        } catch (error) {
            processedGuids = [];
        }
    } else {
        // 既存 of 単一の lastGuid または lastTitle からの移行処理、もしくは新規登録時の初期化処理
        const legacyLastGuid = scriptProperties.getProperty(`lastGuid-${feed.url}`);
        const legacyLastTitle = !legacyLastGuid ? scriptProperties.getProperty(`lastTitle-${feed.url}`) : null;

        if (legacyLastGuid || legacyLastTitle) {
            let matchedIndex = -1;
            for (let index = 0; index < feedItems.length; index++) {
                const item = feedItems[index];
                const guid = getElementTextSafe(item, 'guid', xmlNamespace) || getElementTextSafe(item, 'link', xmlNamespace);
                const title = getElementTextSafe(item, 'title', xmlNamespace);
                if (legacyLastGuid && guid === legacyLastGuid) {
                    matchedIndex = index;
                    break;
                }
                if (legacyLastTitle && title && title === legacyLastTitle) {
                    matchedIndex = index;
                    break;
                }
            }

            if (matchedIndex !== -1) {
                // 保存されている古いアイテムから最後のアイテムまでの GUID を既読とする
                for (let index = matchedIndex; index < feedItems.length; index++) {
                    const item = feedItems[index];
                    const guid = getElementTextSafe(item, 'guid', xmlNamespace) || getElementTextSafe(item, 'link', xmlNamespace);
                    if (guid && processedGuids.indexOf(guid) === -1) {
                        processedGuids.push(guid);
                    }
                }
            } else {
                // 古いアイテムが見つからない場合は、すべての現在あるアイテムの GUID を既読とする
                for (let index = 0; index < feedItems.length; index++) {
                    const item = feedItems[index];
                    const guid = getElementTextSafe(item, 'guid', xmlNamespace) || getElementTextSafe(item, 'link', xmlNamespace);
                    if (guid && processedGuids.indexOf(guid) === -1) {
                        processedGuids.push(guid);
                    }
                }
            }
            
            // 旧プロパティの削除
            if (legacyLastGuid) {
                scriptProperties.deleteProperty(`lastGuid-${feed.url}`);
            }
            if (legacyLastTitle) {
                scriptProperties.deleteProperty(`lastTitle-${feed.url}`);
            }
        } else {
            // 新規登録時は、現在のフィードにあるすべてのアイテムを既読（初回重複送信防止）として終了する
            isNewFeed = true;
            for (let index = 0; index < feedItems.length; index++) {
                const item = feedItems[index];
                const guid = getElementTextSafe(item, 'guid', xmlNamespace) || getElementTextSafe(item, 'link', xmlNamespace);
                if (guid && processedGuids.indexOf(guid) === -1) {
                    processedGuids.push(guid);
                }
            }
        }

        // 最大50件に制限して保存
        if (processedGuids.length > 50) {
            processedGuids = processedGuids.slice(processedGuids.length - 50);
        }
        scriptProperties.setProperty(processedGuidsKey, JSON.stringify(processedGuids));

        if (isNewFeed) {
            return;
        }
    }

    interface RssItem {
        link: string;
        guid: string;
    }

    const unprocessedItems: RssItem[] = [];

    for (const item of feedItems) {
        const guid = getElementTextSafe(item, 'guid', xmlNamespace) || getElementTextSafe(item, 'link', xmlNamespace);
        const link = getElementTextSafe(item, 'link', xmlNamespace) || guid;

        if (!guid) {
            Logger.log(`警告: アイテムに識別子(guidまたはlink)が存在しないため、スキップします。`);
            continue;
        }

        // 過去50件の GUID に含まれていなければ新しい配信とみなす
        if (processedGuids.indexOf(guid) === -1) {
            unprocessedItems.push({
                link: link,
                guid: guid
            });
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
            processedGuids.push(item.guid);
            if (processedGuids.length > 50) {
                processedGuids = processedGuids.slice(processedGuids.length - 50);
            }
            scriptProperties.setProperty(processedGuidsKey, JSON.stringify(processedGuids));
            continue;
        }
        Logger.log(item.link);
        const success = sendDiscord(feed.webhookUrl, item.link);
        
        if (success) {
            // 送信完了後にそのアイテムの GUID を追加して保存
            processedGuids.push(item.guid);
            if (processedGuids.length > 50) {
                processedGuids = processedGuids.slice(processedGuids.length - 50);
            }
            scriptProperties.setProperty(processedGuidsKey, JSON.stringify(processedGuids));
        } else {
            // 送信失敗時は以降のアイテム処理を中断し、次回実行時に再試行する
            Logger.log(`警告: 送信に失敗したため、フィード [${feed.url}] の以降の処理を中断します。`);
            break;
        }
        
        // Discord レート制限対策のため待機
        Utilities.sleep(RETRY_DELAY_MS);
    }
}
