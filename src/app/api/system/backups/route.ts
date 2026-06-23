import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createDatabaseBackup, listDatabaseBackups } from "@/lib/database-backups";

export async function GET() {
  await requireAdmin();
  const backups = await listDatabaseBackups();
  return NextResponse.json(backups);
}

export async function POST() {
  await requireAdmin();
  const backups = await createDatabaseBackup();
  return NextResponse.json(backups, { status: 201 });
}
