import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { fetchBodyState } from "./api";
import type {
  BodyActivity,
  BodyRuntimeState,
  BodyStatePayload
} from "./types";
import {
  EmptyState,
  MetricCard,
  SectionPanel,
  SegmentedControl,
  StatusBadge
} from "./visualization";
import type { DisplayMode } from "./visualization";

type BodyPreviewMode = "auto" | BodyActivity;

const BODY_PREVIEW_OPTIONS: BodyPreviewMode[] = [
  "auto",
  "idle",
  "thinking",
  "speaking",
  "listening",
  "memory",
  "reviewing",
  "warning",
  "sleeping",
];

const DEFAULT_BODY_STATE: BodyRuntimeState = {
  activity: "idle",
  expression: "neutral",
  motion: "idle_breath",
  intensity: 0.3,
  speechState: "silent",
  attentionState: "relaxed",
  mood: "neutral",
  warningLevel: "none",
  source: "frontend_default",
  reason: "Body state is loading.",
};

export function BodyPanel(props: {
  snapshotBody?: BodyStatePayload | null;
  chatBusy?: boolean;
  latestRinMessageId?: string | null;
  displayMode: DisplayMode;
  compact?: boolean;
  onOpenConsole?: () => void;
}) {
  const {
    payload,
    bodyState,
    manualMode,
    reducedMotion,
    forceFallback,
    fetchedAtLabel,
    error,
    setManualMode,
    setForceFallback,
    reload,
  } = useBodyStateController({
    snapshotBody: props.snapshotBody,
    chatBusy: props.chatBusy ?? false,
    latestRinMessageId: props.latestRinMessageId ?? null,
  });
  const model = payload?.model ?? null;
  const fallbackActive = forceFallback || (model?.fallbackActive ?? true);
  const statusTone = bodyState.warningLevel === "error"
    ? "danger"
    : bodyState.warningLevel === "warning" || (model ? model.status !== "available" : true)
      ? "warn"
      : "ok";

  return (
    <div className={`body-module activity-${bodyState.activity} ${props.compact ? "compact" : ""}`}>
      <div className="module-strip">BODY · LIVE2D PRESENCE</div>
      <div className="body-layout">
        <div className="body-shell">
          <BodyStage
            payload={payload}
            state={bodyState}
            forceFallback={forceFallback}
            reducedMotion={reducedMotion}
          />
        </div>
        <BodyStatusStrip
          payload={payload}
          state={bodyState}
          fallbackActive={fallbackActive}
          fetchedAtLabel={fetchedAtLabel}
          tone={statusTone}
        />
      </div>
      {error ? <p className="body-error">{error}</p> : null}
      <BodyControlStrip
        payload={payload}
        manualMode={manualMode}
        forceFallback={forceFallback}
        reducedMotion={reducedMotion}
        onManualMode={setManualMode}
        onForceFallback={setForceFallback}
        onReload={reload}
        onOpenConsole={props.onOpenConsole}
      />
      <div className="body-metrics">
        <MetricCard label="activity" value={bodyState.activity} tone={statusTone} />
        <MetricCard label="expression" value={bodyState.expression} />
        <MetricCard label="motion" value={bodyState.motion} />
        <MetricCard label="runtime" value={model?.runtimeReady ? "ready" : "disabled"} tone={statusTone} />
      </div>
      {props.compact ? null : (
      <SectionPanel title="Asset Contract" defaultOpen={props.displayMode === "developer"}>
        {model ? (
          <div className="body-contract">
            <p className="readable-note">
              {model.statusDetail}
            </p>
            <div className="body-contract-grid">
              <span>Expected URL</span>
              <b>{model.expectedPath}</b>
              <span>Local path</span>
              <b>{model.installPath}</b>
              <span>Frontend public path</span>
              <b>{model.frontendInstallPath}</b>
              <span>Cubism export</span>
              <b>{model.cubismModelPath ?? "not found"}</b>
              <span>Moc / textures</span>
              <b>{model.mocPresent ? "moc ok" : "moc missing"} / {model.texturesPresent ? "textures ok" : "textures missing"}</b>
              <span>Motions / expressions</span>
              <b>{model.motionsPresent ? "motions ok" : "motions missing"} / {model.expressionsPresent ? "expressions ok" : "expressions missing"}</b>
              <span>Runtime ready</span>
              <b>{String(model.runtimeReady)}</b>
            </div>
            {[...model.missingRequiredFiles, ...model.missingReferencedFiles].length ? (
              <div className="tag-row">
                {[...model.missingRequiredFiles, ...model.missingReferencedFiles].map((item) => (
                  <span key={item}>missing {item}</span>
                ))}
              </div>
            ) : null}
            {model.partialCubismExports.length ? (
              <p className="readable-note">
                Partial export detected outside the standard contract; it is preserved
                as a continuation artifact but not auto-loaded as production Live2D.
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState message="Body model status loading." />
        )}
      </SectionPanel>
      )}
      {props.compact ? null : (
      <SectionPanel title="Visual Autonomy" defaultOpen={props.displayMode === "developer"}>
        <div className="body-contract-grid">
          <span>starts conversation</span>
          <b>{String(payload?.autonomy.startsConversation ?? false)}</b>
          <span>executes tools</span>
          <b>{String(payload?.autonomy.executesTools ?? false)}</b>
          <span>external API calls</span>
          <b>{String(payload?.autonomy.externalApiCalls ?? false)}</b>
          <span>writes backend data</span>
          <b>{String(payload?.autonomy.writesBackendData ?? false)}</b>
        </div>
        <p className="readable-note">
          Visual autonomy is limited to blink, breathing, subtle attention shifts,
          low-frequency idle variation, and state glow.
        </p>
      </SectionPanel>
      )}
    </div>
  );
}

export function BodyOnlyPage() {
  const floating = typeof window !== "undefined" && window.location.pathname === "/body/floating";
  return (
    <main className={`body-only-page ${floating ? "floating" : ""}`}>
      <BodyPanel
        displayMode={floating ? "basic" : "advanced"}
        compact={floating}
        onOpenConsole={() => {
          window.location.href = "/glitch-core";
        }}
      />
    </main>
  );
}

function BodyStage(props: {
  payload: BodyStatePayload | null;
  state: BodyRuntimeState;
  forceFallback: boolean;
  reducedMotion: boolean;
}) {
  const model = props.payload?.model;
  if (!model) {
    return <div className="body-stage loading">Loading body state</div>;
  }
  if (model.cubismRuntimeActive && model.runtimeReady && !props.forceFallback) {
    return <Live2DModelRenderer state={props.state} modelPath={model.expectedPath} />;
  }
  return (
    <FallbackAvatarRenderer
      assets={model.fallbackAssets}
      state={props.state}
      reducedMotion={props.reducedMotion}
    />
  );
}

function Live2DModelRenderer(props: {
  state: BodyRuntimeState;
  modelPath: string;
}) {
  return (
    <div className="body-live2d-adapter" data-model-path={props.modelPath}>
      <FallbackAdapterNotice state={props.state} />
    </div>
  );
}

function FallbackAdapterNotice({ state }: { state: BodyRuntimeState }) {
  return (
    <div className="body-fallback-notice">
      <strong>{state.expression}</strong>
      <span>Live2D runtime adapter boundary</span>
    </div>
  );
}

function FallbackAvatarRenderer(props: {
  assets: Record<string, string>;
  state: BodyRuntimeState;
  reducedMotion: boolean;
}) {
  const variant = useIdleVariant(props.reducedMotion);
  const bust = props.assets.bustFront;
  const fullBody = props.assets.frontFullBody;
  const avatar = fullBody ?? bust;
  if (!avatar) {
    return (
      <div className="fallback-avatar missing">
        <strong>Live2D model not installed yet</strong>
        <span>Place model files under /live2d/rin/rin.model3.json</span>
      </div>
    );
  }
  return (
    <div
      className={`fallback-avatar expression-${props.state.expression} motion-${props.state.motion} idle-variant-${variant}`}
      style={{ "--body-intensity": String(props.state.intensity) } as CSSProperties}
    >
      <span className="body-silhouette-glow" aria-hidden="true" />
      <span className="body-ground-glow" aria-hidden="true" />
      <img className="body-avatar-image" src={avatar} alt="RIN static fallback avatar" />
      <span className="body-state-ring ring-a" aria-hidden="true" />
      <span className="body-state-ring ring-b" aria-hidden="true" />
      <span className="body-particle particle-a" aria-hidden="true" />
      <span className="body-particle particle-b" aria-hidden="true" />
      <span className="body-particle particle-c" aria-hidden="true" />
    </div>
  );
}

function BodyStatusStrip(props: {
  payload: BodyStatePayload | null;
  state: BodyRuntimeState;
  fallbackActive: boolean;
  fetchedAtLabel: string;
  tone: "ok" | "warn" | "danger" | "neutral";
}) {
  const model = props.payload?.model;
  const installMessage = props.payload?.installInstructions.message
    ?? "Live2D model not installed yet";
  return (
    <aside className={`body-status-strip ${props.tone}`}>
      <header>
        <StatusBadge value={props.state.activity} />
        <span>{props.fetchedAtLabel}</span>
      </header>
      <p>{props.state.reason}</p>
      <div>
        <span>model</span>
        <b>{model?.status ?? "loading"}</b>
      </div>
      <div>
        <span>fallback</span>
        <b>{props.fallbackActive ? "active" : "inactive"}</b>
      </div>
      <div>
        <span>runtime</span>
        <b>{model?.runtimeReady ? "ready" : "disabled"}</b>
      </div>
      {model && model.status !== "available" ? (
        <small>{installMessage}: {model.expectedPath}</small>
      ) : null}
    </aside>
  );
}

function BodyControlStrip(props: {
  payload: BodyStatePayload | null;
  manualMode: BodyPreviewMode;
  forceFallback: boolean;
  reducedMotion: boolean;
  onManualMode: (value: BodyPreviewMode) => void;
  onForceFallback: (value: boolean) => void;
  onReload: () => void;
  onOpenConsole?: () => void;
}) {
  return (
    <div className="body-controls">
      <SegmentedControl
        label="preview"
        value={props.manualMode}
        options={BODY_PREVIEW_OPTIONS}
        onChange={props.onManualMode}
      />
      <div className="inline-actions">
        <button type="button" onClick={props.onReload}>Reload model</button>
        <button
          type="button"
          className={props.forceFallback ? "active" : ""}
          onClick={() => props.onForceFallback(!props.forceFallback)}
        >
          {props.forceFallback ? "Fallback on" : "Fallback auto"}
        </button>
        {props.manualMode !== "auto" ? (
          <button type="button" onClick={() => props.onManualMode("auto")}>
            Reset preview
          </button>
        ) : null}
        <a href="/body" target="_blank" rel="noreferrer">Body-only</a>
        <a href="/body/floating" target="_blank" rel="noreferrer">Floating</a>
        {props.onOpenConsole ? (
          <button type="button" onClick={props.onOpenConsole}>Open console</button>
        ) : null}
      </div>
      <div className="tag-row">
        <span>reduced motion: {props.reducedMotion ? "on" : "off"}</span>
        <span>backend writes: {String(props.payload?.controls.backendMutationAvailable ?? false)}</span>
      </div>
    </div>
  );
}

function useBodyStateController(options: {
  snapshotBody?: BodyStatePayload | null;
  chatBusy: boolean;
  latestRinMessageId: string | null;
}) {
  const [payload, setPayload] = useState<BodyStatePayload | null>(
    options.snapshotBody ?? null
  );
  const [manualMode, setManualMode] = useState<BodyPreviewMode>("auto");
  const [forceFallback, setForceFallback] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [speakingUntil, setSpeakingUntil] = useState(0);
  const reducedMotion = useReducedMotion();
  const latestRinMessageRef = useRef<string | null | undefined>(undefined);

  const reload = useCallback(async () => {
    try {
      const next = await fetchBodyState();
      setPayload(next);
      setFetchedAt(new Date());
      setError("");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Body state fetch failed.");
    }
  }, []);

  useEffect(() => {
    if (!options.snapshotBody) {
      return;
    }
    setPayload(options.snapshotBody);
    setFetchedAt(new Date());
  }, [options.snapshotBody]);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), 12000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    const previous = latestRinMessageRef.current;
    latestRinMessageRef.current = options.latestRinMessageId;
    if (previous !== undefined && options.latestRinMessageId && previous !== options.latestRinMessageId) {
      setSpeakingUntil(Date.now() + 4500);
    }
  }, [options.latestRinMessageId]);

  useEffect(() => {
    if (speakingUntil <= Date.now()) {
      return;
    }
    const timer = window.setTimeout(() => setSpeakingUntil(0), speakingUntil - Date.now());
    return () => window.clearTimeout(timer);
  }, [speakingUntil]);

  const targetState = useMemo(() => {
    if (manualMode !== "auto") {
      return manualBodyState(manualMode);
    }
    const base = payload?.bodyState ?? DEFAULT_BODY_STATE;
    if (base.warningLevel === "error" || base.activity === "error") {
      return base;
    }
    if (options.chatBusy) {
      return manualBodyState("thinking");
    }
    if (speakingUntil > Date.now()) {
      return manualBodyState("speaking");
    }
    return base;
  }, [manualMode, options.chatBusy, payload?.bodyState, speakingUntil]);
  const bodyState = useStableBodyState(targetState);
  const fetchedAtLabel = fetchedAt ? fetchedAt.toLocaleTimeString() : "loading";

  return {
    payload,
    bodyState,
    manualMode,
    reducedMotion,
    forceFallback,
    fetchedAtLabel,
    error,
    setManualMode,
    setForceFallback,
    reload,
  };
}

function useStableBodyState(target: BodyRuntimeState) {
  const [stable, setStable] = useState(target);
  const lastChangeAt = useRef(Date.now());
  const targetKey = bodyStateKey(target);

  useEffect(() => {
    if (bodyStateKey(stable) === targetKey) {
      if (stable.reason !== target.reason || stable.source !== target.source) {
        setStable(target);
      }
      return;
    }
    const elapsed = Date.now() - lastChangeAt.current;
    const wait = Math.max(0, 700 - elapsed);
    const timer = window.setTimeout(() => {
      lastChangeAt.current = Date.now();
      setStable(target);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [stable, target, targetKey]);

  return stable;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useIdleVariant(reducedMotion: boolean) {
  const [variant, setVariant] = useState(0);
  useEffect(() => {
    if (reducedMotion) {
      setVariant(0);
      return;
    }
    const timer = window.setInterval(() => {
      setVariant((current) => (current + 1) % 3);
    }, 11000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);
  return variant;
}

function bodyStateKey(state: BodyRuntimeState) {
  return [
    state.activity,
    state.expression,
    state.motion,
    state.warningLevel,
    state.speechState,
  ].join("|");
}

function manualBodyState(activity: BodyActivity): BodyRuntimeState {
  const map: Record<BodyActivity, BodyRuntimeState> = {
    idle: {
      ...DEFAULT_BODY_STATE,
      activity: "idle",
      expression: "neutral",
      motion: "idle_breath",
      reason: "Manual frontend-only idle preview.",
    },
    thinking: {
      ...DEFAULT_BODY_STATE,
      activity: "thinking",
      expression: "focused",
      motion: "thinking_loop",
      intensity: 0.72,
      attentionState: "focused",
      mood: "focused",
      reason: "Manual frontend-only thinking preview.",
    },
    speaking: {
      ...DEFAULT_BODY_STATE,
      activity: "speaking",
      expression: "gentle",
      motion: "speaking_loop",
      intensity: 0.62,
      speechState: "simulated",
      attentionState: "engaged",
      mood: "warm",
      reason: "Manual frontend-only speaking preview.",
    },
    listening: {
      ...DEFAULT_BODY_STATE,
      activity: "listening",
      expression: "focused",
      motion: "attention_shift",
      intensity: 0.48,
      attentionState: "attentive",
      reason: "Manual frontend-only listening preview.",
    },
    memory: {
      ...DEFAULT_BODY_STATE,
      activity: "memory",
      expression: "gentle",
      motion: "memory_pulse",
      intensity: 0.58,
      attentionState: "reviewing",
      mood: "attentive",
      reason: "Manual frontend-only memory preview.",
    },
    warning: {
      ...DEFAULT_BODY_STATE,
      activity: "warning",
      expression: "alert",
      motion: "warning_alert",
      intensity: 0.78,
      warningLevel: "warning",
      attentionState: "alert",
      mood: "concerned",
      reason: "Manual frontend-only warning preview.",
    },
    error: {
      ...DEFAULT_BODY_STATE,
      activity: "error",
      expression: "concerned",
      motion: "warning_alert",
      intensity: 0.9,
      warningLevel: "error",
      attentionState: "alert",
      mood: "concerned",
      reason: "Manual frontend-only error preview.",
    },
    sleeping: {
      ...DEFAULT_BODY_STATE,
      activity: "sleeping",
      expression: "tired",
      motion: "sleep_loop",
      intensity: 0.2,
      attentionState: "resting",
      mood: "quiet",
      reason: "Manual frontend-only sleeping preview.",
    },
    reviewing: {
      ...DEFAULT_BODY_STATE,
      activity: "reviewing",
      expression: "thinking",
      motion: "memory_pulse",
      intensity: 0.55,
      attentionState: "reviewing",
      mood: "focused",
      reason: "Manual frontend-only reviewing preview.",
    },
  };
  return map[activity];
}
