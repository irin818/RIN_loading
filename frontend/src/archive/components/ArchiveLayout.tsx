import type { ReactNode } from "react";

interface ArchiveLayoutProps {
  title: string;
  subtitle?: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

const ARCHIVE_NAV_ITEMS = [
  { path: "/archive", label: "Home", code: "HOME" },
  { path: "/archive/illustrations", label: "Illustrations", code: "ILLUST" },
  { path: "/archive/comics", label: "Comics", code: "COMIC" },
  { path: "/archive/stories", label: "Stories", code: "STORY" },
  {
    path: "/archive/character-files",
    label: "Characters",
    code: "CHARS",
  },
  { path: "/archive/timeline", label: "Timeline", code: "TIME" },
  { path: "/admin/archive", label: "Admin", code: "ADMIN" },
];

export function ArchiveLayout({
  title,
  subtitle,
  onNavigate,
  children,
}: ArchiveLayoutProps) {
  return (
    <div className="archive-layout">
      <header className="archive-header">
        <button
          className="archive-header-home"
          type="button"
          onClick={() => onNavigate("/")}
          aria-label="Return to RIN welcome"
        >
          <span className="archive-header-brand">RIN</span>
          <span className="archive-header-sep">/</span>
          <span className="archive-header-module">ARCHIVE</span>
        </button>
        <nav className="archive-nav" aria-label="Archive sections">
          {ARCHIVE_NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className="archive-nav-item"
              type="button"
              onClick={() => onNavigate(item.path)}
              data-code={item.code}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="archive-page">
        <div className="archive-page-head">
          <h1 className="archive-page-title">{title}</h1>
          {subtitle && <p className="archive-page-subtitle">{subtitle}</p>}
        </div>
        <div className="archive-page-body">{children}</div>
      </div>

      <footer className="archive-footer" aria-hidden="true">
        <span>RIN Archive · local memory gallery</span>
        <span>local-first · single-owner · v2026</span>
      </footer>
    </div>
  );
}
