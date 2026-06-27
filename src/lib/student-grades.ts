export const STUDENT_GRADE_OPTIONS = ["初一", "初二", "初三"] as const;

type InitialStudentGrade = (typeof STUDENT_GRADE_OPTIONS)[number];

export function formatGraduatedGrade(year: number) {
  return `${year}初中已毕业`;
}

export function isGraduatedGrade(grade: string | null | undefined) {
  return /^\d{4}初中已毕业$/.test(grade || "");
}

export function normalizeStudentGrade(grade: unknown) {
  if (typeof grade !== "string") return null;
  const value = grade.trim();
  if (!value) return null;
  if ((STUDENT_GRADE_OPTIONS as readonly string[]).includes(value)) return value;
  if (isGraduatedGrade(value)) return value;
  return null;
}

export function nextStudentGrade(grade: string | null | undefined, year: number) {
  const value = normalizeStudentGrade(grade);
  if (value === "初一") return "初二";
  if (value === "初二") return "初三";
  if (value === "初三") return formatGraduatedGrade(year);
  return value;
}

function getChinaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function isRolloverDate(date: Date) {
  const { month, day } = getChinaDateParts(date);
  return month === 9 && day >= 1;
}

export async function rolloverStudentGradesForWorkspace(
  db: {
    $transaction: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  },
  workspaceId: string,
  now = new Date()
) {
  const { year } = getChinaDateParts(now);
  if (!isRolloverDate(now)) return false;

  return db.$transaction(async (tx) => {
    const claimed = await tx.workspace.updateMany({
      where: {
        id: workspaceId,
        gradeRolloverYear: { lt: year },
      },
      data: { gradeRolloverYear: year },
    });

    if (claimed.count === 0) return false;

    const graduatingGrade = formatGraduatedGrade(year);
    const gradeUpdates: Array<[InitialStudentGrade, string]> = [
      ["初三", graduatingGrade],
      ["初二", "初三"],
      ["初一", "初二"],
    ];

    for (const [fromGrade, toGrade] of gradeUpdates) {
      await tx.student.updateMany({
        where: { workspaceId, grade: fromGrade },
        data: { grade: toGrade },
      });
    }

    return true;
  });
}
