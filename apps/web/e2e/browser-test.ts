import { test as base, expect } from "@playwright/test";
import {
  observePageProblems,
  type PageProblems,
} from "../../../packages/template-kit/src/page-problems.ts";

/** Browser errors are test failures, including native error events absent from pageerror. */
export const test = base.extend<{ browserProblems: PageProblems }>({
  browserProblems: [
    async ({ page }, use) => {
      const problems = observePageProblems(page);
      const errors: string[] = [];
      await page.exposeFunction("jeevesReportBrowserError", (message: string) =>
        errors.push(message),
      );
      await page.addInitScript(() => {
        window.addEventListener("error", (event) => {
          const report = (
            window as unknown as { jeevesReportBrowserError(message: string): Promise<void> }
          ).jeevesReportBrowserError;
          void report(event.message);
        });
      });
      try {
        await use(problems);
        expect(errors).toEqual([]);
        problems.assert("Editor browser journey");
      } finally {
        problems.stop();
      }
    },
    { auto: true },
  ],
});
export { expect };
