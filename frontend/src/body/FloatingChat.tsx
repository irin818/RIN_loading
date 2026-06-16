import { useEffect, useRef, useState } from "react";
import { BodyPanel } from "./BodyPanel";
import { BODY_STATES, type BodyState } from "./bodyState";

export function FloatingChat() {
  const [floatingState, setFloatingState] = useState<BodyState>("默认");
  const [bubble, setBubble] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transparent background
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const html = document.documentElement;
    const prev = [html.style.background, document.body.style.background, root.style.background];
    html.style.background = "transparent";
    document.body.style.background = "transparent";
    root.style.background = "transparent";
    return () => {
      html.style.background = prev[0];
      document.body.style.background = prev[1];
      root.style.background = prev[2];
    };
  }, []);

  // Cmd+C to toggle chat — signals Electron to resize window
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "c") {
        e.preventDefault();
        setChatOpen((v) => {
          document.title = v ? "RIN" : "chat-open";
          return !v;
        });
      }
      if (e.key === "Escape") {
        setChatOpen(false);
        document.title = "RIN";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Random state cycling
  useEffect(() => {
    const tick = () => {
      timerRef.current = setTimeout(() => {
        setFloatingState((prev) => {
          const others = BODY_STATES.filter((s) => s !== prev);
          return others[Math.floor(Math.random() * others.length)];
        });
        tick();
      }, 4000 + Math.random() * 8000);
    };
    tick();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Clear bubble after delay
  useEffect(() => {
    if (bubble) {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => setBubble(null), 12000);
    }
    return () => { if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current); };
  }, [bubble]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen && inputRef.current) inputRef.current.focus();
  }, [chatOpen]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setBubble(null);

    try {
      const res = await fetch("/api/chat-test/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, conversationId: null }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { finalAnswer?: string; ok?: boolean };
      if (data.finalAnswer) {
        setBubble(data.finalAnswer.slice(0, 200));
      } else {
        setBubble("...");
      }
    } catch {
      setBubble("(无法连接)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="body-standalone floating">
      <div className="body-standalone-shell">
        {/* Speech bubble */}
        {bubble ? (
          <div className="floating-bubble">
            <p>{bubble}</p>
          </div>
        ) : null}

        {/* Character */}
        <div className="floating-character">
          <BodyPanel
            currentState={null}
            forcedState={floatingState}
            compact
            floating
            showControls={false}
          />
        </div>

        {/* Chat bar — Cmd+C to toggle, Enter to send */}
        {chatOpen ? (
          <form className="floating-chat-bar" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? "..." : "输入后按 Enter..."}
              disabled={busy}
            />
          </form>
        ) : null}
      </div>
    </main>
  );
}
