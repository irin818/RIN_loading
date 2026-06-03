import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { formatSemanticTraceList, listSemanticTraceRecords } from "../memory";
import { createDataLayout } from "../storage";

const args = process.argv.slice(2);
const limit = readPositiveInteger(readArgumentValue(args, "--limit"));
const environment = loadEnvironment();
const layout = createDataLayout(environment.dataDir);
const database = openRinDatabase(layout);

try {
  const records = listSemanticTraceRecords(database, { limit });
  console.log(formatSemanticTraceList(records));
} finally {
  database.close();
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

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
