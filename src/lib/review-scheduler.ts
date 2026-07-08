export function getTodayReviewDate(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isOverdue(date: Date): boolean {
  return date.getTime() < getTodayReviewDate().getTime();
}
