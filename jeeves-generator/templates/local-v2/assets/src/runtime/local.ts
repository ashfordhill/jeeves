import { readFileSync } from "node:fs";

/** Runtime modules explicitly select their credential; setup-only owner/admin credentials
 * are never mounted into application services. No implicit table access accompanies a login.
 * A credential is read from the file `JEEVES_SECRET_<NAME>_FILE` names when that is set (an
 * absolute path; `<NAME>` the name upper-cased, `-` and `.` as `_`), else from
 * `SECRET_DIR/<name>`. An invalid value fails `Invalid endpoint <variable>`, and a file it names
 * that can't be read fails `Unreadable secret file <variable> (<code>)`, never the path or value. */
export const readSecret = (name: string): string => {
  if (!/^[a-z][a-z0-9_.-]{0,190}$/.test(name)) throw new Error("Invalid secret identity");
  const variable = `JEEVES_SECRET_${name.toUpperCase().replace(/[-.]/g, "_")}_FILE`;
  const file = process.env[variable];
  if (file === undefined)
    return readFileSync(`${process.env.SECRET_DIR ?? "/run/secrets"}/${name}`, "utf8").trim();
  if (
    !file.startsWith("/") ||
    [...file].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error(`Invalid endpoint ${variable}`);
  try {
    return readFileSync(file, "utf8").trim();
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    throw new Error(
      `Unreadable secret file ${variable}${typeof code === "string" && /^E[A-Z]+$/.test(code) ? ` (${code})` : ""}`,
    );
  }
};
export const quoteSqlIdentifier = (name: string): string => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("Invalid SQL identifier");
  return `"${name}"`;
};
export type SqlLogin = { host: string; database: string; user: string; secret: string };
