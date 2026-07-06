import { useCallback } from "react";
import { useSyncExternalStore } from "react";
import { navigateWebShell } from "../app/AppRouter";
import { matchArchiveRoute } from "./ArchiveRouter";
import { ArchiveErrorBoundary } from "./components/ArchiveErrorBoundary";
import { ArchiveHomePage } from "./ArchiveHomePage";
import { ArchiveIllustrationsPage } from "./ArchiveIllustrationsPage";
import { ArchiveComicsPage } from "./ArchiveComicsPage";
import { ArchiveComicReaderPage } from "./ArchiveComicReaderPage";
import { ArchiveStoriesPage } from "./ArchiveStoriesPage";
import { ArchiveStoryReaderPage } from "./ArchiveStoryReaderPage";
import { ArchiveCharacterFilesPage } from "./ArchiveCharacterFilesPage";
import { ArchiveTimelinePage } from "./ArchiveTimelinePage";
import { ArchiveAdminPage } from "./ArchiveAdminPage";
import "./archive.css";

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
  return "/archive";
}

export function ArchiveShell() {
  const pathname = useSyncExternalStore(
    subscribeLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const route = matchArchiveRoute(pathname);
  const navigate = useCallback((path: string) => navigateWebShell(path), []);

  return (
    <main className="archive-shell">
      <div className="archive-noise-overlay" aria-hidden="true" />
      <ArchiveErrorBoundary fallbackLabel="Archive Section">
        {route.kind === "archive-home" && <ArchiveHomePage onNavigate={navigate} />}
        {route.kind === "archive-illustrations" && (
          <ArchiveIllustrationsPage onNavigate={navigate} />
        )}
        {route.kind === "archive-comics" && (
          <ArchiveComicsPage onNavigate={navigate} />
        )}
        {route.kind === "archive-comic-reader" && (
          <ArchiveComicReaderPage
            seriesId={route.seriesId}
            onNavigate={navigate}
          />
        )}
        {route.kind === "archive-stories" && (
          <ArchiveStoriesPage onNavigate={navigate} />
        )}
        {route.kind === "archive-story-reader" && (
          <ArchiveStoryReaderPage
            storyId={route.storyId}
            onNavigate={navigate}
          />
        )}
        {route.kind === "archive-character-files" && (
          <ArchiveCharacterFilesPage onNavigate={navigate} />
        )}
        {route.kind === "archive-timeline" && (
          <ArchiveTimelinePage onNavigate={navigate} />
        )}
        {route.kind === "archive-admin" && (
          <ArchiveAdminPage onNavigate={navigate} />
        )}
      </ArchiveErrorBoundary>
    </main>
  );
}
