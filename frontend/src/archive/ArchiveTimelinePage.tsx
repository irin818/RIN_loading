import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";
import { ARCHIVE_ASSET_TYPE_LABELS } from "./archiveTypes";

interface ArchiveTimelinePageProps {
  onNavigate: (path: string) => void;
}

interface TimelineEntry {
  date: string;
  assets: ArchiveAsset[];
}

export function ArchiveTimelinePage({ onNavigate }: ArchiveTimelinePageProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchArchiveAssets(
      { status: "published", limit: 100 },
      { signal: controller.signal },
    )
      .then((payload) => {
        if (!controller.signal.aborted) {
          const sorted = [...payload.assets].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          );
          setEntries(groupByDate(sorted));
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
      title="Timeline"
      subtitle="Archive evolution and recent additions"
      onNavigate={onNavigate}
    >
      {loading && <p className="archive-status">Loading timeline...</p>}
      {error && <p className="archive-status archive-status-error">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="archive-status">No archive entries yet.</p>
      )}
      {entries.length > 0 && (
        <div className="archive-timeline">
          {entries.map((entry) => (
            <div key={entry.date} className="archive-timeline-group">
              <div className="archive-timeline-date">{entry.date}</div>
              <div className="archive-timeline-items">
                {entry.assets.map((asset) => (
                  <div key={asset.id} className="archive-timeline-item">
                    <span className="archive-timeline-item-type">
                      [{ARCHIVE_ASSET_TYPE_LABELS[asset.type]}]
                    </span>
                    <span className="archive-timeline-item-title">
                      {asset.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </ArchiveLayout>
  );
}

function groupByDate(assets: ArchiveAsset[]): TimelineEntry[] {
  const map = new Map<string, ArchiveAsset[]>();
  for (const asset of assets) {
    const date = asset.createdAt.slice(0, 10);
    const list = map.get(date) || [];
    list.push(asset);
    map.set(date, list);
  }
  return Array.from(map.entries()).map(([date, assets]) => ({ date, assets }));
}
