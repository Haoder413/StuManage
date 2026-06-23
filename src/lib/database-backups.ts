import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export const KEEP_BACKUPS = 15;

export type DatabaseBackup = {
  fileName: string;
  size: number;
  modifiedAt: string;
};

function getAppRoot() {
  return process.env.APP_ROOT || process.cwd();
}

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (databaseUrl.startsWith("file:")) {
    const rawPath = databaseUrl.slice("file:".length);
    return path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  }
  return path.join(getAppRoot(), "shared", "dev.db");
}

function getBackupDir() {
  return process.env.BACKUP_DIR || path.join(getAppRoot(), "backups");
}

function backupFileName(date = new Date()) {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return `dev-${stamp}.db`;
}

async function readBackupEntries() {
  const backupDir = getBackupDir();
  await mkdir(backupDir, { recursive: true });
  const names = await readdir(backupDir);
  const backups = await Promise.all(
    names
      .filter((name) => /^dev-.*\.db$/.test(name))
      .map(async (fileName) => {
        const filePath = path.join(backupDir, fileName);
        const info = await stat(filePath);
        return {
          fileName,
          filePath,
          size: info.size,
          modifiedAt: info.mtime,
        };
      })
  );
  return backups.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

export async function cleanupOldBackups() {
  const backups = await readBackupEntries();
  const oldBackups = backups.slice(KEEP_BACKUPS);
  await Promise.all(oldBackups.map((backup) => rm(backup.filePath, { force: true })));
}

export async function listDatabaseBackups(): Promise<DatabaseBackup[]> {
  const backups = await readBackupEntries();
  return backups.slice(0, KEEP_BACKUPS).map((backup) => ({
    fileName: backup.fileName,
    size: backup.size,
    modifiedAt: backup.modifiedAt.toISOString(),
  }));
}

export async function createDatabaseBackup() {
  const dbPath = getDatabasePath();
  const backupDir = getBackupDir();
  await mkdir(backupDir, { recursive: true });
  const targetPath = path.join(backupDir, backupFileName());
  await copyFile(dbPath, targetPath);
  await cleanupOldBackups();
  return listDatabaseBackups();
}
