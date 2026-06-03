import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "./manager";
import {
  formatSemanticAcceptedMemoryIndexReport,
  runSemanticAcceptedMemoryIndexReport,
} from "./semanticAcceptedMemoryIndex";
import type { LocalEmbeddingProvider } from "./semanticEmbedding";

describe("runSemanticAcceptedMemoryIndexReport", () => {
  it("stays disabled by default without loading memories or calling providers", async () => {
    let loadCount = 0;
    const report = await runSemanticAcceptedMemoryIndexReport({
      optIn: false,
      queryText: "local semantic report",
      loadMemories: () => {
        loadCount += 1;
        return [memory("should-not-load", "This should not be loaded.")];
      },
    });

    expect(loadCount).toBe(0);
    expect(report).toMatchObject({
      status: "disabled",
      enabled: false,
      optInSatisfied: false,
      providerMode: "disabled",
      indexedAcceptedMemoryCount: 0,
      providerCallCount: 0,
      errorCode: "LOCAL_EMBEDDING_DISABLED",
      productionIntegrationEnabled: false,
      contextInjectionEnabled: false,
      fullTextIncluded: false,
    });
  });

  it("indexes accepted memories only in explicit report-only fixture mode", async () => {
    const report = await runSemanticAcceptedMemoryIndexReport({
      optIn: true,
      queryText: "semantic local provider",
      memories: [
        memory("accepted-local-provider", "Semantic local provider boundary."),
        memory("accepted-index", "Semantic index lifecycle."),
        memory("proposal-local-provider", "Semantic local provider draft.", {
          status: "proposal",
        }),
      ],
      topK: 2,
      candidateCap: 2,
    });

    expect(report.status).toBe("ready");
    expect(report.providerId).toBe("fixture-mock-local-embedding");
    expect(report.providerMode).toBe("fixture-mock");
    expect(report.indexedAcceptedMemoryCount).toBe(2);
    expect(report.skippedNonAcceptedCount).toBe(1);
    expect(report.skippedNonAcceptedIds).toEqual(["proposal-local-provider"]);
    expect(report.candidateIds).toEqual([
      "accepted-local-provider",
      "accepted-index",
    ]);
    expect(report.providerCallCount).toBe(0);
  });

  it("formats reports without full memory text or raw query text", async () => {
    const report = await runSemanticAcceptedMemoryIndexReport({
      optIn: true,
      queryText: "private semantic query phrase",
      memories: [
        memory(
          "private-memory-id",
          "Private accepted memory text must never appear in report output.",
        ),
      ],
    });
    const summary = formatSemanticAcceptedMemoryIndexReport(report);

    expect(summary).toContain("private-memory-id");
    expect(summary).not.toContain(
      "Private accepted memory text must never appear in report output",
    );
    expect(summary).not.toContain("private semantic query phrase");
    expect(summary).toContain("Full text included: no");
  });

  it("is deterministic across repeated fixture runs", async () => {
    const options = {
      optIn: true,
      queryTerms: ["stable"],
      memories: [
        memory("b", "Stable candidate.", { content: { text: "stable" } }),
        memory("a", "Stable candidate.", { content: { text: "stable" } }),
      ],
      topK: 2,
      candidateCap: 2,
    } as const;
    const first = await runSemanticAcceptedMemoryIndexReport(options);
    const second = await runSemanticAcceptedMemoryIndexReport(options);

    expect(first.candidateIds).toEqual(["a", "b"]);
    expect(first).toEqual(second);
    expect(formatSemanticAcceptedMemoryIndexReport(first)).toEqual(
      formatSemanticAcceptedMemoryIndexReport(second),
    );
  });

  it("reports live local provider disabled safely", async () => {
    const report = await runSemanticAcceptedMemoryIndexReport({
      optIn: true,
      providerMode: "live-local",
      queryText: "local embedding",
      memories: [memory("accepted", "local embedding")],
      localProviderConfig: { enabled: false },
    });

    expect(report.status).toBe("provider_unavailable");
    expect(report.providerMode).toBe("live-local");
    expect(report.providerCallCount).toBe(0);
    expect(report.errorCode).toBe("LOCAL_EMBEDDING_DISABLED");
  });

  it("can use an explicit live local provider without exposing text", async () => {
    const provider = fakeLiveProvider();
    const report = await runSemanticAcceptedMemoryIndexReport({
      optIn: true,
      providerMode: "live-local",
      queryTerms: ["live"],
      memories: [
        memory("live-a", "live"),
        memory("live-b", "other"),
        memory("live-pending", "live", { status: "proposal" }),
      ],
      localProvider: provider,
      topK: 1,
      candidateCap: 1,
    });

    expect(report.status).toBe("ready");
    expect(report.providerMode).toBe("live-local");
    expect(report.providerId).toBe("fake-live-local");
    expect(report.modelId).toBe("fake-live-model");
    expect(report.candidateIds).toEqual(["live-a"]);
    expect(report.skippedNonAcceptedIds).toEqual(["live-pending"]);
    expect(report.providerCallCount).toBe(3);
    expect(formatSemanticAcceptedMemoryIndexReport(report)).not.toContain("live ");
  });
});

function memory(
  id: string,
  text: string,
  overrides: Partial<MemoryRecord> = {},
): MemoryRecord {
  return {
    id,
    memoryType: "semantic",
    content: overrides.content ?? { text },
    metadata: {
      tags: [],
      importance: "normal",
      confidence: "medium",
      source: null,
      reviewedAt: null,
      acceptedAt: null,
    },
    sourceMessageId: null,
    status: overrides.status ?? "accepted",
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    ...overrides,
  };
}

function fakeLiveProvider(): LocalEmbeddingProvider {
  return {
    providerId: "fake-live-local",
    providerKind: "ollama-local",
    modelId: "fake-live-model",
    expectedDimension: 2,
    timeoutMs: 1000,
    async checkReadiness() {
      return {
        enabled: true,
        status: "available",
        providerId: "fake-live-local",
        providerKind: "ollama-local",
        modelId: "fake-live-model",
        dimension: 2,
        latencyMs: 1,
        providerCallCount: 1,
        errorCode: null,
        message: "available",
      };
    },
    async embedText(input) {
      return {
        id: input.id,
        vector: input.text.includes("live") ? [1, 0] : [0, 1],
        providerId: "fake-live-local",
        providerKind: "ollama-local",
        modelId: "fake-live-model",
        dimension: 2,
        latencyMs: 1,
        providerCallCount: 1,
      };
    },
  };
}
