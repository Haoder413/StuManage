const LESSON_HOUR_DECIMAL_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;

export function roundLessonHours(value: number) {
  if (!Number.isFinite(value)) return value;
  const adjustment = Math.sign(value) * Number.EPSILON;
  return Math.round((value + adjustment) * 100) / 100;
}

export function parseLessonHours(
  value: unknown,
  options: { allowNegative?: boolean; allowZero?: boolean } = {}
) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const rawValue = String(value).trim();
  if (!rawValue || !LESSON_HOUR_DECIMAL_PATTERN.test(rawValue)) return null;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return null;
  const normalized = roundLessonHours(parsed);
  if (!options.allowNegative && normalized < 0) return null;
  if (options.allowZero === false && normalized === 0) return null;
  return normalized;
}
