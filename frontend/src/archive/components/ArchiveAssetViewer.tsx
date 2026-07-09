import { useState } from "react";
import type { ArchiveAsset } from "../archiveTypes";
import { isArchiveImage } from "./ArchiveAssetVisual";

interface ArchiveAssetViewerProps {
  asset: ArchiveAsset;
  onClose: () => void;
}

export function ArchiveAssetViewer({ asset, onClose }: ArchiveAssetViewerProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const imageSrc = showOriginal ? asset.originalPath : asset.previewPath;
  const isImage = isArchiveImage(asset);

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
      {isImage ? (
        <img
          src={imageSrc}
          alt={asset.title}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <div
          className="archive-viewer-file"
          onClick={(event) => event.stopPropagation()}
        >
          <strong>{asset.fileName}</strong>
          <span>Stored locally as a safe download. Preview is available for images only.</span>
        </div>
      )}
      <div
        className="archive-viewer-actions"
        onClick={(event) => event.stopPropagation()}
      >
        {isImage ? (
          <button
            className="archive-btn"
            type="button"
            onClick={() => setShowOriginal((current) => !current)}
          >
            {showOriginal ? "Preview" : "Full quality"}
          </button>
        ) : null}
        <a
          className="archive-btn"
          href={asset.originalPath}
          target="_blank"
          rel="noreferrer"
          download
        >
          {isImage ? "Original" : "Download"}
        </a>
      </div>
    </div>
  );
}
