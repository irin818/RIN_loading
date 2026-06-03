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
  OLLAMA_MODEL_ENV,
  OPENAI_COMPATIBLE_ADAPTER_ID,
} from "./config";
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
