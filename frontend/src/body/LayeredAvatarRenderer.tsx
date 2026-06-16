import type { CSSProperties } from "react";

import { bodyAssetUrl } from "./layeredAvatarManifest";
import { effectClassForState, motionClassForState } from "./layeredMotion";
import type { BodyStatePayload, LayeredAvatarManifest, LayeredAvatarLayer } from "./types";

export function LayeredAvatarRenderer({
  manifest,
  state,
  floating = false
}: {
  manifest: LayeredAvatarManifest;
  state: BodyStatePayload;
  floating?: boolean;
}) {
  const stateConfig = manifest.states[state.activity] ?? manifest.states[manifest.defaultState];
  const motionClass = motionClassForState(manifest, state.activity);
  const effectClass = effectClassForState(state.activity);
  const imageSrc = stateConfig.image
    ? bodyAssetUrl(stateConfig.image)
    : bodyAssetUrl("assets/body/rin_default.png");
  const visibleLayers = manifest.layers
    .filter((layer) => !layer.stateVisibility || layer.stateVisibility.includes(state.activity))
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);

  const canvasStyle = {
    "--avatar-scale": manifest.canvas?.baseScale ?? 1,
    "--avatar-center-x": manifest.canvas?.centerX ?? 0.5,
    "--avatar-center-y": manifest.canvas?.centerY ?? 0.54,
    "--avatar-target-height-ratio": manifest.canvas?.targetHeightRatio ?? 0.86,
    "--avatar-safe-padding": manifest.canvas?.safePadding ?? 0.08,
  } as React.CSSProperties;

  return (
    <figure
      className={`layered-avatar state-${state.activity} ${motionClass} ${effectClass} ${floating ? "floating" : ""}`}
      style={canvasStyle}
      aria-label={`RIN Layered Avatar state: ${stateConfig.label}`}
    >
      <div className="avatar-stage-effects" aria-hidden="true">
        <span className="avatar-aura" />
        <span className="avatar-scan-ring ring-a" />
        <span className="avatar-scan-ring ring-b" />
        <span className="avatar-state-grid" />
      </div>
      <div className="avatar-layer-stack">
        {manifest.assetMode === "layered-parts"
          ? visibleLayers.map((layer) => (
              <AvatarLayer key={layer.id} layer={layer} activity={state.activity} />
            ))
          : (
              <img
                className="avatar-state-image avatar-primary-image"
                src={imageSrc}
                alt=""
                draggable={false}
              />
            )}
      </div>
      <figcaption className="avatar-caption">
        <span>{stateConfig.label}</span>
        <small>{manifest.assetMode}</small>
      </figcaption>
    </figure>
  );
}

function AvatarLayer({
  layer,
  activity
}: {
  layer: LayeredAvatarLayer;
  activity: BodyStatePayload["activity"];
}) {
  const style = {
    zIndex: layer.zIndex,
    "--layer-x": `${layer.position?.[0] ?? 0}px`,
    "--layer-y": `${layer.position?.[1] ?? 0}px`,
    "--anchor-x": `${(layer.anchor?.[0] ?? 0.5) * 100}%`,
    "--anchor-y": `${(layer.anchor?.[1] ?? 1) * 100}%`
  } as CSSProperties;
  return (
    <img
      className={`avatar-layer avatar-layer-${layer.id} layer-state-${activity}`}
      src={bodyAssetUrl(layer.src)}
      alt=""
      draggable={false}
      style={style}
    />
  );
}
