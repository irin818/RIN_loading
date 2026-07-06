import { memo } from "react";
import { EmptyState, JsonInspector } from "../visualization";
import { safeDisplayJson } from "../utils";
import type { DisplayMode } from "../visualization";
import type { MemoryCard, WindowPayload, WindowType } from "../types";

export const MemoryWindow = memo(function MemoryWindow({
  snapshot,
  memoryCompact,
  setMemoryCompact,
  memoryQuery,
  setMemoryQuery,
  searchMemory,
  openWindow,
}: {
  snapshot: { memory: { cards: MemoryCard[] } } | null;
  memoryCompact: boolean;
  setMemoryCompact: (value: boolean) => void;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  searchMemory: () => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const cards = snapshot?.memory.cards ?? [];
  return (
    <div className="memory-module">
      <div className="module-strip">MEMORY V2 · READ ONLY</div>
      <div className="memory-toolbar">
        <input
          value={memoryQuery}
          onChange={(event) => setMemoryQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void searchMemory();
          }}
          placeholder="Filter memory metadata..."
        />
        <button type="button" onClick={() => void searchMemory()}>SEARCH</button>
        <button type="button" onClick={() => setMemoryCompact(!memoryCompact)}>
          {memoryCompact ? "EXPAND" : "COMPACT"}
        </button>
      </div>
      <div className={`memory-waterfall ${memoryCompact ? "compact" : "expanded"}`}>
        {cards.length ? (
          cards.map((card) => (
            <button
              key={`${card.kind}-${card.id}`}
              type="button"
              className="memory-card"
              onClick={() =>
                openWindow("memoryDetail", { contextName: card.title, payload: { card } })
              }
            >
              <span>{card.kind}</span>
              <strong>{card.title}</strong>
              <p>{card.contentPreview}</p>
              <dl>
                <div><dt>type</dt><dd>{card.type}</dd></div>
                <div><dt>score</dt><dd>{card.salienceScore}</dd></div>
                <div><dt>updated</dt><dd>{card.updatedAt}</dd></div>
              </dl>
            </button>
          ))
        ) : (
          <p className="empty-state">No memory cards match this filter.</p>
        )}
      </div>
    </div>
  );
});

export const MemoryDetailWindow = memo(function MemoryDetailWindow({
  card,
  displayMode,
}: {
  card?: MemoryCard;
  displayMode: DisplayMode;
}) {
  if (!card) return <p className="empty-state">No memory card selected.</p>;
  return (
    <div className="detail-module">
      <div className="module-strip">{card.kind} · {card.shortId}</div>
      <h2>{card.title}</h2>
      <p>{card.summary}</p>
      <dl className="detail-list">
        <div><dt>memory_id</dt><dd>{card.id}</dd></div>
        <div><dt>type</dt><dd>{card.type}</dd></div>
        <div><dt>source</dt><dd>{card.source}</dd></div>
        <div><dt>linked session</dt><dd>{card.linkedSession}</dd></div>
        <div><dt>created_at</dt><dd>{card.createdAt}</dd></div>
        <div><dt>updated_at</dt><dd>{card.updatedAt}</dd></div>
        <div><dt>last_used_at</dt><dd>{card.lastUsedAt}</dd></div>
        <div><dt>confidence</dt><dd>{card.confidence}</dd></div>
        <div><dt>importance</dt><dd>{card.importance}</dd></div>
      </dl>
      <div className="tag-row">
        {card.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <JsonInspector value={card.metadata} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});
