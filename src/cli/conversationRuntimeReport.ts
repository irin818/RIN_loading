import { loadEnvironment } from "../config/loadEnvironment";
import {
  buildConversationRuntimeReport,
  formatConversationRuntimeReport,
} from "../conversation/runtimeReport";
import { initializeRinStorage } from "../storage";

const environment = loadEnvironment();
const storage = await initializeRinStorage(environment);
const report = buildConversationRuntimeReport(storage.layout);

console.log(formatConversationRuntimeReport(report));
