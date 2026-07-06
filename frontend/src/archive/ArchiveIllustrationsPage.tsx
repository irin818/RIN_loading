import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";
import { archiveAssetPreviewUrl } from "./archiveApi";

interface ArchiveIllustrationsPageProps {
  onNavigate: (path: string) => void;
}

export function ArchiveIllustrationsPage({
  onNavigate,
}: ArchiveIllustrationsPageProps) {
  const [assets, setAssets] = useState<ArchiveAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchiveAssets({ type: "illustration", status: "published" })
      .then((payload) => {
        if (!cancelled) {
          setAssets(payload.assets);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
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
            <div key={asset.id} className="archive-asset-card">
              <div className="archive-asset-card-image">
                <img
                  src={archiveAssetPreviewUrl(asset.id)}
                  alt={asset.title}
                  loading="lazy"
                />
              </div>
              <div className="archive-asset-card-info">
                <span className="archive-asset-card-title">{asset.title}</span>
                {asset.description && (
                  <span className="archive-asset-card-desc">
                    {asset.description}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ArchiveLayout>
  );
}
