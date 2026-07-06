import { useEffect, useRef, useState } from "react";
import { BodyPanel } from "./BodyPanel";
import type { BodyState } from "./bodyState";
import { applyBodyViewToDocument, loadBodyView, type BodyViewSettings } from "./bodyView";
import { fetchCurrentBodyState } from "./bodyApi";

export function FloatingChat() {
  const [floatingState, setFloatingState] = useState<BodyState>("默认");
  const [bubble, setBubble] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [bgBlack, setBgBlack] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastViewRef = useRef<string>("");

  // ── Body view sync: load from localStorage on mount, then poll for changes ──
  const syncBodyView = () => {
    const raw = localStorage.getItem("rin-body-view");
    if (!raw) return;
    if (raw === lastViewRef.current) return; // no change
    lastViewRef.current = raw;
    try {
      const view: BodyViewSettings = JSON.parse(raw);
      applyBodyViewToDocument(view);
    } catch { /* ignore malformed */ }
  };

  useEffect(() => {
    // Apply immediately on mount
    applyBodyViewToDocument(loadBodyView());
    lastViewRef.current = localStorage.getItem("rin-body-view") ?? "";

    // Poll localStorage every 500ms (storage events are unreliable across windows)
    pollRef.current = setInterval(syncBodyView, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Body state sync: poll backend every 2 seconds ──
  useEffect(() => {
    const poll = async () => {
      try {
        const state = await fetchCurrentBodyState();
        if (state) setFloatingState(state);
      } catch { /* backend restarting */ }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Listen for direct localStorage signals from the web UI ──
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rin-body-view" && e.newValue) {
        try {
          applyBodyViewToDocument(JSON.parse(e.newValue));
          lastViewRef.current = e.newValue;
        } catch { /* ignore */ }
      }
      if (e.key === "rin-body-state" && e.newValue) {
        setFloatingState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Background toggle ──
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const html = document.documentElement;
    const prev = [html.style.background, document.body.style.background, root.style.background];
    const bg = bgBlack ? "#020403" : "transparent";
    html.style.background = bg;
    document.body.style.background = bg;
    root.style.background = bg;
    return () => {
      html.style.background = prev[0];
      document.body.style.background = prev[1];
      root.style.background = prev[2];
    };
  }, [bgBlack]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "c") { e.preventDefault(); setChatOpen((v) => !v); }
      if (e.metaKey && e.key === "b") { e.preventDefault(); setBgBlack((v) => !v); }
      if (e.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (bubble) {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = setTimeout(() => setBubble(null), 12000);
    }
    return () => { if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current); };
  }, [bubble]);

  useEffect(() => {
    if (chatOpen && inputRef.current) inputRef.current.focus();
  }, [chatOpen]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setChatOpen(false);
    setBusy(true);
    setBubble(null);
    try {
      const res = await fetch("/api/chat-test/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, conversationId: null }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { finalAnswer?: string };
      if (data.finalAnswer) setBubble(data.finalAnswer.slice(0, 200));
      else setBubble("...");
    } catch {
      setBubble("(无法连接)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="body-standalone floating">
      <div className="body-standalone-shell">
        <div className="floating-character">
          <BodyPanel
            currentState={floatingState}
            compact
            floating
            showControls={false}
          />
        </div>
        {bubble ? (
          <div className="floating-bubble"><p>{bubble}</p></div>
        ) : null}
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
