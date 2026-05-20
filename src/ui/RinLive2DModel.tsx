import type { BodyState } from "../body";

type RinLive2DModelProps = {
  state?: BodyState;
  compact?: boolean;
};

const assetRoot = "/live2d/rin";

export function RinLive2DModel({
  state,
  compact = false,
}: RinLive2DModelProps) {
  const expression = state?.expression ?? "neutral";
  const motion = state?.motion ?? "idle-breathing";
  const mouthSync = state?.mouthSync ?? "idle";

  return (
    <div
      className={`rin-live2d rin-live2d-art-model ${
        compact ? "rin-live2d-compact" : ""
      }`}
      data-expression={expression}
      data-motion={motion}
      data-mouth-sync={mouthSync}
      aria-label="RIN Live2D layered MVP model"
    >
      <div
        className="rin-live2d-art-stage"
        role="img"
        aria-label="RIN black and emerald fox AI companion model"
      >
        <div className="rin-live2d-aura" />
        <img
          className="rin-live2d-tail-art"
          src={`${assetRoot}/rin-tail-large.png`}
          alt=""
          draggable={false}
        />
        <img
          className="rin-live2d-fullbody"
          src={`${assetRoot}/rin-bust-front.png`}
          alt=""
          draggable={false}
        />
        <div className="rin-live2d-mark-glow" />
        <div className="rin-live2d-eye-glint rin-live2d-eye-glint-left" />
        <div className="rin-live2d-eye-glint rin-live2d-eye-glint-right" />
      </div>
    </div>
  );
}
