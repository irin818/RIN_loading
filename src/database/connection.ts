import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type { RinDataLayout } from "../storage";
import { RIN_DATABASE_FILENAME } from "./schema";

export type RinDatabase = DatabaseSync;

export function databasePathFor(layout: RinDataLayout): string {
  return join(layout.directories.databases, RIN_DATABASE_FILENAME);
}

export function openRinDatabase(layout: RinDataLayout): RinDatabase {
  const database = new DatabaseSync(databasePathFor(layout));
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  return database;
}
