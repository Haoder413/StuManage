import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");

const requiredSnippets = [
  "lessonContent String?",
  "lessonFeedback String?",
  "contentTags String?",
  "feedbackTags String?",
  "model LessonTag",
  "workspaceId String",
  "type      String",
  "@@unique([workspaceId, name, type])",
];

const missing = requiredSnippets.filter((snippet) => !schema.includes(snippet));

if (missing.length > 0) {
  console.error(`Missing lesson review schema snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Lesson review schema shape is present.");
