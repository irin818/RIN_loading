import { useCallback, useEffect, useRef, useState } from "react";
import type { GlitchSnapshot } from "../types";
import { BodyPanel } from "./BodyPanel";
import { BODY_STATES, normalizeBodyState, type BodyState } from "./bodyState";

export function BodyStandalonePage({ mode }: { mode: "body" | "floating" }) {
  const floating = mode === "floating";
  const [snapshot, setSnapshot] = useState<GlitchSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [floatingState, setFloatingState] = useState<BodyState>("默认");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback(() => {
    if (!floating) return;
    const delay = 3000 + Math.random() * 7000; // 3-10 seconds
    timerRef.current = setTimeout(() => {
      const others = BODY_STATES.filter((s) => s !== floatingState);
      const next = others[Math.floor(Math.random() * others.length)];
      setFloatingState(next);
      scheduleNext();
    }, delay);
  }, [floating, floatingState]);

  useEffect(() => {
    if (!floating) return;
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [floating, scheduleNext]);

  useEffect(() => {
    if (!floating) return;
    const root = document.getElementById("root");
    if (!root) return;
    const html = document.documentElement;
    const prev: string[] = [
      html.style.background,
      document.body.style.background,
      root.style.background,
    ];
    html.style.background = "transparent";
    document.body.style.background = "transparent";
    root.style.background = "transparent";
    return () => {
      html.style.background = prev[0];
      document.body.style.background = prev[1];
      root.style.background = prev[2];
    };
  }, [floating]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/glitch-core/snapshot", { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Snapshot unavailable (${res.status})`);
        setSnapshot((await res.json()) as GlitchSnapshot);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => ctrl.abort();
  }, []);

  const currentState = normalizeBodyState(
    snapshot?.body?.currentState ?? "默认",
  );

  return (
    <main className={`body-standalone ${floating ? "floating" : "full"}`}>
      <div className="body-standalone-shell">
        <header className="body-standalone-header">
          <span>RIN_BODY</span>
          <strong>Body</strong>
          <a href="/glitch-core">Glitch Core</a>
        </header>
        <BodyPanel
          currentState={currentState}
          forcedState={floating ? floatingState : null}
          compact={floating}
          floating={floating}
          showControls={!floating}
        />
        {error ? <p className="body-standalone-error">{error}</p> : null}
      </div>
    </main>
  );
}
