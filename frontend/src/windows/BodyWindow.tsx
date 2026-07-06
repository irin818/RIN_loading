import { memo } from "react";
import { BodyPanel } from "../body/BodyPanel";
import { normalizeBodyState } from "../body/bodyState";
import type { GlitchSnapshot } from "../types";

export const BodyWindow = memo(function BodyWindow({
  snapshot,
}: {
  snapshot: GlitchSnapshot | null;
}) {
  const currentState = normalizeBodyState(snapshot?.body?.currentState);
  return (
    <div className="body-window">
      <div className="module-strip">ACTIVE BODY</div>
      <BodyPanel currentState={currentState} compact showControls />
      <div className="body-window-links">
        <a href="/body" target="_blank" rel="noreferrer">Open /body</a>
        <a href="/body/floating" target="_blank" rel="noreferrer">Open /body/floating</a>
      </div>
    </div>
  );
});
