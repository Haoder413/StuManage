import { prisma } from "../src/lib/prisma";
import { migrateLegacyResources } from "../src/lib/resource-migration";

async function main() {
  const result = await migrateLegacyResources(prisma);
  console.log(JSON.stringify({
    legacyResources: result.legacyCount,
    createdGroups: result.createdGroups,
    createdFiles: result.createdFiles,
    copiedCoursePermissions: result.copiedCoursePermissions,
    copiedUserPermissions: result.copiedUserPermissions,
    backfilledYears: result.backfilledYears,
    missingFiles: result.missingFiles,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
