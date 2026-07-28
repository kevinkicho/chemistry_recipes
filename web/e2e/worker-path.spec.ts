import { test, expect } from "@playwright/test";

/**
 * Smoke worker path: home → live scout entry → (optional live CID when server up).
 * Full densify/AI is environment-dependent; this guards routing + chrome.
 */
test.describe("worker path scaffold", () => {
  test("home shows live vs training split and problem search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Live · plant scout/i)).toBeVisible();
    await expect(page.getByText(/Training · demos only/i)).toBeVisible();
    await expect(page.getByText(/Problem \/ unit-op search/i)).toBeVisible();
  });

  test("compare page has MSAT board", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByText(/MSAT route-pick board/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Compare recipes/i })).toBeVisible();
  });

  test("search page loads", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("body")).toContainText(/search|PubChem|CID/i);
  });
});
