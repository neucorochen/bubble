import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

type Position = { x: number; y: number };
type Drag = {
  pointerId: number;
  handle: HTMLDivElement;
  offset: Position;
  position: Position | null;
};

const desktopQuery = "(width > 1100px)";

function readPosition(key: string): Position | null {
  try {
    const value: Partial<Position> | null = JSON.parse(localStorage.getItem(key) ?? "null");
    if (typeof value?.x === "number" && Number.isFinite(value.x) &&
        typeof value.y === "number" && Number.isFinite(value.y)) {
      return { x: value.x, y: value.y };
    }
  } catch {
    // The default CSS position also works when storage is unavailable.
  }
  return null;
}

function clampPosition(position: Position, player: HTMLElement): Position {
  const { width, height } = player.getBoundingClientRect();
  const viewport = document.documentElement;
  return {
    x: Math.max(0, Math.min(position.x, viewport.clientWidth - width)),
    y: Math.max(0, Math.min(position.y, viewport.clientHeight - height)),
  };
}

export function useMusicPlayerPosition(compact: boolean, visible: boolean) {
  const storageKey = `music-player-position-${compact ? "compact" : "full"}`;
  const playerRef = useRef<HTMLElement>(null);
  const savedPosition = useRef<Position | null>(null);
  const modeSwitchPosition = useRef<Position | null>(null);
  const drag = useRef<Drag | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const player = playerRef.current;
    if (!visible || !player) return;
    const desktop = window.matchMedia(desktopQuery);
    const switchedPosition = modeSwitchPosition.current;
    modeSwitchPosition.current = null;
    savedPosition.current = switchedPosition
      ? clampPosition(switchedPosition, player)
      : readPosition(storageKey);
    if (switchedPosition) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedPosition.current));
      } catch {
        // Keep the position in memory when storage is unavailable.
      }
    }

    function restorePosition() {
      const target = drag.current?.position ?? savedPosition.current;
      setPosition(desktop.matches && target && player ? clampPosition(target, player) : null);
    }

    const observer = new ResizeObserver(restorePosition);
    observer.observe(player);
    window.addEventListener("resize", restorePosition);
    desktop.addEventListener("change", restorePosition);
    restorePosition();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", restorePosition);
      desktop.removeEventListener("change", restorePosition);
      const active = drag.current;
      drag.current = null;
      if (active?.handle.hasPointerCapture(active.pointerId)) {
        active.handle.releasePointerCapture(active.pointerId);
      }
    };
  }, [storageKey, visible]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const player = playerRef.current;
    if (!player || drag.current || event.pointerType !== "mouse" || event.button !== 0 ||
        !window.matchMedia(desktopQuery).matches ||
        (event.target instanceof Element && event.target.closest(".music-player__window-controls"))) return;

    const { left, top } = player.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      handle: event.currentTarget,
      offset: { x: event.clientX - left, y: event.clientY - top },
      position: null,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    const player = playerRef.current;
    if (!active || active.pointerId !== event.pointerId || !player || !window.matchMedia(desktopQuery).matches) return;

    active.position = clampPosition({
      x: event.clientX - active.offset.x,
      y: event.clientY - active.offset.y,
    }, player);
    setPosition(active.position);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (active.handle.hasPointerCapture(event.pointerId)) {
      active.handle.releasePointerCapture(event.pointerId);
    }

    const player = playerRef.current;
    const desktop = window.matchMedia(desktopQuery).matches;
    if (event.type === "pointerup" && active.position && player && desktop) {
      savedPosition.current = clampPosition(active.position, player);
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedPosition.current));
      } catch {
        // Keep the chosen position in the current view when storage is unavailable.
      }
    }
    setPosition(desktop && player && savedPosition.current ? clampPosition(savedPosition.current, player) : null);
  }

  function prepareModeSwitch() {
    const player = playerRef.current;
    if (!player || !window.matchMedia(desktopQuery).matches) return;
    const { left, top } = player.getBoundingClientRect();
    modeSwitchPosition.current = { x: left, y: top };
  }

  return {
    playerRef,
    prepareModeSwitch,
    style: position ? { "--player-left": `${position.x}px`, "--player-top": `${position.y}px` } as CSSProperties : undefined,
    handleEvents: { onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag, onLostPointerCapture: finishDrag },
  };
}
