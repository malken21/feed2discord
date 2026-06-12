interface FeedItem {
    guid: string;
    link: string;
    title: string;
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

function parseFeed(xmlString: string): FeedItem[] {
    const xmlDocument = XmlService.parse(xmlString);
    const rootElement = xmlDocument.getRootElement();
    const xmlNamespace = rootElement.getNamespace();
    const rootName = rootElement.getName();

    if (rootName === 'feed') {
        return parseAtomFeed(rootElement, xmlNamespace);
    } else {
        return parseRssFeed(rootElement, xmlNamespace);
    }
}

function parseAtomFeed(
    rootElement: GoogleAppsScript.XML_Service.Element, 
    xmlNamespace: GoogleAppsScript.XML_Service.Namespace
): FeedItem[] {
    const feedItems: FeedItem[] = [];
    const entryElements = xmlNamespace ? rootElement.getChildren('entry', xmlNamespace) : rootElement.getChildren('entry');

    for (const entry of entryElements) {
        const id = getElementTextSafe(entry, 'id', xmlNamespace);
        const title = getElementTextSafe(entry, 'title', xmlNamespace);
        
        // Atom では link 要素の href 属性に URL が格納される
        const linkElement = xmlNamespace ? entry.getChild('link', xmlNamespace) : entry.getChild('link');
        let link = '';
        if (linkElement) {
            const hrefAttr = linkElement.getAttribute('href');
            if (hrefAttr) {
                link = hrefAttr.getValue().trim();
            } else {
                link = linkElement.getText().trim();
            }
        }
        
        const guid = id || link;
        if (guid) {
            feedItems.push({
                guid: guid,
                link: link || guid,
                title: title
            });
        }
    }
    return feedItems;
}

function parseRssFeed(
    rootElement: GoogleAppsScript.XML_Service.Element, 
    xmlNamespace: GoogleAppsScript.XML_Service.Namespace
): FeedItem[] {
    const feedItems: FeedItem[] = [];
    const channelElement = xmlNamespace ? rootElement.getChild('channel', xmlNamespace) : rootElement.getChild('channel');
    
    if (!channelElement) {
        Logger.log(`フィードに channel 要素が見つかりません。`);
        return feedItems;
    }
    
    const itemElements = xmlNamespace ? channelElement.getChildren('item', xmlNamespace) : channelElement.getChildren('item');
    for (const item of itemElements) {
        const guid = getElementTextSafe(item, 'guid', xmlNamespace) || getElementTextSafe(item, 'link', xmlNamespace);
        const link = getElementTextSafe(item, 'link', xmlNamespace) || guid;
        const title = getElementTextSafe(item, 'title', xmlNamespace);
        if (guid) {
            feedItems.push({
                guid: guid,
                link: link,
                title: title
            });
        }
    }
    return feedItems;
}
