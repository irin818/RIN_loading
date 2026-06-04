import { describe, expect, it } from "vitest";
import {
  EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV,
  EXTERNAL_MODEL_SMOKE_CONFIRMATION_VALUE,
  formatExternalModelSmokeReport,
  runExternalModelSmoke,
} from "./externalProviderSmoke";
import {
  createDefaultModelRuntimeConfig,
  OPENAI_COMPATIBLE_ADAPTER_ID,
} from "./index";

describe("runExternalModelSmoke", () => {
  it("does not call external providers unless the adapter is explicitly selected", async () => {
    let fetchCalls = 0;
    const report = await runExternalModelSmoke({
      config: createDefaultModelRuntimeConfig(),
      source: {},
      fetchFn: async () => {
        fetchCalls += 1;
        return new Response("{}");
      },
    });

    expect(report).toMatchObject({
      status: "skipped_not_selected",
      externalCallAttempted: false,
      providerCallCount: 0,
      apiKeyPrinted: false,
      fullTextIncluded: false,
    });
    expect(fetchCalls).toBe(0);
  });

  it("reports missing OpenAI-compatible environment without a provider call", async () => {
    const report = await runExternalModelSmoke({
      config: createDefaultModelRuntimeConfig(),
      source: {
        RIN_MODEL_ADAPTER: OPENAI_COMPATIBLE_ADAPTER_ID,
        RIN_OPENAI_COMPATIBLE_BASE_URL: "https://provider.example/v1",
      },
    });

    expect(report.status).toBe("configuration_required");
    expect(report.externalCallAttempted).toBe(false);
    expect(report.missingEnvironment).toEqual([
      "RIN_OPENAI_COMPATIBLE_MODEL",
      "RIN_OPENAI_COMPATIBLE_API_KEY",
    ]);
  });

  it("requires explicit live-smoke confirmation before calling the provider", async () => {
    let fetchCalls = 0;
    const report = await runExternalModelSmoke({
      config: createDefaultModelRuntimeConfig(),
      source: openAiSource(),
      fetchFn: async () => {
        fetchCalls += 1;
        return new Response("{}");
      },
    });

    expect(report).toMatchObject({
      status: "confirmation_required",
      externalCallAttempted: false,
      providerCallCount: 0,
      apiKeyConfigured: true,
    });
    expect(fetchCalls).toBe(0);
  });

  it("runs a confirmed provider smoke without printing secrets or full text", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const report = await runExternalModelSmoke({
      config: createDefaultModelRuntimeConfig(),
      source: {
        ...openAiSource(),
        [EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV]:
          EXTERNAL_MODEL_SMOKE_CONFIRMATION_VALUE,
      },
      fetchFn: async (url, init) => {
        requests.push({ url: String(url), init });

        return new Response(
          JSON.stringify({
            choices: [
              { message: { content: "provider acknowledgement body" } },
            ],
          }),
          { status: 200 },
        );
      },
    });
    const formatted = formatExternalModelSmokeReport(report);

    expect(report).toMatchObject({
      status: "ready",
      externalCallAttempted: true,
      providerCallCount: 1,
      toolCallRequested: false,
      memoryWriteRequested: false,
      apiKeyPrinted: false,
      promptTextPrinted: false,
      responseTextPrinted: false,
      fullTextIncluded: false,
    });
    expect(requests[0]?.url).toBe("https://provider.example/v1/chat/completions");
    expect(formatted).not.toContain("test-key");
    expect(formatted).not.toContain("RIN external provider smoke check.");
    expect(formatted).not.toContain("provider acknowledgement body");
  });

  it("reports provider errors without exposing the API key", async () => {
    const report = await runExternalModelSmoke({
      config: createDefaultModelRuntimeConfig(),
      source: {
        ...openAiSource(),
        [EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV]:
          EXTERNAL_MODEL_SMOKE_CONFIRMATION_VALUE,
      },
      fetchFn: async () =>
        new Response(JSON.stringify({ error: { message: "nope" } }), {
          status: 401,
        }),
    });
    const formatted = formatExternalModelSmokeReport(report);

    expect(report).toMatchObject({
      status: "failed",
      externalCallAttempted: true,
      providerCallCount: 1,
      retryable: true,
      errorCode: "MODEL_PROVIDER_ERROR",
      apiKeyPrinted: false,
    });
    expect(formatted).not.toContain("test-key");
  });
});

function openAiSource(): Record<string, string> {
  return {
    RIN_MODEL_ADAPTER: OPENAI_COMPATIBLE_ADAPTER_ID,
    RIN_OPENAI_COMPATIBLE_BASE_URL: "https://provider.example/v1",
    RIN_OPENAI_COMPATIBLE_MODEL: "provider-model",
    RIN_OPENAI_COMPATIBLE_API_KEY: "test-key",
  };
}
