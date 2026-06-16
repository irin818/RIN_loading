import type { LayeredAvatarManifest } from "./types";

export const BODY_MANIFEST_URL = "/body-assets/rin-layered/manifest.json";
export const BODY_ASSET_BASE_URL = "/body-assets/rin-layered/";

let cachedManifest: LayeredAvatarManifest | null = null;

export async function loadLayeredAvatarManifest(
  signal?: AbortSignal
): Promise<LayeredAvatarManifest> {
  if (cachedManifest) {
    return cachedManifest;
  }
  const response = await fetch(BODY_MANIFEST_URL, {
    signal,
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Body manifest unavailable (${response.status})`);
  }
  const payload = (await response.json()) as LayeredAvatarManifest;
  if (payload.type !== "layered-avatar" || payload.activeRenderer !== "layered") {
    throw new Error("Body manifest does not describe the Layered Avatar renderer");
  }
  cachedManifest = payload;
  return payload;
}

export function bodyAssetUrl(relativePath: string): string {
  return `${BODY_ASSET_BASE_URL}${relativePath.replace(/^\/+/, "")}`;
}
