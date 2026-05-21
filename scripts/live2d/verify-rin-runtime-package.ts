import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

type RuntimeAsset = {
  path: string;
  width: number;
  height: number;
};

type RuntimeManifest = {
  assets: Record<string, RuntimeAsset>;
  expressions: string[];
  motions: string[];
  cubismExport: CubismExportStatus;
};

type CubismExportStatus = {
  available: boolean;
  reason: string;
  model3Json?: string;
  files?: {
    moc3?: string;
    textures?: string[];
    displayInfo?: string;
  };
};

type AssetModel = {
  id: string;
  runtimeModelId: string;
  assets: Record<string, RuntimeAsset>;
  layers: Array<{ id: string; asset?: string; type?: string }>;
  parameters: Array<{ id: string; min: number; max: number; default: number }>;
  expressions: Record<string, { motion: string }>;
  motions: Record<string, { durationSeconds: number; loops: boolean }>;
  cubismExport: CubismExportStatus;
};

type CubismModel3 = {
  FileReferences?: {
    Moc?: string;
    Textures?: string[];
    DisplayInfo?: string;
  };
};

const projectRoot = process.cwd();
const publicRoot = join(projectRoot, "public");
const runtimeFolder = join(publicRoot, "live2d/rin");
const manifestPath = join(runtimeFolder, "rin-runtime-manifest.json");
const modelPath = join(runtimeFolder, "rin-asset-model.json");

async function main() {
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as RuntimeManifest;
  const model = JSON.parse(await readFile(modelPath, "utf8")) as AssetModel;

  if (model.id !== "rin-live2d-asset-model-v1") {
    throw new Error(`Unexpected asset model id: ${model.id}`);
  }

  if (model.runtimeModelId !== "rin-live2d-layered-mvp-v1") {
    throw new Error(`Unexpected runtime model id: ${model.runtimeModelId}`);
  }

  assertSameKeys(Object.keys(manifest.assets), Object.keys(model.assets), "asset");
  assertSameKeys(manifest.expressions, Object.keys(model.expressions), "expression");
  assertSameKeys(manifest.motions, Object.keys(model.motions), "motion");

  for (const [assetId, asset] of Object.entries(model.assets)) {
    const pngPath = join(publicRoot, asset.path.replace(/^\//, ""));
    const png = PNG.sync.read(await readFile(pngPath));

    if (png.width !== asset.width || png.height !== asset.height) {
      throw new Error(
        `${assetId} dimension mismatch: model ${asset.width}x${asset.height}, file ${png.width}x${png.height}`,
      );
    }
  }

  for (const layer of model.layers) {
    if (layer.asset !== undefined && !(layer.asset in model.assets)) {
      throw new Error(`Layer ${layer.id} references missing asset ${layer.asset}`);
    }
  }

  for (const [expression, value] of Object.entries(model.expressions)) {
    if (!(value.motion in model.motions)) {
      throw new Error(
        `Expression ${expression} references missing motion ${value.motion}`,
      );
    }
  }

  const requiredParameters = [
    "ParamAngleX",
    "ParamAngleY",
    "ParamAngleZ",
    "ParamEyeLOpen",
    "ParamEyeROpen",
    "ParamMouthOpenY",
    "ParamMouthForm",
    "ParamBreath",
    "ParamRinTailSway",
    "ParamRinAIMarkGlow",
  ];
  const parameterIds = new Set(model.parameters.map((parameter) => parameter.id));

  for (const parameter of requiredParameters) {
    if (!parameterIds.has(parameter)) {
      throw new Error(`Missing runtime parameter ${parameter}`);
    }
  }

  if (model.cubismExport.available !== manifest.cubismExport.available) {
    throw new Error(
      `Cubism export availability mismatch: manifest=${manifest.cubismExport.available}, model=${model.cubismExport.available}`,
    );
  }

  if (model.cubismExport.available) {
    await verifyCubismExport(model.cubismExport);
  }

  console.log(`Verified ${relativeProjectPath(modelPath)}`);
  console.log(`Assets: ${Object.keys(model.assets).length}`);
  console.log(`Expressions: ${Object.keys(model.expressions).length}`);
  console.log(`Motions: ${Object.keys(model.motions).length}`);
  console.log(`Parameters: ${model.parameters.length}`);
  console.log(
    `Cubism export: ${
      model.cubismExport.available ? model.cubismExport.model3Json : "not available"
    }`,
  );
}

async function verifyCubismExport(cubismExport: CubismExportStatus) {
  if (cubismExport.model3Json === undefined) {
    throw new Error("Cubism export is marked available but has no model3Json path.");
  }

  const model3Path = join(publicRoot, cubismExport.model3Json.replace(/^\//, ""));
  const model3 = JSON.parse(await readFile(model3Path, "utf8")) as CubismModel3;
  const references = model3.FileReferences;
  const moc3 = references?.Moc;
  const textures = references?.Textures ?? [];

  if (moc3 === undefined) {
    throw new Error(`Cubism model3.json has no Moc reference: ${model3Path}`);
  }

  if (textures.length === 0) {
    throw new Error(`Cubism model3.json has no texture references: ${model3Path}`);
  }

  const model3Root = dirname(model3Path);
  await readFile(resolveRelativeExportFile(model3Root, moc3));

  for (const texture of textures) {
    const texturePath = resolveRelativeExportFile(model3Root, texture);
    const png = PNG.sync.read(await readFile(texturePath));

    if (png.width <= 0 || png.height <= 0) {
      throw new Error(`Invalid Cubism texture dimensions: ${texture}`);
    }
  }

  if (references?.DisplayInfo !== undefined) {
    await readFile(resolveRelativeExportFile(model3Root, references.DisplayInfo));
  }
}

function assertSameKeys(left: string[], right: string[], label: string) {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  if (leftSorted.join("\n") !== rightSorted.join("\n")) {
    throw new Error(
      `Runtime ${label} keys differ.\nmanifest=${leftSorted.join(", ")}\nmodel=${rightSorted.join(", ")}`,
    );
  }
}

function resolveRelativeExportFile(base: string, relativePath: string): string {
  if (
    relativePath.startsWith("/") ||
    relativePath.split(/[\\/]+/).includes("..")
  ) {
    throw new Error(`Cubism export reference must be relative: ${relativePath}`);
  }

  return join(base, relativePath);
}

function relativeProjectPath(path: string): string {
  return path.replace(`${projectRoot}/`, "");
}

await main();
