import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";
import { ARCHIVE_ASSET_TYPE_LABELS } from "./archiveTypes";
import { ArchiveAssetViewer } from "./components/ArchiveAssetViewer";
import { ArchiveAssetVisual } from "./components/ArchiveAssetVisual";

interface ArchiveCharacterFilesPageProps {
  onNavigate: (path: string) => void;
}

const CHARACTER_TYPES = [
  "character-file",
  "live2d-asset",
  "avatar",
  "wallpaper",
  "reference",
] as const;

export function ArchiveCharacterFilesPage({
  onNavigate,
}: ArchiveCharacterFilesPageProps) {
  const [assets, setAssets] = useState<ArchiveAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<ArchiveAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchArchiveAssets(
      { type: [...CHARACTER_TYPES], status: "published" },
      { signal: controller.signal },
    )
      .then((payload) => {
        if (!controller.signal.aborted) {
          setAssets(payload.assets);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
    };
  }, []);

  const filtered = activeType
    ? assets.filter((a) => a.type === activeType)
    : assets;

  return (
    <ArchiveLayout
      title="Character Files"
      subtitle="Character designs, Live2D assets, avatars, wallpapers, references"
      onNavigate={onNavigate}
    >
      <div className="archive-filters">
        <button
          className={`archive-filter-btn ${activeType === null ? "archive-filter-active" : ""}`}
          type="button"
          onClick={() => setActiveType(null)}
        >
          All
        </button>
        {CHARACTER_TYPES.map((t) => (
          <button
            key={t}
            className={`archive-filter-btn ${activeType === t ? "archive-filter-active" : ""}`}
            type="button"
            onClick={() => setActiveType(t)}
          >
            {ARCHIVE_ASSET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="archive-status">Loading character files...</p>}
      {error && <p className="archive-status archive-status-error">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="archive-status">No character files yet.</p>
      )}
      {filtered.length > 0 && (
        <div className="archive-asset-grid">
          {filtered.map((asset) => (
            <button
              key={asset.id}
              className="archive-asset-card"
              type="button"
              onClick={() => setSelectedAsset(asset)}
            >
              <div className="archive-asset-card-image">
                <ArchiveAssetVisual asset={asset} loading="lazy" />
              </div>
              <div className="archive-asset-card-info">
                <span className="archive-asset-card-title">{asset.title}</span>
                <span className="archive-asset-card-type">
                  {ARCHIVE_ASSET_TYPE_LABELS[asset.type]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {selectedAsset && (
        <ArchiveAssetViewer
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </ArchiveLayout>
  );
}
