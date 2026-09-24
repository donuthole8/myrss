"use client";

import { useEffect, useState } from "react";
import { parseKeywords } from "@/lib/prefer";
import type { Density, Persisted, ReadingFont, ReadingSize } from "@/lib/store";
import { DAILY_COUNTS, type DailyCount } from "@/lib/today";
import { Icon, Segmented } from "./ui";

type Props = {
  translate: boolean;
  onToggleTranslate: () => void;
  translateError: string | null;
  filters: Persisted["filters"];
  onSaveFilters: (filters: Persisted["filters"]) => void;
  /** 学習に使った記事数 [気になる, 興味なし] */
  events: [number, number];
  onResetModel: () => void;
  density: Density;
  onChangeDensity: (density: Density) => void;
  readingSize: ReadingSize;
  onChangeReadingSize: (size: ReadingSize) => void;
  readingFont: ReadingFont;
  onChangeReadingFont: (font: ReadingFont) => void;
  dailyCount: DailyCount;
  onChangeDailyCount: (count: DailyCount) => void;
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
  density,
  onChangeDensity,
  readingSize,
  onChangeReadingSize,
  readingFont,
  onChangeReadingFont,
  dailyCount,
  onChangeDailyCount,
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

  const label = "block text-2xs font-semibold uppercase tracking-wider text-muted";
  const textarea =
    "mt-1 h-20 w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-ui outline-none placeholder:text-muted focus:border-accent";

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
            <p className={label}>表示</p>
            <div className="mt-2 space-y-2.5 text-ui">
              <div className="flex items-center justify-between gap-3">
                <span>記事一覧</span>
                <Segmented
                  label="記事一覧の表示"
                  value={density}
                  onChange={onChangeDensity}
                  options={[
                    { value: "comfortable", label: "標準" },
                    { value: "compact", label: "コンパクト" },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>今日の分</span>
                <Segmented
                  label="今日の分の本数"
                  value={String(dailyCount) as `${DailyCount}`}
                  onChange={(v) => onChangeDailyCount(Number(v) as DailyCount)}
                  options={DAILY_COUNTS.map((n) => ({ value: String(n) as `${DailyCount}`, label: `${n}本` }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>本文の文字</span>
                <Segmented
                  label="本文の文字の大きさ"
                  value={readingSize}
                  onChange={onChangeReadingSize}
                  options={[
                    { value: "s", label: "小" },
                    { value: "m", label: "中" },
                    { value: "l", label: "大" },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>本文の書体</span>
                <Segmented
                  label="本文の書体"
                  value={readingFont}
                  onChange={onChangeReadingFont}
                  options={[
                    { value: "serif", label: "明朝" },
                    { value: "sans", label: "ゴシック" },
                  ]}
                />
              </div>
            </div>
          </section>

          <section>
            <label className="flex cursor-pointer items-center gap-2 text-ui font-medium">
              <input type="checkbox" checked={translate} onChange={onToggleTranslate} className="accent-[var(--accent)]" />
              英語タイトルを日本語訳で表示する
            </label>
            <p className="mt-1 pl-6 text-2xs leading-relaxed text-muted">
              DeepL API Free で訳します。一度訳したタイトルはこの端末に保存し、二度は訳しません。
            </p>
            {translateError && (
              <p className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
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
            <p className="mt-1 text-2xs text-muted">含む記事は「おすすめ」で上に来ます。英語記事は訳したタイトルでも照合します。</p>
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
            <p className="mt-1 text-2xs text-muted">タイトルに含む記事は、スター付き以外のすべての一覧から隠します。</p>
          </section>

          <section>
            <p className={label}>好みの学習</p>
            <p className="mt-1 text-xs leading-relaxed">
              気になった記事 <span className="font-semibold tabular-nums">{events[0]}</span> 件 ·
              興味なし <span className="font-semibold tabular-nums">{events[1]}</span> 件
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              記事を開く・スターで「気になる」、「興味なし」(D) や開かずに一括既読で「興味なし」として覚えます。
              学習はこの端末の中だけで行い、外部には送りません。
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("学習した好みをリセットしますか？")) onResetModel();
              }}
              className="mt-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-danger"
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
