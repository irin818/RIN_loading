import { BODY_ASSET_BASE_URL } from "./layeredAvatarManifest";
import type { BodyStatePayload } from "./types";

export function StaticFallbackRenderer({
  state,
  message
}: {
  state: BodyStatePayload;
  message: string;
}) {
  return (
    <div className={`body-fallback state-${state.activity}`}>
      <img
        src={`${BODY_ASSET_BASE_URL}assets/body/rin_default.png`}
        alt="RIN Layered Avatar fallback"
      />
      <p>{message}</p>
    </div>
  );
}
