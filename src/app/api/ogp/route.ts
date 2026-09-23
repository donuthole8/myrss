import { NextRequest, NextResponse } from "next/server";
import { decodeBody, fetchWithLimit, safeUrl } from "@/lib/net";
import type { Ogp } from "@/lib/ogp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_URLS = 40;
const PARALLEL = 8;
/** OGP はほぼ変わらないので Data Cache に1日預ける */
const REVALIDATE_SECONDS = 24 * 60 * 60;
const ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** <meta property="og:image" content="..."> を属性の順番によらず拾う */
function metaContent(head: string, names: string[]): string {
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!key || !names.includes(key)) continue;
    const content = /\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[2] ?? content?.[3];
    if (value?.trim()) return decodeEntities(value.trim());
  }
  return "";
}

function absoluteImage(raw: string, base: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function load(raw: string): Promise<Ogp | null> {
  try {
    const url = safeUrl(raw);
    const { body, contentType, finalUrl } = await fetchWithLimit(url, {
      accept: ACCEPT,
      maxBytes: 4 * 1024 * 1024,
      timeoutMs: 8000,
      revalidate: REVALIDATE_SECONDS,
    });
    if (contentType && !/html/i.test(contentType)) return {};
    const html = decodeBody(body, contentType);
    // meta は head にあるので、本文まで正規表現を走らせない
    const end = html.search(/<\/head>|<body[\s>]/i);
    const head = html.slice(0, end === -1 ? 300_000 : end);
    const image = absoluteImage(
      metaContent(head, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"]),
      finalUrl,
    );
    const description = metaContent(head, ["og:description", "twitter:description", "description"])
      .replace(/\s+/g, " ")
      .slice(0, 300);
    return { ...(image ? { image } : {}), ...(description ? { description } : {}) };
  } catch {
    // 取れなかったものは null。クライアントはしばらく聞き直さない
    return null;
  }
}

/**
 * 元記事ページの og:image / og:description を返す。
 * フィードに画像や要約が無い記事の見た目を補うため。
 */
export async function POST(req: NextRequest) {
  let payload: { urls?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディが必要です" }, { status: 400 });
  }
  const urls = Array.isArray(payload.urls)
    ? [...new Set(payload.urls.filter((u): u is string => typeof u === "string"))].slice(0, MAX_URLS)
    : [];

  const results: Record<string, Ogp | null> = {};
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      results[url] = await load(url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, urls.length) }, worker));
  return NextResponse.json({ results });
}
