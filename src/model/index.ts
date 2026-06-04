export { MOCK_MODEL_ADAPTER_ID, mockModelAdapter } from "./mockAdapter";
export {
  createDefaultModelRuntimeConfig,
  getActiveModelAdapterId,
  getOllamaRuntimeOptions,
  getModelRuntimeStatus,
  loadModelRuntimeConfig,
  OLLAMA_ADAPTER_ID,
  OLLAMA_BASE_URL_ENV,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_DEFAULT_NUM_PREDICT,
  OLLAMA_DEFAULT_TEMPERATURE,
  OLLAMA_DEFAULT_TIMEOUT_MS,
  OLLAMA_DEFAULT_TOP_P,
  OLLAMA_MODEL_ENV,
  OLLAMA_NUM_PREDICT_ENV,
  OLLAMA_TEMPERATURE_ENV,
  OLLAMA_TIMEOUT_MS_ENV,
  OLLAMA_TOP_P_ENV,
  OPENAI_COMPATIBLE_ADAPTER_ID,
} from "./config";
export { isModelError, ModelError } from "./errors";
export type { ModelErrorCode, ModelErrorDetails, ModelErrorInit } from "./errors";
export {
  EXTERNAL_MODEL_SMOKE_CONFIRMATION_ENV,
  EXTERNAL_MODEL_SMOKE_CONFIRMATION_VALUE,
  formatExternalModelSmokeReport,
  runExternalModelSmoke,
} from "./externalProviderSmoke";
export type {
  ExternalModelSmokeReport,
  ExternalModelSmokeStatus,
} from "./externalProviderSmoke";
export { createOllamaAdapter } from "./ollamaAdapter";
export { createOpenAiCompatibleAdapter } from "./openAiCompatibleAdapter";
export {
  getConfiguredModelAdapter,
  getDefaultModelAdapter,
  getModelAdapter,
  listModelAdapters,
} from "./registry";
export type {
  ModelAdapterConfig,
  OllamaGenerationOptions,
  OllamaRuntimeOptions,
  ModelRuntimeConfig,
  ModelRuntimeStatus,
} from "./config";
export type {
  ModelAdapter,
  ModelMessage,
  ModelMessageRole,
  ModelRequest,
  ModelResponse,
} from "./types";
