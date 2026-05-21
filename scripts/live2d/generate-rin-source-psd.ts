import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { initializeCanvas, writePsdBuffer } from "ag-psd";
import type { Layer, PixelData, Psd } from "ag-psd";
import { PNG } from "pngjs";

type LayerGroupId = "face-guides" | "accessory-guides" | "composite" | "references";

type LayerRecipe = {
  id: string;
  name: string;
  source: string;
  output: string;
  group: LayerGroupId;
  left: number;
  top: number;
  hidden?: boolean;
  cubismUse: string;
};

type LoadedLayer = LayerRecipe & {
  imageData: PixelData;
  width: number;
  height: number;
  devPath: string;
};

const projectRoot = process.cwd();
const runtimeAssetRoot = join(projectRoot, "public/live2d/rin");
const sourceArtRoot = join(projectRoot, "live2d-development/01_source_art");
const layerOutputRoot = join(
  projectRoot,
  "live2d-development/02_layered_assets/rin-cubism-source-layers",
);
const psdOutputPath = join(sourceArtRoot, "rin-layered-source.psd");
const manifestOutputPath = join(sourceArtRoot, "rin-layered-source-manifest.json");
const previewOutputPath = join(layerOutputRoot, "composite_preview.png");

const psdCanvas = {
  width: 900,
  height: 1120,
};

const recipes: LayerRecipe[] = [
  {
    id: "mouthSetGuide",
    name: "GUIDE_mouth_set__split_into_mouth_parts",
    source: "rin-mouth-set.png",
    output: "guide_mouth_set.png",
    group: "face-guides",
    left: 42,
    top: 410,
    hidden: true,
    cubismUse:
      "Reference only. Split into mouth line, inner mouth, teeth, tongue, and open/closed shapes for the production PSD.",
  },
  {
    id: "eyesDetailGuide",
    name: "GUIDE_eyes_detail__split_left_right",
    source: "rin-eyes-detail.png",
    output: "guide_eyes_detail.png",
    group: "face-guides",
    left: 42,
    top: 270,
    hidden: true,
    cubismUse:
      "Reference only. Split into left/right eye whites, irises, pupils, highlights, upper lashes, lower lashes, and brows.",
  },
  {
    id: "earPairGuide",
    name: "GUIDE_ear_pair__split_left_right",
    source: "rin-ear-pair.png",
    output: "guide_ear_pair.png",
    group: "face-guides",
    left: 42,
    top: 110,
    hidden: true,
    cubismUse:
      "Reference only. Split into left/right outer ears and inner fur layers before Cubism mesh work.",
  },
  {
    id: "foxMaskGuide",
    name: "GUIDE_fox_mask__accessory_reference",
    source: "rin-fox-mask.png",
    output: "guide_fox_mask.png",
    group: "accessory-guides",
    left: 630,
    top: 430,
    hidden: true,
    cubismUse:
      "Accessory reference. Use as a separate fox mask ArtMesh once the production body PSD is split.",
  },
  {
    id: "ponytailGuide",
    name: "GUIDE_ponytail__hair_reference",
    source: "rin-ponytail.png",
    output: "guide_ponytail.png",
    group: "accessory-guides",
    left: 570,
    top: 90,
    hidden: true,
    cubismUse:
      "Hair reference. Use as ponytail source for sway deformers after manual layer cleanup.",
  },
  {
    id: "bustFront",
    name: "RIN_bust_front__composite_placeholder",
    source: "rin-bust-front.png",
    output: "rin_bust_front_composite.png",
    group: "composite",
    left: 287,
    top: 145,
    cubismUse:
      "Visible interim body layer. Replace with split head, face, hair, clothes, hands, and accessory layers for final Cubism authoring.",
  },
  {
    id: "tailBack",
    name: "RIN_tail_back__artmesh_source",
    source: "rin-tail-large.png",
    output: "rin_tail_back.png",
    group: "composite",
    left: 500,
    top: 365,
    cubismUse:
      "Visible interim tail layer. Split base fur and emerald tip before final tail physics setup.",
  },
  {
    id: "frontBodyNoTailReference",
    name: "REF_front_body_no_tail__hidden",
    source: "rin-front-body-no-tail.png",
    output: "ref_front_body_no_tail.png",
    group: "references",
    left: 252,
    top: 50,
    hidden: true,
    cubismUse:
      "Hidden full-body reference without tail for manual redraw and layer alignment.",
  },
  {
    id: "frontFullBodyReference",
    name: "REF_front_fullbody__hidden",
    source: "rin-front-fullbody.png",
    output: "ref_front_fullbody.png",
    group: "references",
    left: 184,
    top: 50,
    hidden: true,
    cubismUse:
      "Hidden full-body reference for proportions, outfit placement, and tail alignment.",
  },
];

initializeCanvas(
  () => {
    throw new Error("Canvas is not required for RIN PSD generation.");
  },
  (width, height) => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }),
);

async function main() {
  await mkdir(sourceArtRoot, { recursive: true });
  await mkdir(layerOutputRoot, { recursive: true });

  const layers = await Promise.all(recipes.map(loadLayer));

  for (const layer of layers) {
    assertLayerWithinCanvas(layer);
  }

  const compositeImageData = composeCompositeImage(layers);
  await writePng(previewOutputPath, compositeImageData);

  const psd: Psd = {
    width: psdCanvas.width,
    height: psdCanvas.height,
    children: [
      layerGroup("10_FACE_GUIDES__hidden", true, layers, "face-guides"),
      layerGroup(
        "20_ACCESSORY_GUIDES__hidden",
        true,
        layers,
        "accessory-guides",
      ),
      layerGroup("30_MODEL_COMPOSITE__visible", false, layers, "composite"),
      layerGroup("90_FULLBODY_REFERENCES__hidden", true, layers, "references"),
    ],
    imageData: compositeImageData,
  };

  await writeFile(psdOutputPath, writePsdBuffer(psd, { compress: true }));

  const manifest = {
    schemaVersion: 1,
    id: "rin-cubism-source-psd-v1",
    generatedAt: "deterministic",
    generatedBy: "npm run live2d:source-psd",
    sourceRuntimeFolder: "public/live2d/rin",
    psdPath: "live2d-development/01_source_art/rin-layered-source.psd",
    manifestPath:
      "live2d-development/01_source_art/rin-layered-source-manifest.json",
    layerFolder: "live2d-development/02_layered_assets/rin-cubism-source-layers",
    compositePreview:
      "live2d-development/02_layered_assets/rin-cubism-source-layers/composite_preview.png",
    canvas: psdCanvas,
    layerOrder: "PSD children are written top-to-bottom.",
    groups: [
      "10_FACE_GUIDES__hidden",
      "20_ACCESSORY_GUIDES__hidden",
      "30_MODEL_COMPOSITE__visible",
      "90_FULLBODY_REFERENCES__hidden",
    ],
    layers: layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      group: layer.group,
      source: `public/live2d/rin/${layer.source}`,
      output: relativeProjectPath(layer.devPath),
      left: layer.left,
      top: layer.top,
      width: layer.width,
      height: layer.height,
      hidden: layer.hidden === true,
      cubismUse: layer.cubismUse,
    })),
    cubismReadiness: {
      productionReady: false,
      reason:
        "This PSD organizes the current cutout assets for Cubism handoff, but it is not a final ArtMesh-ready PSD. The composite bust still needs manual separation into facial, hair, clothing, and accessory parts.",
      requiredManualWork: [
        "Split bust composite into clean head, face, eye, brow, mouth, hair, clothes, hand, charm, and mask layers.",
        "Separate left/right paired parts for symmetric parameters.",
        "Redraw hidden areas needed for head turns and mouth/eye deformation.",
        "Import the cleaned PSD into Live2D Cubism Editor and build ArtMeshes, deformers, physics, expressions, and motions.",
      ],
    },
  };

  await writeFile(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`PSD: ${relativeProjectPath(psdOutputPath)}`);
  console.log(`Manifest: ${relativeProjectPath(manifestOutputPath)}`);
  console.log(`Preview: ${relativeProjectPath(previewOutputPath)}`);
  for (const layer of layers) {
    console.log(`${layer.id}: ${relativeProjectPath(layer.devPath)}`);
  }
}

async function loadLayer(recipe: LayerRecipe): Promise<LoadedLayer> {
  const sourcePath = join(runtimeAssetRoot, recipe.source);
  const png = PNG.sync.read(await readFile(sourcePath));
  const devPath = join(layerOutputRoot, recipe.output);
  await writeFile(devPath, PNG.sync.write(png));

  return {
    ...recipe,
    imageData: {
      data: new Uint8Array(png.data),
      width: png.width,
      height: png.height,
    },
    width: png.width,
    height: png.height,
    devPath,
  };
}

function layerGroup(
  name: string,
  hidden: boolean,
  layers: LoadedLayer[],
  group: LayerGroupId,
): Layer {
  return {
    name,
    hidden,
    children: layers
      .filter((layer) => layer.group === group)
      .map((layer) => ({
        name: layer.name,
        hidden: layer.hidden === true,
        left: layer.left,
        top: layer.top,
        imageData: layer.imageData,
      })),
  };
}

function composeCompositeImage(layers: LoadedLayer[]): PixelData {
  const output: PixelData = {
    data: new Uint8ClampedArray(psdCanvas.width * psdCanvas.height * 4),
    width: psdCanvas.width,
    height: psdCanvas.height,
  };

  for (const layer of layers.filter((item) => item.group === "composite").reverse()) {
    blendLayer(output, layer.imageData, layer.left, layer.top);
  }

  return output;
}

function blendLayer(
  destination: PixelData,
  source: PixelData,
  left: number,
  top: number,
) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const targetX = left + x;
      const targetY = top + y;

      if (
        targetX < 0 ||
        targetX >= destination.width ||
        targetY < 0 ||
        targetY >= destination.height
      ) {
        continue;
      }

      const sourceIndex = (y * source.width + x) * 4;
      const destinationIndex = (targetY * destination.width + targetX) * 4;
      const sourceAlpha = source.data[sourceIndex + 3] / 255;

      if (sourceAlpha === 0) {
        continue;
      }

      const destinationAlpha = destination.data[destinationIndex + 3] / 255;
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

      for (let channel = 0; channel < 3; channel += 1) {
        const sourceColor = source.data[sourceIndex + channel];
        const destinationColor = destination.data[destinationIndex + channel];
        destination.data[destinationIndex + channel] =
          outputAlpha === 0
            ? 0
            : Math.round(
                (sourceColor * sourceAlpha +
                  destinationColor * destinationAlpha * (1 - sourceAlpha)) /
                  outputAlpha,
              );
      }

      destination.data[destinationIndex + 3] = Math.round(outputAlpha * 255);
    }
  }
}

async function writePng(path: string, imageData: PixelData) {
  const png = new PNG({ width: imageData.width, height: imageData.height });
  png.data = Buffer.from(imageData.data);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, PNG.sync.write(png));
}

function assertLayerWithinCanvas(layer: LoadedLayer) {
  const right = layer.left + layer.width;
  const bottom = layer.top + layer.height;

  if (
    layer.left < 0 ||
    layer.top < 0 ||
    right > psdCanvas.width ||
    bottom > psdCanvas.height
  ) {
    throw new Error(
      `${layer.id} is outside the PSD canvas: ${layer.left},${layer.top},${right},${bottom}`,
    );
  }
}

function relativeProjectPath(path: string): string {
  return path.replace(`${projectRoot}/`, "");
}

await main();
