export type BodyActivity =
  | "idle"
  | "thinking"
  | "speaking"
  | "memory"
  | "warning"
  | "error"
  | "sleeping"
  | "listening"
  | "reviewing";

export interface BodyStatePayload {
  activeRenderer: "layered" | string;
  activity: BodyActivity;
  expression: string;
  motion: string;
  intensity: number;
  attentionState: string;
  speechState: "silent" | "speaking" | string;
  warningLevel: number;
}

export interface BodyReportPayload {
  mode: string;
  status: string;
  adapterId: string;
  adapterKind: string;
  activeRenderer: string;
  rendererLabel: string;
  assetMode: string;
  manifestPath: string;
  publicManifestPath: string;
  cubismStatus: string;
  bodyState: BodyStatePayload;
  bodyReplaceable: boolean;
  identityStoredInBody: false;
  memoryStoredInBody: false;
  policyStoredInBody: false;
  providerCallCount: number;
  fullTextIncluded: false;
}

export interface LayeredAvatarLayer {
  id: string;
  kind?: "state-image" | "part" | string;
  src: string;
  zIndex: number;
  anchor?: [number, number];
  position?: [number, number];
  stateVisibility?: BodyActivity[];
  animationProfile?: string;
}

export interface LayeredAvatarStateConfig {
  label: string;
  image?: string;
  animation: string;
  animationProfile: string;
  effectProfile: string;
  expression: string;
  motion: string;
  intensity: number;
}

export interface LayeredAvatarManifest {
  name: string;
  version: number;
  type: "layered-avatar";
  activeRenderer: "layered";
  rendererType: "layered-avatar";
  assetMode: "state-images" | "layered-parts";
  defaultState: BodyActivity;
  cubismStatus: string;
  canvas: {
    targetHeightRatio: number;
    centerX: number;
    centerY: number;
    baseScale: number;
    safePadding: number;
  };
  layers: LayeredAvatarLayer[];
  states: Record<BodyActivity, LayeredAvatarStateConfig>;
  animations: Record<string, { description: string; cssClass: string }>;
  safety: {
    localOnly: boolean;
    rawPromptIncluded: false;
    rawMemoryIncluded: false;
    hiddenReasoningIncluded: false;
    secretValuesIncluded: false;
    providerCallsRequired: false;
  };
}

export const BODY_STATE_KEYS: BodyActivity[] = [
  "idle",
  "thinking",
  "speaking",
  "memory",
  "warning",
  "error",
  "sleeping",
  "listening",
  "reviewing"
];
