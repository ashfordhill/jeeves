import { describe, expect, it } from "vitest";
import { designSchema } from "./design.ts";
import { favoritesStackDesign } from "./fixtures/favorites-stack.ts";
import { generationCallableContracts, generationExtensionApi } from "./generation-catalog.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import { generationCallableContractSchema } from "./generation-support.ts";

// A support-only host. Executable output responsibility is checked in generator tests.
const support = {
  templates: [],
  callables: generationCallableContracts.map((contract) => ({
    contract,
    outputPaths: ["src/runtime/favorites.ts"],
  })),
};

describe("versioned callable metadata", () => {
  it("reads old diagrams, round-trips JSON and normalizes equivalent property order deterministically", () => {
    const design = favoritesStackDesign();
    const original = structuredClone(design);
    const model = resolveGeneration(designSchema.parse(design), support).model;
    expect(model?.capabilities).toHaveLength(4);
    expect(model?.extensionApi).toEqual(generationExtensionApi);
    const json = JSON.stringify(model);
    expect(JSON.parse(json)).toEqual(model);
    const reorder = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reorder)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, item]) => [key, reorder(item)]),
            )
          : value;
    expect(resolveGeneration(designSchema.parse(reorder(design)), support).model).toEqual(model);
    expect(design).toEqual(original);
    expect(model?.capabilities.find((item) => item.contract.id === "favorites.add")).toMatchObject({
      id: "favorite-items.favorites.add",
      module: "favorite-items",
      process: "account-api",
      owner: "account-api-owner",
      role: "api",
      transport: "http",
      dependencies: ["account-check"],
      access: [{ resource: "favorites", name: "favorites.items", use: "write" }],
      caller: { kind: "verified-principal", identity: "sign-in", guard: "account-check" },
      lifecycle: { process: "account-api", mechanism: "src/runtime/process.ts" },
      extensionApiVersion: 2,
    });
  });

  it("names the missing exact capability and actionable selection path; future capabilities stay absent", () => {
    const result = resolveGeneration(favoritesStackDesign(), { templates: [] });
    expect(result.model?.capabilities).toEqual([]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "NEEDS_TEMPLATE",
        message: expect.stringContaining("Required callable favorites.add@1"),
        target: { path: ["generation", "selections", 1, "template"] },
      }),
    );
    expect(result.complete).toBe(false);
    expect(resolveGeneration(favoritesStackDesign(false), support).model?.capabilities).toEqual([]);
  });

  it("accepts only finite contract records and rejects executable/type-expression additions", () => {
    for (const contract of generationCallableContracts)
      expect(generationCallableContractSchema.parse(JSON.parse(JSON.stringify(contract)))).toEqual(
        contract,
      );
    expect(
      generationCallableContractSchema.safeParse({
        ...generationCallableContracts[0],
        validate: () => true,
      }).success,
    ).toBe(false);
    expect(
      generationCallableContractSchema.safeParse({
        ...generationCallableContracts[0],
        effect: "arbitrary",
      }).success,
    ).toBe(false);
    expect(
      generationCallableContractSchema.safeParse({
        ...generationCallableContracts[0],
        input: "Map<string, Function>",
      }).success,
    ).toBe(false);
  });
});
