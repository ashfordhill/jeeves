/** Finite application SQL declarations. Cooperative mistake checks, not a SQL parser/sandbox.
 * PostgreSQL's distinct product credentials enforce the state boundary. */
export type ProductMaximum = {
  resource: string;
  modules?: { module: string; host: string; schema: string; file: string }[];
  productState?: {
    schema?: string;
    access: {
      host: string;
      product: { tables: { name: string; operations: string[] }[]; views: string[] };
    }[];
  };
  productSql?: {
    version: number;
    file: string;
    namespaces: { schema: string; role: string }[];
    bindings: { host: string; module: string; access: string }[];
  };
};
export type ProductDeclaration = {
  version: 1;
  namespaces: { schema: string; migrations: { version: string; file: string }[] }[];
  tables: { schema: string; name: string }[];
  views: { schema: string; name: string; source: string }[];
  operations: {
    name: string;
    module: string;
    host: string;
    kind: "query" | "command";
    file: string;
    parameters: number;
    relations: { schema: string; name: string; operations: string[] }[];
  }[];
};
const fail = (why: string): never => {
  throw new Error(`Invalid product SQL declaration: ${why}`);
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("expected record");
  return value as Record<string, unknown>;
};
const keys = (value: unknown, expected: string[]) => {
  const row = object(value);
  if (Object.keys(row).some((key) => !expected.includes(key))) fail("unknown field");
  return row;
};
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value) || value.length > 128) return fail("expected bounded list");
  return value;
};
const name = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value))
    return fail("invalid SQL name");
  return value;
};
const identity = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,62}$/.test(value))
    return fail("invalid source identity");
  return value;
};
export function validateProductDeclaration(
  value: unknown,
  maximum: ProductMaximum,
): ProductDeclaration {
  const compiled = maximum.productSql;
  const root = keys(value, ["version", "namespaces", "tables", "views", "operations"]);
  if (root.version !== 1 || !compiled || compiled.version !== 1)
    return fail("versioned migration required; never execute legacy re-runnable SQL");
  const namespace = (value: unknown) => {
    const schema = name(value);
    if (!compiled.namespaces.some((row) => row.schema === schema))
      fail(`reserved or foreign schema ${schema}`);
    return schema;
  };
  const path = (value: unknown, directory: string) => {
    const prefix = `infra/postgres/${maximum.resource}/products/${directory}/`;
    if (
      typeof value !== "string" ||
      !value.startsWith(prefix) ||
      !/^[a-zA-Z0-9_/-]+\.sql$/.test(value) ||
      value.includes("..")
    )
      return fail("SQL file outside declared product directory");
    return value;
  };
  const unique = <T>(rows: T[], key: (row: T) => string): T[] => {
    if (new Set(rows.map(key)).size !== rows.length) fail("duplicate identity");
    return rows;
  };
  const namespaces = unique(
    list(root.namespaces).map((value) => {
      const row = keys(value, ["schema", "migrations"]),
        schema = namespace(row.schema);
      const migrations = unique(
        list(row.migrations).map((value) => {
          const row = keys(value, ["version", "file"]);
          if (typeof row.version !== "string" || !/^[0-9]{4}$/.test(row.version))
            return fail("four-digit migration version required");
          return { version: row.version, file: path(row.file, `migrations/${schema}`) };
        }),
        (row) => row.version,
      );
      if (
        migrations.some(
          (row, index) => index > 0 && row.version <= (migrations[index - 1]?.version ?? ""),
        )
      )
        fail("migrations must be strictly ordered");
      return { schema, migrations };
    }),
    (row) => row.schema,
  );
  if (compiled.namespaces.some((row) => !namespaces.some((item) => item.schema === row.schema)))
    fail("missing owned migration namespace");
  const tables = unique(
    list(root.tables).map((value) => {
      const row = keys(value, ["schema", "name"]),
        schema = namespace(row.schema),
        table = name(row.name);
      if (
        schema !== maximum.productState?.schema ||
        !maximum.productState.access.some((entry) =>
          entry.product.tables.some((row) => row.name === table),
        )
      )
        fail("table exceeds compiled owner/grant maximum");
      return { schema, name: table };
    }),
    (row) => `${row.schema}.${row.name}`,
  );
  const views = unique(
    list(root.views).map((value) => {
      const row = keys(value, ["schema", "name", "source"]),
        schema = namespace(row.schema),
        view = name(row.name),
        source = name(row.source);
      if (!maximum.productState?.access.some((entry) => entry.product.views.includes(view)))
        fail("view exceeds compiled audience maximum");
      return { schema, name: view, source };
    }),
    (row) => row.name,
  );
  const operations = unique(
    list(root.operations).map((value) => {
      const row = keys(value, [
        "name",
        "module",
        "host",
        "kind",
        "file",
        "parameters",
        "relations",
      ]);
      const operation = name(row.name),
        module = identity(row.module),
        host = identity(row.host);
      if (!compiled.bindings.some((binding) => binding.host === host && binding.module === module))
        fail("operation has no compiled module/database link");
      if (row.kind !== "query" && row.kind !== "command") fail("query or command required");
      const kind = row.kind as "query" | "command";
      if (
        !compiled.bindings.some(
          (binding) =>
            binding.host === host &&
            binding.module === module &&
            (kind === "query" ? binding.access !== "write" : binding.access !== "read"),
        )
      )
        fail("operation exceeds module link access");
      if (
        !Number.isInteger(row.parameters) ||
        (row.parameters as number) < 0 ||
        (row.parameters as number) > 32
      )
        fail("parameter count 0..32 required");
      const access = maximum.productState?.access.find((entry) => entry.host === host)?.product;
      const relations = unique(
        list(row.relations).map((value) => {
          const row = keys(value, ["schema", "name", "operations"]),
            schema = name(row.schema),
            relation = name(row.name);
          const operations = list(row.operations).map(name);
          if (
            !operations.length ||
            new Set(operations).size !== operations.length ||
            operations.some((item) => !["select", "insert", "update", "delete"].includes(item))
          )
            fail("finite lowercase relation operations required");
          if (kind === "query" && operations.some((item) => item !== "select"))
            fail("query cannot declare mutations");
          const allowed =
            schema === "published"
              ? views.some((row) => row.name === relation) &&
                access?.views.includes(relation) &&
                operations.every((item) => item === "select")
              : tables.some((row) => row.schema === schema && row.name === relation) &&
                schema === maximum.productState?.schema &&
                operations.every((item) =>
                  access?.tables.some(
                    (table) =>
                      table.name === relation && table.operations.includes(item.toUpperCase()),
                  ),
                );
          if (!allowed) fail(`reserved, foreign or ungranted relation ${schema}.${relation}`);
          return { schema, name: relation, operations };
        }),
        (row) => `${row.schema}.${row.name}`,
      );
      if (!relations.length) fail("operation must name its product relations");
      return {
        name: operation,
        module,
        host,
        kind,
        file: path(row.file, kind === "query" ? "queries" : "commands"),
        parameters: row.parameters as number,
        relations,
      };
    }),
    (row) => `${row.host}.${row.module}.${row.name}`,
  );
  return { version: 1, namespaces, tables, views, operations };
}
/** Mask literals/comments with a bounded lexical scan so they cannot hide a control statement.
 * Only ordinary quoted strings/identifiers are supported. This does not parse SQL semantics. */
function sqlCode(sql: string): string {
  let code = "",
    index = 0;
  while (index < sql.length) {
    const char = sql[index],
      next = sql[index + 1];
    if (char === "-" && next === "-") {
      index += 2;
      while (index < sql.length && sql[index] !== "\n") index++;
      code += " ";
    } else if (char === "/" && next === "*") {
      index += 2;
      let depth = 1;
      while (index < sql.length && depth) {
        if (sql[index] === "/" && sql[index + 1] === "*") {
          depth++;
          index += 2;
        } else if (sql[index] === "*" && sql[index + 1] === "/") {
          depth--;
          index += 2;
        } else index++;
      }
      if (depth) fail("unterminated SQL comment");
      code += " ";
    } else if (char === "'" || char === '"') {
      const quote = char;
      index++;
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === "\\") fail("unsupported SQL string escape; use ordinary doubled quotes");
        if (sql[index] === quote) {
          index++;
          if (sql[index] === quote) {
            index++;
            continue;
          }
          closed = true;
          break;
        }
        index++;
      }
      if (!closed) fail("unterminated SQL quote");
      code += " _quoted_ ";
    } else {
      if (char === "$" && (next === "$" || /[a-z_]/i.test(next ?? "")))
        fail("unsupported dollar quoting");
      code += char;
      index++;
    }
  }
  return code;
}
/** Conservative token refusals. No claim to parse SQL or infer its effects. */
export function checkedProductSql(
  sql: string,
  operation?: ProductDeclaration["operations"][number],
): string {
  if (sql.length > 262144 || sql.includes("\0")) fail("SQL is oversized");
  const stripped = sqlCode(sql);
  if (
    stripped
      .split(";")
      .some((statement) =>
        /^\s*(begin|commit|rollback|savepoint|release|start|end|abort|set|reset|grant|revoke|discard|vacuum|copy|do|call|execute|prepare|deallocate)\b/i.test(
          statement,
        ),
      ) ||
    /\b(grant|revoke|role|session|set_config|function|procedure|extension|database|tablespace)\b/i.test(
      stripped,
    ) ||
    /\$[a-zA-Z_]/.test(stripped)
  )
    fail("transaction, privilege or lifecycle control in application SQL");
  if (operation) {
    const statement = stripped.trim().replace(/;$/, "").trim();
    if (
      statement.includes(";") ||
      !(operation.kind === "query" ? /^select\b/i : /^(insert|update|delete)\b/i).test(statement)
    )
      fail("one registered SELECT or mutation statement required");
    const parameters = [...statement.matchAll(/\$([0-9]+)/g)].map((match) => Number(match[1]));
    if (
      parameters.some((value) => value < 1 || value > operation.parameters) ||
      Array.from({ length: operation.parameters }, (_, index) => index + 1).some(
        (value) => !parameters.includes(value),
      )
    )
      fail("parameter placeholders differ from declaration");
    // Qualified references must name a declared relation. Aliases remain ordinary SQL; database
    // grants, not this check, prevent access to other state or hidden function effects.
    for (const match of statement.matchAll(/\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\b/gi)) {
      const schema = match[1] ?? "",
        relation = match[2] ?? "";
      if (
        (schema === "public" ||
          schema === "jeeves" ||
          schema.startsWith("pg_") ||
          schema.startsWith("p_") ||
          schema.startsWith("m_") ||
          schema === "published") &&
        !operation.relations.some((row) => row.schema === schema && row.name === relation)
      )
        fail("SQL names an undeclared relation");
    }
  }
  return sql;
}
