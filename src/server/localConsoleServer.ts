import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { exportAgentStateBundle } from "../bundle";
import {
  conversationErrorResponse,
  getConversation,
  isConversationError,
  listConversationMessages,
  listRecentConversations,
  processOwnerMessage,
} from "../conversation";
import { openRinDatabase } from "../database";
import {
  listMemoryItems,
  reviewMemoryProposal,
  type MemoryReviewDecision,
  type MemoryStatus,
} from "../memory";
import { initializeRinStorage } from "../storage";
import { loadEnvironment } from "../config/loadEnvironment";
import { readLocalConsoleSnapshot } from "./localConsoleSnapshot";
import { executeRegisteredTool, registerBuiltinTools } from "../tools";

const host = "127.0.0.1";
const port = Number(process.env.RIN_CONSOLE_PORT ?? 4173);
const distDir = join(fileURLToPath(new URL("../../dist", import.meta.url)));

await initializeRinStorage(loadEnvironment());

const server = createServer(async (request, response) => {
  try {
    await routeRequest(request, response);
  } catch (error) {
    if (isConversationError(error)) {
      const { status, body } = conversationErrorResponse(error);
      writeJson(response, status, body);
      return;
    }

    writeJson(response, 500, {
      ok: false,
      english: "Local console server error.",
      chinese: "本地 Console 服务错误。",
      detail: error instanceof Error ? error.message : "unknown error",
    });
  }
});

server.listen(port, host, () => {
  console.log(`RIN Console: http://${host}:${port}`);
  console.log(`RIN Console 地址：http://${host}:${port}`);
});

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (url.pathname === "/api/health") {
    if (!isReadRequest(request)) {
      writeMethodNotAllowed(response);
      return;
    }

    writeJson(response, 200, {
      ok: true,
      english: "RIN local console runtime is running.",
      chinese: "RIN 本地 Console runtime 正在运行。",
    }, request.method === "HEAD");
    return;
  }

  if (url.pathname === "/api/local-state") {
    if (!isReadRequest(request)) {
      writeMethodNotAllowed(response);
      return;
    }

    writeJson(response, 200, await readLocalConsoleSnapshot(), request.method === "HEAD");
    return;
  }

  if (url.pathname === "/api/conversations") {
    if (isReadRequest(request)) {
      const storage = await initializeRinStorage(loadEnvironment());

      writeJson(
        response,
        200,
        {
          ok: true,
          conversations: listRecentConversations(storage.layout, 20),
          snapshot: await readLocalConsoleSnapshot(),
        },
        request.method === "HEAD",
      );
      return;
    }

    if (request.method !== "POST") {
      writeMethodNotAllowed(response);
      return;
    }

    const environment = loadEnvironment();
    const storage = await initializeRinStorage(environment);
    const body = await readJsonBody(request);
    const content = typeof body.content === "string" ? body.content : "";
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : undefined;
    const turn = await processOwnerMessage(storage.layout, {
      ownerId: environment.ownerId,
      content,
      conversationId,
    });

    writeJson(response, 200, {
      ok: true,
      turn,
      snapshot: await readLocalConsoleSnapshot(),
    });
    return;
  }

  if (url.pathname.startsWith("/api/conversations/")) {
    if (!isReadRequest(request)) {
      writeMethodNotAllowed(response);
      return;
    }

    const conversationId = decodeURIComponent(
      url.pathname.slice("/api/conversations/".length),
    );
    const storage = await initializeRinStorage(loadEnvironment());
    const database = openRinDatabase(storage.layout);

    try {
      writeJson(
        response,
        200,
        {
          ok: true,
          conversation: getConversation(database, conversationId),
          messages: listConversationMessages(database, conversationId),
          snapshot: await readLocalConsoleSnapshot(),
        },
        request.method === "HEAD",
      );
    } finally {
      database.close();
    }
    return;
  }

  if (url.pathname === "/api/export-bundle") {
    if (request.method !== "POST") {
      writeMethodNotAllowed(response);
      return;
    }

    const storage = await initializeRinStorage(loadEnvironment());
    const bundle = await exportAgentStateBundle(storage.layout);

    writeJson(response, 200, {
      ok: true,
      bundle,
      snapshot: await readLocalConsoleSnapshot(),
    });
    return;
  }

  if (url.pathname === "/api/memory") {
    if (!isReadRequest(request)) {
      writeMethodNotAllowed(response);
      return;
    }

    const status = readMemoryStatus(url.searchParams.get("status"));
    const storage = await initializeRinStorage(loadEnvironment());
    const database = openRinDatabase(storage.layout);

    try {
      writeJson(
        response,
        200,
        {
          ok: true,
          items: listMemoryItems(database, { status, limit: 50 }),
          snapshot: await readLocalConsoleSnapshot(),
        },
        request.method === "HEAD",
      );
    } finally {
      database.close();
    }
    return;
  }

  if (url.pathname.startsWith("/api/memory/") && url.pathname.endsWith("/review")) {
    if (request.method !== "POST") {
      writeMethodNotAllowed(response);
      return;
    }

    const memoryItemId = decodeURIComponent(
      url.pathname.slice("/api/memory/".length, -"/review".length),
    );
    const body = await readJsonBody(request);
    const decision = readMemoryReviewDecision(body.decision);

    if (!decision) {
      writeJson(response, 400, {
        ok: false,
        english: "Memory review decision must be accept, reject, or archive.",
        chinese: "记忆审查决定必须是 accept、reject 或 archive。",
      });
      return;
    }

    const storage = await initializeRinStorage(loadEnvironment());
    const database = openRinDatabase(storage.layout);
    let item: ReturnType<typeof reviewMemoryProposal> | null = null;

    try {
      database.exec("BEGIN;");
      item = reviewMemoryProposal(database, {
        memoryItemId,
        decision,
        reason: typeof body.reason === "string" ? body.reason : null,
        now: new Date(),
      });
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    } finally {
      database.close();
    }

    if (!item) {
      throw new Error("Memory review did not produce an item.");
    }

    writeJson(response, 200, {
      ok: true,
      item,
      snapshot: await readLocalConsoleSnapshot(),
    });
    return;
  }

  if (url.pathname.startsWith("/api/tools/")) {
    if (request.method !== "POST") {
      writeMethodNotAllowed(response);
      return;
    }

    registerBuiltinTools();
    const toolId = decodeURIComponent(url.pathname.slice("/api/tools/".length));
    const storage = await initializeRinStorage(loadEnvironment());
    const body = await readJsonBody(request);
    const database = openRinDatabase(storage.layout);

    try {
      const result = await executeRegisteredTool(database, toolId, body.input ?? {});
      writeJson(response, 200, {
        ok: true,
        result,
        snapshot: await readLocalConsoleSnapshot(),
      });
    } finally {
      database.close();
    }
    return;
  }

  if (!isReadRequest(request)) {
    writeMethodNotAllowed(response);
    return;
  }

  await serveStaticFile(url.pathname, response, request.method === "HEAD");
}

function readMemoryStatus(value: string | null): MemoryStatus | undefined {
  return value === "proposal" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "archived"
    ? value
    : undefined;
}

function readMemoryReviewDecision(value: unknown): MemoryReviewDecision | null {
  return value === "accept" || value === "reject" || value === "archive"
    ? value
    : null;
}

function isReadRequest(request: IncomingMessage): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

function writeMethodNotAllowed(response: ServerResponse): void {
  writeJson(response, 405, {
    ok: false,
    english: "This local runtime route does not support that method.",
    chinese: "当前本地 runtime 路由不支持该请求方法。",
  });
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > 16_384) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

async function serveStaticFile(
  pathname: string,
  response: ServerResponse,
  headOnly: boolean,
): Promise<void> {
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const relativePath = normalizedPath === "/" ? "index.html" : normalizedPath.slice(1);
  const requestedPath = join(distDir, relativePath);
  const fallbackPath = join(distDir, "index.html");
  const filePath = (await fileExists(requestedPath)) ? requestedPath : fallbackPath;

  response.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Cache-Control": "no-cache",
  });
  if (headOnly) {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headOnly: boolean = false,
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  if (headOnly) {
    response.end();
    return;
  }
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function contentTypeFor(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".html":
    default:
      return "text/html; charset=utf-8";
  }
}
