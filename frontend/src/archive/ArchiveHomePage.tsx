interface ArchiveHomePageProps {
  onNavigate: (path: string) => void;
}

const CATEGORY_CARDS = [
  {
    path: "/archive/illustrations",
    title: "Illustrations",
    code: "ILLUST",
    description: "Artwork, paintings, and visual pieces",
    count: null as number | null,
  },
  {
    path: "/archive/comics",
    title: "Comics",
    code: "COMIC",
    description: "Comic series and sequential art",
    count: null,
  },
  {
    path: "/archive/stories",
    title: "Stories",
    code: "STORY",
    description: "Written works and narratives",
    count: null,
  },
  {
    path: "/archive/character-files",
    title: "Character Files",
    code: "CHARS",
    description: "Character designs, Live2D assets, avatars, references",
    count: null,
  },
  {
    path: "/archive/timeline",
    title: "Timeline",
    code: "TIME",
    description: "Archive evolution and recent additions",
    count: null,
  },
  {
    path: "/admin/archive",
    title: "Admin",
    code: "ADMIN",
    description: "Local owner asset management",
    count: null,
  },
];

export function ArchiveHomePage({ onNavigate }: ArchiveHomePageProps) {
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
          {CATEGORY_CARDS.map((item) => (
            <button
              key={item.path}
              className="archive-nav-item"
              type="button"
              onClick={() => onNavigate(item.path)}
              data-code={item.code}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </header>

      <div className="archive-page">
        <div className="archive-page-head">
          <h1 className="archive-page-title">RIN Archive</h1>
          <p className="archive-page-subtitle">
            local creative memory gallery
          </p>
        </div>
        <div className="archive-page-body">
          <div className="archive-home-grid">
            {CATEGORY_CARDS.map((card) => (
              <button
                key={card.path}
                className="archive-category-card"
                type="button"
                onClick={() => onNavigate(card.path)}
                data-code={card.code}
              >
                <span className="archive-category-card-code">{card.code}</span>
                <span className="archive-category-card-title">{card.title}</span>
                <span className="archive-category-card-desc">
                  {card.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="archive-footer" aria-hidden="true">
        <span>RIN Archive · local memory gallery</span>
        <span>local-first · single-owner · v2026</span>
      </footer>
    </div>
  );
}
