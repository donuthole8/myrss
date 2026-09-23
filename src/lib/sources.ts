/**
 * RSS を案内していない (か、ページから辿れない) サービスの URL を、フィードの URL に置き換える。
 * どれも公式に配信されているフィードで、URL の形だけで決まるものに限る。
 * 返した URL が本当にフィードかは /api/discover が取って確かめる。
 */

/** GitHub のユーザー名の直下に来ても、ユーザーではないパス */
const GITHUB_RESERVED = new Set([
  "about", "blog", "collections", "customer-stories", "enterprise", "events", "explore",
  "features", "login", "marketplace", "new", "notifications", "orgs", "pricing", "pulls",
  "issues", "search", "settings", "sponsors", "topics", "trending",
]);

/** URL の形から分かるフィードの URL。該当しなければ空配列 */
export function feedsFor(url: URL): string[] {
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [first = "", second = ""] = parts;
  const enc = encodeURIComponent;

  switch (host) {
    case "github.com": {
      if (!first || GITHUB_RESERVED.has(first)) return [];
      if (!second) return [`https://github.com/${enc(first)}.atom`];
      const repo = `https://github.com/${enc(first)}/${enc(second.replace(/\.git$/, ""))}`;
      // リリースを切らずにタグだけ打つプロジェクトもあるので両方出す
      if (parts[2] === "commits") return [`${repo}/commits.atom`];
      return [`${repo}/releases.atom`, `${repo}/tags.atom`];
    }
    case "youtube.com": {
      const playlist = url.searchParams.get("list");
      if (playlist) return [`https://www.youtube.com/feeds/videos.xml?playlist_id=${enc(playlist)}`];
      if (first === "channel" && second) {
        return [`https://www.youtube.com/feeds/videos.xml?channel_id=${enc(second)}`];
      }
      // @handle はページを取ってチャンネルIDを探す (channelIdFromPage)
      return [];
    }
    case "reddit.com":
      if ((first === "r" || first === "user" || first === "u") && second) {
        return [`https://www.reddit.com/${first === "u" ? "user" : first}/${enc(second)}/.rss`];
      }
      return [];
    case "bsky.app":
      if (first === "profile" && second) return [`https://bsky.app/profile/${enc(second)}/rss`];
      return [];
    case "note.com":
      if (first && !second) return [`https://note.com/${enc(first)}/rss`];
      if (first && second === "m" && parts[2]) {
        return [`https://note.com/${enc(first)}/m/${enc(parts[2])}/rss`];
      }
      return [];
    case "zenn.dev":
      if (first === "topics" && second) return [`https://zenn.dev/topics/${enc(second)}/feed`];
      if (first === "p" && second) return [`https://zenn.dev/p/${enc(second)}/feed`];
      if (first && !second) return [`https://zenn.dev/${enc(first)}/feed`];
      return [];
    case "qiita.com":
      if (first === "tags" && second) return [`https://qiita.com/tags/${enc(second)}/feed`];
      if (first === "organizations" && second) {
        return [`https://qiita.com/organizations/${enc(second)}/activities.atom`];
      }
      if (first && !second) return [`https://qiita.com/${enc(first)}/feed`];
      return [];
    case "medium.com":
      // @user (個人) と publication 名のどちらも /feed/ の後ろにそのまま付ける
      if (/^@?[\w.-]+$/.test(first)) return [`https://medium.com/feed/${first}`];
      return [];
    case "dev.to":
      if (first && !second) return [`https://dev.to/feed/${enc(first)}`];
      return [];
    case "speakerdeck.com":
      if (first && !second) return [`https://speakerdeck.com/${enc(first)}.atom`];
      return [];
  }

  // Mastodon など ActivityPub 系は、どのサーバーでも /@user に .rss を付ければ取れる
  if (/^@[\w.-]+$/.test(first) && !second) {
    return [`${url.origin}/${first}.rss`];
  }
  return [];
}

/** YouTube の @handle / c/ / user/ のページから、チャンネルIDを抜いてフィードにする */
export function channelFeedFromPage(url: URL, html: string): string | null {
  if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
  const id =
    /<meta\s+itemprop=["']channelId["']\s+content=["'](UC[\w-]{22})["']/i.exec(html)?.[1] ??
    /"(?:externalId|channelId|browseId)":"(UC[\w-]{22})"/.exec(html)?.[1];
  return id ? `https://www.youtube.com/feeds/videos.xml?channel_id=${id}` : null;
}

/** 入力欄の下に出す、対応サービスの一覧 */
export const SUPPORTED_SERVICES = [
  "YouTube",
  "GitHub",
  "Reddit",
  "Bluesky",
  "Mastodon",
  "note",
  "Zenn",
  "Qiita",
  "Medium",
  "dev.to",
  "Speaker Deck",
];
