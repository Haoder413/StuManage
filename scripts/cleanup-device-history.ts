import { cleanupOldDeviceHistory } from "../src/lib/device-session";
import { prisma } from "../src/lib/prisma";

async function main() {
  const deletedCount = await cleanupOldDeviceHistory();
  console.log(`Deleted ${deletedCount} old inactive login device record(s).`);
}

void main()
  .catch((error) => {
    console.error("Device history cleanup failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
