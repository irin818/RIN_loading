import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
};

type AssetModel = {
  id: string;
  runtimeModelId: string;
  assets: Record<string, RuntimeAsset>;
  layers: Array<{ id: string; asset?: string; type?: string }>;
  parameters: Array<{ id: string; min: number; max: number; default: number }>;
  expressions: Record<string, { motion: string }>;
  motions: Record<string, { durationSeconds: number; loops: boolean }>;
  cubismExport: { available: boolean; reason: string };
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

  if (model.cubismExport.available) {
    throw new Error("Asset fallback model must not claim Cubism export exists.");
  }

  console.log(`Verified ${relativeProjectPath(modelPath)}`);
  console.log(`Assets: ${Object.keys(model.assets).length}`);
  console.log(`Expressions: ${Object.keys(model.expressions).length}`);
  console.log(`Motions: ${Object.keys(model.motions).length}`);
  console.log(`Parameters: ${model.parameters.length}`);
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

function relativeProjectPath(path: string): string {
  return path.replace(`${projectRoot}/`, "");
}

await main();
