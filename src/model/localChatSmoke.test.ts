import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ModelError } from "./errors";
import {
  formatLocalChatSmokeReport,
  runLocalChatSmoke,
} from "./localChatSmoke";
import type { ModelAdapter } from "./types";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("local chat smoke", () => {
  it("skips by default without calling local or external providers", async () => {
    const report = await runLocalChatSmoke({
      cwd: await createTempRoot(),
      source: {},
    });
    const summary = formatLocalChatSmokeReport(report);

    expect(report.status).toBe("skipped_not_selected");
    expect(report.localModelCallCount).toBe(0);
    expect(report.externalProviderCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(report.rawProviderResponseIncluded).toBe(false);
    expect(report.thinkingIncluded).toBe(false);
    expect(summary).toContain("Status: skipped_not_selected");
  });

  it("reports success without printing model content", async () => {
    const adapter = localAdapter(async () => ({
      content: "final answer that should not be printed",
      adapterId: "rin-ollama-local",
      metadata: {
        externalProvider: false,
        memoryWriteRequested: false,
        toolCallRequested: false,
      },
    }));
    const report = await runLocalChatSmoke({
      cwd: await createTempRoot(),
      source: { RIN_MODEL_ADAPTER: "rin-ollama-local" },
      adapter,
      model: "qwen3:4b",
    });
    const summary = formatLocalChatSmokeReport(report);

    expect(report.status).toBe("success");
    expect(report.contentLength).toBeGreaterThan(0);
    expect(report.localModelCallCount).toBe(1);
    expect(report.externalProviderCallCount).toBe(0);
    expect(summary).not.toContain("final answer");
  });

  it("reports empty-content failures without raw thinking text", async () => {
    const adapter = localAdapter(async () => {
      throw new ModelError({
        code: "MODEL_RESPONSE_INVALID",
        message: "Ollama returned empty assistant content with hidden reasoning",
        adapterId: "rin-ollama-local",
        provider: "local",
        details: {
          model: "qwen3:4b",
          emptyContent: true,
          possibleReasoningOnlyOutput: true,
          responseFields: ["message.content", "message.thinking"],
        },
      });
    });
    const report = await runLocalChatSmoke({
      cwd: await createTempRoot(),
      source: { RIN_MODEL_ADAPTER: "rin-ollama-local" },
      adapter,
      model: "qwen3:4b",
    });
    const summary = formatLocalChatSmokeReport(report);

    expect(report.status).toBe("failed");
    expect(report.errorCode).toBe("MODEL_RESPONSE_INVALID");
    expect(report.retryable).toBe(true);
    expect(report.rawProviderResponseIncluded).toBe(false);
    expect(report.thinkingIncluded).toBe(false);
    expect(summary).not.toContain("hidden reasoning");
  });
});

function localAdapter(generate: ModelAdapter["generate"]): ModelAdapter {
  return {
    id: "rin-ollama-local",
    displayName: "Test local adapter",
    provider: "local",
    generate,
  };
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-local-chat-smoke-"));
  tempRoots.push(root);
  return root;
}
