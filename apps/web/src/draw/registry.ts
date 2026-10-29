/**
 * The builtin template registry, bundled in the browser so connect and attach checks and config
 * validation agree exactly with the server (see the S4 handoff).
 */
import { builtinRegistry } from "@jeeves/registry";

export const registry = builtinRegistry();
