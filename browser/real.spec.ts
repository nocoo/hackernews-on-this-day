import { expect, test } from "@playwright/test";
import packageInfo from "../package.json" with { type: "json" };

test("browses a real isolated Parquet archive through the production API", async ({ page }) => {
  const currentYear = new Date().getUTCFullYear();
  const year = currentYear - 1;
  await page.clock.setFixedTime(new Date(Date.UTC(currentYear, 10, 12, 12)));
  const response = page.waitForResponse((value) => value.url().includes("/api/day?month=11&day=12"));
  await page.goto("/");
  expect((await response).status()).toBe(200);
  await expect(page.locator(".chapter")).toHaveCount(15);
  await expect(page.locator(".brand-t .version")).toHaveText(`v${packageInfo.version}`);
  await expect(page.locator(`#y${year} .lead-link`)).toHaveText(`Synthetic story ${year}`);
  await expect(page.locator(`#y${year} .lead-link`)).toHaveAttribute(
    "href",
    `https://news.ycombinator.com/item?id=${year * 100 + 1}`,
  );
  await page.getByRole("button", { name: "前一天" }).click();
  await expect(page.locator(".st-date")).toContainText("11月11日");
  await expect(page.locator(`#y${year} .lead-link`)).toHaveText(`Previous day ${year}`);
  await page.getByRole("button", { name: "当前中文，切换到英文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(`#y${year} .lead-link`)).toHaveText(`Previous day ${year}`);
});
