import { mockModelAdapter } from "./mockAdapter";
import type { ModelAdapter } from "./types";

const adapters = new Map<string, ModelAdapter>([
  [mockModelAdapter.id, mockModelAdapter],
]);

export function getModelAdapter(adapterId: string): ModelAdapter {
  const adapter = adapters.get(adapterId);

  if (!adapter) {
    throw new Error(`Unknown model adapter: ${adapterId}`);
  }

  return adapter;
}

export function getDefaultModelAdapter(): ModelAdapter {
  return mockModelAdapter;
}

export function listModelAdapters(): ModelAdapter[] {
  return Array.from(adapters.values());
}
