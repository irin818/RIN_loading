import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  fetchCharacterAssets,
  resetWelcomeCharacterAsset,
  uploadWelcomeCharacterAsset,
} from "../api";
import type { CharacterAssetsPayload } from "../api";
import type { RinCharacterAsset } from "../rinCharacters";

interface WelcomePageProps {
  onNavigate: (path: string) => void;
  onPreload: (path: string) => void;
}

type WelcomeDisplayAsset = {
  id: string;
  label: string;
  image: string;
  backdropFit: "cover" | "contain";
  figureFit: "cover" | "contain";
  backdropPosition: string;
  figurePosition: string;
  mobileBackdropPosition: string;
  mobileFigurePosition: string;
  backendAssetId?: string;
};

const DEFAULT_WELCOME_ASSET: WelcomeDisplayAsset = {
  id: "mist-city",
  label: "Mist",
  image: "/body-assets/rin/welcome/rin-mist-city.png",
  backdropFit: "cover",
  figureFit: "cover",
  backdropPosition: "56% 43%",
  figurePosition: "56% 43%",
  mobileBackdropPosition: "50% 38%",
  mobileFigurePosition: "50% 38%",
};

function resolveWelcomeAsset(payload: CharacterAssetsPayload): WelcomeDisplayAsset {
  const selectedId = payload.welcomeAssetId ?? payload.selectedAssetId ?? null;
  const asset = selectedId
    ? payload.assets.find((item) => item.id === selectedId)
    : undefined;
  return asset ? fromBackendAsset(asset) : DEFAULT_WELCOME_ASSET;
}

function fromBackendAsset(asset: RinCharacterAsset): WelcomeDisplayAsset {
  const image = asset.custom ? withAssetCacheKey(asset.path, asset.id) : asset.path;
  return {
    id: asset.id,
    backendAssetId: asset.id,
    label: asset.label,
    image,
    backdropFit: "cover",
    figureFit: asset.custom ? "contain" : "contain",
    backdropPosition: asset.custom ? "50% 44%" : "56% 50%",
    figurePosition: asset.custom ? "72% 48%" : "64% 50%",
    mobileBackdropPosition: asset.custom ? "50% 40%" : "50% 50%",
    mobileFigurePosition: asset.custom ? "50% 37%" : "50% 50%",
  };
}

function withAssetCacheKey(path: string, assetId: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(assetId)}`;
}

function hasWelcomeAssetContract(payload: CharacterAssetsPayload): boolean {
  return Object.prototype.hasOwnProperty.call(payload, "welcomeAssetId");
}

function uploadFailureStatus(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Method Not Allowed")
    || message.includes("405")
    || message.includes("404")
  ) {
    return "restart backend";
  }
  return "failed";
}

export function WelcomePage({ onNavigate, onPreload }: WelcomePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeAsset, setActiveAsset] = useState<WelcomeDisplayAsset>(DEFAULT_WELCOME_ASSET);
  const [assetStatus, setAssetStatus] = useState("");
  const [assetStatusTone, setAssetStatusTone] = useState<"idle" | "ok" | "warn" | "error">("idle");
  const [assetBusy, setAssetBusy] = useState(false);

  const shellStyle = useMemo(
    () => ({
      "--welcome-backdrop-fit": activeAsset.backdropFit,
      "--welcome-figure-fit": activeAsset.figureFit,
      "--welcome-backdrop-position": activeAsset.backdropPosition,
      "--welcome-figure-position": activeAsset.figurePosition,
      "--welcome-mobile-backdrop-position": activeAsset.mobileBackdropPosition,
      "--welcome-mobile-figure-position": activeAsset.mobileFigurePosition,
    }) as CSSProperties,
    [activeAsset],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const motionX = (x - 50) / 50;
    const motionY = (y - 50) / 50;
    event.currentTarget.style.setProperty("--mist-x", `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--mist-y", `${y.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--motion-x", motionX.toFixed(3));
    event.currentTarget.style.setProperty("--motion-y", motionY.toFixed(3));
    event.currentTarget.style.setProperty("--figure-x", `${(motionX * 18).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--figure-y", `${(motionY * 12).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--backdrop-x", `${(motionX * -12).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--backdrop-y", `${(motionY * -8).toFixed(2)}px`);
  }, []);

  const applyCharacterPayload = useCallback((payload: CharacterAssetsPayload) => {
    if (!hasWelcomeAssetContract(payload)) {
      setAssetStatus("restart backend");
      setAssetStatusTone("warn");
    }
    setActiveAsset(resolveWelcomeAsset(payload));
  }, []);

  const handleUpload = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAssetStatus("image only");
      return;
    }
    setAssetBusy(true);
    setAssetStatus("saving");
    setAssetStatusTone("idle");
    try {
      const payload = await uploadWelcomeCharacterAsset(file);
      applyCharacterPayload(payload);
      setAssetStatus("saved");
      setAssetStatusTone("ok");
    } catch (error) {
      setAssetStatus(uploadFailureStatus(error));
      setAssetStatusTone("error");
    } finally {
      setAssetBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [applyCharacterPayload]);

  const handleReset = useCallback(async () => {
    setAssetBusy(true);
    setAssetStatus("resetting");
    setAssetStatusTone("idle");
    try {
      const payload = await resetWelcomeCharacterAsset();
      applyCharacterPayload(payload);
      setAssetStatus("default");
      setAssetStatusTone("ok");
    } catch (error) {
      setAssetStatus(uploadFailureStatus(error));
      setAssetStatusTone("error");
    } finally {
      setAssetBusy(false);
    }
  }, [applyCharacterPayload]);

  useEffect(() => {
    let cancelled = false;
    void fetchCharacterAssets()
      .then((payload) => {
        if (!cancelled) applyCharacterPayload(payload);
      })
      .catch(() => {
        if (!cancelled) {
          setAssetStatus("local");
          setAssetStatusTone("warn");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyCharacterPayload]);

  return (
    <main
      className="welcome-shell"
      style={shellStyle}
      onPointerMove={handlePointerMove}
    >
      <img
        className="welcome-backdrop welcome-backdrop-blur"
        key={`blur-${activeAsset.id}-${activeAsset.image}`}
        src={activeAsset.image}
        alt=""
        aria-hidden="true"
      />
      <img
        className="welcome-backdrop welcome-figure"
        key={`figure-${activeAsset.id}-${activeAsset.image}`}
        src={activeAsset.image}
        alt=""
        aria-hidden="true"
      />
      <div className="welcome-grid-overlay" aria-hidden="true" />
      <div className="welcome-light-field" aria-hidden="true" />
      <div className="welcome-veil welcome-veil-a" aria-hidden="true" />
      <div className="welcome-veil welcome-veil-b" aria-hidden="true" />
      <div className="welcome-noise" aria-hidden="true" />

      <div className="welcome-topline" aria-hidden="true">
        <span className="welcome-brand-mark">RIN</span>
        <span>glitch core</span>
        <span>v2026</span>
      </div>

      <div className="welcome-side-rail" aria-hidden="true">
        thinking with stories
      </div>

      <section className="welcome-content" aria-label="RIN entry">
        <h1 className="dream-title" data-text="RIN">
          <span>RIN</span>
        </h1>
        <p className="dream-subtitle">dream core</p>
        <div className="dream-status-stack" aria-hidden="true">
          <span><em>system</em><strong>online</strong></span>
          <span><em>core</em><strong>stable</strong></span>
          <span><em>memory</em><strong>resonant</strong></span>
        </div>
      </section>

      <button
        className="dream-enter"
        data-testid="welcome-enter"
        type="button"
        aria-label="Enter RIN glitch core"
        onMouseEnter={() => onPreload("/glitch-core")}
        onFocus={() => onPreload("/glitch-core")}
        onClick={() => onNavigate("/glitch-core")}
      >
        <span className="dream-enter-main">enter</span>
        <span className="dream-enter-sub" aria-hidden="true">step into the glitch</span>
      </button>

      <div
        className={`welcome-config welcome-config-${assetStatusTone}`}
        aria-label="Welcome character image"
      >
        <input
          ref={fileInputRef}
          className="welcome-file-input"
          data-testid="welcome-image-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => void handleUpload(event.currentTarget.files)}
        />
        <button
          className="welcome-config-button"
          type="button"
          aria-label={`Load welcome character image. Current: ${activeAsset.label}`}
          disabled={assetBusy}
          onClick={() => fileInputRef.current?.click()}
        >
          image
        </button>
        {activeAsset.backendAssetId ? (
          <button
            className="welcome-config-button"
            type="button"
            aria-label="Reset welcome character image"
            disabled={assetBusy}
            onClick={() => void handleReset()}
          >
            reset
          </button>
        ) : null}
        {assetStatus ? <span className="welcome-config-status">{assetStatus}</span> : null}
      </div>
    </main>
  );
}
