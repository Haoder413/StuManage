import { readFileSync } from "node:fs";

const schedulePage = readFileSync("src/app/schedule/page.tsx", "utf8");

const requiredSnippets = [
  'DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"',
  'className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-background pt-3"',
];

const missing = requiredSnippets.filter((snippet) => !schedulePage.includes(snippet));

if (missing.length > 0) {
  console.error(`Missing lesson review dialog scroll snippets: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Lesson review dialog scroll behavior is present.");
