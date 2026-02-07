/** Type guard that checks whether a value is Promise-like (`thenable`). */
export function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    // @ts-expect-error: we are checking for .then property existence
    typeof value.then === "function"
  )
}

/** Wrapper used to preserve callsite stack traces across yielded values. */
export class CapturedTrace<T> {
  constructor(
    readonly value: T,
    readonly stack: string | undefined,
  ) {}
}

/** Type guard for `CapturedTrace` wrappers. */
export function isCapturedTrace(
  value: unknown,
): value is CapturedTrace<unknown> {
  return value instanceof CapturedTrace
}
