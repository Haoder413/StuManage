import { readFileSync } from "node:fs";

const files = {
  "src/lib/password.ts": [
    "export function hashPassword",
    "export function verifyPassword",
    "pbkdf2Sync",
  ],
  "src/lib/auth.ts": [
    "SESSION_COOKIE",
    "export async function getCurrentUser",
    "export async function requireCurrentUser",
    "export async function requireTeacherLike",
    "export async function requireParent",
    "workspaceId",
  ],
  "src/lib/workspace.ts": [
    "export function workspaceWhere",
    "export function workspaceData",
    "export function assertSameWorkspace",
  ],
};

const missing = [];

for (const [file, snippets] of Object.entries(files)) {
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    missing.push(file);
    continue;
  }
  for (const snippet of snippets) {
    if (!text.includes(snippet)) missing.push(`${file}: ${snippet}`);
  }
}

if (missing.length > 0) {
  console.error(`Missing auth/workspace files: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Auth and workspace helper files are present.");
