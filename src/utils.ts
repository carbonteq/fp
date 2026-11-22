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

/** Drain suspended cleanup without replacing the runner's primary failure. */
export function closeGenerator(
  iterator: Generator<unknown, unknown, unknown>,
  resolveYield: (yielded: unknown) => unknown,
): void {
  try {
    let state = iterator.return(undefined)
    while (!state.done) {
      let value: unknown
      try {
        value = resolveYield(state.value)
      } catch {
        value = undefined
      }
      state = iterator.next(value)
    }
  } catch {
    // Cleanup exceptions must not replace the primary failure.
  }
}

/** Await suspended cleanup without replacing the runner's primary failure. */
export async function closeAsyncGenerator(
  iterator: AsyncGenerator<unknown, unknown, unknown>,
  resolveYield: (yielded: unknown) => unknown | PromiseLike<unknown>,
): Promise<void> {
  try {
    let state = await iterator.return(undefined)
    while (!state.done) {
      let value: unknown
      try {
        value = await resolveYield(state.value)
      } catch {
        value = undefined
      }
      state = await iterator.next(value)
    }
  } catch {
    // Cleanup exceptions must not replace the primary failure.
  }
}
