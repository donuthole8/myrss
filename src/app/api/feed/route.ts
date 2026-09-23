import { NextRequest, NextResponse } from "next/server";
import { HttpError, TtlCache, decodeBody, fetchWithLimit, safeUrl } from "@/lib/net";
import { parseFeed } from "@/lib/rss";
import type { FeedResult, ParsedFeed } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FEED_TTL_SECONDS = 5 * 60;
/** 同じインスタンスに連続で当たったときのパース結果の使い回し */
const cache = new TtlCache<ParsedFeed>(FEED_TTL_SECONDS * 1000);
const ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8";

async function load(raw: string, force: boolean): Promise<ParsedFeed> {
  const url = safeUrl(raw);
  const key = url.toString();
  if (!force) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  // サーバーレスだとインスタンスが使い捨てられるので、取得そのものは Data Cache に預ける
  const { body, contentType } = await fetchWithLimit(url, {
    accept: ACCEPT,
    revalidate: force ? undefined : FEED_TTL_SECONDS,
  });
  const xml = decodeBody(body, contentType);
  let parsed: ParsedFeed;
  try {
    parsed = parseFeed(xml, key);
  } catch (err) {
    throw new HttpError(422, err instanceof Error ? err.message : "解析に失敗しました");
  }
  cache.set(key, parsed);
  return parsed;
}

function toMessage(err: unknown): string {
  if (err instanceof HttpError) return err.message;
  return err instanceof Error ? err.message : "不明なエラー";
}

/** 単一フィードの取得。購読前のプレビューに使う */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url が必要です" }, { status: 400 });
  try {
    const feed = await load(raw, req.nextUrl.searchParams.get("force") === "1");
    return NextResponse.json({ ok: true, feed } satisfies FeedResult);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ ok: false, url: raw, error: toMessage(err) }, { status });
  }
}

/** 購読中フィードの一括更新。1リクエストでまとめて取りに行く */
export async function POST(req: NextRequest) {
  let payload: { urls?: unknown; force?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディが必要です" }, { status: 400 });
  }
  const urls = Array.isArray(payload.urls)
    ? payload.urls.filter((u): u is string => typeof u === "string").slice(0, 100)
    : [];
  const force = payload.force === true;

  const results = await Promise.all(
    urls.map(async (url): Promise<FeedResult> => {
      try {
        return { ok: true, feed: await load(url, force) };
      } catch (err) {
        return { ok: false, url, error: toMessage(err) };
      }
    }),
  );
  return NextResponse.json({ results });
}
