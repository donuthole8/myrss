import type { Feed } from "./types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function outline(feed: Feed): string {
  return (
    `<outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}"` +
    ` xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl)}"/>`
  );
}

export function toOpml(feeds: Feed[], folders: string[]): string {
  const grouped = new Map<string, Feed[]>();
  for (const feed of feeds) {
    const key = feed.folder || "";
    grouped.set(key, [...(grouped.get(key) ?? []), feed]);
  }

  const body: string[] = [];
  for (const folder of folders) {
    const items = grouped.get(folder);
    if (!items?.length) continue;
    body.push(
      `    <outline text="${escapeXml(folder)}" title="${escapeXml(folder)}">`,
      ...items.map((f) => `      ${outline(f)}`),
      `    </outline>`,
    );
  }
  for (const f of grouped.get("") ?? []) body.push(`    ${outline(f)}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Feedly Clone subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${body.join("\n")}
  </body>
</opml>
`;
}

export type ImportedFeed = { url: string; title: string; folder: string };

/** OPML から購読リストを取り出す。ブラウザの DOMParser を使う */
export function fromOpml(xml: string): ImportedFeed[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("OPMLを解析できませんでした");
  }

  const found: ImportedFeed[] = [];
  const walk = (node: Element, folder: string) => {
    for (const child of Array.from(node.children)) {
      if (child.tagName.toLowerCase() !== "outline") continue;
      const xmlUrl = child.getAttribute("xmlUrl") ?? child.getAttribute("xmlurl");
      const label =
        child.getAttribute("title") ?? child.getAttribute("text") ?? "";
      if (xmlUrl) {
        found.push({ url: xmlUrl, title: label || xmlUrl, folder });
      } else {
        walk(child, label || folder);
      }
    }
  };

  const body = doc.querySelector("body");
  if (body) walk(body, "");
  return found;
}

export function downloadFile(name: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
