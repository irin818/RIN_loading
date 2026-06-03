import { describe, expect, it } from "vitest";
import { buildRinSystemPrompt } from "./rinSystemPrompt";

describe("buildRinSystemPrompt", () => {
  it("returns a bounded RIN system message for model calls", () => {
    const message = buildRinSystemPrompt();

    expect(message.role).toBe("system");
    expect(message.content.length).toBeLessThan(900);
    expect(message.content).toContain("local-first");
    expect(message.content).toContain("not RIN's identity source");
    expect(message.content).toContain("Chinese-friendly");
    expect(message.content).not.toContain("PROJECT_CHARTER");
  });
});

