"use client";

import { useEffect, useRef, useState } from "react";
import { parseKeywords } from "@/lib/prefer";
import { parseManifest, uniqueTerms, type Pkg, type StackRelease } from "@/lib/stack";
import { Icon, Spinner } from "./ui";

type Props = {
  terms: string[];
  packages: Pkg[];
  subscribedUrls: Set<string>;
  onSave: (stack: { terms: string[]; packages: Pkg[] }) => void;
  onSubscribeReleases: (releases: StackRelease[]) => void;
  onClose: () => void;
};

type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; releases: StackRelease[]; checked: number }
  | { state: "error"; message: string };

export function StackDialog({ terms, packages, subscribedUrls, onSave, onSubscribeReleases, onClose }: Props) {
  const [text, setText] = useState(terms.join("\n"));
  const [pkgs, setPkgs] = useState(packages);
  const [manifest, setManifest] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const current = () => ({ terms: uniqueTerms(parseKeywords(text)), packages: pkgs });

  // 閉じるときに確定させる。保存ボタンを押し忘れても消えないように
  const close = () => {
    onSave(current());
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const importManifest = (source: string) => {
    const parsed = parseManifest(source);
    if (parsed.terms.length === 0) {
      setNote("技術の名前を読み取れませんでした。package.json などの中身をそのまま貼ってください。");
      return;
    }
    const before = new Set(parseKeywords(text).map((t) => t.toLowerCase()));
    const merged = uniqueTerms([...parseKeywords(text), ...parsed.terms]);
    const added = parsed.terms.filter((t) => !before.has(t.toLowerCase())).length;
    setText(merged.join("\n"));
    const known = new Set(pkgs.map((p) => `${p.ecosystem}:${p.name}`));
    setPkgs([...pkgs, ...parsed.packages.filter((p) => !known.has(`${p.ecosystem}:${p.name}`))]);
    setManifest("");
    setLookup({ state: "idle" });
    setNote(
      parsed.packages.length > 0
        ? `${parsed.packages.length}個のパッケージから、${added}個の名前を足しました。関係ないものは消してください。`
        : `${added}個の名前を足しました。`,
    );
  };

  const findReleases = async () => {
    setLookup({ state: "loading" });
    try {
      const res = await fetch("/api/stack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packages: pkgs }),
      });
      const data = (await res.json()) as { releases?: StackRelease[]; checked?: number; error?: string };
      if (!res.ok || !data.releases) throw new Error(data.error ?? "リリースを探せませんでした");
      setLookup({ state: "done", releases: data.releases, checked: data.checked ?? 0 });
      setChosen(new Set(data.releases.filter((r) => !subscribedUrls.has(r.feedUrl)).map((r) => r.feedUrl)));
    } catch (err) {
      setLookup({ state: "error", message: err instanceof Error ? err.message : "リリースを探せませんでした" });
    }
  };

  const label = "block text-2xs font-semibold uppercase tracking-wider text-muted";
  const textarea =
    "mt-1 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-ui outline-none placeholder:text-muted focus:border-accent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh] backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="マイスタック"
        className="flex max-h-[84dvh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon.Layers className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">マイスタック</h2>
          <button
            type="button"
            onClick={close}
            aria-label="閉じる"
            className="ml-auto rounded-md p-1 text-muted hover:bg-line/60 hover:text-ink"
          >
            <Icon.X />
          </button>
        </div>

        <div className="scroll-thin space-y-5 overflow-y-auto px-4 py-4">
          <p className="text-xs leading-relaxed text-muted">
            使っている技術を登録すると、それに触れた記事を「マイスタック」にまとめ、今日の分でも優先します。
            セキュリティ修正とメジャーリリースは特に上に出します。
          </p>

          <section>
            <label className={label} htmlFor="stack-manifest">設定ファイルから読み込む</label>
            <textarea
              id="stack-manifest"
              value={manifest}
              onChange={(e) => setManifest(e.target.value)}
              placeholder="package.json・composer.json・go.mod・Cargo.toml・Gemfile・requirements.txt の中身を貼る"
              className={`${textarea} h-20 font-mono text-2xs`}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                disabled={!manifest.trim()}
                onClick={() => importManifest(manifest)}
                className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink disabled:opacity-50"
              >
                読み取る
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
              >
                ファイルを選ぶ
              </button>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void file.text().then(importManifest);
                }}
              />
            </div>
            {note && <p className="mt-1.5 text-2xs leading-relaxed text-muted">{note}</p>}
          </section>

          <section>
            <label className={label} htmlFor="stack-terms">技術の名前</label>
            <textarea
              id="stack-terms"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"1行に1つ（例）\nNext.js\nSymfony\nPostgreSQL"}
              className={`${textarea} h-32`}
            />
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              記事のタイトルに出てくる名前で書きます。React・Express のような普通の英単語でもある名前は、大文字で始まるときだけ拾います。
            </p>
          </section>

          <section>
            <p className={label}>リリースを購読する</p>
            {pkgs.length === 0 ? (
              <p className="mt-1 text-2xs leading-relaxed text-muted">
                設定ファイルを読み込むと、依存パッケージの GitHub リリースをまとめて購読できます。
              </p>
            ) : (
              <>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={lookup.state === "loading"}
                    onClick={() => void findReleases()}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    {lookup.state === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <Icon.Search className="h-3.5 w-3.5" />}
                    {pkgs.length}個のパッケージのリリースを探す
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPkgs([]);
                      setLookup({ state: "idle" });
                    }}
                    className="text-2xs text-muted hover:text-danger"
                  >
                    パッケージを忘れる
                  </button>
                </div>
                {lookup.state === "loading" && (
                  <p className="mt-1.5 text-2xs text-muted">レジストリと GitHub に問い合わせています…（数十秒かかることがあります）</p>
                )}
                {lookup.state === "error" && (
                  <p className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{lookup.message}</p>
                )}
                {lookup.state === "done" && (
                  <ReleaseList
                    releases={lookup.releases}
                    checked={lookup.checked}
                    total={pkgs.length}
                    chosen={chosen}
                    subscribedUrls={subscribedUrls}
                    onToggle={(url) =>
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (next.has(url)) next.delete(url);
                        else next.add(url);
                        return next;
                      })
                    }
                    onSubscribe={() => {
                      onSubscribeReleases(lookup.releases.filter((r) => chosen.has(r.feedUrl)));
                      setChosen(new Set());
                    }}
                  />
                )}
              </>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink"
          >
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function ReleaseList({
  releases,
  checked,
  total,
  chosen,
  subscribedUrls,
  onToggle,
  onSubscribe,
}: {
  releases: StackRelease[];
  checked: number;
  total: number;
  chosen: Set<string>;
  subscribedUrls: Set<string>;
  onToggle: (url: string) => void;
  onSubscribe: () => void;
}) {
  if (releases.length === 0) {
    return <p className="mt-1.5 text-2xs text-muted">GitHub でリリースを公開しているパッケージは見つかりませんでした。</p>;
  }
  return (
    <div className="mt-2">
      <p className="text-2xs text-muted">
        {checked < total && `多いので先頭の${checked}個だけ調べました。`}
        {releases.length}件のリポジトリが見つかりました。
      </p>
      <ul className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-line bg-surface-2 p-1.5">
        {releases.map((r) => {
          const subscribed = subscribedUrls.has(r.feedUrl);
          return (
            <li key={r.feedUrl}>
              <label
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-ui ${subscribed ? "opacity-60" : "cursor-pointer hover:bg-line/50"}`}
              >
                <input
                  type="checkbox"
                  disabled={subscribed}
                  checked={subscribed || chosen.has(r.feedUrl)}
                  onChange={() => onToggle(r.feedUrl)}
                  className="accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{r.term}</span>
                  <span className="ml-1.5 text-2xs text-muted">{r.repo}</span>
                </span>
                {subscribed && <span className="shrink-0 text-2xs text-muted">購読中</span>}
                {!subscribed && r.feedUrl.endsWith("/tags.atom") && (
                  <span className="shrink-0 text-2xs text-muted" title="リリースを公開していないので、タグを購読します">
                    タグ
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={chosen.size === 0}
        onClick={onSubscribe}
        className="mt-2 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-ink disabled:opacity-50"
      >
        {chosen.size}件を購読する
      </button>
    </div>
  );
}
