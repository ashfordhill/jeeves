export function message(
  error: unknown,
  fallback = "The request failed. Please try again.",
): string {
  return error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : fallback;
}
