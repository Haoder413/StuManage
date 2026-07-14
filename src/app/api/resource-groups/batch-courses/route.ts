import { NextRequest, NextResponse } from "next/server";
import { requireTeacherLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManageableResourceGroupWhere } from "@/lib/resource-group-access";
import { parseBatchCourseChange } from "@/lib/resource-group-input";
import { visibleCourseWhere } from "@/lib/teacher-visibility";

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  try {
    const change = parseBatchCourseChange(await request.json());
    const groups = await prisma.resourceGroup.findMany({
      where: { id: { in: change.groupIds }, ...getManageableResourceGroupWhere(user) },
      select: { id: true, workspaceId: true },
    });
    if (groups.length !== change.groupIds.length) throw new Error("invalid_group_ids");
    const workspaceIds = Array.from(new Set(groups.map((group) => group.workspaceId)));
    if (workspaceIds.length !== 1) throw new Error("mixed_workspaces");
    const workspaceId = workspaceIds[0];
    const requestedCourseIds = Array.from(new Set([...change.addCourseIds, ...change.removeCourseIds]));
    const courses = await prisma.course.findMany({
      where: user.role === "admin"
        ? { id: { in: requestedCourseIds }, workspaceId }
        : { id: { in: requestedCourseIds }, workspaceId, ...visibleCourseWhere(user) },
      select: { id: true },
    });
    if (courses.length !== requestedCourseIds.length) throw new Error("invalid_course_ids");

    await prisma.$transaction(async (tx) => {
      if (change.removeCourseIds.length > 0) {
        await tx.resourceGroupCoursePermission.deleteMany({
          where: { groupId: { in: change.groupIds }, courseId: { in: change.removeCourseIds } },
        });
      }
      for (const groupId of change.groupIds) {
        for (const courseId of change.addCourseIds) {
          await tx.resourceGroupCoursePermission.upsert({
            where: { groupId_courseId: { groupId, courseId } },
            update: {},
            create: { workspaceId, groupId, courseId },
          });
        }
      }
    });
    return NextResponse.json({ updatedGroupIds: change.groupIds });
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_course_change";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
