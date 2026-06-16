import { useEffect, useState } from "react";
import type { GlitchSnapshot } from "../types";
import { BodyPanel } from "./BodyPanel";
import { FloatingChat } from "./FloatingChat";
import { normalizeBodyState } from "./bodyState";

export function BodyStandalonePage({ mode }: { mode: "body" | "floating" }) {
  const floating = mode === "floating";

  // Desktop floating mode — separate component with chat
  if (floating) return <FloatingChat />;

  // Full standalone /body page
  const [snapshot, setSnapshot] = useState<GlitchSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <main className="body-standalone full">
      <div className="body-standalone-shell">
        <header className="body-standalone-header">
          <span>RIN_BODY</span>
          <strong>Body</strong>
          <a href="/glitch-core">Glitch Core</a>
        </header>
        <BodyPanel
          currentState={currentState}
          compact={false}
          floating={false}
          showControls
        />
        {error ? <p className="body-standalone-error">{error}</p> : null}
      </div>
    </main>
  );
}
