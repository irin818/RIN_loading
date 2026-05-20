import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  beginBodyShellDrag,
  defaultBodyShellState,
  endBodyShellDrag,
  moveBodyShell,
  placeBodyShell,
  registerBodyShellClick,
  settleBodyShell,
  type BodyShellPosition,
  type BodyShellState,
  type BodyState,
} from "../body";
import { RinLive2DModel } from "./RinLive2DModel";

type RinBodyShellProps = {
  state?: BodyState;
  adapterId?: string;
};

type DragSession = {
  pointerId: number;
  origin: BodyShellPosition;
  startPosition: BodyShellPosition;
  moved: boolean;
};

export function RinBodyShell({ state, adapterId = "unknown" }: RinBodyShellProps) {
  const [shellState, setShellState] =
    useState<BodyShellState>(defaultBodyShellState);
  const dragSession = useRef<DragSession | null>(null);

  useEffect(() => {
    if (shellState.bubble === null || shellState.isDragging) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShellState(settleBodyShell);
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [shellState.bubble, shellState.isDragging, shellState.reaction]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragSession.current = {
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      startPosition: shellState.position,
      moved: false,
    };
    setShellState(beginBodyShellDrag);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const session = dragSession.current;

    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    const delta = {
      x: event.clientX - session.origin.x,
      y: event.clientY - session.origin.y,
    };

    if (Math.abs(delta.x) + Math.abs(delta.y) > 4) {
      session.moved = true;
    }

    setShellState((current) =>
      placeBodyShell(current, {
        x: session.startPosition.x + delta.x,
        y: session.startPosition.y + delta.y,
      }),
    );
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const session = dragSession.current;

    if (session === null || session.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragSession.current = null;
    setShellState((current) =>
      session.moved ? endBodyShellDrag(current) : registerBodyShellClick(current),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moveStep = 18;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setShellState(registerBodyShellClick);
      return;
    }

    const movementByKey: Record<string, BodyShellPosition> = {
      ArrowDown: { x: 0, y: moveStep },
      ArrowLeft: { x: -moveStep, y: 0 },
      ArrowRight: { x: moveStep, y: 0 },
      ArrowUp: { x: 0, y: -moveStep },
    };
    const movement = movementByKey[event.key];

    if (movement !== undefined) {
      event.preventDefault();
      setShellState((current) => moveBodyShell(current, movement));
    }
  }

  const actorStyle = {
    "--body-x": `${shellState.position.x}px`,
    "--body-y": `${shellState.position.y}px`,
  } as CSSProperties;

  return (
    <section
      className="body-stage"
      aria-label="RIN desktop body shell / RIN 桌面身体壳"
    >
      <div
        className="body-shell-actor"
        data-reaction={shellState.reaction}
        data-dragging={shellState.isDragging ? "true" : "false"}
        role="button"
        tabIndex={0}
        style={actorStyle}
        aria-label={`RIN body shell. Adapter ${adapterId}. Expression ${
          state?.expression ?? "offline"
        }.`}
        onKeyDown={handleKeyDown}
        onPointerCancel={finishPointer}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
      >
        {shellState.bubble ? (
          <div className="body-bubble" aria-live="polite">
            <span>{shellState.bubble.english}</span>
            <span>{shellState.bubble.chinese}</span>
          </div>
        ) : null}
        <RinLive2DModel state={state} />
      </div>
    </section>
  );
}
