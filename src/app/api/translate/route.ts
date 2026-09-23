import { NextRequest, NextResponse } from "next/server";
import { TtlCache } from "@/lib/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const MAX_TEXTS = 50;
const MAX_CHARS = 300;
/** 別端末から同じタイトルが来たときに DeepL の無料枠を使わずに返すため */
const cache = new TtlCache<string>(24 * 60 * 60 * 1000, 3000);

/** Free プランのキーは末尾が ":fx" で、エンドポイントも別 */
function endpointFor(key: string): string {
  return key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

/**
 * 英語などのタイトルを日本語にする。DeepL のキーは Vercel の環境変数 DEEPL_API_KEY。
 * キーの無料枠を他人に使われないよう、同じオリジンのページからの呼び出しだけ受ける。
 */
export async function POST(req: NextRequest) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "DEEPL_API_KEY が設定されていません" }, { status: 501 });
  }

  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const sameOrigin = site ? site === "same-origin" : !!origin && new URL(origin).host === req.nextUrl.host;
  if (!sameOrigin) {
    return NextResponse.json({ error: "このページからのみ利用できます" }, { status: 403 });
  }

  let payload: { texts?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディが必要です" }, { status: 400 });
  }
  const texts = Array.isArray(payload.texts)
    ? payload.texts
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .slice(0, MAX_TEXTS)
        .map((t) => t.slice(0, MAX_CHARS))
    : [];
  if (texts.length === 0) return NextResponse.json({ translations: {} });

  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const text of texts) {
    const hit = cache.get(text);
    if (hit !== undefined) result[text] = hit;
    else missing.push(text);
  }

  if (missing.length > 0) {
    let res: Response;
    try {
      res = await fetch(endpointFor(key), {
        method: "POST",
        headers: {
          authorization: `DeepL-Auth-Key ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ text: missing, target_lang: "JA" }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return NextResponse.json({ error: "DeepL に接続できませんでした" }, { status: 502 });
    }
    if (res.status === 456) {
      return NextResponse.json({ error: "DeepL の今月の無料枠を使い切りました" }, { status: 429 });
    }
    if (res.status === 403) {
      return NextResponse.json({ error: "DeepL の API キーが正しくありません" }, { status: 503 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `DeepL がエラーを返しました (HTTP ${res.status})` }, { status: 502 });
    }
    const data = (await res.json()) as { translations?: Array<{ text: string }> };
    missing.forEach((text, i) => {
      const translated = data.translations?.[i]?.text;
      if (!translated) return;
      cache.set(text, translated);
      result[text] = translated;
    });
  }

  return NextResponse.json({ translations: result });
}
