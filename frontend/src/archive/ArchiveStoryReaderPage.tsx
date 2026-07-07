import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveStory } from "./archiveApi";
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
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchArchiveStory(storyId, { signal: controller.signal })
      .then((asset) => {
        if (!controller.signal.aborted) {
          setStory(asset);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setStory(null);
          setError(String(err));
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
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
