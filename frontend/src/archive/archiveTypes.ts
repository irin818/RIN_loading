/** RIN Archive type definitions — display-safe only. */

export type ArchiveAssetType =
  | "illustration"
  | "comic"
  | "comic-page"
  | "story"
  | "character-file"
  | "worldbuilding"
  | "live2d-asset"
  | "wallpaper"
  | "avatar"
  | "reference";

export type ArchiveAssetStatus = "draft" | "published" | "archived";

export interface ArchiveAsset {
  id: string;
  type: ArchiveAssetType;
  title: string;
  description: string;
  tags: string[];
  category: string;
  status: ArchiveAssetStatus;
  fileName: string;
  contentType: string;
  originalPath: string;
  previewPath: string;
  thumbnailPath: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
  seriesId: string | null;
  chapterId: string | null;
  pageNumber: number | null;
  storyContent: string | null;
  storyMarkdownFile: string | null;
  coverAssetId: string | null;
}

export interface ArchiveAssetsPayload {
  ok: boolean;
  mode: "rin-archive-assets";
  localOnly: boolean;
  rawTextIncluded: boolean;
  secretValuesIncluded: boolean;
  assets: ArchiveAsset[];
  total: number;
}

export interface ArchiveAssetPatch {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  type?: ArchiveAssetType;
  status?: ArchiveAssetStatus;
  sortOrder?: number;
  seriesId?: string | null;
  chapterId?: string | null;
  pageNumber?: number | null;
  coverAssetId?: string | null;
}

export interface ArchiveFilters {
  type?: ArchiveAssetType;
  status?: ArchiveAssetStatus;
  tag?: string;
  category?: string;
  q?: string;
  seriesId?: string;
  limit?: number;
}

export interface ArchiveUploadMetadata {
  type: ArchiveAssetType;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  seriesId?: string;
  chapterId?: string;
  pageNumber?: number;
  sortOrder?: number;
}

export const ARCHIVE_ASSET_TYPE_LABELS: Record<ArchiveAssetType, string> = {
  illustration: "Illustration",
  comic: "Comic",
  "comic-page": "Comic Page",
  story: "Story",
  "character-file": "Character File",
  worldbuilding: "Worldbuilding",
  "live2d-asset": "Live2D Asset",
  wallpaper: "Wallpaper",
  avatar: "Avatar",
  reference: "Reference",
};

export const ARCHIVE_STATUS_LABELS: Record<ArchiveAssetStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const ARCHIVE_CATEGORIES = [
  "illustration",
  "comic",
  "story",
  "character",
  "worldbuilding",
  "reference",
] as const;
