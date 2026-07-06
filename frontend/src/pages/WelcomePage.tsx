import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

interface WelcomePageProps {
  onNavigate: (path: string) => void;
  onPreload: (path: string) => void;
}

const WELCOME_CHARACTERS = [
  {
    id: "mist-city",
    label: "Mist",
    image: "/body-assets/rin/welcome/rin-mist-city.png",
    fit: "cover",
    position: "56% 43%",
    mobilePosition: "50% 38%",
  },
  {
    id: "moon-veil",
    label: "Moon",
    image: "/body-assets/rin/hero/rin-hero-v2.png",
    fit: "contain",
    position: "58% 50%",
    mobilePosition: "50% 50%",
  },
  {
    id: "core",
    label: "Core",
    image: "/body-assets/rin/characters/rin-00-core.png",
    fit: "contain",
    position: "54% 46%",
    mobilePosition: "50% 50%",
  },
  {
    id: "leap",
    label: "Leap",
    image: "/body-assets/rin/characters/rin-imagel-01-leap.png",
    fit: "contain",
    position: "55% 50%",
    mobilePosition: "50% 52%",
  },
] as const;

export function WelcomePage({ onNavigate, onPreload }: WelcomePageProps) {
  const [characterIndex, setCharacterIndex] = useState(0);
  const activeCharacter = WELCOME_CHARACTERS[characterIndex] ?? WELCOME_CHARACTERS[0];

  const shellStyle = useMemo(
    () => ({
      "--welcome-fit": activeCharacter.fit,
      "--welcome-image-position": activeCharacter.position,
      "--welcome-mobile-image-position": activeCharacter.mobilePosition,
    }) as CSSProperties,
    [activeCharacter],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    event.currentTarget.style.setProperty("--mist-x", `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--mist-y", `${y.toFixed(2)}%`);
  }, []);

  return (
    <main
      className="welcome-shell"
      style={shellStyle}
      onPointerMove={handlePointerMove}
    >
      <img
        className="welcome-backdrop welcome-backdrop-blur"
        src={activeCharacter.image}
        alt=""
        aria-hidden="true"
      />
      <img
        className="welcome-backdrop welcome-figure"
        src={activeCharacter.image}
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
        <button
          className="dream-enter"
          type="button"
          onMouseEnter={() => onPreload("/glitch-core")}
          onFocus={() => onPreload("/glitch-core")}
          onClick={() => onNavigate("/glitch-core")}
        >
          enter
        </button>
      </section>

      <div className="character-switcher" aria-label="Change welcome character">
        {WELCOME_CHARACTERS.map((character, index) => (
          <button
            key={character.id}
            className={`character-dot ${index === characterIndex ? "active" : ""}`}
            type="button"
            aria-label={`Use ${character.label} welcome character`}
            aria-pressed={index === characterIndex}
            onClick={() => setCharacterIndex(index)}
          />
        ))}
      </div>
    </main>
  );
}
