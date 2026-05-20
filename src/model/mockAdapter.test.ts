import { describe, expect, it } from "vitest";
import { mockModelAdapter } from "./mockAdapter";

describe("mockModelAdapter", () => {
  it("returns a local response without external model, memory, or tool effects", async () => {
    const response = await mockModelAdapter.generate({
      ownerId: "owner-a",
      conversationId: "conversation-a",
      messages: [{ role: "owner", content: "hello RIN" }],
    });

    expect(response.adapterId).toBe(mockModelAdapter.id);
    expect(response.content).toContain("hello RIN");
    expect(response.metadata.externalProvider).toBe(false);
    expect(response.metadata.memoryWriteRequested).toBe(false);
    expect(response.metadata.toolCallRequested).toBe(false);
  });
});
