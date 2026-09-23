"use client";

import { useEffect, useRef, useState } from "react";
import { CATALOG_SIZE } from "@/lib/presets";
import type { Candidate } from "@/lib/types";
import { FeedIcon, Icon, Spinner } from "./ui";

type Props = {
  folders: string[];
  subscribedUrls: Set<string>;
  onClose: () => void;
  onSubscribe: (candidates: Candidate[], folder: string) => void;
  /** おすすめフィードの一覧を開く */
  onBrowse: () => void;
};

export function AddFeedDialog({ folders, subscribedUrls, onClose, onSubscribe, onBrowse }: Props) {
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // 開くたびにマウントし直される前提なので、初期化は不要。フォーカスだけ当てる
  useEffect(() => {
    const id = window.setTimeout(() => input.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const search = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setBusy(true);
    setError(null);
    setCandidates(null);
    try {
      const res = await fetch(`/api/discover?url=${encodeURIComponent(withScheme)}`);
      const data = (await res.json()) as { candidates?: Candidate[]; error?: string };
      if (!res.ok || !data.candidates?.length) {
        setError(data.error ?? "フィードが見つかりませんでした");
      } else {
        setCandidates(data.candidates);
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="フィードを追加"
        className="flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon.Plus className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">フィードを追加</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="ml-auto rounded-md p-1 text-muted hover:bg-line/60 hover:text-ink"
          >
            <Icon.X />
          </button>
        </div>

        <div className="scroll-thin overflow-y-auto px-4 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            className="flex gap-2"
          >
            <input
              ref={input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="サイトURL または フィードURL"
              className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Icon.Search />}
              探す
            </button>
          </form>

          <p className="mt-2 text-[11px] text-muted">
            サイトのトップページを入れると、ページ内のフィード指定と定番パスから自動で探します。
          </p>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-500">
              {error}
            </p>
          )}

          {candidates && (
            <>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                フォルダ
              </label>
              <input
                list="folder-options"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="未分類"
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] outline-none placeholder:text-muted focus:border-accent"
              />
              <datalist id="folder-options">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>

              <ul className="mt-3 space-y-1.5">
                {candidates.map((candidate) => {
                  const already = subscribedUrls.has(candidate.url);
                  return (
                    <li key={candidate.url}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => {
                          onSubscribe([candidate], folder.trim());
                          onClose();
                        }}
                        className="flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left transition-colors hover:border-accent disabled:opacity-50 disabled:hover:border-line"
                      >
                        <FeedIcon siteUrl={candidate.siteUrl} title={candidate.title} size={18} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{candidate.title}</span>
                          <span className="block truncate text-[11px] text-muted">{candidate.url}</span>
                          {candidate.description && (
                            <span className="mt-0.5 block line-clamp-2 text-[11.5px] text-muted">
                              {candidate.description}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-muted">
                          {already ? "購読済み" : `${candidate.itemCount}件`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {!candidates && (
            <button
              type="button"
              onClick={onBrowse}
              className="mt-5 flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-3 text-left transition-colors hover:border-accent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon.Sparkle className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">おすすめフィードから選ぶ</span>
                <span className="block text-[11.5px] text-muted">
                  Qiita トレンド・AI・企業テックブログなど {CATALOG_SIZE} 件。中身を見てワンクリックで追加
                </span>
              </span>
              <Icon.Chevron className="h-4 w-4 text-muted" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
