import { useEffect, useMemo, useState } from "react";

import type { GlitchSnapshot } from "../types";
import { bodyStateFromSnapshot, normalizeBodyActivity } from "./bodyStateMapping";
import { BODY_MANIFEST_URL, loadLayeredAvatarManifest } from "./layeredAvatarManifest";
import { LayeredAvatarRenderer } from "./LayeredAvatarRenderer";
import { StaticFallbackRenderer } from "./StaticFallbackRenderer";
import type { BodyActivity, LayeredAvatarManifest } from "./types";
import { BODY_STATE_KEYS } from "./types";

export function BodyRenderer({
  snapshot,
  compact = false,
  floating = false,
  showDiagnostics = true
}: {
  snapshot: GlitchSnapshot | null;
  compact?: boolean;
  floating?: boolean;
  showDiagnostics?: boolean;
}) {
  const [manifest, setManifest] = useState<LayeredAvatarManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<BodyActivity | null>(null);
  const backendState = useMemo(() => bodyStateFromSnapshot(snapshot), [snapshot]);
  const activeState = previewState
    ? { ...backendState, activity: previewState, motion: previewState }
    : backendState;

  useEffect(() => {
    const controller = new AbortController();
    loadLayeredAvatarManifest(controller.signal)
      .then((loaded) => {
        setManifest(loaded);
        setManifestError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setManifestError(error instanceof Error ? error.message : "Body manifest load failed");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <section className={`body-renderer ${compact ? "compact" : ""} ${floating ? "floating" : ""}`}>
      <div className="body-renderer-stage">
        {manifest && !manifestError ? (
          <LayeredAvatarRenderer manifest={manifest} state={activeState} floating={floating} />
        ) : (
          <StaticFallbackRenderer
            state={activeState}
            message={manifestError ?? "Loading Layered Avatar manifest"}
          />
        )}
      </div>
      <div className="body-renderer-controls">
        <div className="body-state-buttons" aria-label="Body state preview">
          {BODY_STATE_KEYS.map((state) => (
            <button
              key={state}
              type="button"
              className={normalizeBodyActivity(activeState.activity) === state ? "active" : ""}
              onClick={() => setPreviewState(state)}
            >
              {state}
            </button>
          ))}
        </div>
        {previewState ? (
          <button type="button" className="body-reset-button" onClick={() => setPreviewState(null)}>
            follow runtime
          </button>
        ) : null}
      </div>
      {showDiagnostics ? (
        <dl className="body-diagnostics">
          <div>
            <dt>Active body renderer</dt>
            <dd>{snapshot?.body?.rendererLabel ?? "Layered Avatar"}</dd>
          </div>
          <div>
            <dt>Manifest</dt>
            <dd>{snapshot?.body?.publicManifestPath ?? BODY_MANIFEST_URL}</dd>
          </div>
          <div>
            <dt>Cubism / Live2D</dt>
            <dd>{snapshot?.body?.cubismStatus ?? "disabled_archived_future_route"}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
