class FeedHistoryManager {
    private feedId: string;
    private feedUrl: string;
    private scriptProperties: GoogleAppsScript.Properties.Properties;
    private processedGuidsKey: string;
    private processedGuids: string[];
    private isNew: boolean = false;

    constructor(feedId: string, feedUrl: string) {
        this.feedId = feedId;
        this.feedUrl = feedUrl;
        this.scriptProperties = PropertiesService.getScriptProperties();
        this.processedGuidsKey = `lastGuids-${feedId}`;
        this.processedGuids = this.loadHistory();
    }

    private loadHistory(): string[] {
        let processedGuidsJson = this.scriptProperties.getProperty(this.processedGuidsKey);
        if (processedGuidsJson) {
            try {
                const parsed = JSON.parse(processedGuidsJson);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }

        // 新キーが存在しない場合のマイグレーション処理 (lastGuids-${url})
        const legacyGuidsKey = `lastGuids-${this.feedUrl}`;
        const legacyGuidsJson = this.scriptProperties.getProperty(legacyGuidsKey);
        if (legacyGuidsJson) {
            this.scriptProperties.setProperty(this.processedGuidsKey, legacyGuidsJson);
            this.scriptProperties.deleteProperty(legacyGuidsKey);
            try {
                const parsed = JSON.parse(legacyGuidsJson);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }

        // 履歴が存在しない（新規または単一キーの移行待ち）
        return [];
    }

    // 初回読み込み時のマイグレーションまたは新規登録時の初期化を行う
    public initialize(feedItems: FeedItem[]): void {
        // すでにロード済みの場合は何もしない
        if (this.scriptProperties.getProperty(this.processedGuidsKey)) {
            return;
        }
        if (this.processedGuids.length > 0) {
            return;
        }

        const legacyLastGuid = this.scriptProperties.getProperty(`lastGuid-${this.feedUrl}`);
        const legacyLastTitle = !legacyLastGuid ? this.scriptProperties.getProperty(`lastTitle-${this.feedUrl}`) : null;

        if (legacyLastGuid || legacyLastTitle) {
            let matchedIndex = -1;
            for (let index = 0; index < feedItems.length; index++) {
                const item = feedItems[index];
                if (legacyLastGuid && item.guid === legacyLastGuid) {
                    matchedIndex = index;
                    break;
                }
                if (legacyLastTitle && item.title && item.title === legacyLastTitle) {
                    matchedIndex = index;
                    break;
                }
            }

            if (matchedIndex !== -1) {
                for (let index = matchedIndex; index < feedItems.length; index++) {
                    const item = feedItems[index];
                    this.addGuid(item.guid);
                }
            } else {
                for (let index = 0; index < feedItems.length; index++) {
                    const item = feedItems[index];
                    this.addGuid(item.guid);
                }
            }

            if (legacyLastGuid) {
                this.scriptProperties.deleteProperty(`lastGuid-${this.feedUrl}`);
            }
            if (legacyLastTitle) {
                this.scriptProperties.deleteProperty(`lastTitle-${this.feedUrl}`);
            }
        } else {
            // 新規登録時の初期化処理（初回重複送信防止）
            this.isNew = true;
            for (let index = 0; index < feedItems.length; index++) {
                const item = feedItems[index];
                this.addGuid(item.guid);
            }
        }

        this.save();
    }

    public isNewFeed(): boolean {
        return this.isNew;
    }

    public isProcessed(guid: string): boolean {
        return this.processedGuids.indexOf(guid) !== -1;
    }

    public addGuid(guid: string): void {
        if (this.processedGuids.indexOf(guid) === -1) {
            this.processedGuids.push(guid);
            if (this.processedGuids.length > 50) {
                this.processedGuids = this.processedGuids.slice(this.processedGuids.length - 50);
            }
        }
    }

    public save(): void {
        this.scriptProperties.setProperty(this.processedGuidsKey, JSON.stringify(this.processedGuids));
    }
}
