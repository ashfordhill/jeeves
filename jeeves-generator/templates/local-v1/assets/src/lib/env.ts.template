import { readFileSync } from "node:fs";
export function secret(name: string): string {
  const value = readFileSync(`/run/secrets/${name}`, "utf8").trim();
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment: ${name}`);
  return value;
}
export class Unimplemented extends Error {
  readonly statusCode = 501;
  readonly code = "CUSTOM_IMPLEMENTATION_REQUIRED";
  constructor(readonly extension: string) {
    super(`Implement ${extension}; generated scaffold has no business handler.`);
  }
}
