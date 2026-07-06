import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveLayout } from "./components/ArchiveLayout";
import {
  fetchArchiveAssets,
  uploadArchiveAsset,
  updateArchiveAsset,
  deleteArchiveAsset,
  archiveAssetPreviewUrl,
} from "./archiveApi";
import type { ArchiveAsset, ArchiveAssetPatch } from "./archiveTypes";
import {
  ARCHIVE_ASSET_TYPE_LABELS,
  ARCHIVE_STATUS_LABELS,
} from "./archiveTypes";
import type { ArchiveAssetType, ArchiveAssetStatus } from "./archiveTypes";

interface ArchiveAdminPageProps {
  onNavigate: (path: string) => void;
}

const ASSET_TYPES = Object.keys(ARCHIVE_ASSET_TYPE_LABELS) as ArchiveAssetType[];
const STATUSES = Object.keys(ARCHIVE_STATUS_LABELS) as ArchiveAssetStatus[];

export function ArchiveAdminPage({ onNavigate }: ArchiveAdminPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<ArchiveAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Upload form state
  const [uploadType, setUploadType] = useState<ArchiveAssetType>("illustration");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState<ArchiveAssetType>("illustration");
  const [editStatus, setEditStatus] = useState<ArchiveAssetStatus>("published");
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSeriesId, setEditSeriesId] = useState("");
  const [editPageNumber, setEditPageNumber] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");

  // Search/filter state
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  const loadAssets = useCallback(() => {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (filterType) filters.type = filterType;
    if (searchQ.trim()) filters.q = searchQ.trim();
    fetchArchiveAssets(filters)
      .then((payload) => {
        setAssets(payload.assets);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [filterType, searchQ]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setStatus("Select a file first.");
      return;
    }
    setUploadBusy(true);
    setStatus("Uploading...");
    try {
      await uploadArchiveAsset(file, {
        type: uploadType,
        title: uploadTitle || file.name,
        description: uploadDesc,
        tags: uploadTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        category: uploadCategory,
      });
      setStatus("Uploaded.");
      setUploadTitle("");
      setUploadDesc("");
      setUploadTags("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadAssets();
    } catch (err) {
      setStatus(`Upload failed: ${String(err)}`);
    } finally {
      setUploadBusy(false);
    }
  }, [uploadType, uploadTitle, uploadDesc, uploadCategory, uploadTags, loadAssets]);

  const startEdit = useCallback((asset: ArchiveAsset) => {
    setEditingId(asset.id);
    setEditTitle(asset.title);
    setEditDesc(asset.description);
    setEditType(asset.type);
    setEditStatus(asset.status);
    setEditCategory(asset.category);
    setEditTags(asset.tags.join(", "));
    setEditSeriesId(asset.seriesId || "");
    setEditPageNumber(asset.pageNumber?.toString() || "");
    setEditSortOrder(asset.sortOrder?.toString() || "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveEdit = useCallback(
    async (assetId: string) => {
      const patch: ArchiveAssetPatch = {
        title: editTitle,
        description: editDesc,
        type: editType,
        status: editStatus,
        category: editCategory,
        tags: editTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        seriesId: editSeriesId || null,
        pageNumber: editPageNumber ? Number(editPageNumber) : null,
        sortOrder: editSortOrder ? Number(editSortOrder) : 0,
      };
      try {
        await updateArchiveAsset(assetId, patch);
        setEditingId(null);
        loadAssets();
      } catch (err) {
        setStatus(`Update failed: ${String(err)}`);
      }
    },
    [
      editTitle, editDesc, editType, editStatus, editCategory,
      editTags, editSeriesId, editPageNumber, editSortOrder, loadAssets,
    ],
  );

  const handleDelete = useCallback(
    async (assetId: string) => {
      if (!window.confirm("Archive this asset? (soft delete by default)")) return;
      try {
        await deleteArchiveAsset(assetId);
        loadAssets();
      } catch (err) {
        setStatus(`Delete failed: ${String(err)}`);
      }
    },
    [loadAssets],
  );

  const handleHardDelete = useCallback(
    async (assetId: string) => {
      if (
        !window.confirm(
          "PERMANENTLY delete this asset and its files? This cannot be undone.",
        )
      )
        return;
      try {
        await deleteArchiveAsset(assetId, true);
        loadAssets();
      } catch (err) {
        setStatus(`Hard delete failed: ${String(err)}`);
      }
    },
    [loadAssets],
  );

  return (
    <ArchiveLayout
      title="Archive Admin"
      subtitle="Local owner asset management — not for public exposure"
      onNavigate={onNavigate}
    >
      <div className="archive-admin-notice">
        ⚠️ Local-only admin panel. Not safe for public exposure. Manage your archive
        assets here.
      </div>

      {/* Upload section */}
      <section className="archive-admin-section">
        <h2 className="archive-admin-section-title">Upload New Asset</h2>
        <div className="archive-admin-form">
          <div className="archive-admin-field">
            <label>File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
            />
          </div>
          <div className="archive-admin-field">
            <label>Type</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as ArchiveAssetType)}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ARCHIVE_ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="archive-admin-field">
            <label>Title</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Asset title"
            />
          </div>
          <div className="archive-admin-field">
            <label>Description</label>
            <input
              type="text"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Short description"
            />
          </div>
          <div className="archive-admin-field">
            <label>Category</label>
            <input
              type="text"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              placeholder="e.g. character, worldbuilding"
            />
          </div>
          <div className="archive-admin-field">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <button
            className="archive-btn archive-btn-primary"
            type="button"
            disabled={uploadBusy}
            onClick={handleUpload}
          >
            {uploadBusy ? "Uploading..." : "Upload"}
          </button>
        </div>
      </section>

      {/* Search/filter */}
      <section className="archive-admin-section">
        <div className="archive-admin-search">
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search assets..."
            className="archive-admin-search-input"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ARCHIVE_ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </section>

      {status && <p className="archive-admin-status">{status}</p>}
      {error && (
        <p className="archive-admin-status archive-admin-status-error">{error}</p>
      )}

      {/* Asset list */}
      <section className="archive-admin-section">
        <h2 className="archive-admin-section-title">
          Assets ({assets.length})
        </h2>
        {loading && <p className="archive-status">Loading...</p>}
        {!loading && assets.length === 0 && (
          <p className="archive-status">No assets found.</p>
        )}
        <div className="archive-admin-list">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className={`archive-admin-item ${editingId === asset.id ? "archive-admin-item-editing" : ""}`}
            >
              {editingId === asset.id ? (
                <div className="archive-admin-edit-form">
                  <div className="archive-admin-edit-preview">
                    <img
                      src={archiveAssetPreviewUrl(asset.id)}
                      alt={asset.title}
                    />
                  </div>
                  <div className="archive-admin-edit-fields">
                    <label>
                      Title
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </label>
                    <label>
                      Description
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={editType}
                        onChange={(e) =>
                          setEditType(e.target.value as ArchiveAssetType)
                        }
                      >
                        {ASSET_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ARCHIVE_ASSET_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={editStatus}
                        onChange={(e) =>
                          setEditStatus(e.target.value as ArchiveAssetStatus)
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ARCHIVE_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Category
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      />
                    </label>
                    <label>
                      Tags (comma-separated)
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                      />
                    </label>
                    <label>
                      Series ID
                      <input
                        type="text"
                        value={editSeriesId}
                        onChange={(e) => setEditSeriesId(e.target.value)}
                      />
                    </label>
                    <label>
                      Page Number
                      <input
                        type="number"
                        value={editPageNumber}
                        onChange={(e) => setEditPageNumber(e.target.value)}
                      />
                    </label>
                    <label>
                      Sort Order
                      <input
                        type="number"
                        value={editSortOrder}
                        onChange={(e) => setEditSortOrder(e.target.value)}
                      />
                    </label>
                    <div className="archive-admin-edit-actions">
                      <button
                        className="archive-btn archive-btn-primary"
                        type="button"
                        onClick={() => saveEdit(asset.id)}
                      >
                        Save
                      </button>
                      <button
                        className="archive-btn"
                        type="button"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="archive-admin-item-row">
                  <div className="archive-admin-item-preview">
                    <img
                      src={archiveAssetPreviewUrl(asset.id)}
                      alt={asset.title}
                    />
                  </div>
                  <div className="archive-admin-item-info">
                    <strong>{asset.title}</strong>
                    <span>
                      [{ARCHIVE_ASSET_TYPE_LABELS[asset.type]}] ·{" "}
                      {ARCHIVE_STATUS_LABELS[asset.status]}
                    </span>
                    {asset.description && <span>{asset.description}</span>}
                    <span className="archive-admin-item-meta">
                      {asset.fileName} ·{" "}
                      {asset.fileSize
                        ? `${(asset.fileSize / 1024).toFixed(0)} KB`
                        : "unknown size"}
                    </span>
                  </div>
                  <div className="archive-admin-item-actions">
                    <button
                      className="archive-btn"
                      type="button"
                      onClick={() => startEdit(asset)}
                    >
                      Edit
                    </button>
                    <button
                      className="archive-btn archive-btn-danger"
                      type="button"
                      onClick={() => handleDelete(asset.id)}
                    >
                      Archive
                    </button>
                    <button
                      className="archive-btn archive-btn-danger"
                      type="button"
                      onClick={() => handleHardDelete(asset.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </ArchiveLayout>
  );
}
