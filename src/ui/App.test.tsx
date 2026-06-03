import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rinLive2dBodyAdapter } from "../body";
import type { LocalConsoleSnapshot } from "../console/types";
import { App } from "./App";

function makeSnapshot(
  overrides: Partial<LocalConsoleSnapshot> = {},
): LocalConsoleSnapshot {
  const base: LocalConsoleSnapshot = {
    ok: true,
    generatedAt: "2026-06-04T00:00:00.000Z",
    dataDir: ".rin-data",
    manifest: null,
    manifestStatus: "ok",
    coreFiles: [],
    database: null,
    databaseStatus: "ok",
    memory: { proposals: 0, accepted: 0, rejected: 0, archived: 0, recent: [] },
    recentConversations: [],
    identity: { name: "RIN", status: "active", english: null, chinese: null },
    ownerModel: {
      status: "placeholder",
      english: null,
      chinese: null,
      interests: 0,
      communicationPreferences: 0,
      currentProjects: 0,
      longTermGoals: 0,
    },
    aiState: {
      mood: "neutral",
      energy: "steady",
      attention: "active",
      expression: "listening",
      initiative: "low",
    },
    permissions: {
      defaultRequiresConfirmationFrom: null,
      forbiddenAutomaticActions: [],
      riskLevels: {},
    },
    modelConfig: {
      activeAdapter: "rin-mock-local",
      selectedProvider: "mock",
      adapterCount: 3,
      apiKeysStoredHere: false,
      externalCallsEnabled: false,
      localCallsConfigured: false,
      missingEnvironment: [],
      ollama: null,
    },
    toolRegistry: { toolCount: 2 },
    portability: { exportBundles: 0 },
    body: {
      adapterId: rinLive2dBodyAdapter.id,
      state: rinLive2dBodyAdapter.mapState({
        mood: "neutral",
        attention: "active",
        expression: "listening",
        voiceStyle: "soft",
      }),
      live2dReady: true,
    },
    featureGates: [],
  };

  return {
    ...base,
    ...overrides,
    modelConfig: { ...base.modelConfig, ...overrides.modelConfig },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeTurn(content: string, reply: string) {
  return {
    conversation: {
      id: "conversation-1",
      title: content,
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:01.000Z",
    },
    ownerMessage: {
      id: "owner-1",
      conversationId: "conversation-1",
      role: "owner" as const,
      content,
      modelAdapter: null,
      createdAt: "2026-06-04T00:00:00.000Z",
      memoryContext: null,
    },
    rinMessage: {
      id: "rin-1",
      conversationId: "conversation-1",
      role: "rin" as const,
      content: reply,
      modelAdapter: "rin-mock-local",
      createdAt: "2026-06-04T00:00:01.000Z",
      memoryContext: null,
    },
    memoryContext: null,
  };
}

function makeMemoryContext(
  memoryId: string,
  matchedKeywords: string[],
  overlapCount: number,
) {
  return {
    injectedMemoryCount: 1,
    injectedMemoryIds: [memoryId],
    memoryContextCharacterCount: 180,
    skippedByBudgetCount: 0,
    skippedByRelevanceCount: 0,
    skippedByMaxCountCount: 0,
    items: [
      {
        memoryId,
        memoryType: "semantic" as const,
        matchedKeywords,
        overlapCount,
        latinTokenMatchCount: overlapCount,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: matchedKeywords.length,
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        wasInjected: true,
        skippedReason: null,
        snippetLength: 42,
      },
    ],
  };
}

const ollamaSnapshot = makeSnapshot({
  modelConfig: {
    activeAdapter: "rin-ollama-local",
    selectedProvider: "local",
    adapterCount: 3,
    apiKeysStoredHere: false,
    externalCallsEnabled: false,
    localCallsConfigured: true,
    missingEnvironment: [],
    ollama: {
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 120_000,
      numPredict: 512,
      temperature: 0.6,
      topP: 0.9,
      invalidEnvironment: [],
    },
  },
});

const retryableErrorBody = {
  ok: false,
  error: {
    code: "LOCAL_MODEL_TIMEOUT",
    message: "Local model generation timed out.",
    recovery: ["Try a shorter prompt.", "Reduce RIN_OLLAMA_NUM_PREDICT."],
    modelAdapter: "rin-ollama-local",
    provider: "local",
    retryable: true,
    details: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
  },
};

const nonRetryableErrorBody = {
  ok: false,
  error: {
    code: "LOCAL_MODEL_MISSING",
    message: "The selected local model is not available.",
    recovery: ["Run ollama pull qwen3:4b."],
    modelAdapter: "rin-ollama-local",
    provider: "local",
    retryable: false,
    details: { baseUrl: "http://127.0.0.1:11434", model: "missing-model" },
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the empty RIN project shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "RIN" })).toBeInTheDocument();
    expect(screen.getByText("model-layer")).toBeInTheDocument();
    expect(screen.getByText("memory-layer")).toBeInTheDocument();
  });

  it("displays active local model status from /api/local-state", async () => {
    const snapshot = makeSnapshot({
      modelConfig: {
        activeAdapter: "rin-ollama-local",
        selectedProvider: "local",
        adapterCount: 3,
        apiKeysStoredHere: false,
        externalCallsEnabled: false,
        localCallsConfigured: true,
        missingEnvironment: [],
        ollama: {
          baseUrl: "http://127.0.0.1:11434",
          model: "qwen3:4b",
          timeoutMs: 120_000,
          numPredict: 512,
          temperature: 0.6,
          topP: 0.9,
          invalidEnvironment: [],
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(snapshot)),
    );

    render(<App />);

    expect(
      await screen.findByText(/Connected to local runtime/),
    ).toBeInTheDocument();
    expect(screen.getByText("qwen3:4b")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:11434")).toBeInTheDocument();
    expect(screen.getByText("120000 ms")).toBeInTheDocument();
    expect(screen.getByText("512")).toBeInTheDocument();
    expect(screen.getByText("0.9")).toBeInTheDocument();
  });

  it("renders gracefully when optional local model settings are absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(makeSnapshot())),
    );

    render(<App />);

    expect(
      await screen.findByText(/Connected to local runtime/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("rin-mock-local").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Local model settings")).toBeNull();
  });

  it("shows a structured recovery error when a conversation turn fails", async () => {
    const snapshot = makeSnapshot();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/conversations") && method === "POST") {
        return jsonResponse(
          {
            ok: false,
            error: {
              code: "LOCAL_MODEL_TIMEOUT",
              message: "Local model generation timed out.",
              recovery: [
                "Try a shorter prompt.",
                "Reduce RIN_OLLAMA_NUM_PREDICT.",
              ],
              modelAdapter: "rin-ollama-local",
              provider: "local",
              retryable: true,
              details: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
            },
          },
          504,
        );
      }

      return jsonResponse(snapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "trigger failure" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Local model generation timed out.");
    expect(alert).toHaveTextContent("LOCAL_MODEL_TIMEOUT");
    expect(alert).toHaveTextContent("Reduce RIN_OLLAMA_NUM_PREDICT.");
    expect(alert).toHaveTextContent("Retryable");
  });

  it("keeps the successful conversation path working", async () => {
    const snapshot = makeSnapshot();
    const turn = {
      conversation: {
        id: "conversation-1",
        title: "trigger success",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:01.000Z",
      },
      ownerMessage: {
        id: "owner-1",
        conversationId: "conversation-1",
        role: "owner" as const,
        content: "trigger success",
        modelAdapter: null,
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      rinMessage: {
        id: "rin-1",
        conversationId: "conversation-1",
        role: "rin" as const,
        content: "RIN structured-success reply",
        modelAdapter: "rin-mock-local",
        createdAt: "2026-06-04T00:00:01.000Z",
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/conversations") && method === "POST") {
        return jsonResponse({ ok: true, turn, snapshot });
      }

      return jsonResponse(snapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "trigger success" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const replies = await screen.findAllByText("RIN structured-success reply");
    expect(replies.length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refreshes model status from /api/local-state on demand", async () => {
    let stateCalls = 0;
    const fetchMock = vi.fn(async () => {
      stateCalls += 1;
      return jsonResponse(stateCalls === 1 ? makeSnapshot() : ollamaSnapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);
    expect(screen.queryByText("qwen3:4b")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Refresh status/ }));

    expect(await screen.findByText("qwen3:4b")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:11434")).toBeInTheDocument();
    expect(stateCalls).toBe(2);
  });

  it("shows a safe message when status refresh fails", async () => {
    let stateCalls = 0;
    const fetchMock = vi.fn(async () => {
      stateCalls += 1;
      return stateCalls === 1
        ? jsonResponse(makeSnapshot())
        : jsonResponse({ ok: false }, 500);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.click(screen.getByRole("button", { name: /Refresh status/ }));

    expect(
      await screen.findByText(/Could not refresh status/),
    ).toBeInTheDocument();
  });

  it("offers retry only for retryable structured errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/conversations") && method === "POST") {
        return jsonResponse(retryableErrorBody, 504);
      }

      return jsonResponse(ollamaSnapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "trigger retryable" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("does not offer retry for non-retryable structured errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/conversations") && method === "POST") {
        return jsonResponse(nonRetryableErrorBody, 503);
      }

      return jsonResponse(ollamaSnapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "trigger missing" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The selected local model is not available.");
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("retries the last failed message through the conversation API and clears the error", async () => {
    const postBodies: string[] = [];
    let postCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/conversations") && method === "POST") {
        postCalls += 1;
        postBodies.push(String(init?.body ?? ""));

        if (postCalls === 1) {
          return jsonResponse(retryableErrorBody, 504);
        }

        return jsonResponse({
          ok: true,
          turn: makeTurn("please retry me", "RIN recovered reply"),
          snapshot: ollamaSnapshot,
        });
      }

      return jsonResponse(ollamaSnapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "please retry me" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    const replies = await screen.findAllByText("RIN recovered reply");
    expect(replies.length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(postCalls).toBe(2);
    expect(JSON.parse(postBodies[1]).content).toBe("please retry me");

    const conversationPosts = fetchMock.mock.calls.filter(([input, init]) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      return url.includes("/api/conversations") && method === "POST";
    });
    expect(conversationPosts.length).toBe(2);
    for (const [input] of fetchMock.mock.calls) {
      const url = typeof input === "string" ? input : String(input);
      expect(url.startsWith("/api/")).toBe(true);
    }
  });

  it("displays memory injection trace without full memory text", async () => {
    const memoryId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/conversations") && method === "POST") {
        return jsonResponse({
          ok: true,
          turn: {
            ...makeTurn("local Ollama reasoning models", "RIN reply"),
            memoryContext: {
              injectedMemoryCount: 1,
              injectedMemoryIds: [memoryId],
              memoryContextCharacterCount: 180,
              skippedByBudgetCount: 0,
              skippedByRelevanceCount: 1,
              skippedByMaxCountCount: 0,
              items: [
                {
                  memoryId,
                  memoryType: "project",
                  matchedKeywords: ["local", "ollama", "reasoning"],
                  overlapCount: 3,
                  latinTokenMatchCount: 3,
                  cjkBigramMatchCount: 0,
                  normalizedQueryTokenCount: 4,
                  typeMatchBonus: 1,
                  matchedTypeSignals: ["project"],
                  wasInjected: true,
                  skippedReason: null,
                  snippetLength: 42,
                },
                {
                  memoryId: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
                  memoryType: "semantic",
                  matchedKeywords: [],
                  overlapCount: 0,
                  latinTokenMatchCount: 0,
                  cjkBigramMatchCount: 0,
                  normalizedQueryTokenCount: 4,
                  typeMatchBonus: 0,
                  matchedTypeSignals: [],
                  wasInjected: false,
                  skippedReason: "zero_relevance",
                  snippetLength: 30,
                },
              ],
            },
          },
          snapshot: ollamaSnapshot,
        });
      }

      return jsonResponse(ollamaSnapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "local Ollama reasoning models" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const panel = await screen.findByLabelText("Memory context trace");
    expect(panel.textContent).toContain("aaaaaaaa");
    expect(
      screen.getByRole("button", { name: /Memory context/ }),
    ).toBeInTheDocument();
    expect(panel.textContent).toMatch(/overlap 3/);
    expect(panel.textContent).toMatch(/type project \+1: project/);
    expect(panel.textContent).toMatch(/local, ollama, reasoning/);
    expect(screen.queryByText(/Owner prefers local Ollama/)).toBeNull();
  });

  it("displays stored memory context when loading conversation history", async () => {
    const memoryId = "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee";
    const conversation = {
      id: "conversation-history",
      title: "stored memory trace",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:01.000Z",
    };
    const memoryContext = {
      injectedMemoryCount: 1,
      injectedMemoryIds: [memoryId],
      memoryContextCharacterCount: 180,
      skippedByBudgetCount: 0,
      skippedByRelevanceCount: 0,
      skippedByMaxCountCount: 0,
      items: [
        {
          memoryId,
          memoryType: "semantic",
          matchedKeywords: ["local", "model"],
          overlapCount: 2,
          latinTokenMatchCount: 2,
          cjkBigramMatchCount: 0,
          normalizedQueryTokenCount: 2,
          typeMatchBonus: 0,
          matchedTypeSignals: [],
          wasInjected: true,
          skippedReason: null,
          snippetLength: 42,
        },
      ],
    };
    const snapshot = makeSnapshot({
      recentConversations: [conversation],
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/conversations/conversation-history")) {
        return jsonResponse({
          ok: true,
          conversation,
          messages: [
            {
              id: "owner-history",
              conversationId: conversation.id,
              role: "owner",
              content: "related prompt",
              modelAdapter: null,
              createdAt: "2026-06-04T00:00:00.000Z",
              memoryContext: null,
            },
            {
              id: "rin-history",
              conversationId: conversation.id,
              role: "rin",
              content: "historical reply",
              modelAdapter: "rin-mock-local",
              createdAt: "2026-06-04T00:00:01.000Z",
              memoryContext,
            },
          ],
          snapshot,
        });
      }

      return jsonResponse(snapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);
    fireEvent.click(screen.getByRole("button", { name: "stored memory trace" }));

    const panel = await screen.findByLabelText("Memory context trace");
    expect(panel.textContent).toContain("cccccccc");
    expect(
      screen.getByRole("button", { name: /Memory context/ }),
    ).toBeInTheDocument();
    expect(panel.textContent).toMatch(/overlap 2/);
    expect(panel.textContent).toMatch(/local, model/);
    expect(screen.queryByText(/Owner prefers local/)).toBeNull();
  });

  it("does not show a memory context affordance for messages without memory context", async () => {
    const conversation = {
      id: "conversation-without-trace",
      title: "no stored memory trace",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:01.000Z",
    };
    const snapshot = makeSnapshot({
      recentConversations: [conversation],
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/conversations/conversation-without-trace")) {
        return jsonResponse({
          ok: true,
          conversation,
          messages: [
            {
              id: "owner-no-trace",
              conversationId: conversation.id,
              role: "owner",
              content: "related prompt",
              modelAdapter: null,
              createdAt: "2026-06-04T00:00:00.000Z",
              memoryContext: null,
            },
            {
              id: "rin-no-trace",
              conversationId: conversation.id,
              role: "rin",
              content: "historical reply without trace",
              modelAdapter: "rin-mock-local",
              createdAt: "2026-06-04T00:00:01.000Z",
              memoryContext: null,
            },
          ],
          snapshot,
        });
      }

      return jsonResponse(snapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);
    fireEvent.click(screen.getByRole("button", { name: "no stored memory trace" }));

    expect(await screen.findByText("historical reply without trace")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Memory context/ })).toBeNull();
    expect(screen.queryByLabelText("Memory context trace")).toBeNull();
  });

  it("selects distinct persisted memory context traces for multiple RIN messages", async () => {
    const conversation = {
      id: "conversation-multiple-traces",
      title: "multiple stored traces",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:03.000Z",
    };
    const firstMemoryContext = makeMemoryContext(
      "dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee",
      ["ollama", "preference"],
      2,
    );
    const secondMemoryContext = makeMemoryContext(
      "eeeeeeee-bbbb-cccc-dddd-eeeeeeeeeeee",
      ["memory", "audit", "trace"],
      3,
    );
    const snapshot = makeSnapshot({
      recentConversations: [conversation],
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/conversations/conversation-multiple-traces")) {
        return jsonResponse({
          ok: true,
          conversation,
          messages: [
            {
              id: "owner-first",
              conversationId: conversation.id,
              role: "owner",
              content: "first prompt",
              modelAdapter: null,
              createdAt: "2026-06-04T00:00:00.000Z",
              memoryContext: null,
            },
            {
              id: "rin-first",
              conversationId: conversation.id,
              role: "rin",
              content: "first historical reply",
              modelAdapter: "rin-mock-local",
              createdAt: "2026-06-04T00:00:01.000Z",
              memoryContext: firstMemoryContext,
            },
            {
              id: "owner-second",
              conversationId: conversation.id,
              role: "owner",
              content: "second prompt",
              modelAdapter: null,
              createdAt: "2026-06-04T00:00:02.000Z",
              memoryContext: null,
            },
            {
              id: "rin-second",
              conversationId: conversation.id,
              role: "rin",
              content: "second historical reply",
              modelAdapter: "rin-mock-local",
              createdAt: "2026-06-04T00:00:03.000Z",
              memoryContext: secondMemoryContext,
            },
          ],
          snapshot,
        });
      }

      return jsonResponse(snapshot);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);
    fireEvent.click(screen.getByRole("button", { name: "multiple stored traces" }));

    let panel = await screen.findByLabelText("Memory context trace");
    expect(panel.textContent).toContain("eeeeeeee");
    expect(panel.textContent).toMatch(/memory, audit, trace/);

    const buttons = screen.getAllByRole("button", { name: /Memory context/ });
    fireEvent.click(buttons[0]);

    panel = await screen.findByLabelText("Memory context trace");
    expect(panel.textContent).toContain("dddddddd");
    expect(panel.textContent).toMatch(/ollama, preference/);
    expect(panel.textContent).not.toContain("Owner full memory text");
    expect(panel.textContent).not.toContain("private prompt snippet");
  });

  it("clears a selected historical trace when sending a new reply without memory context", async () => {
    const conversation = {
      id: "conversation-clear-selection",
      title: "clear selection",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:01.000Z",
    };
    const snapshot = makeSnapshot({
      recentConversations: [conversation],
    });
    const memoryContext = makeMemoryContext(
      "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee",
      ["history"],
      1,
    );
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = (init?.method ?? "GET").toUpperCase();

        if (url.includes("/api/conversations/conversation-clear-selection")) {
          return jsonResponse({
            ok: true,
            conversation,
            messages: [
              {
                id: "owner-clear-history",
                conversationId: conversation.id,
                role: "owner",
                content: "history prompt",
                modelAdapter: null,
                createdAt: "2026-06-04T00:00:00.000Z",
                memoryContext: null,
              },
              {
                id: "rin-clear-history",
                conversationId: conversation.id,
                role: "rin",
                content: "historical reply with trace",
                modelAdapter: "rin-mock-local",
                createdAt: "2026-06-04T00:00:01.000Z",
                memoryContext,
              },
            ],
            snapshot,
          });
        }

        if (url.includes("/api/conversations") && method === "POST") {
          return jsonResponse({
            ok: true,
            turn: makeTurn("new prompt without trace", "new reply without trace"),
            snapshot,
          });
        }

        return jsonResponse(snapshot);
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByText(/Connected to local runtime/);
    fireEvent.click(screen.getByRole("button", { name: "clear selection" }));
    expect(await screen.findByLabelText("Memory context trace")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(/Type a local test message/),
      { target: { value: "new prompt without trace" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Send/ }));

    const replies = await screen.findAllByText("new reply without trace");
    expect(replies.length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Memory context trace")).toBeNull();
  });
});
