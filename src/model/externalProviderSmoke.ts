import { loadEnvironmentSource, type EnvironmentSource } from "../config/loadEnvironment";
import {
  getActiveModelAdapterId,
  getOpenAiCompatibleRuntimeOptions,
  MODEL_ADAPTER_ENV,
  OPENAI_COMPATIBLE_ADAPTER_ID,
  OPENAI_COMPATIBLE_BASE_URL_ENV,
  OPENAI_COMPATIBLE_MODEL_ENV,
  type ModelRuntimeConfig,
} from "./config";
import { isModelError } from "./errors";
import { createOpenAiCompatibleAdapter } from "./openAiCompatibleAdapter";

export const EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV = "RIN_EXTERNAL_MODEL_SMOKE";
export const EXTERNAL_MODEL_SMOKE_CONFIRMATION_VALUE = "allow";

export type ExternalModelSmokeStatus =
  | "ready"
  | "skipped_not_selected"
  | "configuration_required"
  | "confirmation_required"
  | "failed";

export type ExternalModelSmokeReport = {
  mode: "external-model-smoke";
  status: ExternalModelSmokeStatus;
  activeAdapter: string;
  requiredAdapter: typeof OPENAI_COMPATIBLE_ADAPTER_ID;
  confirmationEnv: typeof EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV;
  confirmationSupplied: boolean;
  baseUrlConfigured: boolean;
  modelConfigured: boolean;
  apiKeyConfigured: boolean;
  missingEnvironment: string[];
  externalCallAttempted: boolean;
  providerCallCount: 0 | 1;
  retryable: boolean;
  toolCallRequested: boolean;
  memoryWriteRequested: boolean;
  apiKeyPrinted: false;
  promptTextPrinted: false;
  responseTextPrinted: false;
  fullTextIncluded: false;
  errorCode: string | null;
};

export async function runExternalModelSmoke(input: {
  config: ModelRuntimeConfig;
  source?: EnvironmentSource;
  fetchFn?: typeof fetch;
}): Promise<ExternalModelSmokeReport> {
  const source = input.source ?? loadEnvironmentSource();
  const activeAdapter = getActiveModelAdapterId(input.config, source);
  const confirmationSupplied =
    source[EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV] ===
    EXTERNAL_MODEL_SMOKE_CONFIRMATION_VALUE;

  if (activeAdapter !== OPENAI_COMPATIBLE_ADAPTER_ID) {
    return baseReport({
      status: "skipped_not_selected",
      activeAdapter,
      confirmationSupplied,
      missingEnvironment: [MODEL_ADAPTER_ENV],
      errorCode: "EXTERNAL_MODEL_NOT_SELECTED",
    });
  }

  const adapterConfig = input.config.adapters.find((adapter) => {
    return adapter.id === OPENAI_COMPATIBLE_ADAPTER_ID;
  });

  if (!adapterConfig) {
    return baseReport({
      status: "configuration_required",
      activeAdapter,
      confirmationSupplied,
      missingEnvironment: [OPENAI_COMPATIBLE_ADAPTER_ID],
      errorCode: "EXTERNAL_MODEL_ADAPTER_MISSING",
    });
  }

  const options = getOpenAiCompatibleRuntimeOptions(adapterConfig, source);
  const missingEnvironment = [
    options.baseUrl ? null : OPENAI_COMPATIBLE_BASE_URL_ENV,
    options.model ? null : OPENAI_COMPATIBLE_MODEL_ENV,
    options.apiKey ? null : options.apiKeyEnv,
  ].filter((item): item is string => item !== null);

  if (missingEnvironment.length > 0) {
    return baseReport({
      status: "configuration_required",
      activeAdapter,
      confirmationSupplied,
      baseUrlConfigured: Boolean(options.baseUrl),
      modelConfigured: Boolean(options.model),
      apiKeyConfigured: Boolean(options.apiKey),
      missingEnvironment,
      errorCode: "EXTERNAL_MODEL_ENVIRONMENT_MISSING",
    });
  }

  if (!confirmationSupplied) {
    return baseReport({
      status: "confirmation_required",
      activeAdapter,
      confirmationSupplied,
      baseUrlConfigured: true,
      modelConfigured: true,
      apiKeyConfigured: true,
      errorCode: "EXTERNAL_MODEL_SMOKE_CONFIRMATION_REQUIRED",
    });
  }

  if (!options.baseUrl || !options.model || !options.apiKey) {
    return baseReport({
      status: "configuration_required",
      activeAdapter,
      confirmationSupplied,
      missingEnvironment,
      errorCode: "EXTERNAL_MODEL_ENVIRONMENT_MISSING",
    });
  }

  const adapter = createOpenAiCompatibleAdapter({
    id: OPENAI_COMPATIBLE_ADAPTER_ID,
    displayName: adapterConfig.displayName,
    baseUrl: options.baseUrl,
    model: options.model,
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    fetchFn: input.fetchFn,
  });

  try {
    const response = await adapter.generate({
      ownerId: "external-model-smoke",
      conversationId: "external-model-smoke",
      messages: [
        {
          role: "system",
          content:
            "You are running a RIN external provider smoke check. Reply with a short readiness acknowledgement.",
        },
        {
          role: "owner",
          content: "RIN external provider smoke check.",
        },
      ],
    });
    const unsafeProviderBehavior =
      response.metadata.toolCallRequested ||
      response.metadata.memoryWriteRequested ||
      response.content.trim().length === 0;

    return baseReport({
      status: unsafeProviderBehavior ? "failed" : "ready",
      activeAdapter,
      confirmationSupplied,
      baseUrlConfigured: true,
      modelConfigured: true,
      apiKeyConfigured: true,
      externalCallAttempted: true,
      providerCallCount: 1,
      toolCallRequested: response.metadata.toolCallRequested,
      memoryWriteRequested: response.metadata.memoryWriteRequested,
      errorCode: unsafeProviderBehavior
        ? "EXTERNAL_MODEL_SMOKE_UNSAFE_RESPONSE"
        : null,
    });
  } catch (error) {
    return baseReport({
      status: "failed",
      activeAdapter,
      confirmationSupplied,
      baseUrlConfigured: true,
      modelConfigured: true,
      apiKeyConfigured: true,
      externalCallAttempted: true,
      providerCallCount: 1,
      retryable: isModelError(error) ? error.retryable : true,
      errorCode: isModelError(error)
        ? error.code
        : "EXTERNAL_MODEL_SMOKE_FAILED",
    });
  }
}

export function formatExternalModelSmokeReport(
  report: ExternalModelSmokeReport,
): string {
  return [
    "RIN external model smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Active adapter: ${report.activeAdapter}`,
    `Required adapter: ${report.requiredAdapter}`,
    `Confirmation env: ${report.confirmationEnv}`,
    `Confirmation supplied: ${report.confirmationSupplied ? "yes" : "no"}`,
    `Base URL configured: ${report.baseUrlConfigured ? "yes" : "no"}`,
    `Model configured: ${report.modelConfigured ? "yes" : "no"}`,
    `API key configured: ${report.apiKeyConfigured ? "yes" : "no"}`,
    `External call attempted: ${report.externalCallAttempted ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Retryable: ${report.retryable ? "yes" : "no"}`,
    `Tool call requested: ${report.toolCallRequested ? "yes" : "no"}`,
    `Memory write requested: ${report.memoryWriteRequested ? "yes" : "no"}`,
    `API key printed: ${report.apiKeyPrinted ? "yes" : "no"}`,
    `Prompt text printed: ${report.promptTextPrinted ? "yes" : "no"}`,
    `Response text printed: ${report.responseTextPrinted ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
    "Missing environment:",
    ...formatList(report.missingEnvironment),
  ].join("\n");
}

function baseReport(input: {
  status: ExternalModelSmokeStatus;
  activeAdapter: string;
  confirmationSupplied: boolean;
  baseUrlConfigured?: boolean;
  modelConfigured?: boolean;
  apiKeyConfigured?: boolean;
  missingEnvironment?: string[];
  externalCallAttempted?: boolean;
  providerCallCount?: 0 | 1;
  retryable?: boolean;
  toolCallRequested?: boolean;
  memoryWriteRequested?: boolean;
  errorCode: string | null;
}): ExternalModelSmokeReport {
  return {
    mode: "external-model-smoke",
    status: input.status,
    activeAdapter: input.activeAdapter,
    requiredAdapter: OPENAI_COMPATIBLE_ADAPTER_ID,
    confirmationEnv: EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV,
    confirmationSupplied: input.confirmationSupplied,
    baseUrlConfigured: input.baseUrlConfigured ?? false,
    modelConfigured: input.modelConfigured ?? false,
    apiKeyConfigured: input.apiKeyConfigured ?? false,
    missingEnvironment: input.missingEnvironment ?? [],
    externalCallAttempted: input.externalCallAttempted ?? false,
    providerCallCount: input.providerCallCount ?? 0,
    retryable: input.retryable ?? false,
    toolCallRequested: input.toolCallRequested ?? false,
    memoryWriteRequested: input.memoryWriteRequested ?? false,
    apiKeyPrinted: false,
    promptTextPrinted: false,
    responseTextPrinted: false,
    fullTextIncluded: false,
    errorCode: input.errorCode,
  };
}

function formatList(values: readonly string[]): string[] {
  if (values.length === 0) {
    return ["none"];
  }

  return values.map((value) => `- ${value}`);
}
