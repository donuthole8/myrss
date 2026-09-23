export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const PRIVATE_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * ローカル向けのリーダーとはいえ任意のURLを叩くので、
 * ループバック・プライベート帯だけは弾いておく。
 * (リダイレクト先までは追跡していない)
 */
export function safeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "URLの形式が正しくありません");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "http / https のURLのみ対応しています");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    (IPV4.test(host) && PRIVATE_IPV4.test(host)) ||
    (host.includes(":") && (host === "::1" || /^f[cd]/.test(host)));
  if (blocked) {
    throw new HttpError(400, "プライベートネットワークのURLは取得できません");
  }
  return url;
}

const UA =
  "Mozilla/5.0 (compatible; FeedlyClone/0.1; +https://github.com/) FeedFetcher";

export async function fetchWithLimit(
  url: URL,
  { accept, maxBytes = 5 * 1024 * 1024, timeoutMs = 10_000, revalidate }: {
    accept: string;
    maxBytes?: number;
    timeoutMs?: number;
    /** 秒数を渡すと Next の Data Cache に載る。省略時は毎回取りに行く */
    revalidate?: number;
  },
): Promise<{ body: Uint8Array; contentType: string; finalUrl: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": UA, accept },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      ...(revalidate === undefined
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError"
      ? "タイムアウトしました"
      : "接続できませんでした";
    throw new HttpError(502, reason);
  }
  if (!res.ok) {
    throw new HttpError(502, `取得に失敗しました (HTTP ${res.status})`);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new HttpError(502, "レスポンスが大きすぎます");
  }
  return {
    body: buf,
    contentType: res.headers.get("content-type") ?? "",
    finalUrl: res.url || url.toString(),
  };
}

/** charset 指定が shift_jis / euc-jp などでも読めるようにデコードする */
export function decodeBody(body: Uint8Array, contentType: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    body.subarray(0, 2048),
  );
  const fromMeta =
    /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  const label = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

/** 一定時間だけ結果を抱えておく素朴なメモリキャッシュ */
export class TtlCache<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 300,
  ) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { at: Date.now(), value });
  }
}
