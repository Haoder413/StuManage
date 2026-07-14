import path from "node:path";

export type ResourceFileRole = "student" | "answer" | "supplement";
export type ResourceKind = "paper" | "animation" | "material";

export type ResourceFileSuggestion = {
  originalName: string;
  role: ResourceFileRole;
};

export type ResourceGroupSuggestion = {
  groupKey: string;
  title: string;
  grade: string | null;
  subject: string | null;
  resourceKind: ResourceKind;
  tags: string[];
  confidence: number;
  needsConfirmation: boolean;
  reason: string;
  files: ResourceFileSuggestion[];
};

export type ResourceAnalysisResult = {
  source: "local" | "deepseek";
  groups: ResourceGroupSuggestion[];
};

const grades = ["小一", "小二", "小三", "小四", "小五", "小六", "初一", "初二", "初三", "高一", "高二", "高三"];
const subjects = ["数学", "语文", "英语", "物理", "化学", "生物", "历史", "地理", "政治", "科学"];
const tagCandidates = [
  "一次函数", "二次函数", "反比例函数", "函数", "几何", "代数", "方程", "不等式",
  "概率", "统计", "期中", "期末", "月考", "中考", "高考", "竞赛", "专题", "复习",
];

function withoutExtension(fileName: string) {
  const extension = path.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function fileRole(fileName: string): ResourceFileRole {
  if (/(学生版|无答案|空白卷|答题版)/i.test(fileName)) return "student";
  if (/(含答案|答案|解析|教师版)/i.test(fileName)) return "answer";
  return "supplement";
}

function cleanTitle(fileName: string) {
  return withoutExtension(fileName)
    .replace(/[（(【[]?(学生版|无答案|空白卷|答题版|含答案|教师版|答案|解析)[）)】\]]?/gi, "")
    .replace(/[_—–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groupKey(fileName: string) {
  return cleanTitle(fileName).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function firstMatch(value: string, options: string[]) {
  return options.find((option) => value.includes(option)) || null;
}

function inferKind(fileName: string): ResourceKind {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".html" || extension === ".htm" || /动画/.test(fileName)) return "animation";
  if (/(试卷|真题|练习|习题|测试|测验|月考|期中|期末|中考|高考)/.test(fileName)) return "paper";
  return "material";
}

function inferTags(fileName: string) {
  return tagCandidates.filter((tag) => fileName.includes(tag)).slice(0, 5);
}

function singleSuggestion(fileName: string): ResourceGroupSuggestion {
  const role = fileRole(fileName);
  const grade = firstMatch(fileName, grades);
  const subject = firstMatch(fileName, subjects);
  const resourceKind = inferKind(fileName);
  const uncertain = role === "supplement" && !grade && !subject;
  return {
    groupKey: groupKey(fileName) || withoutExtension(fileName),
    title: cleanTitle(fileName) || withoutExtension(fileName),
    grade,
    subject,
    resourceKind,
    tags: inferTags(fileName),
    confidence: uncertain ? 0.45 : 0.75,
    needsConfirmation: uncertain,
    reason: uncertain ? "文件名信息较少，已保持为独立资料" : "已根据文件名提取资料信息",
    files: [{ originalName: fileName, role }],
  };
}

export function analyzeResourceFileNames(fileNames: string[]): ResourceAnalysisResult {
  const suggestions = fileNames.map(singleSuggestion);
  const buckets = new Map<string, ResourceGroupSuggestion[]>();
  for (const suggestion of suggestions) {
    const bucket = buckets.get(suggestion.groupKey) || [];
    bucket.push(suggestion);
    buckets.set(suggestion.groupKey, bucket);
  }

  const used = new Set<string>();
  const groups: ResourceGroupSuggestion[] = [];
  for (const suggestion of suggestions) {
    if (used.has(suggestion.files[0].originalName)) continue;
    const bucket = buckets.get(suggestion.groupKey) || [suggestion];
    const roles = new Set(bucket.map((item) => item.files[0].role));
    const canPair = bucket.length === 2 && roles.has("student") && roles.has("answer") && suggestion.groupKey.length >= 4;
    if (!canPair) {
      groups.push(suggestion);
      used.add(suggestion.files[0].originalName);
      continue;
    }

    const ordered = [...bucket].sort((left, right) => left.files[0].role === "student" ? -1 : right.files[0].role === "student" ? 1 : 0);
    ordered.forEach((item) => used.add(item.files[0].originalName));
    const primary = ordered[0];
    groups.push({
      ...primary,
      confidence: 0.96,
      needsConfirmation: false,
      reason: "学生版与答案版名称主体完全一致",
      files: ordered.flatMap((item) => item.files),
      tags: Array.from(new Set(ordered.flatMap((item) => item.tags))).slice(0, 5),
    });
  }

  return { source: "local", groups };
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function validateAnalysisResult(value: unknown, expectedFileNames: string[]): ResourceAnalysisResult | null {
  if (!value || typeof value !== "object") return null;
  const sourceValue = (value as { source?: unknown }).source;
  const groupsValue = (value as { groups?: unknown }).groups;
  if ((sourceValue !== undefined && sourceValue !== "deepseek" && sourceValue !== "local") || !Array.isArray(groupsValue) || groupsValue.length === 0) return null;

  const validRoles = new Set<ResourceFileRole>(["student", "answer", "supplement"]);
  const validKinds = new Set<ResourceKind>(["paper", "animation", "material"]);
  const seenNames: string[] = [];
  const groups: ResourceGroupSuggestion[] = [];

  for (const raw of groupsValue) {
    if (!raw || typeof raw !== "object") return null;
    const group = raw as Record<string, unknown>;
    if (
      typeof group.groupKey !== "string" || !group.groupKey.trim() || group.groupKey.trim().length > 100 ||
      typeof group.title !== "string" || !group.title.trim() || group.title.trim().length > 200 ||
      !isStringOrNull(group.grade) || !isStringOrNull(group.subject) ||
      (typeof group.grade === "string" && group.grade.length > 30) ||
      (typeof group.subject === "string" && group.subject.length > 30) ||
      !validKinds.has(group.resourceKind as ResourceKind) ||
      !Array.isArray(group.tags) || !group.tags.every((tag) => typeof tag === "string" && tag.length <= 30) ||
      typeof group.confidence !== "number" || group.confidence < 0 || group.confidence > 1 ||
      typeof group.needsConfirmation !== "boolean" || typeof group.reason !== "string" || group.reason.length > 200 ||
      !Array.isArray(group.files) || group.files.length === 0
    ) return null;

    const files: ResourceFileSuggestion[] = [];
    for (const rawFile of group.files) {
      if (!rawFile || typeof rawFile !== "object") return null;
      const file = rawFile as Record<string, unknown>;
      if (!validRoles.has(file.role as ResourceFileRole)) return null;
      let originalName: string;
      if (file.fileIndex !== undefined) {
        if (!Number.isInteger(file.fileIndex) || (file.fileIndex as number) < 0 || (file.fileIndex as number) >= expectedFileNames.length) return null;
        originalName = expectedFileNames[file.fileIndex as number];
      } else {
        if (typeof file.originalName !== "string" || file.originalName.length > 255) return null;
        originalName = file.originalName;
      }
      seenNames.push(originalName);
      files.push({ originalName, role: file.role as ResourceFileRole });
    }
    groups.push({
      groupKey: group.groupKey.trim(),
      title: group.title.trim(),
      grade: group.grade,
      subject: group.subject,
      resourceKind: group.resourceKind as ResourceKind,
      tags: Array.from(new Set((group.tags as string[]).map((tag) => tag.trim()).filter(Boolean))).slice(0, 5),
      confidence: group.confidence,
      needsConfirmation: group.needsConfirmation,
      reason: group.reason,
      files,
    });
  }

  const expected = [...expectedFileNames].sort();
  const actual = [...seenNames].sort();
  if (expected.length !== actual.length || expected.some((name, index) => name !== actual[index])) return null;
  return { source: sourceValue === "local" ? "local" : "deepseek", groups };
}
