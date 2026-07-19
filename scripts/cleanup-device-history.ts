import { loadEnvFile } from "../src/lib/env-file";

async function main() {
  loadEnvFile(".env");
  const [{ cleanupOldDeviceHistory }, { prisma }] = await Promise.all([
    import("../src/lib/device-session"),
    import("../src/lib/prisma"),
  ]);
  try {
    const deletedCount = await cleanupOldDeviceHistory();
    console.log(`Deleted ${deletedCount} old inactive login device record(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

void main()
  .catch((error) => {
    console.error("Device history cleanup failed.", error);
    process.exitCode = 1;
  });
