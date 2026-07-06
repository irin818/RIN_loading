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
  fit: "cover" | "contain";
  position: string;
  mobilePosition: string;
  backendAssetId?: string;
};

const DEFAULT_WELCOME_ASSET: WelcomeDisplayAsset = {
  id: "mist-city",
  label: "Mist",
  image: "/body-assets/rin/welcome/rin-mist-city.png",
  fit: "cover",
  position: "56% 43%",
  mobilePosition: "50% 38%",
};

function resolveWelcomeAsset(payload: CharacterAssetsPayload): WelcomeDisplayAsset {
  const selectedId = payload.welcomeAssetId ?? payload.selectedAssetId ?? null;
  const asset = selectedId
    ? payload.assets.find((item) => item.id === selectedId)
    : undefined;
  return asset ? fromBackendAsset(asset) : DEFAULT_WELCOME_ASSET;
}

function fromBackendAsset(asset: RinCharacterAsset): WelcomeDisplayAsset {
  return {
    id: asset.id,
    backendAssetId: asset.id,
    label: asset.label,
    image: asset.path,
    fit: asset.custom ? "cover" : "contain",
    position: asset.custom ? "50% 44%" : "56% 50%",
    mobilePosition: asset.custom ? "50% 40%" : "50% 50%",
  };
}

export function WelcomePage({ onNavigate, onPreload }: WelcomePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeAsset, setActiveAsset] = useState<WelcomeDisplayAsset>(DEFAULT_WELCOME_ASSET);
  const [assetStatus, setAssetStatus] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);

  const shellStyle = useMemo(
    () => ({
      "--welcome-fit": activeAsset.fit,
      "--welcome-image-position": activeAsset.position,
      "--welcome-mobile-image-position": activeAsset.mobilePosition,
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
    try {
      const payload = await uploadWelcomeCharacterAsset(file);
      applyCharacterPayload(payload);
      setAssetStatus("saved");
    } catch {
      setAssetStatus("failed");
    } finally {
      setAssetBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [applyCharacterPayload]);

  const handleReset = useCallback(async () => {
    setAssetBusy(true);
    setAssetStatus("resetting");
    try {
      const payload = await resetWelcomeCharacterAsset();
      applyCharacterPayload(payload);
      setAssetStatus("default");
    } catch {
      setAssetStatus("failed");
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
        if (!cancelled) setAssetStatus("local");
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
        src={activeAsset.image}
        alt=""
        aria-hidden="true"
      />
      <img
        className="welcome-backdrop welcome-figure"
        src={activeAsset.image}
        alt=""
        aria-hidden="true"
      />
      <div className="welcome-light-field" aria-hidden="true" />
      <div className="welcome-veil welcome-veil-a" aria-hidden="true" />
      <div className="welcome-veil welcome-veil-b" aria-hidden="true" />

      <section className="welcome-content" aria-label="RIN entry">
        <h1 className="dream-title" data-text="RIN">
          <span>RIN</span>
        </h1>
      </section>

      <button
        className="dream-enter"
        type="button"
        onMouseEnter={() => onPreload("/glitch-core")}
        onFocus={() => onPreload("/glitch-core")}
        onClick={() => onNavigate("/glitch-core")}
      >
        <span>enter</span>
      </button>

      <div className="welcome-config" aria-label="Welcome character image">
        <input
          ref={fileInputRef}
          className="welcome-file-input"
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
