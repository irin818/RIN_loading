export interface SimpleBodyManifest {
  name: string;
  version: number;
  defaultState: string;
  states: Record<string, { label: string; image: string }>;
}

const MANIFEST_URL = "/body-assets/rin/manifest.json";
const ASSET_BASE = "/body-assets/rin/";

let cachedManifest: SimpleBodyManifest | null = null;

export async function loadBodyManifest(
  signal?: AbortSignal,
): Promise<SimpleBodyManifest> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(MANIFEST_URL, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Body manifest unavailable (${res.status})`);
  }
  const data = (await res.json()) as SimpleBodyManifest;
  if (!data.states || typeof data.states !== "object") {
    throw new Error("Invalid body manifest: missing states");
  }
  cachedManifest = data;
  return data;
}

export function bodyImageUrl(manifest: SimpleBodyManifest, state: string): string {
  const entry = manifest.states[state] ?? manifest.states[manifest.defaultState];
  if (!entry) return `${ASSET_BASE}states/idle.png`;
  return `${ASSET_BASE}${entry.image.replace(/^\/+/, "")}`;
}
