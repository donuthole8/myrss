/**
 * タイトル・抜粋翻訳のクライアント側。訳は原文をキーに localStorage へ貯め、
 * 同じ文で DeepL の無料枠を二度使わないようにする。
 */

const KEY = "feedly-clone:translations:v1";
const MAX_ENTRIES = 3000;

export type Translations = Record<string, string>;

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const LATIN = /[A-Za-z]/g;

/** 日本語を含まず、ラテン文字が主体のタイトルだけ訳す */
export function needsTranslation(title: string): boolean {
  if (!title || JAPANESE.test(title)) return false;
  const letters = title.match(LATIN)?.length ?? 0;
  return letters >= 3 && letters / title.replace(/\s/g, "").length >= 0.5;
}

/** 一覧の抜粋は2行で切れるので、訳すのもその分だけ。英語2行はだいたいこの文字数に収まる */
const SNIPPET_CHARS = 120;
const URL_RE = /https?:\/\/\S+/g;

/**
 * 一覧に見えている分の抜粋を切り出す。訳す必要が無ければ null。
 * Hacker News の「Article URL: …」のような URL だけの抜粋も訳さない
 */
export function summarySnippet(summary: string): string | null {
  const text = summary.replace(/\s+/g, " ").trim();
  if (!text || !needsTranslation(text.replace(URL_RE, ""))) return null;
  if (text.replace(URL_RE, "").replace(/\b(Article|Comments) URL:/g, "").trim().length < 20) return null;
  if (text.length <= SNIPPET_CHARS) return text;
  // 単語の途中で切らない
  const cut = text.slice(0, SNIPPET_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${space > SNIPPET_CHARS * 0.6 ? cut.slice(0, space) : cut}…`;
}

export function loadTranslations(): Translations {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Translations) : {};
  } catch {
    return {};
  }
}

export function saveTranslations(map: Translations): void {
  // 挿入順が古い順なので、溢れたら頭から捨てる
  const entries = Object.entries(map);
  const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : map;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* 訳は取り直せるので諦める */
  }
}

export type TranslateOutcome =
  | { ok: true; translations: Translations }
  /** disabled: キー未設定など、しばらく叩いても無駄な状態 */
  | { ok: false; error: string; disabled: boolean };

export async function requestTranslations(texts: string[]): Promise<TranslateOutcome> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    const data = (await res.json()) as { translations?: Translations; error?: string };
    if (!res.ok || !data.translations) {
      return {
        ok: false,
        error: data.error ?? "翻訳に失敗しました",
        disabled: [403, 429, 501, 503].includes(res.status),
      };
    }
    return { ok: true, translations: data.translations };
  } catch {
    return { ok: false, error: "翻訳の通信に失敗しました", disabled: false };
  }
}
