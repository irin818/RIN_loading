import { useEffect, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import { fetchArchiveAssets } from "./archiveApi";
import type { ArchiveAsset } from "./archiveTypes";

interface ArchiveComicReaderPageProps {
  seriesId: string;
  onNavigate: (path: string) => void;
}

export function ArchiveComicReaderPage({
  seriesId,
  onNavigate,
}: ArchiveComicReaderPageProps) {
  const [pages, setPages] = useState<ArchiveAsset[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchiveAssets({ seriesId, type: "comic-page", status: "published" })
      .then((payload) => {
        if (!cancelled) {
          const sorted = [...payload.assets].sort(
            (a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0),
          );
          setPages(sorted);
          setCurrentPage(0);
          setShowOriginal(false);
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
  }, [seriesId]);

  const title = pages.length > 0 ? pages[0].title || seriesId : seriesId;

  const goNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setShowOriginal(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goPrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setShowOriginal(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <ArchiveLayout title={title} subtitle="Comic Reader" onNavigate={onNavigate}>
      <div className="archive-comic-reader">
        {loading && <p className="archive-status">Loading pages...</p>}
        {error && (
          <p className="archive-status archive-status-error">{error}</p>
        )}
        {!loading && !error && pages.length === 0 && (
          <p className="archive-status">No pages found for this series.</p>
        )}
        {pages.length > 0 && (
          <>
            <div className="archive-comic-reader-nav">
              <button
                className="archive-btn"
                type="button"
                disabled={currentPage === 0}
                onClick={goPrev}
              >
                ← Prev
              </button>
              <span className="archive-comic-reader-page-num">
                {currentPage + 1} / {pages.length}
              </span>
              <button
                className="archive-btn"
                type="button"
                disabled={currentPage === pages.length - 1}
                onClick={goNext}
              >
                Next →
              </button>
              <button
                className="archive-btn"
                type="button"
                onClick={() => setShowOriginal((current) => !current)}
              >
                {showOriginal ? "Preview" : "Full quality"}
              </button>
            </div>
            <div className="archive-comic-reader-pages">
              <img
                className="archive-comic-reader-image"
                src={
                  showOriginal
                    ? pages[currentPage].originalPath
                    : pages[currentPage].previewPath
                }
                alt={`Page ${currentPage + 1}`}
              />
            </div>
            <div className="archive-comic-reader-nav">
              <button
                className="archive-btn"
                type="button"
                disabled={currentPage === 0}
                onClick={goPrev}
              >
                ← Prev
              </button>
              <span className="archive-comic-reader-page-num">
                {currentPage + 1} / {pages.length}
              </span>
              <button
                className="archive-btn"
                type="button"
                disabled={currentPage === pages.length - 1}
                onClick={goNext}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </ArchiveLayout>
  );
}
