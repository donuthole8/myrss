"use client";

import { useEffect, useRef, useState } from "react";
import { UNCATEGORIZED } from "@/lib/store";
import type { Feed } from "@/lib/types";
import { FeedIcon, Icon } from "./ui";

function Shell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon.Pencil className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="ml-auto rounded-md p-1 text-muted hover:bg-line/60 hover:text-ink"
          >
            <Icon.X />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">{children}</div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">{footer}</div>
      </div>
    </div>
  );
}

const label = "block text-2xs font-semibold uppercase tracking-wider text-muted";
const input =
  "mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";
const primary = "ml-auto rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50";
const danger =
  "rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:border-danger/50 hover:text-danger";

function useAutofocus() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);
  return ref;
}

export function EditFeedDialog({
  feed,
  folders,
  onSave,
  onRemove,
  onClose,
}: {
  feed: Feed;
  folders: string[];
  /** title を空で渡したら配信側のタイトルに戻す */
  onSave: (changes: { title: string; folder: string }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(feed.title);
  const [folder, setFolder] = useState(feed.folder);
  const ref = useAutofocus();

  const save = () => {
    onSave({ title: title.trim(), folder: folder.trim() });
    onClose();
  };

  return (
    <Shell
      title="フィードを編集"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`「${feed.title}」の購読を解除しますか？`)) {
                onRemove();
                onClose();
              }
            }}
            className={danger}
          >
            購読を解除
          </button>
          <button type="button" onClick={save} className={primary}>
            保存
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-xs text-muted">
          <FeedIcon siteUrl={feed.siteUrl} title={feed.title} size={16} />
          <span className="truncate" title={feed.url}>
            {feed.url}
          </span>
        </div>
        <div>
          <label className={label} htmlFor="feed-title">
            表示名
          </label>
          <input
            id="feed-title"
            ref={ref}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="空にすると配信元のタイトルに戻します"
            className={input}
          />
        </div>
        <div>
          <label className={label} htmlFor="feed-folder">
            フォルダ
          </label>
          <input
            id="feed-folder"
            list="edit-folder-options"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={UNCATEGORIZED}
            className={input}
          />
          <datalist id="edit-folder-options">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <p className="mt-1 text-2xs text-muted">新しい名前を入れるとフォルダを作ります。</p>
        </div>
        {/* Enter で保存するための見えない送信ボタン */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Shell>
  );
}

export function EditFolderDialog({
  name,
  feedCount,
  onRename,
  onUngroup,
  onRemoveAll,
  onClose,
}: {
  /** 空文字なら未分類 */
  name: string;
  feedCount: number;
  onRename: (next: string) => void;
  /** フォルダだけ消して、中のフィードは未分類に移す */
  onUngroup: () => void;
  onRemoveAll: () => void;
  onClose: () => void;
}) {
  const [next, setNext] = useState(name);
  const ref = useAutofocus();
  const uncategorized = name === "";

  const save = () => {
    const trimmed = next.trim();
    if (trimmed !== name) onRename(trimmed);
    onClose();
  };

  return (
    <Shell
      title={uncategorized ? `${UNCATEGORIZED}を整理` : "フォルダを編集"}
      onClose={onClose}
      footer={
        <>
          {!uncategorized && (
            <button
              type="button"
              onClick={() => {
                onUngroup();
                onClose();
              }}
              className={danger}
              title="中のフィードは購読したまま未分類に移します"
            >
              フォルダを解除
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`「${name || UNCATEGORIZED}」の ${feedCount} 件をすべて購読解除しますか？`)) {
                onRemoveAll();
                onClose();
              }
            }}
            className={danger}
          >
            まとめて購読解除
          </button>
          <button type="button" onClick={save} className={primary}>
            保存
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className={label} htmlFor="folder-name">
          {uncategorized ? "まとめて入れるフォルダ" : "フォルダ名"}
        </label>
        <input
          id="folder-name"
          ref={ref}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={uncategorized ? "新しいフォルダ名" : UNCATEGORIZED}
          className={input}
        />
        <p className="mt-1 text-2xs text-muted">
          {uncategorized
            ? `未分類の ${feedCount} 件をこのフォルダに移します。`
            : `既にあるフォルダ名にすると、${feedCount} 件をそちらにまとめます。空にすると未分類に戻します。`}
        </p>
      </form>
    </Shell>
  );
}
