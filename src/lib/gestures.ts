import { useRef } from "react";

/** これだけ動いたら縦か横かを決める */
const LOCK_PX = 12;

type TouchHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
};

/**
 * 横スワイプ。縦スクロールと取り合わないよう、最初の動きで縦か横かを決めて、
 * 横と決まったときだけ onMove / onEnd を呼ぶ。
 * スワイプした直後の click (指を離したときに飛んでくる) は consumeClick() で捨てる。
 */
export function useHorizontalSwipe({
  canStart,
  onMove,
  onEnd,
}: {
  /** 始点で判定する。コードブロックなど横スクロールする場所では false を返す */
  canStart?: (e: React.TouchEvent) => boolean;
  onMove: (dx: number) => void;
  onEnd: (dx: number) => void;
}): { handlers: TouchHandlers; consumeClick: () => boolean } {
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"none" | "h" | "v">("none");
  const dx = useRef(0);
  const swiped = useRef(false);

  const finish = (commit: boolean) => {
    if (mode.current === "h") onEnd(commit ? dx.current : 0);
    start.current = null;
    mode.current = "none";
    dx.current = 0;
  };

  return {
    handlers: {
      onTouchStart: (e) => {
        swiped.current = false;
        if (e.touches.length !== 1 || (canStart && !canStart(e))) {
          start.current = null;
          return;
        }
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        mode.current = "none";
        dx.current = 0;
      },
      onTouchMove: (e) => {
        if (!start.current) return;
        const x = e.touches[0].clientX - start.current.x;
        const y = e.touches[0].clientY - start.current.y;
        if (mode.current === "none") {
          if (Math.abs(x) > LOCK_PX && Math.abs(x) > Math.abs(y) * 1.5) mode.current = "h";
          else if (Math.abs(y) > LOCK_PX) mode.current = "v";
        }
        if (mode.current !== "h") return;
        swiped.current = true;
        dx.current = x;
        onMove(x);
      },
      onTouchEnd: () => finish(true),
      onTouchCancel: () => finish(false),
    },
    consumeClick: () => {
      const was = swiped.current;
      swiped.current = false;
      return was;
    },
  };
}

/** 引っ張って更新。これ以上引いて離したら更新する */
export const PULL_TRIGGER_PX = 64;
const PULL_MAX_PX = 96;

/**
 * 一覧の先頭で下に引っ張ると更新する。1フレームごとに一覧全体を描き直さないよう、
 * 引いた量は state にせず onPull で直接 DOM に当ててもらう。
 */
export function usePullToRefresh({
  scroller,
  onPull,
  onRefresh,
  disabled,
}: {
  scroller: React.RefObject<HTMLElement | null>;
  /** 引いている量 (px)。0 で元に戻す */
  onPull: (px: number) => void;
  onRefresh: () => void;
  disabled?: boolean;
}): TouchHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);
  const pulled = useRef(0);

  const reset = () => {
    start.current = null;
    if (pulled.current !== 0) onPull(0);
    pulled.current = 0;
  };

  return {
    onTouchStart: (e) => {
      const top = scroller.current?.scrollTop ?? 1;
      start.current =
        !disabled && e.touches.length === 1 && top <= 0
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
    },
    onTouchMove: (e) => {
      if (!start.current) return;
      const x = e.touches[0].clientX - start.current.x;
      const y = e.touches[0].clientY - start.current.y;
      // 上に戻した・横スワイプだった・途中でスクロールした なら引っ張りではない
      if (y <= 0 || Math.abs(x) > y || (scroller.current?.scrollTop ?? 0) > 0) {
        reset();
        return;
      }
      pulled.current = Math.min(PULL_MAX_PX, y * 0.5);
      onPull(pulled.current);
    },
    onTouchEnd: () => {
      if (pulled.current >= PULL_TRIGGER_PX) onRefresh();
      reset();
    },
    onTouchCancel: reset,
  };
}

/** 横スワイプを始めてはいけない場所 (それ自体が横スクロールする要素、画面左端のブラウザの戻る操作) */
export function startsInHorizontalScroller(e: React.TouchEvent): boolean {
  const target = e.target as Element | null;
  if (e.touches[0] && e.touches[0].clientX < 20) return true;
  return !!target?.closest("pre, table, iframe, video, audio, input, textarea");
}

const LONG_PRESS_MS = 500;

/**
 * 長押し (タッチ) と右クリックで、`data-longpress` を付けた要素を onLongPress に渡す。
 * 行ごとにフックを持たせずに済むよう、親に1つだけ付けて対象は data 属性で探す。
 * 長押しのあとに飛んでくる click は consumeClick() で捨てる。
 */
export function useLongPress(onLongPress: (target: HTMLElement) => void): {
  handlers: TouchHandlers & { onContextMenu: (e: React.MouseEvent) => void };
  consumeClick: () => boolean;
} {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  const targetOf = (node: EventTarget | null) =>
    (node as Element | null)?.closest<HTMLElement>("[data-longpress]") ?? null;

  return {
    handlers: {
      onTouchStart: (e) => {
        fired.current = false;
        clear();
        const target = targetOf(e.target);
        if (!target || e.touches.length !== 1) return;
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        timer.current = window.setTimeout(() => {
          fired.current = true;
          timer.current = null;
          navigator.vibrate?.(10);
          onLongPress(target);
        }, LONG_PRESS_MS);
      },
      onTouchMove: (e) => {
        if (!start.current) return;
        const x = e.touches[0].clientX - start.current.x;
        const y = e.touches[0].clientY - start.current.y;
        if (Math.hypot(x, y) > 10) clear();
      },
      onTouchEnd: clear,
      onTouchCancel: clear,
      // Android は長押しでも contextmenu が来るので、タイマーで開いた後なら二重に開かない
      onContextMenu: (e) => {
        const target = targetOf(e.target);
        if (!target) return;
        e.preventDefault();
        if (!fired.current) onLongPress(target);
      },
    },
    consumeClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
