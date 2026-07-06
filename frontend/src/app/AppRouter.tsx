import { lazy, Suspense, useCallback, useSyncExternalStore } from "react";

import { ModulePlaceholderPage } from "../pages/ModulePlaceholderPage";
import { WelcomePage } from "../pages/WelcomePage";
import { matchWebRoute } from "./webModules";
import "./web-shell.css";

const GlitchCoreApp = lazy(() => import("../glitch-core/GlitchCoreApp"));
const BodyStandalonePage = lazy(() =>
  import("../body/BodyStandalonePage").then((module) => ({
    default: module.BodyStandalonePage,
  })),
);

function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("rin:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("rin:navigate", callback);
  };
}

function getLocationSnapshot() {
  return window.location.pathname;
}

function getServerLocationSnapshot() {
  return "/";
}

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="web-shell-loading" aria-live="polite">
      <span>RIN</span>
      <strong>{label}</strong>
    </main>
  );
}

function preloadRoute(path: string) {
  if (path === "/glitch-core") {
    void import("../glitch-core/GlitchCoreApp");
    return;
  }
  if (path === "/body" || path === "/body/floating") {
    void import("../body/BodyStandalonePage");
  }
}

export function navigateWebShell(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("rin:navigate"));
}

export function AppRouter() {
  const pathname = useSyncExternalStore(
    subscribeLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const route = matchWebRoute(pathname);
  const navigate = useCallback((path: string) => navigateWebShell(path), []);

  if (route.kind === "welcome") {
    return (
      <WelcomePage
        onNavigate={navigate}
        onPreload={preloadRoute}
      />
    );
  }

  if (route.kind === "glitch-core") {
    return (
      <Suspense fallback={<RouteLoading label="Glitch Core" />}>
        <GlitchCoreApp />
      </Suspense>
    );
  }

  if (route.kind === "body") {
    return (
      <Suspense fallback={<RouteLoading label="Body" />}>
        <BodyStandalonePage mode={route.mode} />
      </Suspense>
    );
  }

  return (
    <ModulePlaceholderPage
      module={route.kind === "reserved" ? route.module : undefined}
      path={route.kind === "not-found" ? route.path : undefined}
      onNavigate={navigate}
    />
  );
}
