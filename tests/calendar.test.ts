import { describe, expect, it } from "vitest";
import { calendarYear, dateLabel, dayOfYear, shiftDay, todayUtc, validDay } from "../src/calendar";
import { browserLanguage, messages } from "../src/i18n";

describe("calendar", () => {
  it("rejects invalid dates and permits leap day", () => {
    for (const [month, day] of [
      [1.5, 1],
      [1, 1.5],
      [0, 1],
      [13, 1],
      [1, 0],
      [2, 30],
    ]) {
      expect(validDay(month, day)).toBe(false);
    }
    expect(validDay(2, 29)).toBe(true);
    expect(validDay(12, 31)).toBe(true);
  });

  it("uses UTC, crosses year boundaries and formats both languages", () => {
    expect(todayUtc(new Date("2026-01-01T00:01:00Z"))).toEqual({ month: 1, day: 1 });
    expect(todayUtc().month).toBeGreaterThanOrEqual(1);
    expect(shiftDay({ month: 2, day: 28 }, 1)).toEqual({ month: 2, day: 29 });
    expect(shiftDay({ month: 1, day: 1 }, -1)).toEqual({ month: 12, day: 31 });
    expect(shiftDay({ month: 12, day: 31 }, 1)).toEqual({ month: 1, day: 1 });
    expect(dateLabel({ month: 11, day: 12 }, "zh")).toBe("11月12日");
    expect(dateLabel({ month: 11, day: 12 }, "en")).toBe("Nov 12");
    expect(dayOfYear({ month: 11, day: 12 }, 2026)).toBe(316);
    expect(calendarYear({ month: 2, day: 29 }, 2026)).toBe(2024);
    expect(calendarYear({ month: 2, day: 29 }, 2028)).toBe(2028);
    expect(calendarYear({ month: 11, day: 12 }, 2026)).toBe(2026);
  });
});

describe("language", () => {
  it("uses the first supported browser language and falls back to English", () => {
    expect(browserLanguage(["zh-Hant", "en-US"])).toBe("zh");
    expect(browserLanguage(["fr-FR", "en-US", "zh-CN"])).toBe("en");
    expect(browserLanguage(["fr-FR", "zh-CN"])).toBe("zh");
    expect(browserLanguage([])).toBe("en");
  });

  it("formats dynamic interface messages in both languages", () => {
    for (const text of [messages.zh, messages.en]) {
      expect(text.missingYears([2024, 2025])).toContain("2024");
      expect(text.yearSpan(1, "2025")).toContain("2025");
      expect(text.yearSpan(2, "2024–2025")).toContain("2024");
      expect(text.collected(5)).toContain("5");
      expect(text.footerNext("Nov 12")).toContain("Nov 12");
      expect(text.jumpYear(2025)).toContain("2025");
      expect(text.year(2025)).toContain("2025");
      expect(text.yearsAgo(1)).toContain("1");
      expect(text.yearsAgo(2)).toContain("2");
      expect(text.points(1)).toBeTruthy();
      expect(text.points(2)).toBeTruthy();
      expect(text.comments(1)).toBeTruthy();
      expect(text.comments(2)).toBeTruthy();
      expect(text.topStories(5)).toContain("5");
      expect(text.chartValue(2025, 1)).toContain("2025");
      expect(text.chartValue(2025, 2)).toContain("2");
      expect(text.leadingScore("200")).toContain("200");
    }
    expect(messages.en.points(1)).toBe("point");
    expect(messages.en.points(2)).toBe("points");
    expect(messages.en.comments(1)).toBe("comment");
    expect(messages.en.comments(2)).toBe("comments");
  });
});
