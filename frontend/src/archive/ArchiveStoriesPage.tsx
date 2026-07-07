import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";

interface ArchiveStoriesPageProps {
  onNavigate: (path: string) => void;
}

export function ArchiveStoriesPage({ onNavigate }: ArchiveStoriesPageProps) {
  const [stories, setStories] = useState<ArchiveAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchArchiveAssets(
      { type: "story", status: "published" },
      { signal: controller.signal },
    )
      .then((payload) => {
        if (!controller.signal.aborted) {
          setStories(payload.assets);
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
      title="Stories"
      subtitle="Written works and narratives"
      onNavigate={onNavigate}
    >
      {loading && <p className="archive-status">Loading stories...</p>}
      {error && <p className="archive-status archive-status-error">{error}</p>}
      {!loading && !error && stories.length === 0 && (
        <p className="archive-status">No stories yet.</p>
      )}
      {stories.length > 0 && (
        <div className="archive-asset-grid">
          {stories.map((story) => (
            <button
              key={story.id}
              className="archive-story-card"
              type="button"
              onClick={() => onNavigate(`/archive/stories/${story.id}`)}
            >
              <span className="archive-story-card-title">{story.title}</span>
              {story.description && (
                <span className="archive-story-card-desc">
                  {story.description}
                </span>
              )}
              <span className="archive-story-card-meta">
                {story.tags.join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </ArchiveLayout>
  );
}
