import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

type CropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AssetRecipe = {
  id: string;
  source: string;
  output: string;
  crop: CropBox;
  transparentBoardBackground?: boolean;
  keepLargestAlphaComponent?: boolean;
  trimPadding: number;
};

type GeneratedAsset = {
  id: string;
  path: string;
  width: number;
  height: number;
  source: string;
  crop: CropBox;
};

type CubismExportStatus = {
  available: boolean;
  reason: string;
  sourceFolder?: string;
  publicFolder?: string;
  model3Json?: string;
  sdkVersion?: string;
  files?: {
    moc3: string;
    textures: string[];
    displayInfo?: string;
  };
};

type CubismModel3 = {
  FileReferences?: {
    Moc?: string;
    Textures?: string[];
    DisplayInfo?: string;
  };
};

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "live2d-development/photo");
const outputRoot = join(projectRoot, "public/live2d/rin");
const cubismExportSourceRoot = join(
  projectRoot,
  "live2d-development/04_exports/rin-layered-source",
);
const cubismExportPublicRoot = join(
  outputRoot,
  "cubism/rin-layered-source",
);
const cubismModel3Filename = "rin-layered-source.model3.json";

const recipes: AssetRecipe[] = [
  {
    id: "bustFront",
    source: "image4.png",
    output: "rin-bust-front.png",
    crop: { x: 180, y: 34, width: 340, height: 498 },
    transparentBoardBackground: true,
    trimPadding: 8,
  },
  {
    id: "frontFullBody",
    source: "image3.png",
    output: "rin-front-fullbody.png",
    crop: { x: 42, y: 0, width: 533, height: 1016 },
    trimPadding: 10,
  },
  {
    id: "frontBodyNoTail",
    source: "image3.png",
    output: "rin-front-body-no-tail.png",
    crop: { x: 42, y: 0, width: 396, height: 1016 },
    trimPadding: 10,
  },
  {
    id: "tailLarge",
    source: "image3.png",
    output: "rin-tail-large.png",
    crop: { x: 1203, y: 420, width: 333, height: 540 },
    keepLargestAlphaComponent: true,
    trimPadding: 8,
  },
  {
    id: "foxMask",
    source: "image3.png",
    output: "rin-fox-mask.png",
    crop: { x: 1065, y: 330, width: 220, height: 305 },
    trimPadding: 10,
  },
  {
    id: "ponytail",
    source: "image3.png",
    output: "rin-ponytail.png",
    crop: { x: 925, y: 20, width: 290, height: 290 },
    trimPadding: 10,
  },
  {
    id: "earPair",
    source: "image3.png",
    output: "rin-ear-pair.png",
    crop: { x: 585, y: 35, width: 205, height: 136 },
    trimPadding: 10,
  },
  {
    id: "eyesDetail",
    source: "image3.png",
    output: "rin-eyes-detail.png",
    crop: { x: 588, y: 185, width: 240, height: 110 },
    trimPadding: 10,
  },
  {
    id: "mouthSet",
    source: "image3.png",
    output: "rin-mouth-set.png",
    crop: { x: 588, y: 300, width: 432, height: 190 },
    trimPadding: 10,
  },
];

async function main() {
  await mkdir(outputRoot, { recursive: true });

  const generatedAssets: GeneratedAsset[] = [];

  for (const recipe of recipes) {
    const sourcePath = join(sourceRoot, recipe.source);
    const source = PNG.sync.read(await readFile(sourcePath));
    let asset = cropPng(source, recipe.crop);

    if (recipe.transparentBoardBackground) {
      removeConnectedBoardBackground(asset);
    }

    if (recipe.keepLargestAlphaComponent) {
      keepLargestAlphaComponent(asset);
    }

    asset = trimTransparentBounds(asset, recipe.trimPadding);
    const outputPath = join(outputRoot, recipe.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, PNG.sync.write(asset));

    generatedAssets.push({
      id: recipe.id,
      path: `/live2d/rin/${recipe.output}`,
      width: asset.width,
      height: asset.height,
      source: `live2d-development/photo/${recipe.source}`,
      crop: recipe.crop,
    });
  }

  const cubismExport = await syncCubismExport();
  const manifest = {
    schemaVersion: 1,
    id: "rin-live2d-asset-runtime-v1",
    generatedAt: "deterministic",
    generatedBy: "npm run live2d:assets",
    sourceFolder: "live2d-development/photo",
    runtimeFolder: "public/live2d/rin",
    assets: Object.fromEntries(generatedAssets.map((asset) => [asset.id, asset])),
    expressions: [
      "neutral",
      "listening",
      "focused",
      "thinking",
      "happy",
      "warning",
      "sleepy",
      "confused",
      "slight-smile",
      "dissatisfied",
    ],
    motions: [
      "idle-breathing",
      "attentive-sway",
      "focused-still",
      "sleepy-breathing",
      "soft-sway",
    ],
    cubismExport,
  };

  await writeFile(
    join(outputRoot, "rin-runtime-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const assetModel = createAssetModel(generatedAssets, cubismExport);
  await writeFile(
    join(outputRoot, "rin-asset-model.json"),
    `${JSON.stringify(assetModel, null, 2)}\n`,
  );

  for (const asset of generatedAssets) {
    console.log(`${asset.id}: ${asset.path} ${asset.width}x${asset.height}`);
  }
}

function createAssetModel(
  generatedAssets: GeneratedAsset[],
  cubismExport: CubismExportStatus,
) {
  const assets = Object.fromEntries(
    generatedAssets.map((asset) => [
      asset.id,
      {
        path: asset.path,
        width: asset.width,
        height: asset.height,
      },
    ]),
  );

  return {
    schemaVersion: 1,
    id: "rin-live2d-asset-model-v1",
    runtimeModelId: "rin-live2d-layered-mvp-v1",
    generatedAt: "deterministic",
    generatedBy: "npm run live2d:assets",
    renderer: {
      type: "react-css-asset-layered-rig",
      component: "src/ui/RinLive2DModel.tsx",
      adapter: "src/body/rinLive2dAdapter.ts",
      fallbackForCubism: true,
    },
    canvas: {
      width: 326,
      height: 498,
      coordinateSystem: "bust-front-viewbox",
    },
    assets,
    layers: [
      {
        id: "tailBack",
        asset: "tailLarge",
        zIndex: 1,
        anchor: { rightPercent: -18, bottomPercent: -3, widthPercent: 48 },
        motion: ["idle-tail-sway", "attentive-tail-sway"],
      },
      {
        id: "bodyBust",
        asset: "bustFront",
        zIndex: 2,
        anchor: { leftPercent: 0, topPercent: 0, widthPercent: 100 },
        motion: ["breathing", "body-sway"],
      },
      {
        id: "expressionOverlay",
        type: "svg-overlay",
        zIndex: 4,
        viewBox: "0 0 326 498",
        motion: ["mouth-form", "mouth-open", "mark-glow", "eye-glint"],
      },
    ],
    parameters: [
      { id: "ParamAngleX", min: -30, max: 30, default: 0, implemented: "css-sway" },
      { id: "ParamAngleY", min: -30, max: 30, default: 0, implemented: "css-breathe" },
      { id: "ParamAngleZ", min: -30, max: 30, default: 0, implemented: "css-rotate" },
      { id: "ParamEyeLOpen", min: 0, max: 1, default: 1, implemented: "overlay-state" },
      { id: "ParamEyeROpen", min: 0, max: 1, default: 1, implemented: "overlay-state" },
      { id: "ParamMouthOpenY", min: 0, max: 1, default: 0, implemented: "svg-mouth-open" },
      { id: "ParamMouthForm", min: -1, max: 1, default: 0, implemented: "svg-mouth-form" },
      { id: "ParamBreath", min: 0, max: 1, default: 0.5, implemented: "css-breathe" },
      { id: "ParamRinTailSway", min: -1, max: 1, default: 0, implemented: "css-tail" },
      { id: "ParamRinAIMarkGlow", min: 0, max: 1, default: 0.45, implemented: "css-glow" },
    ],
    expressions: {
      neutral: { motion: "idle-breathing", mouthForm: 0, mouthOpen: 0, markGlow: 0.45 },
      listening: { motion: "attentive-sway", mouthForm: 0, mouthOpen: 0, markGlow: 0.55 },
      focused: { motion: "focused-still", mouthForm: 0, mouthOpen: 0, markGlow: 0.9 },
      thinking: { motion: "idle-breathing", mouthForm: 0, mouthOpen: 0, markGlow: 0.55 },
      happy: { motion: "soft-sway", mouthForm: 0.65, mouthOpen: 0, markGlow: 0.62 },
      warning: { motion: "focused-still", mouthForm: -0.55, mouthOpen: 0, markGlow: 1 },
      sleepy: { motion: "sleepy-breathing", mouthForm: -0.35, mouthOpen: 0, markGlow: 0.25 },
      confused: { motion: "idle-breathing", mouthForm: 0, mouthOpen: 0.7, markGlow: 0.55 },
      "slight-smile": { motion: "soft-sway", mouthForm: 0.45, mouthOpen: 0, markGlow: 0.55 },
      dissatisfied: { motion: "sleepy-breathing", mouthForm: -0.45, mouthOpen: 0, markGlow: 0.35 },
    },
    motions: {
      "idle-breathing": { durationSeconds: 4.2, loops: true },
      "attentive-sway": { durationSeconds: 3.8, loops: true },
      "focused-still": { durationSeconds: 6.8, loops: true },
      "sleepy-breathing": { durationSeconds: 6.2, loops: true },
      "soft-sway": { durationSeconds: 4.6, loops: true },
    },
    sourceHandoff: {
      psd: "live2d-development/01_source_art/rin-layered-source.psd",
      manifest: "live2d-development/01_source_art/rin-layered-source-manifest.json",
      layerFolder: "live2d-development/02_layered_assets/rin-cubism-source-layers",
    },
    cubismExport,
  };
}

async function syncCubismExport(): Promise<CubismExportStatus> {
  const sourceModel3Path = join(cubismExportSourceRoot, cubismModel3Filename);

  if (!(await fileExists(sourceModel3Path))) {
    return {
      available: false,
      reason:
        "No Cubism export folder was found. Run Cubism Editor export into live2d-development/04_exports/rin-layered-source first.",
    };
  }

  const model3 = JSON.parse(await readFile(sourceModel3Path, "utf8")) as CubismModel3;
  const references = model3.FileReferences;
  const moc3 = references?.Moc;
  const textures = references?.Textures ?? [];
  const displayInfo = references?.DisplayInfo;

  if (moc3 === undefined || textures.length === 0) {
    return {
      available: false,
      reason:
        "Cubism model3.json exists, but it does not reference both a .moc3 file and at least one texture.",
    };
  }

  const referencedFiles = [moc3, ...textures, displayInfo].filter(
    (file): file is string => file !== undefined,
  );
  const missingFiles: string[] = [];

  for (const file of referencedFiles) {
    if (!(await fileExists(join(cubismExportSourceRoot, file)))) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    return {
      available: false,
      reason: `Cubism export is incomplete. Missing: ${missingFiles.join(", ")}`,
    };
  }

  await rm(cubismExportPublicRoot, { recursive: true, force: true });
  await mkdir(dirname(cubismExportPublicRoot), { recursive: true });
  await cp(cubismExportSourceRoot, cubismExportPublicRoot, { recursive: true });

  return {
    available: true,
    reason:
      "Official Cubism Editor export is available and mirrored into public runtime assets.",
    sourceFolder: "live2d-development/04_exports/rin-layered-source",
    publicFolder: "public/live2d/rin/cubism/rin-layered-source",
    model3Json: `/live2d/rin/cubism/rin-layered-source/${cubismModel3Filename}`,
    sdkVersion: "Cubism 5.3",
    files: {
      moc3,
      textures,
      displayInfo,
    },
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function cropPng(source: PNG, crop: CropBox): PNG {
  const output = new PNG({ width: crop.width, height: crop.height });

  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const sourceX = crop.x + x;
      const sourceY = crop.y + y;
      const outputIndex = (y * crop.width + x) * 4;

      if (
        sourceX < 0 ||
        sourceX >= source.width ||
        sourceY < 0 ||
        sourceY >= source.height
      ) {
        output.data[outputIndex + 3] = 0;
        continue;
      }

      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      output.data[outputIndex] = source.data[sourceIndex];
      output.data[outputIndex + 1] = source.data[sourceIndex + 1];
      output.data[outputIndex + 2] = source.data[sourceIndex + 2];
      output.data[outputIndex + 3] = source.data[sourceIndex + 3];
    }
  }

  return output;
}

function removeConnectedBoardBackground(png: PNG) {
  const queue: Array<[number, number]> = [];
  const seen = new Uint8Array(png.width * png.height);

  for (let x = 0; x < png.width; x += 1) {
    queue.push([x, 0], [x, png.height - 1]);
  }

  for (let y = 0; y < png.height; y += 1) {
    queue.push([0, y], [png.width - 1, y]);
  }

  while (queue.length > 0) {
    const next = queue.pop();

    if (next === undefined) {
      continue;
    }

    const [x, y] = next;

    if (x < 0 || x >= png.width || y < 0 || y >= png.height) {
      continue;
    }

    const seenIndex = y * png.width + x;

    if (seen[seenIndex] === 1) {
      continue;
    }

    seen[seenIndex] = 1;

    const dataIndex = seenIndex * 4;

    if (!isLightBoardBackground(png.data, dataIndex)) {
      continue;
    }

    png.data[dataIndex + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function isLightBoardBackground(data: Buffer, index: number): boolean {
  const alpha = data[index + 3];

  if (alpha === 0) {
    return true;
  }

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);

  return red > 218 && green > 222 && blue > 222 && max - min < 30;
}

function keepLargestAlphaComponent(png: PNG) {
  const seen = new Uint8Array(png.width * png.height);
  const components: Array<{ count: number; pixels: number[] }> = [];

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const startIndex = y * png.width + x;

      if (seen[startIndex] === 1) {
        continue;
      }

      seen[startIndex] = 1;

      if (png.data[startIndex * 4 + 3] === 0) {
        continue;
      }

      const pixels: number[] = [];
      const queue: Array<[number, number]> = [[x, y]];

      while (queue.length > 0) {
        const next = queue.pop();

        if (next === undefined) {
          continue;
        }

        const [currentX, currentY] = next;
        const currentIndex = currentY * png.width + currentX;

        if (png.data[currentIndex * 4 + 3] === 0) {
          continue;
        }

        pixels.push(currentIndex);

        queueAlphaNeighbor(png, seen, queue, currentX + 1, currentY);
        queueAlphaNeighbor(png, seen, queue, currentX - 1, currentY);
        queueAlphaNeighbor(png, seen, queue, currentX, currentY + 1);
        queueAlphaNeighbor(png, seen, queue, currentX, currentY - 1);
      }

      components.push({ count: pixels.length, pixels });
    }
  }

  const largest = components.sort((left, right) => right.count - left.count)[0];

  if (largest === undefined) {
    return;
  }

  const kept = new Uint8Array(png.width * png.height);

  for (const pixel of largest.pixels) {
    kept[pixel] = 1;
  }

  for (let index = 0; index < kept.length; index += 1) {
    if (kept[index] === 0) {
      png.data[index * 4 + 3] = 0;
    }
  }
}

function queueAlphaNeighbor(
  png: PNG,
  seen: Uint8Array,
  queue: Array<[number, number]>,
  x: number,
  y: number,
) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) {
    return;
  }

  const index = y * png.width + x;

  if (seen[index] === 1) {
    return;
  }

  seen[index] = 1;

  if (png.data[index * 4 + 3] !== 0) {
    queue.push([x, y]);
  }
}

function trimTransparentBounds(source: PNG, padding: number): PNG {
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = source.data[(y * source.width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return source;
  }

  return cropPng(source, {
    x: Math.max(minX - padding, 0),
    y: Math.max(minY - padding, 0),
    width: Math.min(maxX + padding + 1, source.width) - Math.max(minX - padding, 0),
    height:
      Math.min(maxY + padding + 1, source.height) - Math.max(minY - padding, 0),
  });
}

await main();
