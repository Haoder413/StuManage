import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const workspaceArg = process.argv.find((arg) => arg.startsWith("--workspace="));
const workspaceId = workspaceArg ? workspaceArg.slice("--workspace=".length) : "";

function normalizeDescription(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function groupKey(point) {
  return [point.workspaceId, point.studentId, normalizeDescription(point.description)].join("::");
}

function pointScore(point) {
  return (
    (point.status === "active" ? 100000 : 0) +
    (point.learningLinkId ? 1000 : 0) +
    point.reviewSchedules.length * 10 +
    point.createdAt.getTime() / 1000000000000
  );
}

function chooseKeeper(points) {
  return [...points].sort((a, b) => pointScore(b) - pointScore(a))[0];
}

async function mergeGroup(tx, keeper, duplicates) {
  const duplicateIds = duplicates.map((point) => point.id);
  const hasActive = [keeper, ...duplicates].some((point) => point.status === "active");
  const masteredDates = [keeper, ...duplicates]
    .map((point) => point.masteredAt)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());
  const learningLinkId = keeper.learningLinkId || duplicates.find((point) => point.learningLinkId)?.learningLinkId || null;

  await tx.reviewSchedule.updateMany({
    where: { weakPointId: { in: duplicateIds } },
    data: { weakPointId: keeper.id },
  });

  await tx.weakPoint.update({
    where: { id: keeper.id },
    data: {
      description: normalizeDescription(keeper.description),
      learningLinkId,
      status: hasActive ? "active" : "mastered",
      masteredAt: hasActive ? null : masteredDates[0] || keeper.masteredAt,
    },
  });

  await tx.weakPoint.deleteMany({
    where: { id: { in: duplicateIds } },
  });
}

async function main() {
  const weakPoints = await prisma.weakPoint.findMany({
    where: workspaceId ? { workspaceId } : {},
    include: {
      student: { select: { name: true } },
      reviewSchedules: true,
    },
    orderBy: [{ studentId: "asc" }, { createdAt: "desc" }],
  });

  const groups = new Map();
  for (const point of weakPoints) {
    const key = groupKey(point);
    groups.set(key, [...(groups.get(key) || []), point]);
  }

  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  if (duplicateGroups.length === 0) {
    console.log("No duplicate weak points found.");
    return;
  }

  let deleteCount = 0;
  console.log(`${apply ? "Applying" : "Dry run"} duplicate weak point cleanup.`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);

  for (const group of duplicateGroups) {
    const keeper = chooseKeeper(group);
    const duplicates = group.filter((point) => point.id !== keeper.id);
    deleteCount += duplicates.length;

    console.log("");
    console.log(`${group[0].student?.name || group[0].studentId} | ${normalizeDescription(group[0].description)}`);
    console.log(`  keep: ${keeper.id}`);
    console.log(`  merge/delete: ${duplicates.map((point) => point.id).join(", ")}`);

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      await mergeGroup(tx, keeper, duplicates);
    });
  }

  console.log("");
  console.log(apply
    ? `Merged ${deleteCount} duplicate weak points.`
    : `Would merge ${deleteCount} duplicate weak points. Re-run with --apply to update the database.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
