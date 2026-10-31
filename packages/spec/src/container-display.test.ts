import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { containerDescription, containerTechnology } from "./container-display.ts";
import { elementSchema, operationBatchJsonSchema, operationSchema } from "./index.ts";
import { sampleDesign, testLookup } from "./test-support.ts";

describe("C2 presentation metadata", () => {
  it("accepts optional bounded text through atomic element operations without changing notes or pins", () => {
    const design = sampleDesign();
    const before = structuredClone(design);
    const result = applyOperations(
      design,
      [
        {
          op: "updateElement",
          id: "api",
          description: " Owns stock records. ",
          technology: "TypeScript",
        },
      ],
      testLookup,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.elements[0]).toEqual({
      ...before.elements[0],
      description: "Owns stock records.",
      technology: "TypeScript",
    });
    expect(design).toEqual(before);
    expect(
      operationSchema.safeParse({ op: "updateElement", id: "api", description: "x".repeat(241) })
        .success,
    ).toBe(false);
    expect(
      elementSchema.safeParse({ ...design.elements[0], technology: "x".repeat(121) }).success,
    ).toBe(false);
    expect(JSON.stringify(operationBatchJsonSchema())).toContain('"description"');
  });
  it("uses technology and responsibility defaults independently from notes, pins and config", () => {
    const service = elementSchema.parse({
      id: "api",
      name: "API",
      template: { id: "http-service", version: "0.1.0" },
      notes: "Sensitive implementation brief",
    });
    expect(containerTechnology(service)).toBe("Node.js · Fastify");
    expect(
      containerTechnology({ ...service, template: { id: "http-service", version: "0.1.1" } }),
    ).toBe(containerTechnology(service));
    expect(containerDescription(service)).not.toContain("Sensitive");
    const cache = elementSchema.parse({
      id: "cache",
      name: "Cache",
      template: null,
      planned: "distributed-cache",
      notes: "Do not show this brief",
    });
    // Engine defaults apply to old documents without migrating their stored metadata.
    expect(containerTechnology(cache)).toBe("Redis compatible");
    expect(containerTechnology({ ...cache, config: { engine: "Memcached" } })).toBe("Memcached");
    expect(containerTechnology({ ...cache, technology: "Valkey 8" })).toBe("Valkey 8");
    expect(containerDescription(cache)).not.toContain("Do not show");
    expect(containerDescription({ ...cache, description: "Caches destinations" })).toBe(
      "Caches destinations",
    );
    expect(cache).not.toHaveProperty("description");
    const unknown = { ...service, template: { id: "constructor", version: "0.1.0" } };
    expect(containerTechnology(unknown)).toBe("Technology unspecified");
    expect(containerDescription(unknown)).toBe("Describe this container's responsibility.");
  });
});
