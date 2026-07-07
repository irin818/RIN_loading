import type {
  ArchiveAsset,
  ArchiveAssetType,
  ArchiveAssetPatch,
  ArchiveAssetsPayload,
  ArchiveFilters,
  ArchiveUploadMetadata,
} from "./archiveTypes";

interface ArchiveRequestOptions {
  signal?: AbortSignal;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (payload.detail) {
        message =
          typeof payload.detail === "string"
            ? payload.detail
            : JSON.stringify(payload.detail);
      }
    } catch {
      // Keep the HTTP status message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchArchiveAssets(
  filters: ArchiveFilters = {},
  options: ArchiveRequestOptions = {},
): Promise<ArchiveAssetsPayload> {
  const params = new URLSearchParams();
  setArchiveAssetTypeFilter(params, filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.seriesId) params.set("seriesId", filters.seriesId);
  if (filters.limit) params.set("limit", String(filters.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/archive/assets${suffix}`, {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<ArchiveAssetsPayload>(response);
}

export async function uploadArchiveAsset(
  file: File,
  metadata: ArchiveUploadMetadata,
): Promise<ArchiveAssetsPayload> {
  const response = await fetch("/api/archive/assets", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": file.type || "application/octet-stream",
      "X-RIN-File-Name": encodeURIComponent(file.name),
      "X-RIN-Metadata": encodeURIComponent(JSON.stringify(metadata)),
    },
    body: file,
  });
  return readJson<ArchiveAssetsPayload>(response);
}

export async function updateArchiveAsset(
  assetId: string,
  patch: ArchiveAssetPatch,
): Promise<ArchiveAssetsPayload> {
  const response = await fetch(`/api/archive/assets/${assetId}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  return readJson<ArchiveAssetsPayload>(response);
}

export async function deleteArchiveAsset(
  assetId: string,
  hard = false,
): Promise<ArchiveAssetsPayload> {
  const params = hard ? "?hard=true" : "";
  const response = await fetch(`/api/archive/assets/${assetId}${params}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  return readJson<ArchiveAssetsPayload>(response);
}

export function archiveAssetOriginalUrl(assetId: string): string {
  return `/api/archive/assets/files/${assetId}`;
}

export function archiveAssetPreviewUrl(assetId: string): string {
  return `/api/archive/assets/previews/${assetId}`;
}

export function archiveAssetThumbnailUrl(assetId: string): string {
  return `/api/archive/assets/thumbnails/${assetId}`;
}

export async function fetchArchiveStory(
  storyId: string,
  options: ArchiveRequestOptions = {},
): Promise<ArchiveAsset> {
  const response = await fetch(`/api/archive/stories/${storyId}`, {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  return readJson<ArchiveAsset>(response);
}

export async function saveArchiveStory(
  storyId: string,
  content: string,
): Promise<ArchiveAsset> {
  const response = await fetch(`/api/archive/stories/${storyId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  return readJson<ArchiveAsset>(response);
}

function setArchiveAssetTypeFilter(
  params: URLSearchParams,
  type: ArchiveAssetType | ArchiveAssetType[] | undefined,
) {
  if (!type) return;
  params.set("type", Array.isArray(type) ? type.join(",") : type);
}
