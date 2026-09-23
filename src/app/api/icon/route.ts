import { NextRequest, NextResponse } from "next/server";
import { TtlCache, decodeBody, fetchWithLimit, safeUrl } from "@/lib/net";

export const runtime = "nodejs";
export const maxDuration = 20;

const ICON_TTL_SECONDS = 24 * 60 * 60;

type Icon = { body: Uint8Array; contentType: string } | null;

const cache = new TtlCache<Icon>(ICON_TTL_SECONDS * 1000, 500);
const REL = /rel=["']?[^"'>]*\b(?:shortcut\s+)?icon\b/i;

/** <link rel="icon"> 系を拾って、サイズ指定が大きいものを優先する */
function iconLinks(html: string, base: string): string[] {
  const scored: Array<{ href: string; score: number }> = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!REL.test(tag)) continue;
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    const size = Number(/sizes=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    const apple = /apple-touch-icon/i.test(tag) ? 120 : 0;
    try {
      scored.push({ href: new URL(href, base).toString(), score: size || apple });
    } catch {
      /* 壊れた href は無視 */
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.href);
}

async function loadImage(url: string): Promise<Icon> {
  try {
    const { body, contentType } = await fetchWithLimit(safeUrl(url), {
      accept: "image/*",
      maxBytes: 512 * 1024,
      timeoutMs: 8_000,
      revalidate: ICON_TTL_SECONDS,
    });
    if (body.byteLength === 0) return null;
    const type = contentType.split(";")[0] || "image/x-icon";
    if (!type.startsWith("image/")) return null;
    return { body, contentType: type };
  } catch {
    return null;
  }
}

async function resolveIcon(site: URL): Promise<Icon> {
  let candidates = [new URL("/favicon.ico", site).toString()];
  try {
    const { body, contentType, finalUrl } = await fetchWithLimit(site, {
      accept: "text/html,application/xhtml+xml",
      maxBytes: 1024 * 1024,
      timeoutMs: 8_000,
      revalidate: ICON_TTL_SECONDS,
    });
    const html = decodeBody(body, contentType);
    candidates = [...iconLinks(html, finalUrl), new URL("/favicon.ico", finalUrl).toString()];
  } catch {
    /* HTML が読めなくても /favicon.ico は試す */
  }
  for (const candidate of candidates.slice(0, 4)) {
    const image = await loadImage(candidate);
    if (image) return image;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("url が必要です", { status: 400 });

  let site: URL;
  try {
    site = safeUrl(raw);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  const key = site.origin;

  let icon = cache.get(key);
  if (icon === undefined) {
    icon = await resolveIcon(site);
    cache.set(key, icon);
  }
  if (!icon) return new NextResponse(null, { status: 404 });

  return new NextResponse(icon.body as unknown as BodyInit, {
    headers: {
      "content-type": icon.contentType,
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
