import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");

const patterns = [
  /teachingSubject\s+String\?/,
  /model LearningLink/,
  /parentId\s+String/,
  /teacherId\s+String/,
  /subject\s+String/,
  /learningLinkId\s+String\?/,
  /reviewStatus\s+String/,
  /submittedById\s+String\?/,
  /reviewedById\s+String\?/,
  /reviewedAt\s+DateTime\?/,
  /rejectionReason\s+String\?/,
  /resourceKind\s+String/,
  /subject\s+String\?/,
  /learningLinksAsParent\s+LearningLink\[\]\s+@relation\("ParentLearningLinks"\)/,
  /learningLinksAsTeacher\s+LearningLink\[\]\s+@relation\("TeacherLearningLinks"\)/,
];

const missing = patterns
  .filter((pattern) => !pattern.test(schema))
  .map((pattern) => pattern.toString());

if (missing.length > 0) {
  console.error(`Missing learning-link schema snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Learning-link schema shape is present.");
