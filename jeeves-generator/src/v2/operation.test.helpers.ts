import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

/** Test loaders of emitted modules must share the actual operation runtime/AsyncLocalStorage. */
export const operationUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readFileSync(new URL("../../templates/local-v2/assets/src/runtime/operation.ts.template", import.meta.url), "utf8"))).toString("base64")}`;
const withOperation = (source: string) =>
  source.replaceAll('from "./operation.ts"', `from "${operationUrl}"`);
export const transactionUrl = `data:text/javascript;base64,${Buffer.from(withOperation(stripTypeScriptTypes(readFileSync(new URL("../../templates/local-v2/assets/src/runtime/transaction.ts.template", import.meta.url), "utf8")))).toString("base64")}`;
export const operationImports = (source: string) =>
  withOperation(source).replaceAll('from "./transaction.ts"', `from "${transactionUrl}"`);
