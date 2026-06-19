import { addDays } from "date-fns";

export const REVIEW_INTERVALS = [1, 3, 7, 15, 30, 60];

export function getNextReviewDate(stage: number): Date {
  const index = Math.min(stage - 1, REVIEW_INTERVALS.length - 1);
  return addDays(new Date(), REVIEW_INTERVALS[index]);
}

export function isOverdue(date: Date): boolean {
  return new Date() > date;
}

export function getStageLabel(stage: number): string {
  const labels = ["第1次: 1天后", "第2次: 3天后", "第3次: 7天后", "第4次: 15天后", "第5次: 30天后", "第6次: 60天后"];
  return labels[Math.min(stage - 1, labels.length - 1)];
}
