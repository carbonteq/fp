export function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    // @ts-expect-error: we are checking for .then property existence
    typeof value.then === "function"
  )
}

export class CapturedTrace<T> {
  constructor(
    readonly value: T,
    readonly stack: string | undefined,
  ) {}
}

export function isCapturedTrace(
  value: unknown,
): value is CapturedTrace<unknown> {
  return value instanceof CapturedTrace
}
