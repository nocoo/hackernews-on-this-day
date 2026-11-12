import type { CalendarDay, DayArchive } from "../model";

export async function fetchArchive(date: CalendarDay, signal: AbortSignal): Promise<DayArchive> {
  const query = new URLSearchParams({ month: String(date.month), day: String(date.day) });
  const response = await fetch(`/api/day?${query}`, { signal });
  if (!response.ok) throw new Error("Archive unavailable");
  return response.json() as Promise<DayArchive>;
}
