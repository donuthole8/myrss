import { NextRequest, NextResponse } from "next/server";
import { decodeBody, fetchWithLimit, safeUrl } from "@/lib/net";
import { looksLikeFeed, parseFeed } from "@/lib/rss";
import { termOf, type Ecosystem, type Pkg, type StackRelease } from "@/lib/stack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 一度に調べるパッケージの上限。レジストリに迷惑をかけないように */
const MAX_PACKAGES = 40;
const CONCURRENCY = 6;
/** レジストリの情報はそう変わらないので1日は使い回す */
const REVALIDATE_S = 24 * 60 * 60;

/** パッケージ名として受け付ける形。URL に埋め込むので厳しめに見る */
const NAME: Record<Ecosystem, RegExp> = {
  npm: /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i,
  composer: /^[a-z0-9][\w.-]*\/[a-z0-9][\w.-]*$/i,
  pypi: /^[a-z0-9][\w.-]*$/i,
  go: /^[\w.-]+\.[a-z]{2,}(\/[\w.~-]+)+$/i,
  cargo: /^[a-z0-9][\w-]*$/i,
  rubygems: /^[a-z0-9][\w.-]*$/i,
};

async function getJson(url: string): Promise<unknown> {
  const { body, contentType } = await fetchWithLimit(safeUrl(url), {
    accept: "application/json",
    maxBytes: 8 * 1024 * 1024,
    revalidate: REVALIDATE_S,
  });
  return JSON.parse(decodeBody(body, contentType));
}

function pickString(value: unknown, ...path: string[]): string {
  let node = value;
  for (const key of path) {
    if (!node || typeof node !== "object") return "";
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "string" ? node : "";
}

/** git+https://github.com/owner/repo.git などから owner/repo を取り出す */
export function githubRepoOf(raw: string): string | null {
  const m = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(raw.trim());
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

/** パッケージのレジストリから、ソースの置き場所 (GitHub) を引く */
async function repoOf(pkg: Pkg): Promise<string | null> {
  const enc = encodeURIComponent;
  switch (pkg.ecosystem) {
    case "npm": {
      // 全版の情報は大きすぎるので latest だけ取る
      const json = await getJson(`https://registry.npmjs.org/${pkg.name.replace("/", "%2f")}/latest`);
      const repo = (json as { repository?: unknown }).repository;
      return githubRepoOf(typeof repo === "string" ? repo : pickString(repo, "url"));
    }
    case "composer": {
      // 本体から切り出した読み取り専用のリポジトリにはリリースが出ないので、本体を見る
      const vendor = pkg.name.toLowerCase().split("/")[0];
      if (vendor === "symfony") return "symfony/symfony";
      if (vendor === "illuminate") return "laravel/framework";
      const json = await getJson(`https://repo.packagist.org/p2/${pkg.name.toLowerCase()}.json`);
      const versions = (json as { packages?: Record<string, unknown[]> }).packages?.[pkg.name.toLowerCase()];
      return githubRepoOf(pickString(versions?.[0], "source", "url"));
    }
    case "pypi": {
      const json = await getJson(`https://pypi.org/pypi/${enc(pkg.name)}/json`);
      const info = (json as { info?: { project_urls?: Record<string, string> | null; home_page?: string } }).info;
      const urls = [...Object.values(info?.project_urls ?? {}), info?.home_page ?? ""];
      for (const url of urls) {
        const repo = typeof url === "string" ? githubRepoOf(url) : null;
        if (repo) return repo;
      }
      return null;
    }
    case "go":
      return pkg.name.startsWith("github.com/") ? githubRepoOf(pkg.name.replace(/\/v\d+$/, "")) : null;
    case "cargo": {
      const json = await getJson(`https://crates.io/api/v1/crates/${enc(pkg.name)}`);
      return githubRepoOf(pickString(json, "crate", "repository"));
    }
    case "rubygems": {
      const json = await getJson(`https://rubygems.org/api/v1/gems/${enc(pkg.name)}.json`);
      return githubRepoOf(pickString(json, "source_code_uri")) ?? githubRepoOf(pickString(json, "homepage_uri"));
    }
  }
}

/** リリースを切っていればリリース、タグしか打たないならタグのフィードを返す */
async function feedFor(repo: string): Promise<string | null> {
  for (const kind of ["releases", "tags"]) {
    const url = `https://github.com/${repo}/${kind}.atom`;
    try {
      const { body, contentType } = await fetchWithLimit(safeUrl(url), {
        accept: "application/atom+xml, application/xml",
        revalidate: REVALIDATE_S,
      });
      const xml = decodeBody(body, contentType);
      if (looksLikeFeed(xml, contentType) && parseFeed(xml, url).articles.length > 0) return url;
    } catch {
      /* 次の種類を試す */
    }
  }
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(req: NextRequest) {
  let body: { packages?: unknown };
  try {
    body = (await req.json()) as { packages?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON で送ってください" }, { status: 400 });
  }
  const packages = (Array.isArray(body.packages) ? body.packages : [])
    .filter(
      (p): p is Pkg =>
        !!p &&
        typeof p === "object" &&
        typeof (p as Pkg).name === "string" &&
        (p as Pkg).ecosystem in NAME &&
        NAME[(p as Pkg).ecosystem].test((p as Pkg).name),
    )
    .slice(0, MAX_PACKAGES);

  const repos = await mapLimit(packages, CONCURRENCY, (pkg) => repoOf(pkg).catch(() => null));

  // モノレポ (@tanstack/* など) は1つのリポジトリにまとめる
  const byRepo = new Map<string, { term: string; repo: string; packages: string[] }>();
  packages.forEach((pkg, i) => {
    const repo = repos[i];
    if (!repo) return;
    const entry = byRepo.get(repo.toLowerCase());
    if (entry) entry.packages.push(pkg.name);
    else byRepo.set(repo.toLowerCase(), { term: termOf(pkg) ?? pkg.name, repo, packages: [pkg.name] });
  });
  const unique = [...byRepo.values()];

  const feeds = await mapLimit(unique, CONCURRENCY, (u) => feedFor(u.repo));
  const releases: StackRelease[] = unique.flatMap((u, i) => {
    const feedUrl = feeds[i];
    return feedUrl ? [{ ...u, feedUrl }] : [];
  });
  return NextResponse.json({ releases, checked: packages.length });
}
