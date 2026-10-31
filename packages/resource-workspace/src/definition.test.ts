import { expect, it } from "vitest";
import fixture from "../conformance/fixtures/definition.json";
import {
  formInput,
  inputSchema,
  type ResourceRecord,
  workspaceDefinitionSchema,
} from "./definition.ts";

it("refuses unsafe/unsupported descriptors before rendering", () => {
  expect(workspaceDefinitionSchema.safeParse(fixture).success).toBe(true);
  for (const mutate of [
    (value: typeof fixture) => {
      value.collections[0]!.operations = ["create"];
    },
    (value: typeof fixture) => {
      value.collections[1]!.relationships[0]!.target = "internal-record";
    },
    (value: typeof fixture) => {
      value.collections[0]!.primaryField = "password";
    },
    (value: typeof fixture) => {
      value.collections[0]!.fields[0]!.name = "ownerId";
    },
    (value: typeof fixture) => {
      value.collections.push(value.collections[0]!);
    },
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    expect(workspaceDefinitionSchema.safeParse(value).success).toBe(false);
  }
});

it("forms honor required PATCH values, preserve optional values, and reject malformed input", () => {
  const definition = workspaceDefinitionSchema.parse(fixture),
    warehouse = definition.collections[0]!,
    stock = definition.collections[1]!;
  expect(
    formInput(warehouse, { name: "North", website: "javascript:alert(1)" }).errors.website,
  ).toBeTruthy();
  expect(formInput(warehouse, { name: "North", website: "not-a-url" }).errors.website).toBeTruthy();
  expect(formInput(warehouse, { name: "", website: "" }).data).toEqual({ name: "", website: null });
  const values = {
    title: "Widget",
    quantity: "5",
    state: "available",
    notes: "",
    warehouseId: "a0000000-0000-4000-8000-000000000000",
  };
  expect(formInput(stock, { ...values, quantity: "" }).errors.quantity).toBeTruthy();
  expect(formInput(stock, { ...values, quantity: "1.1" }).errors.quantity).toBeTruthy();
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    recordedAt: new Date().toISOString(),
    ...formInput(stock, values).data,
  } as ResourceRecord;
  expect(formInput(stock, { ...values, quantity: "8" }, record).data).toEqual({
    title: "Widget",
    quantity: 8,
    state: "available",
    warehouseId: values.warehouseId,
  });
  expect(formInput(stock, values, record).changed).toBe(false);
  expect(formInput(stock, { ...values, quantity: "8" }, { ...record, notes: "" }).data).toEqual({
    title: "Widget",
    quantity: 8,
    state: "available",
    warehouseId: values.warehouseId,
  });
  const valid = {
    title: "Widget",
    quantity: 5,
    state: "available",
    warehouseId: values.warehouseId,
  };
  expect(inputSchema(stock).safeParse(valid).success).toBe(true);
  expect(inputSchema(stock).safeParse({ ...valid, id: record.id }).success).toBe(false);
  expect(inputSchema(stock).safeParse({ ...valid, recordedAt: record.recordedAt }).success).toBe(
    false,
  );
});
