import { describe, expect, it } from "vitest";
import { mergePackageDependencies, runtimeTarballName, vendoredRuntimeSpec } from "./packages.ts";

describe("runtime tarballs", () => {
  it("are named the way pnpm pack names them", () => {
    expect(runtimeTarballName("@jeeves/service-runtime", "0.1.0")).toBe(
      "jeeves-service-runtime-0.1.0.tgz",
    );
  });

  it("are referenced relative to the element directory", () => {
    expect(vendoredRuntimeSpec("services/links", "@jeeves/rest-server", "0.2.0")).toBe(
      "file:../../vendor/jeeves/jeeves-rest-server-0.2.0.tgz",
    );
  });
});

describe("mergePackageDependencies", () => {
  const text = `${JSON.stringify(
    { name: "links", dependencies: { zod: "4.5.4" }, devDependencies: { vitest: "5.0.0" } },
    null,
    2,
  )}\n`;

  it("adds missing dependencies in sorted order", () => {
    const merged = JSON.parse(
      mergePackageDependencies(text, [
        { name: "drizzle-orm", spec: "0.45.4" },
        { name: "drizzle-kit", spec: "0.31.11", dev: true },
      ]),
    );
    expect(Object.keys(merged.dependencies)).toEqual(["drizzle-orm", "zod"]);
    expect(Object.keys(merged.devDependencies)).toEqual(["drizzle-kit", "vitest"]);
    expect(merged.name).toBe("links");
  });

  it("never changes a dependency the project already lists, in either section", () => {
    const entries = [
      { name: "zod", spec: "4.0.0" },
      { name: "vitest", spec: "1.0.0" },
    ];
    expect(mergePackageDependencies(text, entries)).toBe(text);
  });
});
