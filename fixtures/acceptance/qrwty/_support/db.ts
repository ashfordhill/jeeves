import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { psql } from "./fixture.ts";

type Descriptor = {
  id: string;
  table: string;
  fields: { name: string; column: string; type: string }[];
  belongsTo: { resource: string; column: string; name: string }[];
};

/** Import the generated resource descriptor, the only stable source of physical names. */
export async function descriptor(resource: string): Promise<Descriptor> {
  const project = process.env.JEEVES_TEST_PROJECT_DIR ?? "";
  const service = process.env.JEEVES_TEST_SERVICE ?? "";
  const file = join(project, "services", service, "src/generated/resources", `${resource}.ts`);
  const module = (await import(pathToFileURL(file).href)) as { default: Descriptor };
  return module.default;
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Insert one scan row at a fixed UTC timestamp, outside the production app. */
export async function insertScan(
  qrId: string,
  occurredAt: string,
  scanResource = "scan",
  parentResource = "qr",
): Promise<void> {
  const scan = await descriptor(scanResource);
  const parent = scan.belongsTo.find((relation) => relation.resource === parentResource);
  const occurred = scan.fields.find((field) => field.type === "timestamp");
  if (!parent || !occurred)
    throw new Error(
      `The ${scanResource} descriptor needs a ${parentResource} relationship and timestamp`,
    );
  psql(
    `INSERT INTO ${quote(scan.table)} (${quote("id")}, ${quote(parent.column)}, ${quote(occurred.column)}) VALUES (${literal(randomUUID())}, ${literal(qrId)}, ${literal(occurredAt)})`,
  );
}

export async function countScans(
  qrId: string,
  scanResource = "scan",
  parentResource = "qr",
): Promise<number> {
  const scan = await descriptor(scanResource);
  const parent = scan.belongsTo.find((relation) => relation.resource === parentResource);
  if (!parent)
    throw new Error(`The ${scanResource} descriptor has no ${parentResource} relationship`);
  const value = psql(
    `SELECT count(*) FROM ${quote(scan.table)} WHERE ${quote(parent.column)} = ${literal(qrId)}`,
  );
  return Number(value);
}
