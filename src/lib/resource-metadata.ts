type GradeGroup = {
  canonical: string;
  aliases: string[];
};

const RESOURCE_GRADE_GROUPS: GradeGroup[] = [
  { canonical: "小一", aliases: ["小一", "一年级", "1年级", "小学一年级"] },
  { canonical: "小二", aliases: ["小二", "二年级", "2年级", "小学二年级"] },
  { canonical: "小三", aliases: ["小三", "三年级", "3年级", "小学三年级"] },
  { canonical: "小四", aliases: ["小四", "四年级", "4年级", "小学四年级"] },
  { canonical: "小五", aliases: ["小五", "五年级", "5年级", "小学五年级"] },
  { canonical: "小六", aliases: ["小六", "六年级", "6年级", "小学六年级"] },
  { canonical: "初一", aliases: ["初一", "七年级", "7年级", "初中一年级"] },
  { canonical: "初二", aliases: ["初二", "八年级", "8年级", "初中二年级"] },
  { canonical: "初三", aliases: ["初三", "九年级", "9年级", "初中三年级"] },
  { canonical: "高一", aliases: ["高一", "高中一年级"] },
  { canonical: "高二", aliases: ["高二", "高中二年级"] },
  { canonical: "高三", aliases: ["高三", "高中三年级"] },
];

function gradeGroupFor(value: string) {
  return RESOURCE_GRADE_GROUPS.find((group) => group.aliases.includes(value));
}

export function normalizeResourceGrade(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return gradeGroupFor(normalized)?.canonical ?? normalized;
}

export function resourceGradeAliases(value: string) {
  const normalized = value.trim();
  if (!normalized) return [];
  const group = gradeGroupFor(normalized);
  return group ? [...group.aliases] : [normalized];
}

export function resourceGradeSearchTerms(value: string) {
  return resourceGradeAliases(value).map((alias) => ({
    alias,
    mode: /^(?:[一二三四五六]|[1-6])年级$/.test(alias) ? "startsWith" as const : "contains" as const,
  }));
}

export function extractResourceYear(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const matches = value.matchAll(/(^|[^\d])((?:19\d{2}|20\d{2}|2100))(?!\d)/g);
    for (const match of matches) {
      const year = Number(match[2]);
      if (year >= 1900 && year <= 2100) return year;
    }
  }
  return null;
}
