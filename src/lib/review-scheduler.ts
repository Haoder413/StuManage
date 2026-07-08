import { addDays } from "date-fns";

export const DEFAULT_REVIEW_INTERVAL_DAYS = 7;

export function getTodayReviewDate(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDefaultNextReviewDate(): Date {
  return addDays(getTodayReviewDate(), DEFAULT_REVIEW_INTERVAL_DAYS);
}

export function parseReviewDate(value: unknown, fallback = getDefaultNextReviewDate()): Date {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
}

export function isOverdue(date: Date): boolean {
  return date.getTime() < getTodayReviewDate().getTime();
}
