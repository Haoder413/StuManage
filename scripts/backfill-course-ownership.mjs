import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const workspaceArg = process.argv.find((arg) => arg.startsWith("--workspace="));
const courseArg = process.argv.find((arg) => arg.startsWith("--course="));
const workspaceId = workspaceArg ? workspaceArg.slice("--workspace=".length).trim() : "";
const courseId = courseArg ? courseArg.slice("--course=".length).trim() : "";

function addCandidate(candidateTeacherIds, teacherId) {
  if (teacherId) candidateTeacherIds.add(teacherId);
}

function inferCourseOwner(course) {
  const candidateTeacherIds = new Set();

  for (const link of course.learningLinks) {
    addCandidate(candidateTeacherIds, link.teacherId);
  }

  for (const enrollment of course.studentCourses) {
    addCandidate(candidateTeacherIds, enrollment.student.createdById);
    for (const link of enrollment.student.learningLinks) {
      addCandidate(candidateTeacherIds, link.teacherId);
    }
  }

  return candidateTeacherIds;
}

async function main() {
  const courses = await prisma.course.findMany({
    where: {
      createdById: null,
      ...(workspaceId ? { workspaceId } : {}),
      ...(courseId ? { id: courseId } : {}),
    },
    include: {
      learningLinks: {
        where: { isActive: true },
        select: { teacherId: true },
      },
      studentCourses: {
        include: {
          student: {
            select: {
              name: true,
              createdById: true,
              learningLinks: {
                where: { isActive: true },
                select: { teacherId: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ workspaceId: "asc" }, { createdAt: "asc" }],
  });

  if (courses.length === 0) {
    console.log("No ownerless courses found.");
    return;
  }

  const workspaceIds = [...new Set(courses.map((course) => course.workspaceId))];
  const teachers = await prisma.user.findMany({
    where: { workspaceId: { in: workspaceIds }, role: "teacher" },
    select: { id: true, name: true, workspaceId: true },
  });
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const teacherIdsByWorkspace = new Map();
  for (const teacher of teachers) {
    teacherIdsByWorkspace.set(teacher.workspaceId, [
      ...(teacherIdsByWorkspace.get(teacher.workspaceId) || []),
      teacher.id,
    ]);
  }

  let assignableCount = 0;
  let skippedCount = 0;

  console.log(`${apply ? "Applying" : "Dry run"} course ownership backfill.`);
  console.log(`Ownerless courses: ${courses.length}`);

  for (const course of courses) {
    const candidateTeacherIds = inferCourseOwner(course);
    for (const teacherId of [...candidateTeacherIds]) {
      const teacher = teacherById.get(teacherId);
      if (!teacher || teacher.workspaceId !== course.workspaceId) candidateTeacherIds.delete(teacherId);
    }
    const workspaceTeacherIds = teacherIdsByWorkspace.get(course.workspaceId) || [];
    if (candidateTeacherIds.size === 0 && workspaceTeacherIds.length === 1) {
      candidateTeacherIds.add(workspaceTeacherIds[0]);
    }

    if (candidateTeacherIds.size !== 1) {
      skippedCount += 1;
      const candidates = [...candidateTeacherIds].map((id) => teacherById.get(id)?.name || id).join(", ") || "none";
      console.log(`SKIP | ${course.name} (${course.id}) | candidates: ${candidates}`);
      continue;
    }

    const [teacherId] = candidateTeacherIds;
    const teacher = teacherById.get(teacherId);
    assignableCount += 1;
    console.log(`ASSIGN | ${course.name} (${course.id}) | ${teacher?.name || teacherId}`);

    if (apply) {
      await prisma.course.update({
        where: { id: course.id },
        data: { createdById: teacherId },
      });
    }
  }

  console.log("");
  console.log(apply
    ? `Assigned ${assignableCount} courses; skipped ${skippedCount}.`
    : `Would assign ${assignableCount} courses; would skip ${skippedCount}. Re-run with --apply to update the database.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
