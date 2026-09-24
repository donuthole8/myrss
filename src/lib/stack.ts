/**
 * マイスタック。使っている技術を名前で持ち、記事のタイトルに出たら「自分に関係ある」とみなす。
 * package.json / composer.json などを貼ると、依存パッケージから名前を起こす。
 * パッケージ名そのままでは記事に出てこない (next → Next.js、laravel/framework → Laravel) ので、
 * よく使われるものは記事で呼ばれる名前に読み替える。
 */

export type Ecosystem = "npm" | "composer" | "pypi" | "go" | "cargo" | "rubygems";

export type Pkg = { ecosystem: Ecosystem; name: string };

/** 依存パッケージのリポジトリで見つかったリリースのフィード */
export type StackRelease = {
  /** 記事での呼び名 */
  term: string;
  /** owner/repo */
  repo: string;
  feedUrl: string;
  /** 元にしたパッケージ名。モノレポなら複数になる */
  packages: string[];
};

export type ParsedManifest = {
  /** 記事の照合に使う名前 */
  terms: string[];
  /** リリースを探すのに使うパッケージ */
  packages: Pkg[];
};

/** 記事で呼ばれる名前。パッケージ名そのままで通じるものは載せない */
const ALIASES: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "react-dom": "React",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  astro: "Astro",
  express: "Express",
  hono: "Hono",
  fastify: "Fastify",
  typescript: "TypeScript",
  tailwindcss: "Tailwind",
  vite: "Vite",
  vitest: "Vitest",
  jest: "Jest",
  eslint: "ESLint",
  prettier: "Prettier",
  webpack: "webpack",
  prisma: "Prisma",
  "drizzle-orm": "Drizzle",
  playwright: "Playwright",
  "@playwright/test": "Playwright",
  ai: "AI SDK",
  openai: "OpenAI",
  "@anthropic-ai/sdk": "Claude",
  anthropic: "Claude",
  "laravel/framework": "Laravel",
  "cakephp/cakephp": "CakePHP",
  "phpunit/phpunit": "PHPUnit",
  "phpstan/phpstan": "PHPStan",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  pydantic: "Pydantic",
  pytorch: "PyTorch",
  torch: "PyTorch",
  numpy: "NumPy",
  pandas: "pandas",
  rails: "Rails",
  tokio: "Tokio",
  axum: "axum",
  serde: "Serde",
};

/** スコープごとまとめて1つの名前で呼ぶもの */
const SCOPES: Record<string, string> = {
  "@angular": "Angular",
  "@nestjs": "NestJS",
  "@remix-run": "Remix",
  "@tanstack": "TanStack",
  "@prisma": "Prisma",
  "@tailwindcss": "Tailwind",
  "@vue": "Vue",
  "@nuxt": "Nuxt",
  "@ai-sdk": "AI SDK",
  "@mui": "MUI",
  "@storybook": "Storybook",
  "@trpc": "tRPC",
  "@supabase": "Supabase",
  "@sentry": "Sentry",
  "@aws-sdk": "AWS SDK",
  "@google-cloud": "Google Cloud",
  "@radix-ui": "Radix UI",
  "@testing-library": "Testing Library",
  "@reduxjs": "Redux",
  "@apollo": "Apollo",
  "@mantine": "Mantine",
  "@chakra-ui": "Chakra UI",
  "@emotion": "Emotion",
  "@vitejs": "Vite",
  "@biomejs": "Biome",
  "@hono": "Hono",
  "@modelcontextprotocol": "MCP",
  symfony: "Symfony",
  laravel: "Laravel",
  doctrine: "Doctrine",
  illuminate: "Laravel",
  twig: "Twig",
};

/** composer の vendor/name で name が一般的すぎて、vendor で呼ぶもの */
const GENERIC_NAMES = new Set(["framework", "core", "orm", "sdk", "client", "library", "lib", "php"]);

/** 型定義・lint の設定など、記事で話題にならないパッケージ */
const SKIP = /^(@types\/|eslint-(config|plugin)-|@eslint\/|@typescript-eslint\/|ext-|lib-|php$|composer\/|python$)/;

/** 名前のままだと普通の英単語と区別が付かないので、大文字始まりのときだけ拾う */
const COMMON_WORDS = new Set(["react", "express", "next", "rails", "vue", "vite", "jest", "flask", "remix", "astro", "hono"]);

const MIN_TERM_LENGTH = 2;

/** パッケージから記事での呼び名を起こす。呼び名にならないものは null */
export function termOf(pkg: Pkg): string | null {
  const name = pkg.name.trim();
  if (!name || SKIP.test(name)) return null;
  const lower = name.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];

  if (pkg.ecosystem === "npm" && lower.startsWith("@")) {
    const [scope, rest = ""] = lower.split("/");
    return SCOPES[scope] ?? (rest.length > MIN_TERM_LENGTH ? rest : scope.slice(1));
  }
  if (pkg.ecosystem === "composer") {
    const [vendor, rest = ""] = lower.split("/");
    if (SCOPES[vendor]) return SCOPES[vendor];
    return GENERIC_NAMES.has(rest) || rest === vendor ? vendor : rest || vendor;
  }
  if (pkg.ecosystem === "go") {
    // github.com/gin-gonic/gin/v2 → gin
    const parts = lower.split("/").filter((p) => !/^v\d+$/.test(p));
    return parts.at(-1) ?? null;
  }
  return lower;
}

/* ---------- 設定ファイルの読み取り ---------- */

function keysOf(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

function fromJson(text: string): Pkg[] | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  // composer.json は require、package.json は dependencies を持つ
  if ("require" in json || "require-dev" in json) {
    return [...keysOf(json.require), ...keysOf(json["require-dev"])]
      .filter((name) => name.includes("/"))
      .map((name) => ({ ecosystem: "composer", name }));
  }
  if ("dependencies" in json || "devDependencies" in json) {
    return [...keysOf(json.dependencies), ...keysOf(json.devDependencies)].map((name) => ({
      ecosystem: "npm",
      name,
    }));
  }
  return null;
}

function fromGoMod(text: string): Pkg[] | null {
  if (!/^module\s+\S+/m.test(text)) return null;
  const found: Pkg[] = [];
  // require ( ... ) のブロックと、1行の require の両方
  for (const [, block] of text.matchAll(/^require\s*\(([\s\S]*?)^\)/gm)) {
    for (const line of block.split("\n")) {
      const name = /^\s*([\w.-]+\.[\w.-]+\/\S+)\s+v/.exec(line)?.[1];
      if (name && !line.includes("// indirect")) found.push({ ecosystem: "go", name });
    }
  }
  for (const [, name] of text.matchAll(/^require\s+([\w.-]+\.[\w.-]+\/\S+)\s+v/gm)) {
    found.push({ ecosystem: "go", name });
  }
  return found;
}

function fromCargo(text: string): Pkg[] | null {
  if (!/^\[(dev-)?dependencies\]/m.test(text)) return null;
  const found: Pkg[] = [];
  let inDeps = false;
  for (const line of text.split("\n")) {
    const section = /^\s*\[([^\]]+)\]/.exec(line)?.[1];
    if (section !== undefined) {
      inDeps = /(^|\.)(dev-|build-)?dependencies$/.test(section);
      continue;
    }
    const name = inDeps ? /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line)?.[1] : undefined;
    if (name) found.push({ ecosystem: "cargo", name });
  }
  return found;
}

function fromGemfile(text: string): Pkg[] | null {
  const names = [...text.matchAll(/^\s*gem\s+["']([\w.-]+)["']/gm)].map((m) => m[1]);
  return names.length > 0 ? names.map((name) => ({ ecosystem: "rubygems", name })) : null;
}

/** requirements.txt / pyproject.toml の dependencies */
function fromPython(text: string): Pkg[] | null {
  const pyproject = /^\[project\]/m.test(text) || /^\[tool\.poetry/m.test(text);
  if (pyproject) {
    const quoted = [...text.matchAll(/^\s*["']([A-Za-z0-9][\w.-]*)(\[[^\]]*\])?\s*[<>=!~;"' ]/gm)].map((m) => m[1]);
    const poetry = [...text.matchAll(/^([A-Za-z0-9][\w.-]*)\s*=\s*["{]/gm)]
      .map((m) => m[1])
      .filter((n) => n !== "python" && n !== "name" && n !== "version");
    const names = [...quoted, ...poetry];
    return names.length > 0 ? names.map((name) => ({ ecosystem: "pypi", name })) : null;
  }
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("-"));
  // すべての行が「名前 + バージョン指定」の形なら requirements.txt とみなす
  const pinned = lines.map((l) => /^([A-Za-z0-9][\w.-]*)(\[[^\]]*\])?\s*(==|>=|<=|~=|!=|>|<)/.exec(l)?.[1]);
  if (lines.length === 0 || pinned.some((n) => !n)) return null;
  return pinned.map((name) => ({ ecosystem: "pypi", name: name! }));
}

/** 改行・カンマ区切りの名前の並び */
function fromList(text: string): string[] {
  return text
    .split(/[\n,、]/)
    .map((w) => w.trim())
    .filter((w) => w.length >= MIN_TERM_LENGTH && w.length <= 40);
}

const LANGUAGE: Partial<Record<Ecosystem, string>> = {
  composer: "PHP",
  pypi: "Python",
  cargo: "Rust",
  rubygems: "Ruby",
  go: "Golang",
};

/** 貼られた設定ファイル (または名前の並び) から、照合する名前とパッケージを取り出す */
export function parseManifest(text: string): ParsedManifest {
  const trimmed = text.trim();
  if (!trimmed) return { terms: [], packages: [] };
  const packages =
    (trimmed.startsWith("{") ? fromJson(trimmed) : null) ??
    fromGoMod(trimmed) ??
    fromCargo(trimmed) ??
    fromGemfile(trimmed) ??
    fromPython(trimmed);
  if (!packages) return { terms: uniqueTerms(fromList(trimmed)), packages: [] };

  const unique = [...new Map(packages.map((p) => [`${p.ecosystem}:${p.name.toLowerCase()}`, p])).values()];
  const language = LANGUAGE[unique[0]?.ecosystem];
  const terms = unique
    .map(termOf)
    .filter((t): t is string => !!t && t.length >= MIN_TERM_LENGTH);
  return {
    terms: uniqueTerms([...(language ? [language] : []), ...terms]),
    packages: unique.filter((p) => termOf(p) !== null),
  };
}

/** 大文字小文字違いの重複を落とす。先に出たほうの表記を残す */
export function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------- 記事との照合 ---------- */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const matcherCache = new Map<string, RegExp>();

/**
 * 単語の途中には当てない (React が Reactive に当たらないように)。
 * 普通の英単語でもある名前は大文字始まりのときだけ拾い、Next.js は NextJS / nextjs とも書かれるので寄せる。
 */
function matcherFor(term: string): RegExp {
  const hit = matcherCache.get(term);
  if (hit) return hit;
  const lower = term.toLowerCase();
  const body = lower.endsWith(".js")
    ? `${escapeRegExp(term.slice(0, -3))}\\.?js`
    : escapeRegExp(term);
  const caseSensitive = COMMON_WORDS.has(lower);
  // 日本語はそのまま続けて書かれる (Reactで作る) ので、境界はラテン文字で見る。後ろの数字は版番号 (PHP8.4) なので許す
  const re = new RegExp(`(?<![A-Za-z0-9_-])${body}(?![A-Za-z_])`, caseSensitive ? "u" : "iu");
  matcherCache.set(term, re);
  return re;
}

/** text に出てくるスタックの名前 */
export function stackMatches(text: string, terms: string[]): string[] {
  return terms.filter((t) => matcherFor(t).test(text));
}
