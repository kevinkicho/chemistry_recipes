import { test, expect } from "@playwright/test";

/**
 * Smoke worker path: home live densify entry + problem search.
 * Full densify/AI is environment-dependent; this guards routing + chrome.
 */
test.describe("worker path scaffold", () => {
  test("home shows live densify entry and problem search", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Live densify \+ AI dual-view/i)).toBeVisible();
    await expect(page.getByText(/Problem \/ unit-op search/i)).toBeVisible();
    await expect(page.getByText(/MSAT journey/i).first()).toBeVisible();
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

  test("workspace is campaign-first", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page.getByText(/MSAT primary path/i)).toBeVisible();
  });

  test("diagnostics has cold-CID floors", async ({ page }) => {
    await page.goto("/diagnostics");
    await expect(page.getByText(/Cold-CID densify floors/i)).toBeVisible();
  });
});
