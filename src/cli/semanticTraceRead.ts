import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { formatSemanticTraceRecord, getSemanticTraceRecord } from "../memory";
import { createDataLayout } from "../storage";

const args = process.argv.slice(2);
const traceId = readArgumentValue(args, "--id") ?? process.env.RIN_SEMANTIC_TRACE_ID;

if (!traceId) {
  console.log("RIN semantic trace record.");
  console.log("Status: missing_id");
  console.log("Full text included: no");
  console.log("Vector included: no");
} else {
  const environment = loadEnvironment();
  const layout = createDataLayout(environment.dataDir);
  const database = openRinDatabase(layout);

  try {
    const record = getSemanticTraceRecord(database, traceId);
    console.log(formatSemanticTraceRecord(record));
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
