import { expect, test } from "@playwright/test";

const years = [2025, 2024, 2023].map((year) => ({
  year,
  stories: Array.from({ length: 5 }, (_, i) => ({
    id: year * 100 + i,
    title: `Real ${year} story ${i + 1}${year === 2024 && i === 2 ? ` ${"x".repeat(500)}` : ""}`,
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

test("revealed chapters and chart stay visible during navigation and interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".chapter")).toHaveCount(3);

  for (const year of [2025, 2024, 2023, 2025]) {
    const chapter = page.locator(`#y${year}`);
    await chapter.evaluate((element) => {
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top - 200,
        behavior: "instant",
      });
    });
    await expect(chapter).toHaveClass(/is-active/);
    await expect(chapter.locator(".lead")).toHaveCSS("opacity", "1");
  }

  const chart = page.locator("#chart");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toHaveCSS("opacity", "1");
  await chart.locator("svg").hover({ position: { x: 120, y: 100 } });
  await expect(chart).toHaveClass(/hover/);
  await expect(chart).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await expect(chart).toHaveCSS("opacity", "1");
});

test("a very tall chapter is revealed when only a small portion is visible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const chapter = page.locator("#y2025");
  await chapter.evaluate((element) => {
    element.style.minHeight = "20000px";
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 200, behavior: "instant" });
  });
  await expect(chapter.locator(".lead")).toHaveCSS("opacity", "1");
});

test("mobile layout and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".chapter")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "已暂停" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "前一天" }).click();
  await expect(page.locator(".st-date")).toContainText("11月11日");
  await expect(page.locator(".chapter")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "前一天" })).toBeVisible();
});

test("language follows the browser and toggles without changing stories", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/day?")) requests++;
  });
  await page.goto("/");
  await expect(page.locator(".chapter")).toHaveCount(3);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  const languageControl = page.getByRole("button", { name: "切换到英文" });
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await languageControl.focus();
  await expect(languageControl).toBeFocused();
  await expect(page.locator(".language")).toHaveCSS("outline-style", "solid");
  const controls = await page.evaluate(() => {
    const dimensions = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, radius: getComputedStyle(element).borderRadius };
    };
    return [dimensions(".language"), dimensions("button.theme:not(.language)")];
  });
  expect(controls[0]).toEqual(controls[1]);
  await expect(page.getByText("真实数据")).toHaveCount(0);
  const story = (await page.locator("#y2025 .lead-link").textContent()) ?? "";
  await page.getByRole("button", { name: "2024 年", exact: true }).click();
  await expect(page.locator(".m-title")).toContainText("Real 2024 story 1");
  await languageControl.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: /On this day/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Paused" })).toBeVisible();
  await expect(page.locator(".m-title")).toContainText("Real 2024 story 1");
  await expect(page.locator("#y2025 .lead-link")).toHaveText(story);
  expect(requests).toBe(1);
  const frame = await page.locator("header, main, footer, nav").allTextContents();
  expect(frame.join(" ")).not.toMatch(/[\u4e00-\u9fff]/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.evaluate(() => localStorage.removeItem("hntoday-language"));
  await page.reload();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", { value: ["en-US"], configurable: true });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("automatically shows English and fits narrow screens", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();
    await expect(page.locator(".st-date")).toContainText("Nov 12");
    await expect(page.locator("#y2025 .lead-link")).toHaveText("Real 2025 story 1");
    await expect(page).toHaveTitle("Nov 12 · Hacker News On This Day");
    for (const language of ["en", "zh"] as const) {
      if (language === "zh") await page.getByRole("button", { name: "Switch to Chinese" }).click();
      for (const width of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const layout = await page.evaluate(() => {
          const bounds = (selector: string) => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`Missing ${selector}`);
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, width: rect.width };
          };
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            brand: bounds(".brand"),
            stepper: bounds(".stepper"),
            controls: bounds(".nav-r"),
            month: bounds(".d-unit:nth-child(2)"),
            day: bounds(".d-unit:nth-child(4)"),
          };
        });
        expect(layout.overflow).toBe(false);
        expect(layout.stepper.left).toBeGreaterThanOrEqual(0);
        expect(layout.stepper.right).toBeLessThanOrEqual(layout.controls.left);
        if (layout.brand.width > 0) expect(layout.brand.right).toBeLessThanOrEqual(layout.stepper.left);
        expect(Math.abs(layout.month.top - layout.day.top)).toBeLessThan(3);
      }
    }
  });

  test("localizes missing-data errors", async ({ page }) => {
    await page.unrouteAll({ behavior: "wait" });
    let calls = 0;
    await page.route("**/api/day?*", async (route) => {
      calls++;
      if (calls === 1) await route.fulfill({ status: 503, json: { error: "Unavailable" } });
      else await route.fulfill({ json: { month: 11, day: 12, years, missingYears: [2011] } });
    });
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("The archive could not be loaded");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("status")).toContainText("Archive files are missing for 2011");
  });
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
