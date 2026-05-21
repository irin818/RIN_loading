import type { BodyState } from "../body";
import { RIN_LIVE2D_ASSETS } from "../live2d/rinRuntime";

type RinLive2DModelProps = {
  state?: BodyState;
  compact?: boolean;
};

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
          src={RIN_LIVE2D_ASSETS.tailLarge}
          alt=""
          draggable={false}
        />
        <img
          className="rin-live2d-fullbody"
          src={RIN_LIVE2D_ASSETS.bustFront}
          alt=""
          draggable={false}
        />
        <div className="rin-live2d-mark-glow" />
        <div className="rin-live2d-eye-glint rin-live2d-eye-glint-left" />
        <div className="rin-live2d-eye-glint rin-live2d-eye-glint-right" />
        <svg
          className="rin-live2d-expression-overlay"
          viewBox="0 0 326 498"
          aria-hidden="true"
        >
          <g className="rin-live2d-mouth-overlay">
            <path
              className="rin-live2d-expression-path rin-live2d-mouth-smile"
              d="M149 254 Q163 263 177 254"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-mouth-frown"
              d="M149 259 Q163 251 177 259"
            />
            <path
              className="rin-live2d-expression-fill rin-live2d-mouth-open"
              d="M151 253 C157 264 170 264 176 253 C174 270 153 270 151 253 Z"
            />
          </g>
          <g className="rin-live2d-eye-overlay">
            <path
              className="rin-live2d-expression-path rin-live2d-eye-smile rin-live2d-eye-smile-left"
              d="M116 210 Q133 219 150 210"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-eye-smile rin-live2d-eye-smile-right"
              d="M176 210 Q194 219 212 210"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-eye-sleep rin-live2d-eye-sleep-left"
              d="M115 210 Q133 214 151 210"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-eye-sleep rin-live2d-eye-sleep-right"
              d="M175 210 Q194 214 213 210"
            />
          </g>
          <g className="rin-live2d-brow-overlay">
            <path
              className="rin-live2d-expression-path rin-live2d-brow-warning-left"
              d="M107 188 L150 198"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-brow-warning-right"
              d="M216 188 L173 198"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-brow-confused-left"
              d="M108 185 Q129 177 150 185"
            />
            <path
              className="rin-live2d-expression-path rin-live2d-brow-confused-right"
              d="M174 198 Q194 188 214 193"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
