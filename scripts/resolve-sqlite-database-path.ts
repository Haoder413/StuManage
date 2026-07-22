import { resolve } from "node:path";
import { loadEnvFile } from "../src/lib/env-file";
import { resolveSqliteDatabasePath } from "../src/lib/sqlite-database-path";

loadEnvFile(".env");
console.log(resolveSqliteDatabasePath(process.env.DATABASE_URL || "", resolve("prisma")));
