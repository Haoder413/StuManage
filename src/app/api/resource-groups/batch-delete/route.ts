import { NextRequest, NextResponse } from "next/server";
import { requireTeacherLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getManageableResourceGroupWhere } from "@/lib/resource-group-access";
import { removeStoredResourceFile } from "@/lib/resource-storage";

export async function POST(request: NextRequest) {
  const user = await requireTeacherLike();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ids = (payload as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (ids.length > 200) return NextResponse.json({ error: "too_many" }, { status: 400 });

  // 只删除当前用户有权管理的资料组，其余 id 会被 where 过滤掉，不会越权删除。
  const groups = await prisma.resourceGroup.findMany({
    where: { id: { in: ids }, ...getManageableResourceGroupWhere(user) },
    include: { files: true },
  });
  if (groups.length === 0) return NextResponse.json({ deleted: 0, ids: [] });

  await Promise.all(
    groups.flatMap((group) =>
      group.files.map((file) => removeStoredResourceFile(file.storedName).catch(() => undefined)),
    ),
  );
  await prisma.resourceGroup.deleteMany({
    where: { id: { in: groups.map((group) => group.id) } },
  });

  return NextResponse.json({ deleted: groups.length, ids: groups.map((group) => group.id) });
}
