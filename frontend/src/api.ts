import type { ChatSendResult, GlitchSnapshot, MemoryCard } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (payload.detail) {
        message = typeof payload.detail === "string"
          ? payload.detail
          : JSON.stringify(payload.detail);
      }
    } catch {
      // Keep the HTTP status message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchGlitchSnapshot(
  conversationId?: string | null,
  memoryQuery = ""
): Promise<GlitchSnapshot> {
  const params = new URLSearchParams();
  if (conversationId) {
    params.set("conversationId", conversationId);
  }
  if (memoryQuery.trim()) {
    params.set("memoryQuery", memoryQuery.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/glitch-core/snapshot${suffix}`, {
    headers: { Accept: "application/json" }
  });
  return readJson<GlitchSnapshot>(response);
}

export async function fetchMemoryCards(query: string): Promise<MemoryCard[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("query", query.trim());
  }
  const response = await fetch(`/api/glitch-core/memories?${params.toString()}`, {
    headers: { Accept: "application/json" }
  });
  const payload = await readJson<{ cards: MemoryCard[] }>(response);
  return payload.cards;
}

export async function sendChatMessage(
  content: string,
  conversationId?: string | null
): Promise<ChatSendResult> {
  const response = await fetch("/api/chat-test/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content, conversationId })
  });
  return readJson<ChatSendResult>(response);
}
