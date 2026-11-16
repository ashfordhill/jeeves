import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import type {
  ProductDeclaration,
  ProductMaximum,
} from "../../templates/local-v2/assets/src/runtime/product-contract.ts";

export const dataUrl = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
export const productContractUrl = dataUrl(
  stripTypeScriptTypes(
    readFileSync(
      new URL("../../templates/local-v2/assets/src/runtime/product-contract.ts", import.meta.url),
      "utf8",
    ),
  ),
);
export const loadProducts = (source: string) =>
  import(
    dataUrl(
      source.replace('from "../src/runtime/product-contract.ts"', `from "${productContractUrl}"`),
    )
  );
export const declarationFor = (db: ProductMaximum): ProductDeclaration => ({
  version: 1,
  namespaces: (db.productSql?.namespaces ?? []).map((row) => ({
    schema: row.schema,
    migrations: [
      {
        version: "0001",
        file: `infra/postgres/${db.resource}/products/migrations/${row.schema}/0001-initial.sql`,
      },
    ],
  })),
  tables: [
    ...new Set(
      db.productState?.access.flatMap((row) => row.product.tables.map((table) => table.name)) ?? [],
    ),
  ].map((name) => ({ schema: db.productState?.schema ?? "", name })),
  views: [...new Set(db.productState?.access.flatMap((row) => row.product.views) ?? [])].map(
    (name) => ({ schema: db.productSql?.namespaces[0]?.schema ?? "", name, source: name }),
  ),
  operations: [],
});
