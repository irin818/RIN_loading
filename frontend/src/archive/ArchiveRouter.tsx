export type ArchiveRouteMatch =
  | { kind: "archive-home" }
  | { kind: "archive-illustrations" }
  | { kind: "archive-comics" }
  | { kind: "archive-comic-reader"; seriesId: string }
  | { kind: "archive-stories" }
  | { kind: "archive-story-reader"; storyId: string }
  | { kind: "archive-character-files" }
  | { kind: "archive-timeline" }
  | { kind: "archive-admin" }
  | { kind: "not-found"; path: string };

export function matchArchiveRoute(pathname: string): ArchiveRouteMatch {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/archive" || path === "/portfolio" || path === "/library") {
    return { kind: "archive-home" };
  }
  if (path === "/archive/illustrations") {
    return { kind: "archive-illustrations" };
  }
  if (path === "/archive/comics" || path === "/comics") {
    return { kind: "archive-comics" };
  }
  const comicMatch = path.match(/^\/archive\/comics\/([^/]+)$/);
  if (comicMatch) {
    return { kind: "archive-comic-reader", seriesId: comicMatch[1] };
  }
  if (path === "/archive/stories") {
    return { kind: "archive-stories" };
  }
  const storyMatch = path.match(/^\/archive\/stories\/([^/]+)$/);
  if (storyMatch) {
    return { kind: "archive-story-reader", storyId: storyMatch[1] };
  }
  if (path === "/archive/character-files") {
    return { kind: "archive-character-files" };
  }
  if (path === "/archive/timeline") {
    return { kind: "archive-timeline" };
  }
  if (path === "/admin/archive") {
    return { kind: "archive-admin" };
  }

  return { kind: "not-found", path };
}
