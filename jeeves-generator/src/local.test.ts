import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleExperimental,
  exportNewDirectory,
  loadYoutubeLocalInput,
  localV1Templates,
  sha256,
  templateIds,
} from "./index.ts";

describe("real local templates", () => {
  it("emits deterministic independent scaffolding with exact provenance and honest gaps", () => {
    const input = loadYoutubeLocalInput();
    const first = assembleExperimental(input, localV1Templates);
    const second = assembleExperimental(input, localV1Templates);
    expect(first.files.map((file) => [file.path, sha256(file.bytes)])).toEqual(
      second.files.map((file) => [file.path, sha256(file.bytes)]),
    );
    expect(first.manifest.templates.map((template) => template.id)).toEqual(
      [...templateIds].sort(),
    );
    expect(
      first.report.mappings.every(
        (mapping) => mapping.availability === "experimental-template-installed",
      ),
    ).toBe(true);
    expect(
      first.report.settings.filter((setting) => setting.status === "unsupported"),
    ).toHaveLength(25);
    expect(first.report.settings.filter((setting) => setting.status === "unimplemented")).toEqual(
      [],
    );
    expect(first.report.runtimeVerification).toBe("none");
    expect(first.report.strictReadiness.generationEligible).toBe(false);
    expect(first.report.extensionTasks).toHaveLength(7);
    expect(first.manifest.diagram.included).toBe(true);
    const text = (path: string) =>
      new TextDecoder().decode(first.files.find((file) => file.path === path)?.bytes);
    expect(text("pnpm-lock.yaml")).not.toMatch(/workspace:|\/home\/ash/u);
    expect(text("package.json")).not.toContain("workspace:");
    const compose = JSON.parse(text("compose.yaml"));
    expect(compose.services.transcoder.command).toContain("dist/workers/transcoder.js");
    for (const id of ["upload", "transcoder"]) {
      expect(JSON.stringify(compose.services[id].secrets)).not.toMatch(/metadata|counts/u);
    }
    expect(compose.services["completion-handler"].secrets).toContain("metadata_owner");
    expect(compose.services["view-counter"].secrets).toContain("counts_owner");
    expect(text("src/extensions/transcoder-encoder.ts")).toContain("throw new Unimplemented");
    expect(text("src/lib/amqp.ts")).toContain("prefetch(concurrency, false)");
    expect(text("src/lib/jwt.ts")).toContain('requiredClaims: ["exp", "sub"]');
    expect(
      first.manifest.files.filter((file) => file.ownership === "generated-extension"),
    ).toHaveLength(7);
    for (const record of first.manifest.files) {
      const bytes = first.files.find((file) => file.path === record.path)?.bytes;
      expect(bytes && sha256(bytes)).toBe(record.sha256);
    }
  });

  it("creates new output exclusively and refuses existing contents or symlink ancestors", async () => {
    const scratch = await mkdtemp(join(tmpdir(), "jeeves-export-test-"));
    const files = [
      { path: "nested/file.txt", bytes: new TextEncoder().encode("retained bytes\n") },
    ];
    try {
      const destination = join(scratch, "new");
      await exportNewDirectory(files, destination);
      expect(await readFile(join(destination, "nested/file.txt"), "utf8")).toBe("retained bytes\n");
      await writeFile(join(destination, "custom.txt"), "preserved");
      await expect(exportNewDirectory(files, destination)).rejects.toMatchObject({
        code: "EEXIST",
      });
      expect(await readFile(join(destination, "custom.txt"), "utf8")).toBe("preserved");
      await symlink(destination, join(scratch, "link"));
      await expect(exportNewDirectory(files, join(scratch, "link/child"))).rejects.toThrow(
        "Unsafe export ancestor",
      );
      await expect(
        exportNewDirectory(
          [{ path: "../escape", bytes: new Uint8Array() }],
          join(scratch, "unsafe"),
        ),
      ).rejects.toThrow();
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});
