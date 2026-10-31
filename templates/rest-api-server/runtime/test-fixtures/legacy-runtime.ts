/** Load the preserved compiled release offline, with only installed dependencies. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { resourceServer } from "../src/resources.ts";

export async function legacyRuntime() {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-legacy-runtime-"));
  try {
    execFileSync("tar", [
      "-xzf",
      fileURLToPath(
        new URL(
          "../../../../artifacts/rest-server/0.2.0/jeeves-rest-server-0.2.0.tgz",
          import.meta.url,
        ),
      ),
      "-C",
      dir,
    ]);
    symlinkSync(
      fileURLToPath(new URL("../node_modules", import.meta.url)),
      join(dir, "node_modules"),
      "dir",
    );
    const runtime = (await import(pathToFileURL(join(dir, "package/dist/index.js")).href)) as {
      resourceServer: typeof resourceServer;
    };
    return { ...runtime, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}
