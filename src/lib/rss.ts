import { XMLParser } from "fast-xml-parser";
import sanitizeHtml from "sanitize-html";
import type { Article, ParsedFeed } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});

type Node = Record<string, unknown>;

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** タグの中身を文字列で取り出す。属性付きタグは #text を見る */
function text(value: unknown): string {
  const node = Array.isArray(value) ? value[0] : value;
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (typeof node === "object" && "#text" in (node as Node)) {
    const inner = (node as Node)["#text"];
    return inner === undefined || inner === null ? "" : String(inner);
  }
  return "";
}

function attr(node: unknown, name: string): string {
  if (!node || typeof node !== "object") return "";
  const value = (node as Node)[`@_${name}`];
  return value === undefined || value === null ? "" : String(value);
}

function absolutize(href: string | undefined, base: string): string {
  if (!href) return "";
  try {
    return new URL(href, base || undefined).toString();
  } catch {
    return href;
  }
}

function parseDate(...candidates: string[]): number | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return ms;
  }
  return null;
}

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "picture",
  "source",
  "video",
  "audio",
  "iframe",
];

function cleanHtml(html: string, base: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "title", "target", "rel"],
      img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
      source: ["src", "srcset", "type", "media", "sizes"],
      video: ["src", "poster", "controls", "width", "height"],
      audio: ["src", "controls"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedIframeHostnames: [
      "www.youtube.com",
      "youtube.com",
      "www.youtube-nocookie.com",
      "player.vimeo.com",
      "w.soundcloud.com",
      "speakerdeck.com",
    ],
    transformTags: {
      a: (tagName, attribs) => {
        const href = absolutize(attribs.href, base);
        const next: Record<string, string> = { ...attribs };
        delete next.href;
        if (href) {
          next.href = href;
          next.target = "_blank";
          next.rel = "noopener noreferrer";
        }
        return { tagName, attribs: next };
      },
      img: (tagName, attribs) => {
        const src = absolutize(attribs.src, base);
        const next: Record<string, string> = { ...attribs, loading: "lazy" };
        delete next.srcset; // 相対URL混じりが多いので落として src に寄せる
        if (src) next.src = src;
        else delete next.src;
        return { tagName, attribs: next };
      },
    },
  });
}

function toPlainText(html: string, limit = 280): string {
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > limit ? `${stripped.slice(0, limit)}…` : stripped;
}

function findImage(item: Node, html: string, base: string): string | null {
  const media = toArray(item["media:content"] as unknown)
    .concat(toArray(item["media:thumbnail"] as unknown))
    .find((node) => {
      const url = attr(node, "url");
      if (!url) return false;
      const type = attr(node, "type");
      const medium = attr(node, "medium");
      return !type || type.startsWith("image/") || medium === "image";
    });
  if (media) return absolutize(attr(media, "url"), base);

  const enclosure = toArray(item.enclosure as unknown).find((node) =>
    attr(node, "type").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(attr(node, "url")),
  );
  if (enclosure) return absolutize(attr(enclosure, "url"), base);

  const inline = /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1];
  return inline ? absolutize(inline, base) : null;
}

/** Atom の <link rel="alternate" href> を取り出す */
function atomLink(node: unknown, rel = "alternate"): string {
  const links = toArray((node as Node)?.link as unknown);
  const match =
    links.find((l) => attr(l, "rel") === rel && attr(l, "href")) ??
    links.find((l) => !attr(l, "rel") && attr(l, "href")) ??
    links.find((l) => attr(l, "href"));
  return match ? attr(match, "href") : text((node as Node)?.link);
}

function stableId(...parts: string[]): string {
  const seed = parts.find((p) => p && p.trim()) ?? "";
  if (seed) return seed.trim();
  return `anon-${Math.random().toString(36).slice(2)}`;
}

type Shape = {
  channel: Node;
  items: Node[];
  kind: "rss" | "atom" | "rdf";
};

function detectShape(doc: Node): Shape | null {
  const rss = (doc.rss as Node | undefined)?.channel as Node | undefined;
  if (rss) return { channel: rss, items: toArray(rss.item as unknown) as Node[], kind: "rss" };

  const atom = doc.feed as Node | undefined;
  if (atom) return { channel: atom, items: toArray(atom.entry as unknown) as Node[], kind: "atom" };

  const rdf = doc["rdf:RDF"] as Node | undefined;
  if (rdf) {
    const channel = (rdf.channel as Node | undefined) ?? {};
    return { channel, items: toArray(rdf.item as unknown) as Node[], kind: "rdf" };
  }

  // 名前空間付きルート (例: <atom:feed>) の保険
  const key = Object.keys(doc).find((k) => k.endsWith(":feed") || k.endsWith(":rss"));
  if (key) return detectShape({ [key.split(":").pop()!]: doc[key] } as Node);
  return null;
}

export function parseFeed(xml: string, feedUrl: string): ParsedFeed {
  const doc = parser.parse(xml) as Node;
  const shape = detectShape(doc);
  if (!shape) throw new Error("RSS / Atom として解釈できませんでした");

  const { channel, items, kind } = shape;
  const siteUrl =
    (kind === "atom" ? atomLink(channel) : text(channel.link)) || feedUrl;
  const feedTitle = text(channel.title) || new URL(feedUrl).hostname;

  const articles: Article[] = items.map((item) => {
    const link = absolutize(
      kind === "atom" ? atomLink(item) : text(item.link) || text(item["rdf:about"]),
      siteUrl,
    );
    const base = link || siteUrl;
    const rawHtml =
      text(item["content:encoded"]) ||
      text(item.content) ||
      text(item.description) ||
      text(item.summary) ||
      "";
    const content = cleanHtml(rawHtml, base);
    const summarySource = text(item.description) || text(item.summary) || rawHtml;

    return {
      id: stableId(text(item.guid), text(item.id), link, text(item.title)),
      feedUrl,
      feedTitle,
      title: text(item.title) || "(無題)",
      link,
      author:
        text(item["dc:creator"]) ||
        text(item.author) ||
        text((item.author as Node | undefined)?.name) ||
        "",
      publishedAt: parseDate(
        text(item.pubDate),
        text(item.published),
        text(item.updated),
        text(item["dc:date"]),
      ),
      summary: toPlainText(summarySource),
      content,
      image: findImage(item, rawHtml, base),
    };
  });

  articles.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  return {
    url: feedUrl,
    title: feedTitle,
    siteUrl: absolutize(siteUrl, feedUrl),
    description: toPlainText(text(channel.description) || text(channel.subtitle), 160),
    articles: articles.slice(0, 60),
  };
}

export function looksLikeFeed(body: string, contentType: string): boolean {
  if (/(rss|atom|xml)/i.test(contentType)) return true;
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));
}
