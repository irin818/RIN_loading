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

/** Body state entry from GET /api/body/state-assets */
export interface BodyStateEntry {
  stateId: string;
  label: string;
  imageUrl: string;
  custom: boolean;
}

export interface BodyStatesPayload {
  ok: boolean;
  mode: string;
  localOnly: boolean;
  rawTextIncluded: boolean;
  secretValuesIncluded: boolean;
  storageScope?: string;
  absolutePathIncluded?: boolean;
  currentState?: string;
  selectedStateId?: string;
  defaultStateIds?: string[];
  states: BodyStateEntry[];
}

async function parseBodyStatePayload(res: Response): Promise<BodyStatesPayload> {
  const data = await res.json().catch(() => ({})) as Partial<BodyStatesPayload> & { detail?: string };
  if (!res.ok) {
    throw new Error(data.detail ?? `Body state request failed (${res.status})`);
  }
  return {
    ok: data.ok ?? false,
    mode: data.mode ?? "rin-body-states",
    localOnly: data.localOnly ?? true,
    rawTextIncluded: data.rawTextIncluded ?? false,
    secretValuesIncluded: data.secretValuesIncluded ?? false,
    storageScope: data.storageScope,
    absolutePathIncluded: data.absolutePathIncluded,
    currentState: data.currentState,
    selectedStateId: data.selectedStateId,
    defaultStateIds: data.defaultStateIds,
    states: data.states ?? [],
  };
}

/** Load available body states (static + custom) from the backend body contract. */
export async function loadBodyStatesPayload(signal?: AbortSignal): Promise<BodyStatesPayload> {
  const res = await fetch("/api/body/state-assets", {
    signal,
    headers: { Accept: "application/json" },
  });
  return parseBodyStatePayload(res);
}

/** Load available body state entries in backend order. */
export async function loadBodyStates(signal?: AbortSignal): Promise<BodyStateEntry[]> {
  return (await loadBodyStatesPayload(signal)).states;
}

/** Resolve the image URL for a given body state ID. Checks dynamic states first, then static manifest. */
export function resolveBodyImageUrl(
  state: string,
  manifest: SimpleBodyManifest | null,
  stateEntries: BodyStateEntry[],
): string | null {
  // Check dynamic states
  const dyn = stateEntries.find((e) => e.stateId === state);
  if (dyn) return dyn.imageUrl;
  // Check static manifest
  if (manifest) {
    try {
      return bodyImageUrl(manifest, state);
    } catch { /* fall through */ }
  }
  return null;
}

/** Fetch the current persisted body state from the backend. */
export async function fetchCurrentBodyState(signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/body/current-state", {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return "默认";
  const data = await res.json() as { stateId?: string };
  return data.stateId ?? "默认";
}

/** Persist the current body state to the backend. */
export async function setCurrentBodyState(stateId: string): Promise<void> {
  const res = await fetch("/api/body/current-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stateId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail ?? `Body state update failed (${res.status})`);
  }
}

function encodedHeaderValue(value: string): string {
  return encodeURIComponent(value);
}

export async function uploadBodyState(file: File): Promise<BodyStatesPayload> {
  const label = file.name.replace(/\.[^.]+$/, "") || "CUSTOM";
  const res = await fetch("/api/body/state-assets", {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-rin-file-name": encodedHeaderValue(file.name),
      "x-rin-state-label": encodedHeaderValue(label),
    },
    body: file,
  });
  return parseBodyStatePayload(res);
}

export async function deleteBodyState(stateId: string): Promise<BodyStatesPayload> {
  const res = await fetch(`/api/body/state-assets/${encodeURIComponent(stateId)}`, {
    method: "DELETE",
  });
  return parseBodyStatePayload(res);
}
