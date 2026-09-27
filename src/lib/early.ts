import { leadOf, type Story } from "./stories";
import { isAiText } from "./topics";
import type { Article } from "./types";

/**
 * 海外で先行。HN など海外の配信元で盛り上がっているのに、国内の配信元 (はてブ・Zenn・Qiita など) には
 * まだ出ておらず、はてブもほとんど付いていない話題を拾う。日本語の記事が出回る前に知っておける。
 */

const HOUR = 60 * 60 * 1000;
/** 先行と言えるのは出てからこのくらいまで */
export const EARLY_WINDOW_MS = 72 * HOUR;
/** はてブがこれだけ付いたら、国内にも届いたとみなす */
const ARRIVED_BOOKMARKS = 10;
/** 海外で1ソースしか出ていなくても、HN でこれだけ伸びていれば話題とみなす */
const HOT_POINTS = 100;
/** 漢字だけだと中国語と見分けが付かないので、かなで判定する */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function isJapaneseTitle(title: string): boolean {
  return KANA.test(title);
}

/**
 * タイトルの半分以上が日本語のフィードを国内とみなす。
 * はてブのホッテントリのように英語の記事が混ざるフィードも、国内として扱える。
 */
export function domesticFeeds(byFeed: Record<string, Article[]>): Set<string> {
  const domestic = new Set<string>();
  for (const [url, articles] of Object.entries(byFeed)) {
    if (articles.length === 0) continue;
    const ja = articles.filter((a) => isJapaneseTitle(a.title)).length;
    if (ja * 2 >= articles.length) domestic.add(url);
  }
  return domestic;
}

/**
 * @param hatena 記事URL -> はてブ数。問い合わせ済みのURLだけが入っている
 */
export function isEarly(
  story: Story,
  domestic: Set<string>,
  hatena: Record<string, number>,
  now: number,
): boolean {
  if (story.publishedAt === null || now - story.publishedAt > EARLY_WINDOW_MS) return false;
  for (const url of story.feeds) if (domestic.has(url)) return false;
  if (story.articles.some((a) => isJapaneseTitle(a.title))) return false;
  // はてブ数がまだ分からない話題は、国内で話題になっていないとは言えない
  if (!story.articles.some((a) => a.link && hatena[a.link] !== undefined)) return false;
  if ((story.buzz.hatena ?? 0) >= ARRIVED_BOOKMARKS) return false;
  return story.feeds.size >= 2 || (story.buzz.points ?? 0) >= HOT_POINTS;
}

/* ---------- 技術の話題か ---------- */

/**
 * HN は政治・科学・雑学も多いので、Web・ソフトウェア・IT 業界の話題だけを残す。
 * タイトルの語で見る。短い語や略語は大文字小文字を区別して、ふつうの英単語に引っかからないようにする。
 */
const TECH_ACRONYMS =
  /\b(API|SDK|CLI|IDE|OS|CPU|GPU|TPU|SQL|CSS|HTML|HTTP|HTTPS|DNS|TCP|UDP|TLS|SSL|SSH|JSON|YAML|XML|CVE|JS|TS|UI|UX|PWA|SaaS|OSS|LLVM|GCC|JIT|VM|WASM|K8s|AWS|GCP|RSS|URL|USB|RAM|SSD|ARM|RISC-V|DOS|C\+\+|C#|F#|Go|Git)\b/;
const TECH_WORDS =
  /(program|coding|\bcode\b|codebase|software|developer|\bdevs?\b|engineer|compil|kernel|linux|unix|\bbsd\b|windows|macos|\bios\b|android|browser|chrome|firefox|safari|webkit|\bweb\b|website|javascript|typescript|node\.?js|deno|\bbun\b|python|\brust\b|golang|\bjava\b|kotlin|swift|ruby|rails|\bphp\b|haskell|ocaml|elixir|erlang|\bzig\b|lisp|clojure|scala|postgres|mysql|sqlite|database|redis|github|gitlab|docker|kubernetes|container|cloud|server|backend|frontend|framework|library|open[- ]source|\brepo|\bbugs?\b|debug|performance|latency|cach(e|ing)|concurren|async|thread|memory|allocat|\bchips?\b|semiconductor|nvidia|intel\b|\bamd\b|asml|tsmc|\bnix|emacs|\bvim\b|neovim|terminal|\bshell\b|\bbash\b|regex|algorithm|data ?struct|protocol|encrypt|cryptograph|security|vulnerab|exploit|hack|malware|ransomware|phishing|privacy|\bapps?\b|startup|excel|spreadsheet|figma|diagram|editor|vscode|webassembly|markdown|unicode|self-host|homelab|raspberry|arduino|firmware|hardware|laptop|computer|computing|internet|online|\bdata\b|dataset|robot|automat|google|apple|microsoft|\bmeta\b|amazon|facebook|twitter|bluesky|mastodon|tesla|spacex|starlink|cloudflare|vercel|stripe|\bsite\b|devops|\bsre\b|observability|monitoring|\blogs?\b|deploy|\bci\b|testing|\btests?\b|refactor|typing|type system|functional|\boop\b|design pattern|architecture|distributed|scalab|microservice|queue|stream|\bfile ?system|\bstorage|virtual|emulat|simulat|\bgames? engine|render|graphics|shader|opengl|vulkan|metal\b|pixel|display|smartphone|iphone|ipad|\bmac\b|keyboard|firewall|network|router|wi-?fi|bluetooth|5g|satellite|quantum comput|blockchain|bitcoin|ethereum|crypto\b|tech\b|technolog|digital|electronic|gadget|silicon)/i;
/** ソースコードやプロダクトの置き場。ここへのリンクなら技術の話とみなす */
const TECH_HOSTS = /(^|\.)(github\.com|gitlab\.com|codeberg\.org|sr\.ht|lwn\.net|arxiv\.org|npmjs\.com|crates\.io|pypi\.org)$|\.dev$/;
/** HN の自作紹介は、ほぼソフトウェアかハードウェア */
const SHOW_HN = /^(Show|Launch) HN:/;

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** @param translated 日本語訳。訳のほうが技術の語が見つかることがある */
export function isTechArticle(article: Article, translated?: string): boolean {
  const text = `${article.title}\n${translated ?? ""}`;
  return (
    SHOW_HN.test(article.title) ||
    TECH_HOSTS.test(hostOf(article.link)) ||
    TECH_ACRONYMS.test(text) ||
    TECH_WORDS.test(text) ||
    isAiText(text) ||
    /(開発|プログラ|ソフトウェア|エンジニア|サーバー|データベース|脆弱性|セキュリティ|ブラウザ|アプリ|コード)/.test(translated ?? "")
  );
}

/* ---------- 国内でも話題の語 ---------- */

const WEEK_MS = 7 * 24 * HOUR;
/** 国内のこれだけの記事に出ていたら、その語自体は国内でも話題とみなす */
const KNOWN_MIN_ARTICLES = 3;
/**
 * いつもどこかの記事に出てくる名前やふつうの英単語。これで国内でも話題としてしまうと、
 * OpenAI の新しいニュースまで「国内でも話題」になってしまう
 */
const EVERYWHERE = new Set([
  "ai", "llm", "llms", "gpt", "chatgpt", "openai", "anthropic", "claude", "gemini", "google", "apple",
  "microsoft", "meta", "amazon", "aws", "azure", "github", "linux", "windows", "macos", "ios", "android",
  "python", "rust", "go", "java", "javascript", "typescript", "node", "react", "next.js", "docker",
  "api", "app", "apps", "web", "code", "data", "model", "models", "agent", "agents", "open", "source",
  "cloud", "server", "search", "research", "deep", "new", "free", "pro", "max", "plus", "the", "and",
  "for", "with", "how", "why", "what", "your", "from", "show", "ask", "launch", "hn", "is", "in", "of",
  "to", "on", "at", "by", "vs", "part", "one", "first", "update", "release", "introducing", "mcp",
]);
/** 大文字で始まる語 (製品名・技術名になりやすい)。国内の記事のほうは大小を問わない */
const PROPER = /\p{Lu}[\p{L}\p{N}.+#-]*[\p{L}\p{N}+#]/gu;
const LATIN = /[\p{Script=Latin}\p{N}][\p{Script=Latin}\p{N}.+#-]*[\p{Script=Latin}\p{N}+#]/gu;

/** 国内の記事の、ラテン文字の語 -> 出てきた記事の数。直近1週間、同じ記事は1回だけ数える */
export function domesticTerms(
  byFeed: Record<string, Article[]>,
  domestic: Set<string>,
  now: number,
): Map<string, number> {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const url of domestic) {
    for (const a of byFeed[url] ?? []) {
      if (a.publishedAt !== null && now - a.publishedAt > WEEK_MS) continue;
      const key = a.link || a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const term of new Set((a.title.match(LATIN) ?? []).map((t) => t.toLowerCase()))) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** 話題そのものは国内に来ていなくても、国内でも話題になっている製品名・技術名 */
export function knownTermsOf(story: Story, terms: Map<string, number>): Array<{ term: string; count: number }> {
  const found = new Map<string, { term: string; count: number }>();
  for (const term of leadOf(story).title.match(PROPER) ?? []) {
    const key = term.toLowerCase();
    if (term.length < 3 || EVERYWHERE.has(key) || found.has(key)) continue;
    const count = terms.get(key) ?? 0;
    if (count >= KNOWN_MIN_ARTICLES) found.set(key, { term, count });
  }
  return [...found.values()];
}
