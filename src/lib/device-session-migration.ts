import { prisma } from "@/lib/prisma";

export const DEVICE_SESSION_MIGRATION_KEY = "device-session-v1";

export type DeviceSessionMigrationResult = {
  clearedSessions: number;
  alreadyApplied: boolean;
};

export type DeviceSessionMigrationTransaction = {
  findMigration(key: string): Promise<boolean>;
  clearSessions(): Promise<number>;
  createMigration(key: string): Promise<void>;
};

export type DeviceSessionMigrationDatabase = {
  findMigration(key: string): Promise<boolean>;
  transaction<T>(work: (tx: DeviceSessionMigrationTransaction) => Promise<T>): Promise<T>;
};

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function isSQLiteBusyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const message = "message" in error ? String(error.message) : "";
  return code === "P1008" || code === "P2034" || /SQLITE_BUSY|database is locked/i.test(message);
}

type DeviceSessionMigrationOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function createPrismaDeviceSessionMigrationDatabase(
  client: typeof prisma,
): DeviceSessionMigrationDatabase {
  return {
    async findMigration(key) {
      return Boolean(await client.systemMigration.findUnique({ where: { key }, select: { key: true } }));
    },
    transaction(work) {
      return client.$transaction(async (transaction) =>
        work({
          async findMigration(key) {
            return Boolean(
              await transaction.systemMigration.findUnique({ where: { key }, select: { key: true } }),
            );
          },
          async clearSessions() {
            return (await transaction.session.deleteMany({})).count;
          },
          async createMigration(key) {
            await transaction.systemMigration.create({ data: { key } });
          },
        }),
      );
    },
  };
}

export async function migrateDeviceSessions(
  database: DeviceSessionMigrationDatabase = createPrismaDeviceSessionMigrationDatabase(prisma),
  options: DeviceSessionMigrationOptions = {},
): Promise<DeviceSessionMigrationResult> {
  const maxAttempts = Math.min(5, Math.max(1, options.maxAttempts ?? 3));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 100);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (await database.findMigration(DEVICE_SESSION_MIGRATION_KEY)) {
        return { clearedSessions: 0, alreadyApplied: true };
      }
      return await database.transaction(async (transaction) => {
        if (await transaction.findMigration(DEVICE_SESSION_MIGRATION_KEY)) {
          return { clearedSessions: 0, alreadyApplied: true };
        }

        const clearedSessions = await transaction.clearSessions();
        await transaction.createMigration(DEVICE_SESSION_MIGRATION_KEY);
        return { clearedSessions, alreadyApplied: false };
      });
    } catch (error) {
      // The failed transaction has rolled back before this marker check. A concurrent winner
      // therefore becomes a no-op without retaining this attempt's session deletion.
      const concurrencyError = isUniqueConstraintError(error) || isSQLiteBusyError(error);
      if (!concurrencyError) throw error;

      let markerReadSucceeded = false;
      let markerApplied = false;
      let retryError = error;
      try {
        markerApplied = await database.findMigration(DEVICE_SESSION_MIGRATION_KEY);
        markerReadSucceeded = true;
      } catch (markerError) {
        if (!isSQLiteBusyError(markerError)) throw markerError;
        retryError = markerError;
      }
      if (markerApplied) {
        return { clearedSessions: 0, alreadyApplied: true };
      }
      if (isUniqueConstraintError(error) && markerReadSucceeded) throw error;
      if (attempt === maxAttempts) throw retryError;

      // Re-entering the loop always checks the marker again before another delete transaction.
      await wait(retryDelayMs);
    }
  }

  throw new Error("device_session_migration_attempts_exhausted");
}
