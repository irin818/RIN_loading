import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";

interface ArchiveComicsPageProps {
  onNavigate: (path: string) => void;
}

interface ComicGroup {
  seriesId: string;
  title: string;
  coverUrl: string | null;
  pageCount: number;
}

export function ArchiveComicsPage({ onNavigate }: ArchiveComicsPageProps) {
  const [groups, setGroups] = useState<ComicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchiveAssets({ type: "comic", status: "published" })
      .then((payload) => {
        if (!cancelled) {
          setGroups(groupComicAssets(payload.assets));
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
      title="Comics"
      subtitle="Comic series and sequential art"
      onNavigate={onNavigate}
    >
      {loading && <p className="archive-status">Loading comics...</p>}
      {error && <p className="archive-status archive-status-error">{error}</p>}
      {!loading && !error && groups.length === 0 && (
        <p className="archive-status">No comics yet.</p>
      )}
      {groups.length > 0 && (
        <div className="archive-asset-grid">
          {groups.map((group) => (
            <button
              key={group.seriesId}
              className="archive-category-card archive-comic-series-card"
              type="button"
              onClick={() =>
                onNavigate(`/archive/comics/${group.seriesId}`)
              }
            >
              {group.coverUrl && (
                <img
                  className="archive-comic-cover"
                  src={group.coverUrl}
                  alt={group.title}
                  loading="lazy"
                />
              )}
              <span className="archive-category-card-title">{group.title}</span>
              <span className="archive-category-card-desc">
                {group.pageCount} pages
              </span>
            </button>
          ))}
        </div>
      )}
    </ArchiveLayout>
  );
}

function groupComicAssets(assets: ArchiveAsset[]): ComicGroup[] {
  const map = new Map<string, ArchiveAsset[]>();
  for (const asset of assets) {
    const key = asset.seriesId || asset.id;
    const list = map.get(key) || [];
    list.push(asset);
    map.set(key, list);
  }
  const groups: ComicGroup[] = [];
  for (const [seriesId, list] of map) {
    list.sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0));
    const coverAsset = list.find((a) => a.coverAssetId) || list[0];
    const coverUrl = coverAsset ? coverAsset.thumbnailPath : null;
    groups.push({
      seriesId,
      title: list[0].title || seriesId,
      coverUrl,
      pageCount: list.length,
    });
  }
  return groups;
}
