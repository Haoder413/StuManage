import { isAbsolute, resolve } from "node:path";

export function resolveSqliteDatabasePath(databaseUrl: string, schemaDirectory: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("sqlite_database_url_required");
  }
  const filePath = databaseUrl.slice("file:".length);
  if (!filePath) throw new Error("sqlite_database_url_required");
  return isAbsolute(filePath) ? filePath : resolve(schemaDirectory, filePath);
}
