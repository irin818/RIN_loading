import type { WebModuleDefinition } from "../app/webModules";

interface ModulePlaceholderPageProps {
  module?: WebModuleDefinition;
  path?: string;
  onNavigate: (path: string) => void;
}

export function ModulePlaceholderPage({
  module,
  path,
  onNavigate,
}: ModulePlaceholderPageProps) {
  const label = module?.label ?? "Route";
  const code = module?.code ?? "404";

  return (
    <main className="reserved-page">
      <header className="reserved-header">
        <button type="button" onClick={() => onNavigate("/")}>
          RIN
        </button>
        <span>{code}</span>
      </header>
      <section className="reserved-content" aria-label={`${label} module`}>
        <p className="reserved-kicker">
          {module ? "Reserved Web Module" : "Missing Route"}
        </p>
        <h1>{label}</h1>
        <p>
          {module
            ? "This route is registered in the local web shell and ready for a future module."
            : `${path ?? "This path"} is not registered in the local web shell.`}
        </p>
        <div className="reserved-actions">
          <button type="button" onClick={() => onNavigate("/")}>
            Welcome
          </button>
          <button type="button" onClick={() => onNavigate("/glitch-core")}>
            Glitch Core
          </button>
        </div>
      </section>
    </main>
  );
}
