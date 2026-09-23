import { NextRequest, NextResponse } from "next/server";
import { HttpError, decodeBody, fetchWithLimit, safeUrl } from "@/lib/net";
import { looksLikeFeed, parseFeed } from "@/lib/rss";
import type { Candidate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const FEED_TYPE = /(application\/(rss|atom)\+xml|application\/feed\+json)/i;
const COMMON_PATHS = [
  "/feed",
  "/rss",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feeds/posts/default",
];

/** <link rel="alternate" type="application/rss+xml" href="..."> を拾う */
function linkTags(html: string, base: string): string[] {
  const found: string[] = [];
  const re = /<link\b[^>]*>/gi;
  for (const [tag] of html.matchAll(re)) {
    if (!/rel=["']?[^"'>]*alternate/i.test(tag)) continue;
    const type = /type=["']([^"']+)["']/i.exec(tag)?.[1] ?? "";
    if (!FEED_TYPE.test(type)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    try {
      found.push(new URL(href, base).toString());
    } catch {
      /* 壊れた href は無視 */
    }
  }
  return found;
}

/** 候補の重複判定に使う。同じ記事を返すフィードは1つに絞る */
type Probe = { candidate: Candidate; fingerprint: string };

async function describe(url: string): Promise<Probe | null> {
  try {
    const target = safeUrl(url);
    const { body, contentType } = await fetchWithLimit(target, {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      timeoutMs: 10_000,
    });
    const xml = decodeBody(body, contentType);
    if (!looksLikeFeed(xml, contentType)) return null;
    const feed = parseFeed(xml, target.toString());
    return {
      candidate: {
        url: feed.url,
        title: feed.title,
        siteUrl: feed.siteUrl,
        description: feed.description,
        itemCount: feed.articles.length,
      },
      fingerprint: `${feed.title}|${feed.articles.map((a) => a.id).slice(0, 3).join("|")}`,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url が必要です" }, { status: 400 });

  try {
    const url = safeUrl(raw);
    const { body, contentType, finalUrl } = await fetchWithLimit(url, {
      accept: "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
    });
    const doc = decodeBody(body, contentType);

    // そのものがフィードだった場合
    if (looksLikeFeed(doc, contentType)) {
      const feed = parseFeed(doc, finalUrl);
      return NextResponse.json({
        candidates: [
          {
            url: feed.url,
            title: feed.title,
            siteUrl: feed.siteUrl,
            description: feed.description,
            itemCount: feed.articles.length,
          },
        ] satisfies Candidate[],
      });
    }

    // HTML なら autodiscovery → だめなら定番パスを総当たり
    const seen = new Set<string>();
    const guesses = [
      ...linkTags(doc, finalUrl),
      ...COMMON_PATHS.map((p) => new URL(p, finalUrl).toString()),
    ].filter((u) => (seen.has(u) ? false : (seen.add(u), true)));

    const candidates: Candidate[] = [];
    const fingerprints = new Set<string>();
    for (const guess of guesses.slice(0, 10)) {
      const found = await describe(guess);
      if (found && !fingerprints.has(found.fingerprint)) {
        fingerprints.add(found.fingerprint);
        candidates.push(found.candidate);
      }
      if (candidates.length >= 5) break;
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "このページからフィードを見つけられませんでした" },
        { status: 404 },
      );
    }
    return NextResponse.json({ candidates });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: message }, { status });
  }
}
