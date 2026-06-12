function sendDiscord(webhookUrl: string, messageContent: string): boolean {
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload(messageContent)),
        muteHttpExceptions: true
    };

    for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
        try {
            const response = UrlFetchApp.fetch(webhookUrl, options);
            const responseCode = response.getResponseCode();

            if (responseCode === 204) {
                Logger.log('Discordへのメッセージ送信が成功しました (Code 204)。');
                return true; // 成功したら true を返す
            } else if (responseCode === 400 || responseCode === 401 || responseCode === 404) {
                Logger.log(`Discordへのメッセージ送信が失敗しました（致命的エラー ${responseCode}）。再送を行わず終了します。内容: ${response.getContentText()}`);
                return false; // 致命的エラーは再送しても解決しないため即座に終了
            } else {
                Logger.log(`Discordへのメッセージ送信が失敗しました。レスポンスコード: ${responseCode}, 内容: ${response.getContentText()}`);
            }
        } catch (error: any) {
            Logger.log(`Discordへのメッセージ送信中に例外が発生しました: ${error.message}`);
        }

        if (retryCount < MAX_RETRIES) {
            Logger.log(`${RETRY_DELAY_MS / 1000}秒後に再送を試みます... (試行回数: ${retryCount + 1}/${MAX_RETRIES})`);
            Utilities.sleep(RETRY_DELAY_MS);
        } else {
            Logger.log(`最大再試行回数 (${MAX_RETRIES}回) に達したため、再送を中止します。`);
        }
    }
    return false;
}
