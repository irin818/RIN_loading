import { memo, useCallback } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { ConsoleWindow } from "../types";

const WINDOW_META_CODES: Record<string, string> = {
  body: "BODY",
  chat: "CHAT",
  memory: "MEM",
  memoryDetail: "MEM+",
  tasks: "TASK",
  settings: "SET",
  developer: "DEV",
  error: "ERR",
};

function windowTypeClass(type: string) {
  return type.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export const WindowFrame = memo(function WindowFrame({
  win,
  active,
  children,
  onFocus,
  onUpdate,
  onClose,
  onMinimize,
  onMaximize,
}: {
  win: ConsoleWindow;
  active: boolean;
  children: ReactNode;
  onFocus: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ConsoleWindow>) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
}) {
  const style: CSSProperties = win.maximized
    ? { zIndex: win.zIndex }
    : {
        transform: `translate(${win.x}px, ${win.y}px)`,
        width: `${win.width}px`,
        height: `${win.height}px`,
        zIndex: win.zIndex,
      };

  const WINDOW_MIN_Y = 64; // keep title bar below top system-menu (top:10 + height:52)

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (win.maximized) return;
    event.preventDefault();
    onFocus(win.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = win.x;
    const originY = win.y;
    const move = (moveEvent: PointerEvent) => {
      onUpdate(win.id, {
        x: Math.max(0, originX + moveEvent.clientX - startX),
        y: Math.max(WINDOW_MIN_Y, originY + moveEvent.clientY - startY),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }, [win.id, win.maximized, win.x, win.y, onFocus, onUpdate]);

  const beginResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onFocus(win.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originWidth = win.width;
    const originHeight = win.height;
    const move = (moveEvent: PointerEvent) => {
      onUpdate(win.id, {
        width: Math.max(300, originWidth + moveEvent.clientX - startX),
        height: Math.max(220, originHeight + moveEvent.clientY - startY),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }, [win.id, win.width, win.height, onFocus, onUpdate]);

  return (
    <section
      className={`os-window window-${windowTypeClass(win.type)} ${active ? "focused" : ""} ${win.maximized ? "maximized" : ""}`}
      data-window-type={win.type}
      style={style}
      onPointerDown={() => onFocus(win.id)}
    >
      <div className="window-titlebar" onPointerDown={beginDrag} onDoubleClick={() => onMaximize(win.id)}>
        <div>
          <span className="window-led" />
          <span className="window-type-badge">{WINDOW_META_CODES[win.type] ?? win.type.toUpperCase()}</span>
          <strong>{win.title}</strong>
        </div>
        <div className="window-controls">
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onMinimize(win.id)}>_</button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onMaximize(win.id)}>□</button>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onClose(win.id)}>×</button>
        </div>
      </div>
      <div className="window-body">{children}</div>
      {!win.maximized ? <div className="resize-handle" onPointerDown={beginResize} /> : null}
    </section>
  );
});
