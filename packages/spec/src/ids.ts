import { z } from "zod";

/**
 * IDs for elements, connections, packages and other studio identities. They are unique across
 * the whole design and are lowercase slugs, so a generator can use them as names.
 */
export const idSchema = z
  .string()
  .max(63)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and single hyphens");

export const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Use a semantic version such as 0.1.0");
