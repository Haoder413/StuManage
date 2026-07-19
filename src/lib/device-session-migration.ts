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
): Promise<DeviceSessionMigrationResult> {
  try {
    return await database.transaction(async (transaction) => {
      if (await transaction.findMigration(DEVICE_SESSION_MIGRATION_KEY)) {
        return { clearedSessions: 0, alreadyApplied: true };
      }

      const clearedSessions = await transaction.clearSessions();
      await transaction.createMigration(DEVICE_SESSION_MIGRATION_KEY);
      return { clearedSessions, alreadyApplied: false };
    });
  } catch (error) {
    // Concurrent first deployments can both observe a missing marker. The unique-key loser
    // rolls back its whole transaction (including deleteMany), then safely reports a no-op.
    if (
      isUniqueConstraintError(error) &&
      (await database.findMigration(DEVICE_SESSION_MIGRATION_KEY))
    ) {
      return { clearedSessions: 0, alreadyApplied: true };
    }
    throw error;
  }
}
