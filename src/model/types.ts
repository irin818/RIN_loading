export type ModelMessageRole = "system" | "owner" | "rin";

export type ModelMessage = {
  role: ModelMessageRole;
  content: string;
};

export type ModelRequest = {
  messages: ModelMessage[];
  ownerId: string;
  conversationId: string;
};

export type ModelResponse = {
  content: string;
  adapterId: string;
  metadata: {
    externalProvider: boolean;
    memoryWriteRequested: boolean;
    toolCallRequested: boolean;
  };
};

export type ModelAdapter = {
  id: string;
  displayName: string;
  provider: "mock" | "openai-compatible" | "local" | "custom";
  generate: (request: ModelRequest) => Promise<ModelResponse>;
};
