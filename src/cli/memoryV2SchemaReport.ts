import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  buildMemoryV2SchemaReport,
  formatMemoryV2SchemaReport,
} from "../memory";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatMemoryV2SchemaReport(buildMemoryV2SchemaReport(database)));
} finally {
  database.close();
}
