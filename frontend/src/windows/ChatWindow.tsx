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
            onClick={() => openWindow("trace", { contextName: "Latest Turn" })}
          >
            OPEN TRACE
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
