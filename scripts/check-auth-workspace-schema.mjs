import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");

const requiredSnippets = [
  "model Workspace",
  "model User",
  "model Session",
  "model ParentStudent",
  "workspaceId      String   @default(\"default-real\")",
  "workspace Workspace @relation(fields: [workspaceId], references: [id])",
  "parent   User    @relation(fields: [parentId], references: [id], onDelete: Cascade)",
  "@@unique([parentId, studentId])",
];

const workspaceModels = [
  "Student",
  "Course",
  "StudentCourse",
  "Exam",
  "KnowledgePoint",
  "StudentKpProgress",
  "WeakPoint",
  "ReviewSchedule",
  "Schedule",
  "Attendance",
  "CommunicationLog",
  "WeakPointTag",
  "LessonTag",
];

const missing = requiredSnippets.filter((snippet) => !schema.includes(snippet));

for (const model of workspaceModels) {
  const modelStart = schema.indexOf(`model ${model} {`);
  const nextModel = schema.indexOf("\nmodel ", modelStart + 1);
  const body = schema.slice(modelStart, nextModel === -1 ? undefined : nextModel);
  if (modelStart === -1 || !body.includes("workspaceId")) {
    missing.push(`${model}.workspaceId`);
  }
}

if (missing.length > 0) {
  console.error(`Missing auth/workspace schema snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Auth and workspace schema shape is present.");
