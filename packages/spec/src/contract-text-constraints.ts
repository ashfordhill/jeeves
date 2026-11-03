/** Named protocol constraints only; users cannot supply regular expressions. */
export const contractTextConstraints = {
  email: {
    format: "email",
    pattern:
      "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$",
  },
  sha256: { pattern: "^[a-f0-9]{64}$" },
  "error-code": { pattern: "^[A-Z][A-Z0-9_]{0,63}$" },
  "correlation-id": { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$" },
  base64url: { pattern: "^[A-Za-z0-9_-]+$" },
  base64: { pattern: "^[A-Za-z0-9+/]+={0,2}$" },
  uri: { format: "uri" },
} as const;
export type ContractTextConstraint = keyof typeof contractTextConstraints;
