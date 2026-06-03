import { describe, expect, it } from "vitest";
import type { ModelMessage } from "../model";
import { buildModelContext } from "./contextBuilder";

describe("buildModelContext", () => {
  it("places the generated system message first and retained messages chronologically", () => {
    const context = buildModelContext([
      owner("first"),
      rin("second"),
      owner("third"),
    ]);

    expect(context.messages.map((message) => message.role)).toEqual([
      "system",
      "owner",
      "rin",
      "owner",
    ]);
    expect(context.messages.map((message) => message.content)).toEqual([
      expect.stringContaining("reasoning/chat model"),
      "first",
      "second",
      "third",
    ]);
  });

  it("drops older messages first when the message budget is exceeded", () => {
    const context = buildModelContext(
      [
        owner("owner-1"),
        rin("rin-1"),
        owner("owner-2"),
        rin("rin-2"),
        owner("owner-3"),
      ],
      {
        maxRecentMessages: 3,
        maxInputCharacters: 12_000,
        preserveLatestOwnerMessage: true,
      },
    );

    expect(context.messages.map((message) => message.content)).toEqual([
      expect.stringContaining("reasoning/chat model"),
      "owner-2",
      "rin-2",
      "owner-3",
    ]);
    expect(context.stats.droppedMessageCount).toBe(2);
  });

  it("preserves the latest owner message when the character budget is tight", () => {
    const context = buildModelContext(
      [
        owner("older owner ".repeat(80)),
        rin("older rin ".repeat(80)),
        owner("latest owner must stay"),
      ],
      {
        maxRecentMessages: 12,
        maxInputCharacters: 120,
        preserveLatestOwnerMessage: true,
      },
    );

    expect(context.messages.at(-1)).toEqual(owner("latest owner must stay"));
    expect(context.messages.some((message) => message.content.startsWith("older"))).toBe(
      false,
    );
  });

  it("does not duplicate stored system messages", () => {
    const context = buildModelContext([
      { role: "system", content: "stored system prompt" },
      owner("hello"),
    ]);

    expect(context.messages.filter((message) => message.role === "system")).toHaveLength(
      1,
    );
    expect(context.messages[0].content).not.toBe("stored system prompt");
    expect(context.messages[1]).toEqual(owner("hello"));
  });

  it("reports character count and applied budget stats", () => {
    const context = buildModelContext([owner("hello")]);

    expect(context.stats.contextBudgetApplied).toBe(true);
    expect(context.stats.messageCount).toBe(context.messages.length);
    expect(context.stats.characterCount).toBe(
      context.messages.reduce(
        (total, message) => total + message.content.length,
        0,
      ),
    );
  });
});

function owner(content: string): ModelMessage {
  return { role: "owner", content };
}

function rin(content: string): ModelMessage {
  return { role: "rin", content };
}

