import { useEffect, useState, type FormEvent } from "react";
import type {
  ConversationDetailResponse,
  ConversationTurnResponse,
  LocalConsoleSnapshot,
} from "../console/types";
import type {
  ConversationErrorPayload,
  ConversationMessageRecord,
} from "../conversation";
import type {
  MemoryConfidence,
  MemoryImportance,
  MemoryMetadataInput,
  MemoryRecord,
} from "../memory";
import { rinLive2dBodyAdapter } from "../body";
import { CURRENT_PHASES, RIN_PROJECT_NAME } from "../core/project";
import { runtimeBoundaries } from "../runtime";
import { parseConversationError, safeLocalBaseUrl } from "./consoleStatus";
import {
  formatMemoryRankingBreakdown,
  injectedMemoryItems,
  skippedMemoryItems,
} from "./memoryContextTrace";
import { RinBodyShell } from "./RinBodyShell";
import { RinLive2DModel } from "./RinLive2DModel";
import "./styles.css";

const previewBodyAdapterId = "rin-live2d-layered-mvp-v1";

const localDataFiles = [
  "manifest.json",
  "config/user_model.json",
  "config/ai_identity.json",
  "config/ai_state.json",
  "config/policy_config.json",
  "config/model_config.json",
  "logs/audit_log.jsonl",
];

type MemoryMetadataDraft = {
  tags: string;
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  source: string;
};

export function App() {
  const [snapshot, setSnapshot] = useState<LocalConsoleSnapshot | null>(null);
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "offline">(
    "loading",
  );
  const [messageDraft, setMessageDraft] = useState("");
  const [turnStatus, setTurnStatus] = useState<"idle" | "sending" | "error">("idle");
  const [memoryReviewingId, setMemoryReviewingId] = useState<string | null>(null);
  const [memoryMetadataDrafts, setMemoryMetadataDrafts] = useState<
    Record<string, MemoryMetadataDraft>
  >({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [conversationMessages, setConversationMessages] = useState<
    ConversationMessageRecord[]
  >([]);
  const [conversationLoadStatus, setConversationLoadStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [lastTurn, setLastTurn] = useState<ConversationTurnResponse["turn"] | null>(
    null,
  );
  const [selectedMemoryContextMessageId, setSelectedMemoryContextMessageId] =
    useState<string | null>(null);
  const [conversationError, setConversationError] =
    useState<ConversationErrorPayload | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "refreshing" | "error"
  >("idle");

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      try {
        const response = await fetch("/api/local-state");

        if (!response.ok) {
          throw new Error(`Local runtime returned ${response.status}`);
        }

        const nextSnapshot = (await response.json()) as LocalConsoleSnapshot;

        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setApiStatus("connected");
        }
      } catch {
        if (!cancelled) {
          setApiStatus("offline");
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  const bodyOnly = window.location.pathname === "/body";
  const previewExpression =
    new URLSearchParams(window.location.search).get("expression") ?? "listening";
  const previewAttention = previewExpression === "listening" ? "active" : "idle";
  const bodyState =
    snapshot?.body.state ??
    rinLive2dBodyAdapter.mapState({
      mood: "neutral",
      attention: previewAttention,
      expression: previewExpression,
      voiceStyle: "soft",
    });
  const bodyAdapterId = snapshot?.body.adapterId ?? previewBodyAdapterId;
  const live2dReady = snapshot?.body.live2dReady ?? true;
  const selectedMemoryContextMessage = selectedMemoryContextMessageId
    ? conversationMessages.find(
        (message) => message.id === selectedMemoryContextMessageId,
      )
    : null;
  const selectedMemoryContext = selectedMemoryContextMessage?.memoryContext ?? null;
  const deterministicInjectedMemoryIds =
    selectedMemoryContext?.deterministicInjectedMemoryIds ??
    selectedMemoryContext?.injectedMemoryIds ??
    [];
  const semanticInjectedMemoryIds =
    selectedMemoryContext?.semanticInjectedMemoryIds ?? [];
  const semanticContextExpansionEnabled =
    selectedMemoryContext?.semanticContextExpansionEnabled ?? false;

  async function sendMessage(content: string) {
    if (content.trim().length === 0 || apiStatus !== "connected") {
      return;
    }

    setTurnStatus("sending");
    setConversationError(null);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          conversationId: activeConversationId ?? undefined,
        }),
      });

      if (!response.ok) {
        let parsed: unknown = null;

        try {
          parsed = await response.json();
        } catch {
          parsed = null;
        }

        setConversationError(parseConversationError(parsed));
        setLastFailedInput(content);
        setTurnStatus("error");
        return;
      }

      const body = (await response.json()) as ConversationTurnResponse;
      const rinMessage = {
        ...body.turn.rinMessage,
        memoryContext:
          body.turn.rinMessage.memoryContext ?? body.turn.memoryContext,
      };
      setSnapshot(body.snapshot);
      setLastTurn(body.turn);
      setSelectedMemoryContextMessageId(
        rinMessage.memoryContext ? rinMessage.id : null,
      );
      setActiveConversationId(body.turn.conversation.id);
      setConversationMessages((current) =>
        activeConversationId === body.turn.conversation.id
          ? [...current, body.turn.ownerMessage, rinMessage]
          : [body.turn.ownerMessage, rinMessage],
      );
      setMessageDraft("");
      setConversationError(null);
      setLastFailedInput(null);
      setTurnStatus("idle");
    } catch {
      setConversationError(null);
      setLastFailedInput(content);
      setTurnStatus("error");
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(messageDraft);
  }

  async function retryLastMessage() {
    if (lastFailedInput === null || turnStatus === "sending") {
      return;
    }

    await sendMessage(lastFailedInput);
  }

  async function refreshSnapshot() {
    setRefreshStatus("refreshing");

    try {
      const response = await fetch("/api/local-state");

      if (!response.ok) {
        throw new Error(`Local runtime returned ${response.status}`);
      }

      const nextSnapshot = (await response.json()) as LocalConsoleSnapshot;
      setSnapshot(nextSnapshot);
      setApiStatus("connected");
      setRefreshStatus("idle");
    } catch {
      setRefreshStatus("error");
    }
  }

  async function loadConversation(conversationId: string) {
    setConversationLoadStatus("loading");

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}`,
      );

      if (!response.ok) {
        throw new Error(`Conversation load failed: ${response.status}`);
      }

      const body = (await response.json()) as ConversationDetailResponse;
      setSnapshot(body.snapshot);
      setActiveConversationId(body.conversation.id);
      setConversationMessages(body.messages);
      setLastTurn(null);
      setSelectedMemoryContextMessageId(
        findLatestMemoryContextMessageId(body.messages),
      );
      setConversationLoadStatus("idle");
    } catch {
      setConversationLoadStatus("error");
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setConversationMessages([]);
    setLastTurn(null);
    setSelectedMemoryContextMessageId(null);
    setConversationLoadStatus("idle");
  }

  async function reviewMemory(
    item: MemoryRecord,
    decision: "accept" | "reject" | "archive",
  ) {
    const memoryItemId = item.id;
    setMemoryReviewingId(memoryItemId);

    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(memoryItemId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            metadata: metadataInputFromDraft(metadataDraftFor(item)),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Memory review failed: ${response.status}`);
      }

      const body = (await response.json()) as {
        ok: true;
        snapshot: LocalConsoleSnapshot;
      };
      setSnapshot(body.snapshot);
    } finally {
      setMemoryReviewingId(null);
    }
  }

  async function saveMemoryMetadata(item: MemoryRecord) {
    setMemoryReviewingId(item.id);

    try {
      const response = await fetch(
        `/api/memory/${encodeURIComponent(item.id)}/metadata`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: metadataInputFromDraft(metadataDraftFor(item)),
            reason: "owner reviewed metadata",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Memory metadata update failed: ${response.status}`);
      }

      const body = (await response.json()) as {
        ok: true;
        snapshot: LocalConsoleSnapshot;
      };
      setSnapshot(body.snapshot);
    } finally {
      setMemoryReviewingId(null);
    }
  }

  function metadataDraftFor(item: MemoryRecord): MemoryMetadataDraft {
    return (
      memoryMetadataDrafts[item.id] ?? {
        tags: item.metadata.tags.join(", "),
        importance: item.metadata.importance,
        confidence: item.metadata.confidence,
        source: item.metadata.source ?? "",
      }
    );
  }

  function updateMemoryMetadataDraft(
    item: MemoryRecord,
    patch: Partial<MemoryMetadataDraft>,
  ) {
    setMemoryMetadataDrafts((current) => ({
      ...current,
      [item.id]: {
        ...metadataDraftFor(item),
        ...patch,
      },
    }));
  }

  if (bodyOnly) {
    return (
      <main className="body-only-shell">
        <RinBodyShell
          adapterId={bodyAdapterId}
          state={bodyState}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="intro" aria-labelledby="app-title">
        <p className="kicker">
          Local-first personal AI system / 本地优先的个人 AI 系统
        </p>
        <h1 id="app-title">{RIN_PROJECT_NAME}</h1>
        <p className="scope">
          Project charter, technical direction, and empty local application
          skeleton for {CURRENT_PHASES.join(" and ")}.
          <br />
          项目宪章、技术方向，以及用于 {CURRENT_PHASES.join(" 和 ")} 的空本地应用骨架。
        </p>
      </section>

      <section className="phase-panel" aria-labelledby="phase-title">
        <h2 id="phase-title">Current Build / 当前构建</h2>
        <p>
          RIN can now run a local read-only Console backed by the local runtime.
          <br />
          RIN 现在可以运行由本地 runtime 支撑的只读本地 Console。
        </p>
        <div className="command-list" aria-label="RIN commands">
          <code>npm run rin:init</code>
          <code>npm run rin:inspect</code>
          <code>npm run rin:console</code>
        </div>
      </section>

      <section className="body-panel" aria-labelledby="body-title">
        <h2 id="body-title">RIN Body MVP / RIN 身体 MVP</h2>
        <RinLive2DModel state={bodyState} compact />
        <p>
          Layered Live2D MVP based on RIN's fox AI reference design.
          <br />
          基于 RIN 狐系 AI 设定图的分层 Live2D MVP 身体。
        </p>
        {snapshot ? (
          <dl className="status-grid compact">
            <div>
              <dt>Adapter</dt>
              <dd>{snapshot.body.adapterId}</dd>
            </div>
            <div>
              <dt>Expression</dt>
              <dd>{snapshot.body.state.expression}</dd>
            </div>
            <div>
              <dt>Motion</dt>
              <dd>{snapshot.body.state.motion}</dd>
            </div>
            <div>
              <dt>Live2D</dt>
              <dd>{live2dReady ? "MVP ready" : "not installed"}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="status-panel" aria-labelledby="status-title">
        <h2 id="status-title">Runtime Status / Runtime 状态</h2>
        <p className={`status-pill status-${apiStatus}`}>
          {apiStatus === "connected"
            ? "Connected to local runtime / 已连接本地 runtime"
            : apiStatus === "loading"
              ? "Checking local runtime / 正在检查本地 runtime"
              : "Offline static UI / 当前是离线静态 UI"}
        </p>
        {snapshot ? (
          <dl className="status-grid">
            <div>
              <dt>Data directory / 数据目录</dt>
              <dd>{snapshot.dataDir}</dd>
            </div>
            <div>
              <dt>Manifest / Manifest</dt>
              <dd>{snapshot.manifestStatus}</dd>
            </div>
            <div>
              <dt>AI identity / AI 身份</dt>
              <dd>{snapshot.identity.name ?? "unset"} · {snapshot.identity.status}</dd>
            </div>
            <div>
              <dt>Owner model / 所有者模型</dt>
              <dd>{snapshot.ownerModel.status ?? "unset"}</dd>
            </div>
            <div>
              <dt>Model adapter / 模型 adapter</dt>
              <dd>{snapshot.modelConfig.activeAdapter ?? "unset"}</dd>
            </div>
            <div>
              <dt>External model / 外部模型</dt>
              <dd>
                {snapshot.modelConfig.externalCallsEnabled
                  ? "configured"
                  : "not active"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="muted">
            Start `npm run rin:console` to show live local state.
            <br />
            启动 `npm run rin:console` 后可显示实时本地状态。
          </p>
        )}
      </section>

      <section className="conversation-panel" aria-labelledby="conversation-title">
        <h2 id="conversation-title">Local Conversation / 本地对话</h2>
        <p>
          This template writes raw messages through the local runtime. It uses
          the configured model adapter and keeps memory writes behind proposals.
          <br />
          当前模板会通过本地 runtime 写入原始消息。它使用已配置的模型
          adapter，并且仍然只创建记忆提案。
        </p>
        <div className="conversation-toolbar">
          <span>
            {activeConversationId
              ? `Active conversation / 当前对话：${shortId(activeConversationId)}`
              : "New conversation / 新对话"}
          </span>
          <button type="button" onClick={startNewConversation}>
            New / 新建
          </button>
        </div>
        <form onSubmit={submitMessage} className="conversation-form">
          <textarea
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            placeholder="Type a local test message / 输入一条本地测试消息"
            disabled={apiStatus !== "connected" || turnStatus === "sending"}
          />
          <button
            type="submit"
            disabled={
              apiStatus !== "connected" ||
              turnStatus === "sending" ||
              messageDraft.trim().length === 0
            }
          >
            {turnStatus === "sending" ? "Sending / 发送中" : "Send / 发送"}
          </button>
        </form>
        {turnStatus === "error" ? (
          conversationError ? (
            <div
              className="conversation-error"
              role="alert"
              aria-label="Conversation error"
            >
              <strong className="conversation-error-message">
                {conversationError.message}
              </strong>
              <p className="conversation-error-meta">
                <span>Code: {conversationError.code}</span>
                {conversationError.retryable ? <span>Retryable</span> : null}
                {conversationError.modelAdapter ? (
                  <span>Adapter: {conversationError.modelAdapter}</span>
                ) : null}
                <span>Provider: {conversationError.provider}</span>
                {conversationError.details.model ? (
                  <span>Model: {conversationError.details.model}</span>
                ) : null}
              </p>
              {conversationError.recovery.length > 0 ? (
                <ul className="recovery-list" aria-label="Recovery guidance">
                  {conversationError.recovery.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : null}
              {conversationError.retryable && lastFailedInput !== null ? (
                <div className="conversation-error-actions">
                  <button
                    type="button"
                    onClick={() => void retryLastMessage()}
                    disabled={apiStatus !== "connected"}
                  >
                    Retry / 重试
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="error-text">
              Conversation failed. Check the local runtime.
              <br />
              对话失败。请检查本地 runtime。
            </p>
          )
        ) : null}
        {lastTurn ? (
          <div className="turn-preview">
            <strong>Latest turn / 最新回合</strong>
            <p>{lastTurn.ownerMessage.content}</p>
            <p>{lastTurn.rinMessage.content}</p>
          </div>
        ) : null}
        {selectedMemoryContext ? (
          <div className="memory-context-trace" aria-label="Memory context trace">
            <strong>Memory context / 记忆上下文</strong>
            <p className="memory-context-selected">
              Selected RIN reply / 已选择 RIN 回复：
              <code>{shortId(selectedMemoryContextMessage?.id ?? "")}</code>
            </p>
            <dl className="status-grid compact">
              <div>
                <dt>Injected / 已注入</dt>
                <dd>{selectedMemoryContext.injectedMemoryCount}</dd>
              </div>
              <div>
                <dt>Deterministic / 确定性</dt>
                <dd>{deterministicInjectedMemoryIds.length}</dd>
              </div>
              <div>
                <dt>Semantic / 语义候选</dt>
                <dd>{semanticInjectedMemoryIds.length}</dd>
              </div>
              <div>
                <dt>Semantic enabled / 语义启用</dt>
                <dd>{semanticContextExpansionEnabled ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Trace items / 候选记录</dt>
                <dd>{selectedMemoryContext.items.length}</dd>
              </div>
              <div>
                <dt>Context chars / 上下文字符</dt>
                <dd>{selectedMemoryContext.memoryContextCharacterCount}</dd>
              </div>
              <div>
                <dt>Skipped (budget) / 预算跳过</dt>
                <dd>{selectedMemoryContext.skippedByBudgetCount}</dd>
              </div>
              <div>
                <dt>Skipped (relevance) / 相关性跳过</dt>
                <dd>{selectedMemoryContext.skippedByRelevanceCount}</dd>
              </div>
              <div>
                <dt>Skipped (max count) / 数量上限跳过</dt>
                <dd>{selectedMemoryContext.skippedByMaxCountCount}</dd>
              </div>
            </dl>
            {injectedMemoryItems(selectedMemoryContext.items).length > 0 ? (
              <ul className="memory-context-list">
                {injectedMemoryItems(selectedMemoryContext.items).map((item) => (
                  <li key={item.memoryId}>
                    <code>{shortId(item.memoryId)}</code>
                    {" · "}
                    {formatMemoryRankingBreakdown(item)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="memory-context-empty">
                No memories injected for this turn.
                <br />
                本回合未注入记忆。
              </p>
            )}
            {skippedMemoryItems(selectedMemoryContext.items).length > 0 ? (
              <details className="memory-context-skipped">
                <summary>
                  Skipped memories / 跳过的记忆 (
                  {skippedMemoryItems(selectedMemoryContext.items).length})
                </summary>
                <ul className="memory-context-list">
                  {skippedMemoryItems(selectedMemoryContext.items).map((item) => (
                    <li key={item.memoryId}>
                      <code>{shortId(item.memoryId)}</code>
                      {" · "}
                      {formatMemoryRankingBreakdown(item)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        {conversationMessages.length > 0 ? (
          <div className="conversation-history" aria-label="Conversation history">
            {conversationMessages.map((message) => (
              <article key={message.id} data-role={message.role}>
                <strong>{message.role}</strong>
                <p>{message.content}</p>
                {message.role === "rin" && message.memoryContext ? (
                  <button
                    type="button"
                    className="memory-context-select"
                    aria-pressed={selectedMemoryContextMessageId === message.id}
                    onClick={() => setSelectedMemoryContextMessageId(message.id)}
                  >
                    Memory context / 记忆上下文
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
        {snapshot?.recentConversations.length ? (
          <div className="recent-conversations">
            <strong>Recent conversations / 最近对话</strong>
            <div>
              {snapshot.recentConversations.map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  disabled={conversationLoadStatus === "loading"}
                  onClick={() => void loadConversation(conversation.id)}
                >
                  {conversation.title}
                </button>
              ))}
            </div>
            {conversationLoadStatus === "error" ? (
              <p className="error-text">
                Could not load conversation.
                <br />
                无法加载对话。
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="database-panel" aria-labelledby="database-title">
        <h2 id="database-title">SQLite Database / SQLite 数据库</h2>
        {snapshot?.database ? (
          <dl className="status-grid compact">
            <div>
              <dt>Schema</dt>
              <dd>{snapshot.database.schemaVersion}</dd>
            </div>
            <div>
              <dt>Conversations</dt>
              <dd>{snapshot.database.counts.conversations}</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>{snapshot.database.counts.messages}</dd>
            </div>
            <div>
              <dt>Memory items</dt>
              <dd>{snapshot.database.counts.memoryItems}</dd>
            </div>
            <div>
              <dt>Raw events</dt>
              <dd>{snapshot.database.counts.rawEvents}</dd>
            </div>
            <div>
              <dt>State history</dt>
              <dd>{snapshot.database.counts.stateHistory}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted">Database status unavailable / 数据库状态不可用</p>
        )}
      </section>

      <section className="boundary-panel" aria-labelledby="boundaries-title">
        <h2 id="boundaries-title">
          Reserved Runtime Boundaries / 预留运行时边界
        </h2>
        <ul>
          {runtimeBoundaries.map((boundary) => (
            <li key={boundary.name}>
              <strong>{boundary.name}</strong>
              <span>{boundary.english}</span>
              <span>{boundary.chinese}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="data-panel" aria-labelledby="data-title">
        <h2 id="data-title">Local Data Files / 本地数据文件</h2>
        <ul>
          {(snapshot?.coreFiles ?? localDataFiles.map((file) => ({
            relativePath: file,
            exists: false,
            key: file,
            created: false,
            english: "Start the local console to check this file.",
            chinese: "启动本地 Console 后可检查此文件。",
          }))).map((file) => (
            <li key={file.relativePath}>
              <strong>{file.exists ? "ok" : "pending"}</strong>
              <span>{file.relativePath}</span>
              <small>{file.chinese}</small>
            </li>
          ))}
        </ul>
      </section>

      {snapshot ? (
        <>
          <section className="state-panel" aria-labelledby="identity-title">
            <h2 id="identity-title">Identity / 身份</h2>
            <p>{snapshot.identity.english}</p>
            <p>{snapshot.identity.chinese}</p>
          </section>

          <section className="state-panel" aria-labelledby="state-title">
            <h2 id="state-title">AI State / AI 状态</h2>
            <dl className="status-grid compact">
              <div>
                <dt>Mood</dt>
                <dd>{snapshot.aiState.mood}</dd>
              </div>
              <div>
                <dt>Energy</dt>
                <dd>{snapshot.aiState.energy}</dd>
              </div>
              <div>
                <dt>Attention</dt>
                <dd>{snapshot.aiState.attention}</dd>
              </div>
              <div>
                <dt>Expression</dt>
                <dd>{snapshot.aiState.expression}</dd>
              </div>
            </dl>
          </section>

          <section className="state-panel" aria-labelledby="safety-title">
            <h2 id="safety-title">Safety Gates / 安全开关</h2>
            <ul>
              {snapshot.featureGates.map((gate) => (
                <li key={gate.key}>
                  <strong>{gate.enabled ? "enabled" : "disabled"}</strong>
                  <span>{gate.english}</span>
                  <small>{gate.chinese}</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="state-panel" aria-labelledby="model-title">
            <h2 id="model-title">Model Runtime / 模型运行时</h2>
            <div className="model-runtime-toolbar">
              <button
                type="button"
                onClick={() => void refreshSnapshot()}
                disabled={refreshStatus === "refreshing"}
              >
                {refreshStatus === "refreshing"
                  ? "Refreshing / 刷新中"
                  : "Refresh status / 刷新状态"}
              </button>
              {refreshStatus === "error" ? (
                <span className="model-runtime-refresh-error" role="status">
                  Could not refresh status. / 无法刷新状态。
                </span>
              ) : null}
            </div>
            <dl className="status-grid compact">
              <div>
                <dt>Active adapter</dt>
                <dd>{snapshot.modelConfig.activeAdapter ?? "unset"}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{snapshot.modelConfig.selectedProvider}</dd>
              </div>
              <div>
                <dt>Adapters</dt>
                <dd>{snapshot.modelConfig.adapterCount}</dd>
              </div>
              <div>
                <dt>Keys in config</dt>
                <dd>{snapshot.modelConfig.apiKeysStoredHere ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Local model</dt>
                <dd>
                  {snapshot.modelConfig.localCallsConfigured
                    ? "configured"
                    : "not active"}
                </dd>
              </div>
              <div>
                <dt>External model</dt>
                <dd>
                  {snapshot.modelConfig.externalCallsEnabled
                    ? "configured"
                    : "not active"}
                </dd>
              </div>
            </dl>
            {snapshot.modelConfig.ollama ? (
              <dl
                className="status-grid compact local-model-grid"
                aria-label="Local model settings"
              >
                <div>
                  <dt>Local model name</dt>
                  <dd>{snapshot.modelConfig.ollama.model ?? "unset"}</dd>
                </div>
                <div>
                  <dt>Base URL</dt>
                  <dd>
                    {safeLocalBaseUrl(snapshot.modelConfig.ollama.baseUrl) ??
                      "hidden (non-local)"}
                  </dd>
                </div>
                <div>
                  <dt>Timeout</dt>
                  <dd>{snapshot.modelConfig.ollama.timeoutMs} ms</dd>
                </div>
                <div>
                  <dt>num_predict</dt>
                  <dd>{snapshot.modelConfig.ollama.numPredict}</dd>
                </div>
                <div>
                  <dt>temperature</dt>
                  <dd>{snapshot.modelConfig.ollama.temperature}</dd>
                </div>
                <div>
                  <dt>top_p</dt>
                  <dd>{snapshot.modelConfig.ollama.topP}</dd>
                </div>
              </dl>
            ) : null}
            {snapshot.modelConfig.ollama?.invalidEnvironment.length ? (
              <p className="muted">
                Invalid local model settings / 无效本地模型设置：{" "}
                {snapshot.modelConfig.ollama.invalidEnvironment.join(", ")}
              </p>
            ) : null}
            {snapshot.modelConfig.missingEnvironment.length > 0 ? (
              <p className="muted">
                Missing environment / 缺少环境变量：{" "}
                {snapshot.modelConfig.missingEnvironment.join(", ")}
              </p>
            ) : null}
          </section>

          <section className="state-panel" aria-labelledby="memory-title">
            <h2 id="memory-title">Memory MVP / 记忆 MVP</h2>
            <dl className="status-grid compact">
              <div>
                <dt>Proposals</dt>
                <dd>{snapshot.memory.proposals}</dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd>{snapshot.memory.accepted}</dd>
              </div>
              <div>
                <dt>Rejected</dt>
                <dd>{snapshot.memory.rejected}</dd>
              </div>
              <div>
                <dt>Archived</dt>
                <dd>{snapshot.memory.archived}</dd>
              </div>
            </dl>
            {snapshot.memory.recent.length > 0 ? (
              <ul className="memory-review-list" aria-label="Recent memory items">
                {snapshot.memory.recent.map((item) => (
                  <li key={item.id}>
                    <strong>{item.status}</strong>
                    <span>{memoryText(item.content)}</span>
                    <small>
                      {item.memoryType}
                      {item.metadata.tags.length > 0
                        ? ` · tags: ${item.metadata.tags.join(", ")}`
                        : ""}
                      {` · importance: ${item.metadata.importance}`}
                      {` · confidence: ${item.metadata.confidence}`}
                    </small>
                    <div className="memory-metadata-controls">
                      <label>
                        Tags
                        <input
                          value={metadataDraftFor(item).tags}
                          onChange={(event) =>
                            updateMemoryMetadataDraft(item, {
                              tags: event.target.value,
                            })
                          }
                          placeholder="project, preference"
                          disabled={memoryReviewingId === item.id}
                        />
                      </label>
                      <label>
                        Importance
                        <select
                          value={metadataDraftFor(item).importance}
                          onChange={(event) =>
                            updateMemoryMetadataDraft(item, {
                              importance: event.target.value as MemoryImportance,
                            })
                          }
                          disabled={memoryReviewingId === item.id}
                        >
                          <option value="low">low</option>
                          <option value="normal">normal</option>
                          <option value="high">high</option>
                        </select>
                      </label>
                      <label>
                        Confidence
                        <select
                          value={metadataDraftFor(item).confidence}
                          onChange={(event) =>
                            updateMemoryMetadataDraft(item, {
                              confidence: event.target.value as MemoryConfidence,
                            })
                          }
                          disabled={memoryReviewingId === item.id}
                        >
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                      </label>
                      <label>
                        Source
                        <input
                          value={metadataDraftFor(item).source}
                          onChange={(event) =>
                            updateMemoryMetadataDraft(item, {
                              source: event.target.value,
                            })
                          }
                          placeholder="owner review"
                          disabled={memoryReviewingId === item.id}
                        />
                      </label>
                    </div>
                    <p className="memory-metadata-note">
                      Owner-reviewed metadata only. Not used for ranking yet.
                    </p>
                    {item.status === "proposal" ? (
                      <div className="memory-actions">
                        <button
                          type="button"
                          disabled={memoryReviewingId === item.id}
                          onClick={() => void reviewMemory(item, "accept")}
                        >
                          Accept / 接受
                        </button>
                        <button
                          type="button"
                          disabled={memoryReviewingId === item.id}
                          onClick={() => void reviewMemory(item, "reject")}
                        >
                          Reject / 拒绝
                        </button>
                      </div>
                    ) : (
                      <div className="memory-actions">
                        <button
                          type="button"
                          disabled={memoryReviewingId === item.id}
                          onClick={() => void saveMemoryMetadata(item)}
                        >
                          Save metadata / 保存元数据
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No memory proposals yet. Use `/remember ` in a local message to
                create one.
                <br />
                暂无记忆提案。可在本地消息中使用 `/remember ` 创建一条。
              </p>
            )}
          </section>

          <section className="state-panel" aria-labelledby="portability-title">
            <h2 id="portability-title">Portability / 可移植性</h2>
            <dl className="status-grid compact">
              <div>
                <dt>Legacy tool records</dt>
                <dd>
                  {snapshot.operationalStatus.agentRuntime.legacyToolInvocationCount}
                </dd>
              </div>
              <div>
                <dt>Export bundles</dt>
                <dd>{snapshot.portability.exportBundles}</dd>
              </div>
              <div>
                <dt>Backup dry-run</dt>
                <dd>
                  {snapshot.operationalStatus.backup.dryRunAvailable
                    ? `${snapshot.operationalStatus.backup.fileCount} files`
                    : "unavailable"}
                </dd>
              </div>
              <div>
                <dt>Agent runtime</dt>
                <dd>decommissioned</dd>
              </div>
            </dl>
          </section>
        </>
      ) : null}
    </main>
  );
}

function memoryText(content: Record<string, unknown>): string {
  return typeof content.text === "string"
    ? content.text
    : JSON.stringify(content);
}

function metadataInputFromDraft(
  draft: MemoryMetadataDraft,
): MemoryMetadataInput {
  return {
    tags: draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    importance: draft.importance,
    confidence: draft.confidence,
    source: draft.source.trim().length > 0 ? draft.source : null,
  };
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function findLatestMemoryContextMessageId(
  messages: readonly ConversationMessageRecord[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "rin" && message.memoryContext) {
      return message.id;
    }
  }

  return null;
}
