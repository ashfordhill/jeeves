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
  "local-time": { pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" },
  date: {
    format: "date",
    pattern:
      "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$",
  },
  "decimal-digits": { pattern: "^\\d+$" },
  "asset-code": { pattern: "^ASSET-[0-9]{1,8}$" },
} as const;
export type ContractTextConstraint = keyof typeof contractTextConstraints;
