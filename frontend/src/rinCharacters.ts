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
