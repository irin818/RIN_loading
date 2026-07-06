export type WebModuleStatus = "live" | "reserved";
export type WebModuleKind = "entry" | "core" | "body" | "content";

export interface WebModuleDefinition {
  id: string;
  path: string;
  label: string;
  code: string;
  kind: WebModuleKind;
  status: WebModuleStatus;
}

export type WebRouteMatch =
  | { kind: "welcome"; module: WebModuleDefinition }
  | { kind: "glitch-core"; module: WebModuleDefinition }
  | { kind: "body"; module: WebModuleDefinition; mode: "body" | "floating" }
  | { kind: "reserved"; module: WebModuleDefinition }
  | { kind: "not-found"; path: string };

export const WEB_MODULES: WebModuleDefinition[] = [
  {
    id: "welcome",
    path: "/",
    label: "RIN",
    code: "ENTRY",
    kind: "entry",
    status: "live",
  },
  {
    id: "glitch-core",
    path: "/glitch-core",
    label: "Glitch Core",
    code: "CORE",
    kind: "core",
    status: "live",
  },
  {
    id: "body",
    path: "/body",
    label: "Body",
    code: "BODY",
    kind: "body",
    status: "live",
  },
  {
    id: "comics",
    path: "/comics",
    label: "Comics",
    code: "CMX",
    kind: "content",
    status: "reserved",
  },
  {
    id: "games",
    path: "/games",
    label: "Games",
    code: "GAME",
    kind: "content",
    status: "reserved",
  },
  {
    id: "library",
    path: "/library",
    label: "Library",
    code: "LIB",
    kind: "content",
    status: "reserved",
  },
];

const ROUTE_BY_PATH = new Map(WEB_MODULES.map((item) => [item.path, item]));

export function normalizeWebPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

export function matchWebRoute(pathname: string): WebRouteMatch {
  const path = normalizeWebPath(pathname);
  if (path === "/body/floating") {
    return {
      kind: "body",
      module: ROUTE_BY_PATH.get("/body")!,
      mode: "floating",
    };
  }

  const module = ROUTE_BY_PATH.get(path);
  if (!module) return { kind: "not-found", path };
  if (module.id === "welcome") return { kind: "welcome", module };
  if (module.id === "glitch-core") return { kind: "glitch-core", module };
  if (module.id === "body") return { kind: "body", module, mode: "body" };
  return { kind: "reserved", module };
}

export function routableWebShellPaths(): string[] {
  return ["/", "/body/floating", ...WEB_MODULES.map((item) => item.path)];
}
