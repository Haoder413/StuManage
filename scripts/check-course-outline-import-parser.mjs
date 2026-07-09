import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync("src/app/courses/[id]/course-outline-editor.tsx", "utf8");

let parserSource = editor.match(/function parseOutlineText[\s\S]*?export function CourseOutlineEditor/)?.[0]
  ?.replace(/export function CourseOutlineEditor[\s\S]*/, "");
assert.ok(parserSource, "course outline parser source should be extractable");
parserSource = parserSource
  .replace("function parseOutlineText(text: string): ParsedOutlineItem[]", "function parseOutlineText(text)")
  .replace("const stack: { indent: number; tempId: string }[] = [];", "const stack = [];")
  .replace("const siblingCounts = new Map<string, number>();", "const siblingCounts = new Map();")
  .replace("const items: ParsedOutlineItem[] = [];", "const items = [];")
  .replace("function stripOutlineInvisibleChars(line: string)", "function stripOutlineInvisibleChars(line)")
  .replace("function normalizeOutlineIndent(indentText: string)", "function normalizeOutlineIndent(indentText)");

const parseOutlineText = new Function(`${parserSource}; return parseOutlineText;`)();

const pasted = [
  "第一章 丰富的图形世界\t",
  "\t旋转体  ",
  "",
  "\u200B\t\t表面积计算/体积计算",
  "\u200B\t展开图\t",
  "",
  "\u200B\t\t面积计算/体积计算",
  "第二章 有理数及其运算\t",
  "\u200B\t有理数的大小比较\t",
  "",
  "\u200B\t\t数轴，作差或者作商",
].join("\n");

const items = parseOutlineText(pasted);
const byName = new Map(items.map((item) => [item.name, item]));

assert.equal(byName.get("第一章 丰富的图形世界")?.parentTempId, null);
assert.equal(byName.get("旋转体")?.parentTempId, byName.get("第一章 丰富的图形世界")?.tempId);
assert.equal(byName.get("表面积计算/体积计算")?.parentTempId, byName.get("旋转体")?.tempId);
assert.equal(byName.get("展开图")?.parentTempId, byName.get("第一章 丰富的图形世界")?.tempId);
assert.equal(byName.get("面积计算/体积计算")?.parentTempId, byName.get("展开图")?.tempId);
assert.equal(byName.get("第二章 有理数及其运算")?.parentTempId, null);
assert.equal(byName.get("有理数的大小比较")?.parentTempId, byName.get("第二章 有理数及其运算")?.tempId);
assert.equal(byName.get("数轴，作差或者作商")?.parentTempId, byName.get("有理数的大小比较")?.tempId);

console.log("Course outline import parser handles pasted invisible characters.");
