import { memo, useCallback, useEffect, useRef } from "react";
import type { ChatMessage, GlitchSnapshot, WindowPayload, WindowType } from "../types";

export const ChatWindow = memo(function ChatWindow({
  snapshot,
  chatInput,
  setChatInput,
  chatBusy,
  lastChatContent,
  submitChat,
  openWindow,
}: {
  snapshot: GlitchSnapshot | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatBusy: boolean;
  lastChatContent: string;
  submitChat: (content: string) => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const messages = snapshot?.messages ?? [];
  const provider = snapshot?.provider;
  const selectedMemoryCount = snapshot?.mind.latest?.memoryRetrieval.selected.length ?? 0;
  const pendingMemoryCandidates = (snapshot?.mind.memoryCandidates.length
    ? snapshot.mind.memoryCandidates
    : snapshot?.mind.latest?.memoryCandidates ?? []
  ).filter((candidate) => ["candidate", "review_required"].includes(candidate.reviewStatus)).length;
  const latestError = snapshot?.errors[0];
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="chat-module">
      <div className="module-strip">
        CHAT LINK · {snapshot?.selectedConversationId ?? "new session"}
      </div>
      <div className="chat-status-row" aria-label="Chat runtime status">
        <span><small>model</small><b>{provider?.activeModel ?? "loading"}</b></span>
        <span><small>state</small><b>{snapshot?.core.status ?? "booting"}</b></span>
        <span><small>memory used</small><b>{selectedMemoryCount}</b></span>
        <span><small>pending memory</small><b>{pendingMemoryCandidates}</b></span>
        {latestError ? (
          <button
            type="button"
            className="chat-error-chip"
            onClick={() =>
              openWindow("error", {
                contextName: latestError.code,
                payload: { error: latestError },
              })
            }
          >
            {latestError.severity}: {latestError.code}
          </button>
        ) : null}
      </div>
      <div className="message-list">
        {messages.length ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <p className="empty-state">No active conversation messages.</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submitChat(chatInput);
        }}
      >
        <textarea
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submitChat(chatInput);
            }
          }}
          placeholder="Send a local owner message..."
        />
        <div className="composer-actions">
          <button type="submit" disabled={chatBusy || !chatInput.trim()}>
            {chatBusy ? "SENDING" : "SEND"}
          </button>
          <button
            type="button"
            disabled={!lastChatContent || chatBusy}
            onClick={() => void submitChat(lastChatContent)}
          >
            RETRY
          </button>
          <button
            type="button"
            disabled={!snapshot?.trace.latest}
            onClick={() => openWindow("developer", { contextName: "Latest Turn" })}
          >
            DIAGNOSTICS
          </button>
        </div>
      </form>
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={`message-bubble ${message.role}`}>
      <header>
        <span>{message.role}</span>
        <small>{message.shortId}</small>
      </header>
      <p>{message.content}</p>
      {message.hiddenReasoningRedacted ? (
        <small className="message-safety-note">hidden reasoning redacted</small>
      ) : null}
    </article>
  );
});
