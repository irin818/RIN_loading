import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { initializeCanvas, readPsd } from "ag-psd";
import type { Layer, Psd } from "ag-psd";

type FlatLayer = {
  name: string;
  path: string;
  hasChildren: boolean;
  hasImageData: boolean;
  hidden: boolean;
};

const projectRoot = process.cwd();
const psdPath = join(
  projectRoot,
  "live2d-development/01_source_art/rin-layered-source.psd",
);
const expectedCanvas = {
  width: 900,
  height: 1120,
};
const expectedGroups = [
  "10_FACE_GUIDES__hidden",
  "20_ACCESSORY_GUIDES__hidden",
  "30_MODEL_COMPOSITE__visible",
  "90_FULLBODY_REFERENCES__hidden",
];
const expectedBitmapLayers = [
  "GUIDE_mouth_set__split_into_mouth_parts",
  "GUIDE_eyes_detail__split_left_right",
  "GUIDE_ear_pair__split_left_right",
  "GUIDE_fox_mask__accessory_reference",
  "GUIDE_ponytail__hair_reference",
  "RIN_bust_front__composite_placeholder",
  "RIN_tail_back__artmesh_source",
  "REF_front_body_no_tail__hidden",
  "REF_front_fullbody__hidden",
];

initializeCanvas(
  () => {
    throw new Error("Canvas is not required for RIN PSD verification.");
  },
  (width, height) => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }),
);

async function main() {
  const psd = readPsd(await readFile(psdPath), {
    skipCompositeImageData: true,
    skipThumbnail: true,
    useImageData: true,
  });

  assertPsdShape(psd);

  const flattened = flattenLayers(psd.children ?? []);
  const names = flattened.map((layer) => layer.name);
  const duplicateNames = names.filter(
    (name, index) => names.indexOf(name) !== index,
  );

  if (duplicateNames.length > 0) {
    throw new Error(`Duplicate PSD layer names: ${duplicateNames.join(", ")}`);
  }

  for (const expectedGroup of expectedGroups) {
    assertIncludes(names, expectedGroup, "group");
  }

  for (const expectedLayer of expectedBitmapLayers) {
    assertIncludes(names, expectedLayer, "bitmap layer");
  }

  const bitmapLayers = flattened.filter((layer) =>
    expectedBitmapLayers.includes(layer.name),
  );

  for (const layer of bitmapLayers) {
    if (!layer.hasImageData) {
      throw new Error(`Bitmap layer missing image data: ${layer.path}`);
    }
  }

  console.log(
    `Verified ${relativeProjectPath(psdPath)}: ${flattened.length} layers/groups`,
  );
  console.log(`Groups: ${expectedGroups.length}`);
  console.log(`Bitmap layers: ${bitmapLayers.length}`);
}

function assertPsdShape(psd: Psd) {
  if (psd.width !== expectedCanvas.width || psd.height !== expectedCanvas.height) {
    throw new Error(
      `Unexpected PSD canvas ${psd.width}x${psd.height}; expected ${expectedCanvas.width}x${expectedCanvas.height}`,
    );
  }

  if ((psd.children ?? []).length !== expectedGroups.length) {
    throw new Error(
      `Unexpected root group count ${(psd.children ?? []).length}; expected ${expectedGroups.length}`,
    );
  }
}

function flattenLayers(layers: Layer[], parentPath = ""): FlatLayer[] {
  return layers.flatMap((layer) => {
    const path = parentPath.length > 0 ? `${parentPath}/${layer.name}` : layer.name;
    const current = {
      name: layer.name ?? "(unnamed)",
      path,
      hasChildren: Array.isArray(layer.children),
      hasImageData: layer.imageData !== undefined,
      hidden: layer.hidden === true,
    };

    return [
      current,
      ...(layer.children ? flattenLayers(layer.children, path) : []),
    ];
  });
}

function assertIncludes(names: string[], expected: string, type: string) {
  if (!names.includes(expected)) {
    throw new Error(`Missing expected PSD ${type}: ${expected}`);
  }
}

function relativeProjectPath(path: string): string {
  return path.replace(`${projectRoot}/`, "");
}

await main();
