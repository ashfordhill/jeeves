// The module fan: the kinds a tile allows, a row per what each can generate there.
import { moduleKinds, studioArchitectureExample } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { moduleItems } from "./creation.tsx";

describe("moduleItems", () => {
  it("rows a Service's and a Worker's kinds by Template, Part of a template and Stub", () => {
    const design = studioArchitectureExample("studio-youtube").design;
    const rows = (host: string, kind: "service" | "worker") =>
      moduleItems(moduleKinds(design, host), kind).map((item) => [
        item.label,
        item.group,
        item.detail,
      ]);
    expect(rows("watch", "service")).toEqual([
      ["Cache reader", "lead", "Template"],
      ["Multipart uploads", "lead", "Template"],
      ["Search query", "lead", "Template"],
      ["Event publisher", "part", "Part of a template"],
      ["Data access", "part", "Part of a template"],
      ["Auth guard", "part", "Part of a template"],
      ["Rate limiter", "stub", "Stub"],
      ["ID generator", "stub", "Stub"],
      ["Redirect responder", "stub", "Stub"],
      ["Event consumer", "stub", "Stub"],
      ["External call", "stub", "Stub"],
      ["Custom", "stub", "Stub"],
    ]);
    const worker = rows("transcoder", "worker");
    expect(worker).toHaveLength(16);
    expect(worker.filter(([, group]) => group === "lead").map(([label]) => label)).toEqual([
      "Lifecycle writer",
      "Video encoder",
      "Event counter",
      "Index writer",
    ]);
    // Each item is the kind, with its one-line description for the tip.
    const [first] = moduleItems(["custom"], "service");
    expect(first).toMatchObject({
      id: "custom",
      description: "Your own logic, generated as a stub.",
    });
  });
});
