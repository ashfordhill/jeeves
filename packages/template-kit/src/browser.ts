import { type Browser, chromium, type Page } from "@playwright/test";

// Browser checks for test packs (Playwright's Chromium). Separate from the main entry, like the
// harness, so templates' generate code doesn't load Playwright.

export interface PageProblems {
  /** `console.error` messages and failed resource loads, as the console reports them. */
  console: string[];
  /** Uncaught exceptions and unhandled rejections. */
  errors: string[];
}

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
    const problems: PageProblems = { console: [], errors: [] };
    page.on("console", (message) => {
      if (message.type() === "error") problems.console.push(message.text());
    });
    page.on("pageerror", (error) => problems.errors.push(error.message));
    return await fn(page, problems);
  } finally {
    await browser.close();
  }
}

/** Throws listing every console error and page error, or does nothing when there were none. */
export function assertNoPageProblems(problems: PageProblems, where: string): void {
  const all = [
    ...problems.errors.map((e) => `uncaught: ${e}`),
    ...problems.console.map((c) => `console.error: ${c}`),
  ];
  if (all.length > 0) throw new Error(`${where} logged errors:\n${all.join("\n")}`);
}
