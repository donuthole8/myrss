"use client";

import { useEffect, useState } from "react";
import { parseKeywords } from "@/lib/prefer";
import type { Persisted } from "@/lib/store";
import { Icon } from "./ui";

type Props = {
  translate: boolean;
  onToggleTranslate: () => void;
  translateError: string | null;
  filters: Persisted["filters"];
  onSaveFilters: (filters: Persisted["filters"]) => void;
  /** 学習に使った記事数 [気になる, 興味なし] */
  events: [number, number];
  onResetModel: () => void;
  onClose: () => void;
};

export function PrefsDialog({
  translate,
  onToggleTranslate,
  translateError,
  filters,
  onSaveFilters,
  events,
  onResetModel,
  onClose,
}: Props) {
  const [mute, setMute] = useState(filters.mute.join("\n"));
  const [interest, setInterest] = useState(filters.interest.join("\n"));

  // 閉じるときにキーワードを確定させる。保存ボタンを押し忘れても消えないように
  const close = () => {
    onSaveFilters({ mute: parseKeywords(mute), interest: parseKeywords(interest) });
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const label = "block text-[11px] font-semibold uppercase tracking-wider text-muted";
  const textarea =
    "mt-1 h-20 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] outline-none placeholder:text-muted focus:border-accent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="表示と好みの設定"
        className="flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon.Sliders className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">表示と好みの設定</h2>
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
          <section>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
              <input type="checkbox" checked={translate} onChange={onToggleTranslate} className="accent-[var(--accent)]" />
              英語タイトルを日本語訳で表示する
            </label>
            <p className="mt-1 pl-6 text-[11.5px] leading-relaxed text-muted">
              DeepL API Free で訳します。一度訳したタイトルはこの端末に保存し、二度は訳しません。
            </p>
            {translateError && (
              <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-500">
                {translateError}
              </p>
            )}
          </section>

          <section>
            <label className={label} htmlFor="interest-words">興味のあるキーワード</label>
            <textarea
              id="interest-words"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder={"1行に1つ（例）\nRust\nエージェント\nNext.js"}
              className={textarea}
            />
            <p className="mt-1 text-[11.5px] text-muted">含む記事は「おすすめ」で上に来ます。英語記事は訳したタイトルでも照合します。</p>
          </section>

          <section>
            <label className={label} htmlFor="mute-words">ミュートするキーワード</label>
            <textarea
              id="mute-words"
              value={mute}
              onChange={(e) => setMute(e.target.value)}
              placeholder={"1行に1つ（例）\nPR\n転職\n仮想通貨"}
              className={textarea}
            />
            <p className="mt-1 text-[11.5px] text-muted">タイトルに含む記事は、スター付き以外のすべての一覧から隠します。</p>
          </section>

          <section>
            <p className={label}>好みの学習</p>
            <p className="mt-1 text-[12.5px] leading-relaxed">
              気になった記事 <span className="font-semibold tabular-nums">{events[0]}</span> 件 ·
              興味なし <span className="font-semibold tabular-nums">{events[1]}</span> 件
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              記事を開く・スターで「気になる」、「興味なし」(D) や開かずに一括既読で「興味なし」として覚えます。
              学習はこの端末の中だけで行い、外部には送りません。
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("学習した好みをリセットしますか？")) onResetModel();
              }}
              className="mt-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-red-500"
            >
              学習をリセット
            </button>
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
