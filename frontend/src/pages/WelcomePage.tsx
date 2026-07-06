import type { WebModuleDefinition } from "../app/webModules";

interface WelcomePageProps {
  modules: WebModuleDefinition[];
  onNavigate: (path: string) => void;
  onPreload: (path: string) => void;
}

export function WelcomePage({ modules, onNavigate, onPreload }: WelcomePageProps) {
  const launchableModules = modules.filter((module) => module.id !== "welcome");

  return (
    <main className="welcome-shell">
      <img
        className="welcome-backdrop"
        src="/body-assets/rin/hero/rin-hero-v2.png"
        alt=""
        aria-hidden="true"
      />
      <section className="welcome-content" aria-label="RIN entry">
        <p className="welcome-kicker">LOCAL FIRST AI SYSTEM</p>
        <h1>RIN</h1>
        <p className="welcome-copy">
          Personal core, body view, and future web modules stay behind one local shell.
        </p>
        <div className="welcome-actions">
          <button
            className="welcome-primary"
            type="button"
            onMouseEnter={() => onPreload("/glitch-core")}
            onFocus={() => onPreload("/glitch-core")}
            onClick={() => onNavigate("/glitch-core")}
          >
            Enter Core
          </button>
          <button
            className="welcome-secondary"
            type="button"
            onMouseEnter={() => onPreload("/body")}
            onFocus={() => onPreload("/body")}
            onClick={() => onNavigate("/body")}
          >
            Body View
          </button>
        </div>
      </section>

      <nav className="module-dock" aria-label="RIN modules">
        {launchableModules.map((module) => (
          <button
            key={module.id}
            className="module-launch"
            type="button"
            onMouseEnter={() => onPreload(module.path)}
            onFocus={() => onPreload(module.path)}
            onClick={() => onNavigate(module.path)}
          >
            <span className="module-code">{module.code}</span>
            <span className="module-name">{module.label}</span>
            <span className={`module-status ${module.status}`}>
              {module.status === "live" ? "Live" : "Reserved"}
            </span>
          </button>
        ))}
      </nav>
    </main>
  );
}
