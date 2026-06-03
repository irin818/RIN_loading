import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  formatHybridRetrievalReport,
  listMemoryItems,
  recordSemanticTrace,
  runHybridRetrievalReport,
  semanticTraceFromHybridRetrievalReport,
} from "../memory";
import { createDataLayout } from "../storage";

const args = process.argv.slice(2);
const optIn =
  args.includes("--allow-hybrid-retrieval-report") ||
  process.env.RIN_HYBRID_RETRIEVAL_REPORT === "report-only";
const recordTrace =
  args.includes("--record-semantic-trace") ||
  process.env.RIN_SEMANTIC_TRACE === "record";
const queryText =
  readArgumentValue(args, "--query") ?? process.env.RIN_HYBRID_RETRIEVAL_QUERY;

try {
  const report = await runHybridRetrievalReport({
    optIn,
    queryText,
    loadMemories: optIn ? loadAcceptedMemories : undefined,
  });

  console.log(formatHybridRetrievalReport(report));

  if (recordTrace) {
    console.log(`Trace ID: ${recordTraceForReport(report)}`);
  }
} catch {
  console.log("RIN hybrid retrieval candidate report.");
  console.log("Status: invalid_request");
  console.log("Error code: HYBRID_RETRIEVAL_UNAVAILABLE");
  console.log("Message: Unable to load accepted memories for report-only hybrid retrieval.");
  process.exitCode = 1;
}

function loadAcceptedMemories() {
  const environment = loadEnvironment();
  const layout = createDataLayout(environment.dataDir);
  const database = openRinDatabase(layout);

  try {
    return listMemoryItems(database, { status: "accepted", limit: 100 });
  } finally {
    database.close();
  }
}

function recordTraceForReport(
  report: Awaited<ReturnType<typeof runHybridRetrievalReport>>,
): string {
  const environment = loadEnvironment();
  const layout = createDataLayout(environment.dataDir);
  const database = openRinDatabase(layout);

  try {
    return recordSemanticTrace(database, {
      trace: semanticTraceFromHybridRetrievalReport(report),
    });
  } finally {
    database.close();
  }
}

function readArgumentValue(args: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));

  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
