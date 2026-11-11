import { readFileSync } from "node:fs";

/** Runtime modules explicitly select their credential; setup-only owner/admin credentials
 * are never mounted into application services. No implicit table access accompanies a login. */
export const readSecret = (name: string): string => {
  if (!/^[a-z][a-z0-9_.-]{0,190}$/.test(name)) throw new Error("Invalid secret identity");
  return readFileSync(`${process.env.SECRET_DIR ?? "/run/secrets"}/${name}`, "utf8").trim();
};
export const quoteSqlIdentifier = (name: string): string => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("Invalid SQL identifier");
  return `"${name}"`;
};
export type SqlLogin = { host: string; database: string; user: string; secret: string };
