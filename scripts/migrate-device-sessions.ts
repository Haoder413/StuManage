import { loadEnvFile } from "../src/lib/env-file";

async function main() {
  loadEnvFile(".env");
  const [{ migrateDeviceSessions }, { prisma }] = await Promise.all([
    import("../src/lib/device-session-migration"),
    import("../src/lib/prisma"),
  ]);
  try {
    const result = await migrateDeviceSessions();
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("Device session migration failed.", error);
  process.exitCode = 1;
});
