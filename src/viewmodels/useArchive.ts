import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchArchive } from "../api/archive";
import { shiftDay, todayUtc } from "../calendar";
import type { CalendarDay, DayArchive } from "../model";

export function useArchive() {
  const [date, setDate] = useState<CalendarDay>(() => todayUtc());
  const [archive, setArchive] = useState<DayArchive | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => todayUtc());

  useEffect(() => {
    const timer = setInterval(() => setToday(todayUtc()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchArchive(date, controller.signal)
      .then(setArchive)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Archive unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date]);

  const shift = useCallback((offset: number) => setDate((current) => shiftDay(current, offset)), []);
  const random = useCallback(
    () => setDate(shiftDay({ month: 1, day: 1 }, Math.floor(Math.random() * 366))),
    [],
  );
  const refresh = useCallback(() => setDate((current) => ({ ...current })), []);
  const years = useMemo(() => archive?.years ?? [], [archive]);
  const isToday = date.month === today.month && date.day === today.day;
  return { date, setDate, today, isToday, years, archive, error, loading, shift, random, refresh };
}
