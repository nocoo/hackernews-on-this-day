import { expect, test } from "@playwright/test";

const years = [2025, 2024, 2023].map((year) => ({
  year,
  stories: Array.from({ length: 5 }, (_, i) => ({
    id: year * 100 + i,
    title: `Real ${year} story ${i + 1}`,
    author: `author${i}`,
    score: 1000 - i,
    comments: 100 - i,
    url: `https://example.com/${year}/${i}`,
  })),
}));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.route("**/api/day?*", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      json: {
        month: Number(url.searchParams.get("month")),
        day: Number(url.searchParams.get("day")),
        years,
        missingYears: [],
      },
    });
  });
});

test("shows archive, real links and working navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /历史上的今天/ })).toBeVisible();
  await expect(page.locator(".chapter")).toHaveCount(3);
  await expect(page.locator("#y2025 .lead-link")).toHaveAttribute(
    "href",
    "https://news.ycombinator.com/item?id=202500",
  );
  await expect(page.locator("#y2025 .source-link")).toHaveAttribute("href", "https://example.com/2025/0");
  await page.getByRole("button", { name: "前一天" }).click();
  await expect(page.locator(".st-date")).toContainText("11月11日");
  await expect(page.locator(".chapter")).toHaveCount(3);
  await page.getByTitle("回到今天").click();
  await expect(page.locator(".st-date")).toContainText("11月12日");
  await page.getByRole("button", { name: "切换明暗主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "2024 年", exact: true }).click();
  await expect(page.locator(".m-title")).toContainText("Real 2024 story 1");
  await expect(page.getByRole("button", { name: "2024 年", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "2024 年", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".m-title")).toContainText("Real 2025 story 1");
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", /2024 年/);
  expect(errors).toEqual([]);
});

test("mobile layout and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".chapter")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "已暂停" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "前一天" })).toBeVisible();
});

test("explains unavailable data and permits retry", async ({ page }) => {
  let calls = 0;
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/day?*", async (route) => {
    calls++;
    if (calls === 1) await route.fulfill({ status: 503, json: { error: "Unavailable" } });
    else await route.fulfill({ json: { month: 11, day: 12, years, missingYears: [2011] } });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("暂时无法读取历史数据");
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("status")).toContainText("部分年份的数据文件缺失：2011");
  await expect(page.locator(".chapter")).toHaveCount(3);
});
