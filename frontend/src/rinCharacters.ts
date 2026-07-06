export type RinCharacterAsset = {
  id: string;
  label: string;
  source: "core" | "imagel" | "bbb" | "local";
  pose: string;
  path: string;
  previewPath: string;
  custom?: boolean;
  stageScale?: number;
  stageX?: number;
  stageY?: number;
};

export function normalizeCharacterView(
  view: Partial<{ x: number; y: number; scale: number; cropTop: number; cropRight: number; cropBottom: number; cropLeft: number }> | undefined,
  fallback?: RinCharacterAsset
): { x: number; y: number; scale: number; cropTop: number; cropRight: number; cropBottom: number; cropLeft: number } {
  return {
    x: typeof view?.x === "number" && Number.isFinite(view.x) ? Math.min(420, Math.max(-420, view.x)) : (fallback?.stageX ?? 0),
    y: typeof view?.y === "number" && Number.isFinite(view.y) ? Math.min(320, Math.max(-320, view.y)) : (fallback?.stageY ?? 0),
    scale: typeof view?.scale === "number" && Number.isFinite(view.scale) ? Math.min(2.6, Math.max(0.45, view.scale)) : (fallback?.stageScale ?? 1),
    cropTop: typeof view?.cropTop === "number" && Number.isFinite(view.cropTop) ? Math.min(36, Math.max(0, view.cropTop)) : 0,
    cropRight: typeof view?.cropRight === "number" && Number.isFinite(view.cropRight) ? Math.min(36, Math.max(0, view.cropRight)) : 0,
    cropBottom: typeof view?.cropBottom === "number" && Number.isFinite(view.cropBottom) ? Math.min(36, Math.max(0, view.cropBottom)) : 0,
    cropLeft: typeof view?.cropLeft === "number" && Number.isFinite(view.cropLeft) ? Math.min(36, Math.max(0, view.cropLeft)) : 0,
  };
}

export const RIN_CHARACTER_ASSETS: RinCharacterAsset[] = [
  {
    id: "rin-00-core",
    label: "CORE DEFAULT",
    source: "core",
    pose: "standing",
    path: "/body-assets/rin/characters/rin-00-core.png",
    previewPath: "/body-assets/rin/characters/thumbs/rin-00-core.png",
    stageScale: 1.07,
    stageY: -4
  },
  {
    id: "rin-imagel-01-leap",
    label: "CLOVER LEAP",
    source: "imagel",
    pose: "leap",
    path: "/body-assets/rin/characters/rin-imagel-01-leap.png",
    previewPath: "/body-assets/rin/characters/thumbs/rin-imagel-01-leap.png",
    stageScale: 1.02,
    stageY: 0
  },
  {
    id: "rin-imagel-03-kneel",
    label: "QUIET KNEEL",
    source: "imagel",
    pose: "kneel",
    path: "/body-assets/rin/characters/rin-imagel-03-kneel.png",
    previewPath: "/body-assets/rin/characters/thumbs/rin-imagel-03-kneel.png",
    stageScale: 1.04,
    stageY: 8
  },
  {
    id: "rin-bbb-03-stand",
    label: "STATIC STAND",
    source: "bbb",
    pose: "stand",
    path: "/body-assets/rin/characters/rin-bbb-03-stand.png",
    previewPath: "/body-assets/rin/characters/thumbs/rin-bbb-03-stand.png",
    stageScale: 1.08,
    stageY: -2
  }
];
