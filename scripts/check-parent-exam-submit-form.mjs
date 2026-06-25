import { readFileSync } from "node:fs";

const source = readFileSync("src/components/parent-exam-submission-form.tsx", "utf8");
const missing = [];

for (const snippet of [
  "const formElement = event.currentTarget",
  "const form = new FormData(formElement)",
  "formElement.reset()",
]) {
  if (!source.includes(snippet)) missing.push(snippet);
}

if (source.includes("event.currentTarget.reset()")) {
  missing.push("should not reset through event.currentTarget after async work");
}

if (missing.length > 0) {
  console.error(`Parent exam submit form checks failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Parent exam submit form is safe after async submit.");
