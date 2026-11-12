import type { CalendarDay } from "./model.ts";

export function validDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

export function todayUtc(now = new Date()): CalendarDay {
  return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

export function shiftDay(date: CalendarDay, offset: number): CalendarDay {
  const shifted = new Date(Date.UTC(2024, date.month - 1, date.day + offset));
  return { month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function dateLabel(date: CalendarDay): string {
  return `${date.month}月${date.day}日`;
}

export function dayOfYear(date: CalendarDay, year: number): number {
  return Math.round((Date.UTC(year, date.month - 1, date.day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
}

export function calendarYear(date: CalendarDay, currentYear: number): number {
  return date.month === 2 && date.day === 29 && new Date(Date.UTC(currentYear, 1, 29)).getUTCMonth() !== 1
    ? 2024
    : currentYear;
}
