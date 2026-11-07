/** Access/schema failures stop a bounded live suite before another external request. */
export function liveBlocker(error: string | null): boolean {
  return (
    error !== null &&
    /API key|quota|refused the request|no credits|credits remaining|not logged in|usage limit/i.test(
      error,
    )
  );
}
