import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";
import { ArchiveAssetViewer } from "./components/ArchiveAssetViewer";
import { ArchiveAssetVisual } from "./components/ArchiveAssetVisual";

interface ArchiveIllustrationsPageProps {
  onNavigate: (path: string) => void;
}

export function ArchiveIllustrationsPage({
  onNavigate,
}: ArchiveIllustrationsPageProps) {
  const [assets, setAssets] = useState<ArchiveAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<ArchiveAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchArchiveAssets(
      { type: "illustration", status: "published" },
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

  return (
    <ArchiveLayout
      title="Illustrations"
      subtitle="Artwork and visual pieces"
      onNavigate={onNavigate}
    >
      {loading && <p className="archive-status">Loading illustrations...</p>}
      {error && <p className="archive-status archive-status-error">{error}</p>}
      {!loading && !error && assets.length === 0 && (
        <p className="archive-status">No illustrations yet.</p>
      )}
      {assets.length > 0 && (
        <div className="archive-asset-grid">
          {assets.map((asset) => (
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
                {asset.description && (
                  <span className="archive-asset-card-desc">
                    {asset.description}
                  </span>
                )}
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
