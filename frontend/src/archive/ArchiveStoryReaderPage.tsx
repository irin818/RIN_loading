import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";

interface ArchiveStoryReaderPageProps {
  storyId: string;
  onNavigate: (path: string) => void;
}

export function ArchiveStoryReaderPage({
  storyId,
  onNavigate,
}: ArchiveStoryReaderPageProps) {
  const [story, setStory] = useState<ArchiveAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchiveAssets({ type: "story" })
      .then((payload) => {
        if (!cancelled) {
          const found = payload.assets.find((a) => a.id === storyId) || null;
          setStory(found);
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
  }, [storyId]);

  return (
    <ArchiveLayout
      title={story?.title || "Story"}
      subtitle="Story Reader"
      onNavigate={onNavigate}
    >
      {loading && <p className="archive-status">Loading story...</p>}
      {error && <p className="archive-status archive-status-error">{error}</p>}
      {!loading && !error && !story && (
        <p className="archive-status">Story not found.</p>
      )}
      {story && (
        <div className="archive-story-reader">
          <div className="archive-story-reader-meta">
            {story.description && (
              <p className="archive-story-reader-desc">{story.description}</p>
            )}
            {story.tags.length > 0 && (
              <div className="archive-story-reader-tags">
                {story.tags.map((tag) => (
                  <span key={tag} className="archive-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="archive-story-reader-content">
            {story.storyContent ? (
              <div className="archive-story-text">
                {story.storyContent.split("\n").map((line, i) => (
                  <p key={i}>{line || " "}</p>
                ))}
              </div>
            ) : (
              <p className="archive-status">
                Story content not yet available. Edit in Admin to add content.
              </p>
            )}
          </div>
        </div>
      )}
    </ArchiveLayout>
  );
}
