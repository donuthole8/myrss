"use client";

import { useEffect } from "react";
import { Icon } from "./ui";

const SHORTCUTS: Array<[string, string]> = [
  ["J / ↓", "次の記事"],
  ["K / ↑", "前の記事"],
  ["O / Enter", "元記事を新しいタブで開く"],
  ["M", "既読 / 未読を切り替える"],
  ["S", "スターを付け外しする"],
  ["U", "未読のみ表示を切り替える"],
  ["R", "すべてのフィードを更新"],
  ["A", "フィードを追加"],
  ["/", "検索にフォーカス"],
  ["?", "このヘルプ"],
  ["Esc", "検索解除 / ダイアログを閉じる"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="キーボードショートカット"
        className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon.Keyboard className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">キーボードショートカット</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="ml-auto rounded-md p-1 text-muted hover:bg-line/60 hover:text-ink"
          >
            <Icon.X />
          </button>
        </div>
        <dl className="divide-y divide-line/70">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys} className="flex items-center gap-3 px-4 py-2">
              <dt className="w-24 shrink-0">
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-[13px]">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
