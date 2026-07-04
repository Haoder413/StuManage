import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const workspaceArg = process.argv.find((arg) => arg.startsWith("--workspace="));
const workspaceId = workspaceArg ? workspaceArg.slice("--workspace=".length) : "";

function formatLocalCalendarDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTags(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function lessonKey(record) {
  return [
    record.workspaceId,
    record.studentId,
    formatLocalCalendarDate(record.date),
    record.status,
    record.schedule?.course?.name || record.learningLink?.course?.name || "",
    record.learningLink?.teacher?.id || "",
    record.learningLink?.subject || record.learningLink?.teacher?.teachingSubject || "",
  ].join(":");
}

function recordScore(record) {
  return (
    (record.lessonVideo ? 1000 : 0) +
    (record.learningLinkId ? 100 : 0) +
    (record.lessonContent ? 20 : 0) +
    (record.lessonFeedback ? 20 : 0) +
    parseTags(record.contentTags).length +
    parseTags(record.feedbackTags).length +
    parseTags(record.weakPointTags).length +
    record.createdAt.getTime() / 100000000000000
  );
}

function chooseKeeper(records) {
  return [...records].sort((a, b) => recordScore(b) - recordScore(a))[0];
}

async function reassignRelatedRows(tx, keeper, duplicateIds) {
  const duplicateWithVideo = await tx.attendance.findFirst({
    where: { id: { in: duplicateIds }, lessonVideo: { isNot: null } },
    include: { lessonVideo: true },
    orderBy: { createdAt: "desc" },
  });

  if (!keeper.lessonVideo && duplicateWithVideo?.lessonVideo) {
    await tx.lessonVideo.update({
      where: { id: duplicateWithVideo.lessonVideo.id },
      data: {
        attendanceId: keeper.id,
        learningLinkId: keeper.learningLinkId,
        scheduleId: keeper.scheduleId,
      },
    });
  }

  await tx.lessonHourLog.updateMany({
    where: { attendanceId: { in: duplicateIds } },
    data: { attendanceId: keeper.id },
  });
}

async function main() {
  const records = await prisma.attendance.findMany({
    where: workspaceId ? { workspaceId } : {},
    include: {
      lessonVideo: true,
      schedule: { include: { course: true } },
      learningLink: {
        include: {
          teacher: { select: { id: true, name: true, teachingSubject: true } },
          course: true,
        },
      },
      student: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const groups = new Map();
  for (const record of records) {
    const key = lessonKey(record);
    groups.set(key, [...(groups.get(key) || []), record]);
  }

  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  if (duplicateGroups.length === 0) {
    console.log("No duplicate attendance records found.");
    return;
  }

  let deleteCount = 0;
  console.log(`${apply ? "Applying" : "Dry run"} duplicate attendance cleanup.`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);

  for (const group of duplicateGroups) {
    const keeper = chooseKeeper(group);
    const duplicates = group.filter((record) => record.id !== keeper.id);
    deleteCount += duplicates.length;
    const sample = group[0];
    console.log("");
    console.log([
      formatLocalCalendarDate(sample.date),
      sample.student?.name || sample.studentId,
      sample.schedule?.course?.name || sample.learningLink?.course?.name || "课堂",
      sample.learningLink?.teacher?.name || "老师",
      sample.status,
    ].join(" | "));
    console.log(`  keep: ${keeper.id}`);
    console.log(`  delete: ${duplicates.map((record) => record.id).join(", ")}`);

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      await reassignRelatedRows(tx, keeper, duplicates.map((record) => record.id));
      await tx.attendance.deleteMany({
        where: { id: { in: duplicates.map((record) => record.id) } },
      });
    });
  }

  console.log("");
  console.log(apply
    ? `Deleted ${deleteCount} duplicate attendance records.`
    : `Would delete ${deleteCount} duplicate attendance records. Re-run with --apply to delete.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
