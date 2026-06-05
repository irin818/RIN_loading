import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { inspectRinDatabase, openRinDatabase } from "../database";
import {
  applyMemoryV2LegacyMigration,
  createMemoryProposal,
  reviewMemoryProposal,
} from "../memory";
import { ModelError, type ModelAdapter } from "../model";
import { initializeRinStorage } from "../storage";
import type { RinDataLayout } from "../storage";
import { isConversationError } from "./errors";
import { listConversationMessages } from "./repository";
import { processOwnerMessage } from "./runtime";

function seedAcceptedMemory(
  layout: RinDataLayout,
  text: string,
  now: Date,
): string {
  const database = openRinDatabase(layout);

  try {
    const proposal = createMemoryProposal(database, {
      memoryType: "semantic",
      content: { text },
      now,
    });
    reviewMemoryProposal(database, {
      memoryItemId: proposal.id,
      decision: "accept",
      now,
    });
    return proposal.id;
  } finally {
    database.close();
  }
}

function latestModelResponsePayload(
  layout: RinDataLayout,
): Record<string, unknown> {
  const database = openRinDatabase(layout);

  try {
    const row = database
      .prepare(
        `
          SELECT payload_json
          FROM raw_events
          WHERE event_type = 'model.response_received'
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get() as { payload_json: string };
    return JSON.parse(row.payload_json) as Record<string, unknown>;
  } finally {
    database.close();
  }
}

function failingLocalAdapter(): ModelAdapter {
  return {
    id: "rin-ollama-local",
    displayName: "Failing local adapter",
    provider: "local",
    generate: async () => {
      throw new ModelError({
        code: "LOCAL_MODEL_TIMEOUT",
        message: "Ollama local model timed out.",
        adapterId: "rin-ollama-local",
        provider: "local",
        details: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
      });
    },
  };
}

function successfulCountingAdapter(content = "RIN persisted reply."): {
  adapter: ModelAdapter;
  calls: () => number;
} {
  let callCount = 0;

  return {
    adapter: {
      id: "rin-test-adapter",
      displayName: "Test adapter",
      provider: "mock",
      generate: async () => {
        callCount += 1;
        return {
          content,
          adapterId: "rin-test-adapter",
          metadata: {
            externalProvider: false,
            memoryWriteRequested: false,
            toolCallRequested: false,
          },
        };
      },
    },
    calls: () => callCount,
  };
}

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("processOwnerMessage", () => {
  it("creates a local conversation turn through the mock model adapter", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const turn = await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "RIN, confirm local conversation template.",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });
    const database = inspectRinDatabase(storage.layout);

    expect(turn.conversation.title).toContain("RIN, confirm");
    expect(turn.ownerMessage.role).toBe("owner");
    expect(turn.rinMessage.role).toBe("rin");
    expect(turn.rinMessage.modelAdapter).toBe("rin-mock-local");
    expect(turn.rinMessage.content).toContain("without calling an external model");
    expect(database.counts.conversations).toBe(1);
    expect(database.counts.messages).toBe(2);
    expect(database.counts.memoryItems).toBe(0);
  });

  it("rejects empty owner messages", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await expect(
      processOwnerMessage(storage.layout, {
        ownerId: defaultEnvironment.ownerId,
        content: "   ",
      }),
    ).rejects.toThrow("Owner message cannot be empty.");
  });

  it("creates memory proposals without accepting long-term memory", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "/remember RIN should keep local identity separate from models.",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });

    const database = inspectRinDatabase(storage.layout);

    expect(database.counts.memoryItems).toBe(1);
    expect(database.counts.rawEvents).toBeGreaterThanOrEqual(2);
    expect(database.counts.stateHistory).toBe(1);
    expect(database.counts.slowVariableVersions).toBeGreaterThan(0);
  });

  it("records bounded model context stats before adapter generation", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const firstTurn = await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "start context budget test",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });

    for (let index = 1; index < 8; index += 1) {
      await processOwnerMessage(storage.layout, {
        ownerId: defaultEnvironment.ownerId,
        conversationId: firstTurn.conversation.id,
        content: `continue context budget test ${index}`,
        now: new Date(`2026-05-19T00:0${index}:00.000Z`),
      });
    }

    const database = openRinDatabase(storage.layout);

    try {
      const row = database
        .prepare(
          `
            SELECT payload_json
            FROM raw_events
            WHERE event_type = 'model.response_received'
            ORDER BY created_at DESC
            LIMIT 1
          `,
        )
        .get() as { payload_json: string };
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;

      expect(payload.contextBudgetApplied).toBe(true);
      expect(payload.modelContextMessageCount).toBe(14);
      expect(payload.modelContextCharacterCount).toEqual(expect.any(Number));
      expect(payload.modelContextDroppedMessageCount).toBeGreaterThan(0);
      expect(payload.profileContextIncluded).toBe(true);
      expect(payload.profileContextCharacterCount).toEqual(expect.any(Number));
    } finally {
      database.close();
    }
  });

  it("injects a relevant accepted memory into model context and records its id", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const memoryId = seedAcceptedMemory(
      storage.layout,
      "Owner prefers local Ollama reasoning models.",
      new Date("2026-05-19T00:00:00.000Z"),
    );

    const turn = await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "Which local Ollama reasoning models should RIN use?",
      now: new Date("2026-05-19T00:01:00.000Z"),
    });

    expect(turn.memoryContext?.injectedMemoryCount).toBe(1);
    expect(turn.memoryContext?.items[0]?.matchedKeywords.length).toBeGreaterThan(
      0,
    );

    const payload = latestModelResponsePayload(storage.layout);

    expect(payload.injectedMemoryCount).toBe(1);
    expect(payload.injectedMemoryIds).toEqual([memoryId]);
    expect(payload.memoryContextCharacterCount).toBeGreaterThan(0);
    const items = payload.memoryInjectionItems as Array<Record<string, unknown>>;
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memoryId,
          wasInjected: true,
          overlapCount: expect.any(Number),
          matchedKeywords: expect.any(Array),
        }),
      ]),
    );
    expect(JSON.stringify(items)).not.toContain(
      "Owner prefers local Ollama reasoning models",
    );
    expect(items.every((item) => !("text" in item))).toBe(true);
  });

  it("uses Memory V2 migrated legacy traces as the production memory source", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const memoryId = seedAcceptedMemory(
      storage.layout,
      "Owner prefers local Qwen memory v2 retrieval.",
      new Date("2026-05-19T00:00:00.000Z"),
    );
    const database = openRinDatabase(storage.layout);

    try {
      applyMemoryV2LegacyMigration(
        database,
        new Date("2026-05-19T00:00:30.000Z"),
      );
    } finally {
      database.close();
    }

    await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "How should RIN use local Qwen memory v2 retrieval?",
      now: new Date("2026-05-19T00:01:00.000Z"),
    });

    const payload = latestModelResponsePayload(storage.layout);

    expect(payload.memoryRetrievalSource).toBe("memory-v2-legacy-traces");
    expect(payload.legacyAcceptedMemoryCount).toBe(1);
    expect(payload.migratedLegacyMemoryCount).toBe(1);
    expect(payload.pendingLegacyMemoryCount).toBe(0);
    expect(payload.injectedMemoryIds).toEqual([memoryId]);
    expect(JSON.stringify(payload)).not.toContain(
      "Owner prefers local Qwen memory v2 retrieval",
    );
  });

  it("persists and reloads safe memory context trace for successful RIN turns", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const memoryId = seedAcceptedMemory(
      storage.layout,
      "Owner prefers local Ollama reasoning models.",
      new Date("2026-05-19T00:00:00.000Z"),
    );

    const turn = await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "Which local Ollama reasoning models should RIN use?",
      now: new Date("2026-05-19T00:01:00.000Z"),
    });
    const inspected = inspectRinDatabase(storage.layout);

    expect(inspected.counts.messageMemoryContexts).toBe(1);
    expect(turn.rinMessage.memoryContext?.injectedMemoryIds).toEqual([memoryId]);

    const database = openRinDatabase(storage.layout);

    try {
      const messages = listConversationMessages(database, turn.conversation.id);
      const reloadedRinMessage = messages.find((message) => message.role === "rin");
      const row = database
        .prepare(
          `
            SELECT trace_json
            FROM message_memory_contexts
            WHERE message_id = ?
          `,
        )
        .get(turn.rinMessage.id) as { trace_json: string } | undefined;

      expect(reloadedRinMessage?.memoryContext?.injectedMemoryIds).toEqual([
        memoryId,
      ]);
      expect(reloadedRinMessage?.memoryContext?.items[0]?.memoryId).toBe(memoryId);
      expect(JSON.stringify(reloadedRinMessage?.memoryContext)).not.toContain(
        "Owner prefers local Ollama reasoning models",
      );
      expect(row?.trace_json).not.toContain(
        "Owner prefers local Ollama reasoning models",
      );
      expect(row?.trace_json).not.toContain("Relevant accepted owner memories");
    } finally {
      database.close();
    }
  });

  it("loads older conversation messages without memory context gracefully", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const turn = await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "RIN, confirm local conversation template.",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });
    const database = openRinDatabase(storage.layout);

    try {
      const messages = listConversationMessages(database, turn.conversation.id);

      expect(messages).toHaveLength(2);
      expect(messages.every((message) => message.memoryContext === null)).toBe(
        true,
      );
    } finally {
      database.close();
    }
  });

  it("does not inject pending or rejected memories", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const now = new Date("2026-05-19T00:00:00.000Z");
    const database = openRinDatabase(storage.layout);

    try {
      createMemoryProposal(database, {
        memoryType: "semantic",
        content: { text: "Owner prefers local Ollama reasoning models." },
        now,
      });
      const rejected = createMemoryProposal(database, {
        memoryType: "semantic",
        content: { text: "Owner prefers local Ollama reasoning models too." },
        now,
      });
      reviewMemoryProposal(database, {
        memoryItemId: rejected.id,
        decision: "reject",
        now,
      });
    } finally {
      database.close();
    }

    await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "Which local Ollama reasoning models should RIN use?",
      now: new Date("2026-05-19T00:01:00.000Z"),
    });

    const payload = latestModelResponsePayload(storage.layout);

    expect(payload.injectedMemoryCount).toBe(0);
    expect(payload.injectedMemoryIds).toEqual([]);
  });

  it("does not inject an accepted memory that is unrelated to the message", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    seedAcceptedMemory(
      storage.layout,
      "Owner enjoys weekend hiking trips.",
      new Date("2026-05-19T00:00:00.000Z"),
    );

    await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "Explain the SQLite schema migration plan.",
      now: new Date("2026-05-19T00:01:00.000Z"),
    });

    const payload = latestModelResponsePayload(storage.layout);

    expect(payload.injectedMemoryCount).toBe(0);
  });

  it("adds accepted semantic candidates only when semantic context is opted in", async () => {
    const previousMode = process.env.RIN_SEMANTIC_CONTEXT;
    const previousMaxCandidates = process.env.RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES;
    const previousMaxCharacters = process.env.RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS;
    process.env.RIN_SEMANTIC_CONTEXT = "candidate-expansion";
    process.env.RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES = "1";
    process.env.RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS = "200";

    try {
      const cwd = await createTempRoot();
      const storage = await initializeRinStorage(defaultEnvironment, { cwd });

      for (let index = 0; index < 6; index += 1) {
        seedAcceptedMemory(
          storage.layout,
          `Owner tracks stable semantic context expansion ${index}.`,
          new Date(`2026-05-19T00:0${index}:00.000Z`),
        );
      }

      const turn = await processOwnerMessage(storage.layout, {
        ownerId: defaultEnvironment.ownerId,
        content: "stable semantic context expansion",
        now: new Date("2026-05-19T00:10:00.000Z"),
      });
      const payload = latestModelResponsePayload(storage.layout);

      expect(turn.memoryContext?.injectedMemoryCount).toBe(6);
      expect(turn.memoryContext?.deterministicInjectedMemoryIds).toHaveLength(5);
      expect(turn.memoryContext?.semanticInjectedMemoryIds).toHaveLength(1);
      expect(turn.memoryContext?.semanticCandidateIds).toEqual(
        turn.memoryContext?.semanticInjectedMemoryIds,
      );
      expect(payload.semanticContextExpansionEnabled).toBe(true);
      expect(payload.semanticInjectedMemoryIds).toEqual(
        turn.memoryContext?.semanticInjectedMemoryIds,
      );
      expect(JSON.stringify(payload)).not.toContain(
        "Owner tracks stable semantic context expansion",
      );
    } finally {
      restoreEnv("RIN_SEMANTIC_CONTEXT", previousMode);
      restoreEnv("RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES", previousMaxCandidates);
      restoreEnv("RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS", previousMaxCharacters);
    }
  });

  it("maps a local model failure to a structured conversation error", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    let captured: unknown;

    try {
      await processOwnerMessage(
        storage.layout,
        {
          ownerId: defaultEnvironment.ownerId,
          content: "trigger a local model failure",
          now: new Date("2026-05-19T00:00:00.000Z"),
        },
        { resolveAdapter: async () => failingLocalAdapter() },
      );
    } catch (error) {
      captured = error;
    }

    expect(isConversationError(captured)).toBe(true);
    if (!isConversationError(captured)) {
      throw new Error("Expected a ConversationError.");
    }

    expect(captured.httpStatus).toBe(504);
    expect(captured.payload.code).toBe("LOCAL_MODEL_TIMEOUT");
    expect(captured.payload.modelAdapter).toBe("rin-ollama-local");
    expect(captured.payload.retryable).toBe(true);
    expect(captured.payload.recovery.length).toBeGreaterThan(0);
  });

  it("preserves the owner message and failed turn when model generation fails", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const turnId = "turn-failure-preserves-owner";

    await expect(
      processOwnerMessage(
        storage.layout,
        {
          ownerId: defaultEnvironment.ownerId,
          content: "this turn should not persist a reply",
          turnId,
          now: new Date("2026-05-19T00:00:00.000Z"),
        },
        { resolveAdapter: async () => failingLocalAdapter() },
      ),
    ).rejects.toMatchObject({ name: "ConversationError" });

    const inspected = inspectRinDatabase(storage.layout);
    expect(inspected.counts.conversations).toBe(1);
    expect(inspected.counts.conversationTurns).toBe(1);
    expect(inspected.counts.messages).toBe(1);
    expect(inspected.counts.messageMemoryContexts).toBe(0);

    const database = openRinDatabase(storage.layout);

    try {
      const turn = database
        .prepare(
          `
            SELECT *
            FROM conversation_turns
            WHERE id = ?
          `,
        )
        .get(turnId) as {
        conversation_id: string;
        owner_message_id: string;
        rin_message_id: string | null;
        status: string;
        attempt_count: number;
        error_code: string | null;
      };
      const messages = listConversationMessages(database, turn.conversation_id);
      const failureEvent = database
        .prepare(
          `
            SELECT event_type, payload_json
            FROM raw_events
            WHERE event_type = 'conversation.turn_failed'
            LIMIT 1
          `,
        )
        .get() as { event_type: string; payload_json: string } | undefined;

      expect(turn.status).toBe("failed");
      expect(turn.attempt_count).toBe(1);
      expect(turn.error_code).toBe("LOCAL_MODEL_TIMEOUT");
      expect(turn.rin_message_id).toBeNull();
      expect(messages).toHaveLength(1);
      expect(messages[0]?.id).toBe(turn.owner_message_id);
      expect(messages[0]?.role).toBe("owner");
      expect(messages[0]?.content).toBe("this turn should not persist a reply");
      expect(failureEvent?.event_type).toBe("conversation.turn_failed");
      expect(JSON.parse(failureEvent?.payload_json ?? "{}")).toMatchObject({
        turnId,
        errorCode: "LOCAL_MODEL_TIMEOUT",
        ownerMessageId: turn.owner_message_id,
      });
    } finally {
      database.close();
    }
  });

  it("retries a failed turn by reusing the owner message without duplicating it", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const turnId = "turn-retry-after-failure";
    const content = "retry this failed turn";

    await expect(
      processOwnerMessage(
        storage.layout,
        {
          ownerId: defaultEnvironment.ownerId,
          content,
          turnId,
          now: new Date("2026-05-19T00:00:00.000Z"),
        },
        { resolveAdapter: async () => failingLocalAdapter() },
      ),
    ).rejects.toMatchObject({ name: "ConversationError" });

    const successful = successfulCountingAdapter("retry succeeded");
    const turn = await processOwnerMessage(
      storage.layout,
      {
        ownerId: defaultEnvironment.ownerId,
        content,
        turnId,
        now: new Date("2026-05-19T00:01:00.000Z"),
      },
      { resolveAdapter: async () => successful.adapter },
    );
    const inspected = inspectRinDatabase(storage.layout);

    expect(successful.calls()).toBe(1);
    expect(turn.turn.status).toBe("completed");
    expect(turn.turn.attemptCount).toBe(2);
    expect(inspected.counts.conversationTurns).toBe(1);
    expect(inspected.counts.messages).toBe(2);

    const database = openRinDatabase(storage.layout);

    try {
      const messages = listConversationMessages(database, turn.conversation.id);

      expect(messages.map((message) => message.role)).toEqual(["owner", "rin"]);
      expect(messages[0]?.content).toBe(content);
      expect(messages[1]?.content).toBe("retry succeeded");
    } finally {
      database.close();
    }
  });

  it("returns an existing completed turn without appending a duplicate reply", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const turnId = "turn-idempotent-completed";
    const successful = successfulCountingAdapter("first persisted reply");

    const first = await processOwnerMessage(
      storage.layout,
      {
        ownerId: defaultEnvironment.ownerId,
        content: "dedupe this completed turn",
        turnId,
        now: new Date("2026-05-19T00:00:00.000Z"),
      },
      { resolveAdapter: async () => successful.adapter },
    );
    const second = await processOwnerMessage(
      storage.layout,
      {
        ownerId: defaultEnvironment.ownerId,
        content: "dedupe this completed turn",
        turnId,
        now: new Date("2026-05-19T00:01:00.000Z"),
      },
      {
        resolveAdapter: async () => {
          throw new Error("Adapter should not be called for completed turn.");
        },
      },
    );
    const inspected = inspectRinDatabase(storage.layout);

    expect(successful.calls()).toBe(1);
    expect(second.turn.id).toBe(first.turn.id);
    expect(second.rinMessage.id).toBe(first.rinMessage.id);
    expect(second.rinMessage.content).toBe("first persisted reply");
    expect(inspected.counts.conversationTurns).toBe(1);
    expect(inspected.counts.messages).toBe(2);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-conversation-"));
  tempRoots.push(root);
  return root;
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
