import { readFileSync } from "node:fs";
import { immutable } from "./hook-boundary.ts";
import { assertOperation, dependency, withEffect } from "./operation.ts";
import {
  checkedProductSql,
  type ProductMaximum,
  validateProductDeclaration,
} from "./product-contract.ts";

/** Only registered names and positional values cross the product boundary. The supplied driver
 * is generated privately with a product-only login, never the template process pool. */
export function prepareProductOperations(
  maximum: ProductMaximum,
  binding: { tile: string; module: string },
  read = (path: string) => readFileSync(path, "utf8"),
) {
  if (!maximum.productSql) throw new Error("Versioned product declaration required");
  if (
    !maximum.productSql.bindings.some(
      (row) => row.host === binding.tile && row.module === binding.module,
    )
  )
    throw new Error("No compiled module/database binding");
  const declaration = validateProductDeclaration(
    JSON.parse(read(maximum.productSql.file)),
    maximum,
  );
  const entries = new Map(
    declaration.operations
      .filter((row) => row.host === binding.tile && row.module === binding.module)
      .map((row) => [row.name, { ...row, sql: checkedProductSql(read(row.file), row) }]),
  );
  return (
    execute: (
      sql: string,
      values: unknown[],
      readOnly: boolean,
    ) => Promise<{ rows: unknown[]; rowCount: number | null }>,
  ) =>
    Object.freeze({
      async call(name: string, parameters: readonly unknown[]) {
        const entry = entries.get(name);
        if (!entry) throw new Error("Unregistered product SQL operation");
        if (!Array.isArray(parameters) || parameters.length !== entry.parameters)
          throw new Error("Invalid product SQL parameters");
        const values = Array.from({ length: parameters.length }, (_, index) => {
          const property = Object.getOwnPropertyDescriptor(parameters, String(index));
          if (!property || !("value" in property))
            throw new Error("Invalid product SQL parameters");
          const value: unknown = property.value;
          if (
            (value !== null && !["string", "number", "boolean"].includes(typeof value)) ||
            (typeof value === "number" && !Number.isFinite(value))
          )
            throw new Error("Invalid product SQL parameters");
          return value;
        });
        assertOperation();
        return withEffect(entry.kind === "query" ? "read" : "local-atomic-mutation", async () => {
          const result = await dependency({ mutation: entry.kind === "command" }, () =>
            execute(entry.sql, values, entry.kind === "query"),
          );
          return immutable({ rows: result.rows, rowCount: result.rowCount ?? 0 });
        });
      },
    });
}

export function registeredProductOperations(
  maximum: ProductMaximum,
  binding: { tile: string; module: string },
  execute: (
    sql: string,
    values: unknown[],
    readOnly: boolean,
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>,
  read?: (path: string) => string,
) {
  return prepareProductOperations(maximum, binding, read)(execute);
}
