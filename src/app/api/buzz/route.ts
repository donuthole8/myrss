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

/** Qiita は未認証だと1時間60回まで。1記事1回で済むよう、いいね数は1時間キャッシュする */
const LIKES_REVALIDATE_SECONDS = 60 * 60;
const MAX_LIKE_URLS = 40;

/** Qiita / Zenn の記事URLから、いいね数を返す API の URL を作る */
function likesEndpoint(url: string): { api: string; field: "likes_count" | "liked_count" } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const qiita = u.hostname === "qiita.com" && /^\/[^/]+\/items\/([0-9a-f]{20})\/?$/.exec(u.pathname);
  if (qiita) return { api: `https://qiita.com/api/v2/items/${qiita[1]}`, field: "likes_count" };
  const zenn = u.hostname === "zenn.dev" && /^\/[^/]+\/articles\/([\w-]+)\/?$/.exec(u.pathname);
  if (zenn) return { api: `https://zenn.dev/api/articles/${zenn[1]}`, field: "liked_count" };
  return null;
}

async function likesOf(url: string): Promise<number | undefined> {
  const target = likesEndpoint(url);
  if (!target) return undefined;
  try {
    const { body } = await fetchWithLimit(safeUrl(target.api), {
      accept: "application/json",
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: 8_000,
      revalidate: LIKES_REVALIDATE_SECONDS,
    });
    const parsed = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown> & {
      article?: Record<string, unknown>;
    };
    // Zenn は { article: {...} } で包んで返す
    const n = (parsed.article ?? parsed)[target.field];
    return typeof n === "number" ? n : undefined;
  } catch {
    // 回数制限に当たったときなども、数を出さないだけ
    return undefined;
  }
}

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

/**
 * 記事URLごとのはてなブックマーク数。購読元に関係なく、どの記事にも「話題度」を付けるため。
 * Qiita / Zenn の記事には、それぞれのいいね数も付ける
 */
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

  const likeUrls = urls.filter((u) => likesEndpoint(u)).slice(0, MAX_LIKE_URLS);
  const likesTask = Promise.all(likeUrls.map(async (u) => [u, await likesOf(u)] as const));

  const counts: Record<string, number> = {};
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const results = await Promise.all(chunks.slice(i, i + PARALLEL).map(countChunk));
    for (const result of results) Object.assign(counts, result);
  }

  const likes: Record<string, number> = {};
  for (const [u, n] of await likesTask) if (n !== undefined) likes[u] = n;
  return NextResponse.json({ counts, likes });
}
