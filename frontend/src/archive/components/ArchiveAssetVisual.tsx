import type { ArchiveAsset } from "../archiveTypes";

export function isArchiveImage(asset: ArchiveAsset): boolean {
  return asset.contentType.startsWith("image/");
}

export function ArchiveAssetVisual({
  asset,
  loading,
}: {
  asset: ArchiveAsset;
  loading?: "lazy" | "eager";
}) {
  if (isArchiveImage(asset)) {
    return <img src={asset.thumbnailPath} alt={asset.title} loading={loading} />;
  }
  const suffix = asset.fileName.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <div className="archive-file-visual" aria-label={`${asset.title} file`}>
      <span>FILE</span>
      <strong>{suffix}</strong>
    </div>
  );
}
