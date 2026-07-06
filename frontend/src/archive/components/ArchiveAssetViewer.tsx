import { useState } from "react";
import type { ArchiveAsset } from "../archiveTypes";

interface ArchiveAssetViewerProps {
  asset: ArchiveAsset;
  onClose: () => void;
}

export function ArchiveAssetViewer({ asset, onClose }: ArchiveAssetViewerProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const imageSrc = showOriginal ? asset.originalPath : asset.previewPath;

  return (
    <div
      className="archive-viewer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
      onClick={onClose}
    >
      <button
        className="archive-viewer-close"
        type="button"
        onClick={onClose}
      >
        Close
      </button>
      <img
        src={imageSrc}
        alt={asset.title}
        onClick={(event) => event.stopPropagation()}
      />
      <div
        className="archive-viewer-actions"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="archive-btn"
          type="button"
          onClick={() => setShowOriginal((current) => !current)}
        >
          {showOriginal ? "Preview" : "Full quality"}
        </button>
        <a
          className="archive-btn"
          href={asset.originalPath}
          target="_blank"
          rel="noreferrer"
        >
          Original
        </a>
      </div>
    </div>
  );
}
