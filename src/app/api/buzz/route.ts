import { NextRequest, NextResponse } from "next/server";
import { fetchWithLimit, safeUrl } from "@/lib/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const MAX_URLS = 600;
/** API は1回50件までだが、URL が長いとリクエスト行が伸びるので控えめに切る */
const CHUNK = 30;
const PARALLEL = 4;
/** ブクマ数はそれなりの速さで動くので、Data Cache は短めに */
const REVALIDATE_SECONDS = 10 * 60;

const ENDPOINT = "https://bookmark.hatenaapis.com/count/entries";

async function countChunk(urls: string[]): Promise<Record<string, number>> {
  const endpoint = new URL(ENDPOINT);
  for (const url of urls) endpoint.searchParams.append("url", url);
  try {
    const { body } = await fetchWithLimit(safeUrl(endpoint.toString()), {
      accept: "application/json",
      maxBytes: 256 * 1024,
      timeoutMs: 8_000,
      revalidate: REVALIDATE_SECONDS,
    });
    const parsed = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
    const counts: Record<string, number> = {};
    for (const url of urls) {
      const n = parsed[url];
      counts[url] = typeof n === "number" ? n : 0;
    }
    return counts;
  } catch {
    // 取れなかった束は数えないだけ。次の更新でまた聞く
    return {};
  }
}

/** 記事URLごとのはてなブックマーク数。購読元に関係なく、どの記事にも「話題度」を付けるため */
export async function POST(req: NextRequest) {
  let payload: { urls?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディが必要です" }, { status: 400 });
  }
  const urls = Array.isArray(payload.urls)
    ? [
        ...new Set(
          payload.urls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)),
        ),
      ].slice(0, MAX_URLS)
    : [];

  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += CHUNK) chunks.push(urls.slice(i, i + CHUNK));

  const counts: Record<string, number> = {};
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const results = await Promise.all(chunks.slice(i, i + PARALLEL).map(countChunk));
    for (const result of results) Object.assign(counts, result);
  }
  return NextResponse.json({ counts });
}
