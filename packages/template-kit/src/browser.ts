import { type Browser, chromium, type Page } from "@playwright/test";
import { observePageProblems, type PageProblems } from "./page-problems.ts";

export { assertNoPageProblems, observePageProblems, type PageProblems } from "./page-problems.ts";

// Browser checks for test packs (Playwright's Chromium). Separate from the main entry, like the
// harness, so templates' generate code doesn't load Playwright.

/**
 * Opens a fresh page in headless Chromium, runs `fn`, and closes everything. Console errors and
 * page errors are collected from the start, so `fn` can assert there were none.
 */
export async function withPage<T>(
  fn: (page: Page, problems: PageProblems) => Promise<T>,
): Promise<T> {
  const browser: Browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const problems = observePageProblems(page);
    return await fn(page, problems);
  } finally {
    await browser.close();
  }
}
