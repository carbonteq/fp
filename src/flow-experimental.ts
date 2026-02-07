import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "./option-experimental.js"
import { ExperimentalResult as Result } from "./result-experimental.js"
import { CapturedTrace, isCapturedTrace, isPromiseLike } from "./utils.js"

function isOption<T>(value: unknown): value is Option<T> {
  if (value instanceof Option) {
    return true
  }

  if (typeof value !== "object" || value === null) {
    return false
  }

  const optionLike = value as {
    _tag?: unknown
    isSome?: unknown
    isNone?: unknown
    unwrap?: unknown
  }

  return (
    (optionLike._tag === "Some" || optionLike._tag === "None") &&
    typeof optionLike.isSome === "function" &&
    typeof optionLike.isNone === "function" &&
    typeof optionLike.unwrap === "function"
  )
}

function isResult<T, E>(value: unknown): value is Result<T, E> {
  if (value instanceof Result) {
    return true
  }

  if (typeof value !== "object" || value === null) {
    return false
  }

  const resultLike = value as {
    _tag?: unknown
    isOk?: unknown
    isErr?: unknown
    unwrap?: unknown
    unwrapErr?: unknown
  }

  return (
    (resultLike._tag === "Ok" || resultLike._tag === "Err") &&
    typeof resultLike.isOk === "function" &&
    typeof resultLike.isErr === "function" &&
    typeof resultLike.unwrap === "function" &&
    typeof resultLike.unwrapErr === "function"
  )
}

/**
 * Base class for errors that can be directly yielded in Flow generators.
 * Extend this class instead of Error to enable `yield* new MyError(...)`
 * in `Flow.gen` and `Flow.asyncGen`.
 *
 * @example
 * ```typescript
 * class ValidationError extends FlowError {
 *   readonly _tag = "ValidationError";
 *   constructor(message: string) {
 *     super(message);
 *     this.name = "ValidationError";
 *   }
 * }
 *
 * const result = Flow.gen(function* () {
 *   if (value < 0) {
 *     yield* new ValidationError("Value must be positive");
 *   }
 *   return value * 2;
 * });
 * ```
 */
export class ExperimentalFlowError extends Error {
  *[Symbol.iterator](): Generator<this, never, unknown> {
    const trace = new Error().stack
    return (yield new CapturedTrace(this, trace) as unknown as this) as never
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<this, never, unknown> {
    const trace = new Error().stack
    return (yield new CapturedTrace(this, trace) as unknown as this) as never
  }
}

function isFlowError(value: unknown): value is ExperimentalFlowError {
  return value instanceof ExperimentalFlowError
}

type ExtractXFlowError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends Option<any>
    ? UnwrappedNone
    : // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
      Y extends Result<any, infer E>
      ? E
      : Y extends ExperimentalFlowError
        ? Y
        : never

class XFlowYieldWrap<T, E> {
  constructor(readonly value: Option<T> | Result<T, E>) {}

  *[Symbol.iterator](): Generator<XFlowYieldWrap<T, E>, T, unknown> {
    const trace = new Error().stack
    return (yield new CapturedTrace(this, trace) as unknown as XFlowYieldWrap<
      T,
      E
    >) as T
  }
}

class AsyncXFlowYieldWrap<T, E> {
  readonly value: Promise<Option<T> | Result<T, E>>

  constructor(
    value: Option<T> | Result<T, E> | Promise<Option<T> | Result<T, E>>,
  ) {
    this.value = (
      isPromiseLike(value) ? value : Promise.resolve(value)
    ) as Promise<Option<T> | Result<T, E>>
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<
    AsyncXFlowYieldWrap<T, E>,
    T,
    unknown
  > {
    const trace = new Error().stack
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as AsyncXFlowYieldWrap<T, E>) as T
  }
}

type ExtractWrapError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends XFlowYieldWrap<any, infer E>
    ? E // UnwrappedNone is added via adapter overload for Option
    : never

type ExtractAsyncWrapError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends AsyncXFlowYieldWrap<any, infer E>
    ? E // UnwrappedNone is added via adapter overload for Option
    : never

// biome-ignore lint/complexity/noStaticOnlyClass: Namespace-like class
export class ExperimentalFlow {
  // Direct generator (no adapter)
  static gen<
    // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
    Eff extends Option<any> | Result<any, any> | ExperimentalFlowError,
    T,
  >(
    genFn: () => Generator<Eff, T, unknown>,
  ): Result<T, ExtractXFlowError<Eff>> {
    const iterator = genFn()
    let nextArg: unknown

    while (true) {
      const next = iterator.next(nextArg)
      if (next.done) return Result.Ok(next.value)

      let value = next.value
      let stack: string | undefined

      if (isCapturedTrace(value)) {
        stack = value.stack
        value = value.value as Eff
      }

      if (isFlowError(value)) {
        // Handle FlowError - short-circuit with the error
        if (stack) {
          const stackLines = stack.split("\n")
          // stackLines[0] is "Error"
          // stackLines[1] is the internal FlowError.[Symbol.iterator] frame
          // We want to keep from stackLines[2] onwards
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            value.stack = `${value.name}: ${value.message}\n${userStack}`
          }
        }
        return Result.Err(value) as Result<T, ExtractXFlowError<Eff>>
      } else if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone()
          if (stack) {
            const stackLines = stack.split("\n")
            // stackLines[0] is "Error"
            // stackLines[1] is the internal Option.[Symbol.iterator] frame
            // We want to keep from stackLines[2] onwards
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return Result.Err(err) as Result<T, ExtractXFlowError<Eff>>
        }
        nextArg = value.unwrap()
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr()
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n")
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return value as unknown as Result<T, ExtractXFlowError<Eff>>
        }
        nextArg = value.unwrap()
      } else {
        // Should not happen if types are correct, but runtime safe
        // Could throw or just return generic error
        // For now, assuming strict usage or runtime error
        throw new Error("Flow.gen yielded unknown type")
      }
    }
  }

  // Adapter generator
  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static genAdapter<Eff extends XFlowYieldWrap<any, any>, T>(
    genFn: (adapter: {
      <A>(val: Option<A>): XFlowYieldWrap<A, UnwrappedNone>
      <A, E>(val: Result<A, E>): XFlowYieldWrap<A, E>
      fail: <E extends Error>(error: E) => XFlowYieldWrap<never, E>
    }) => Generator<Eff, T, unknown>,
  ): Result<T, ExtractWrapError<Eff>> {
    const baseAdapter = <A, E>(val: Option<A> | Result<A, E>) =>
      new XFlowYieldWrap(val)
    const adapter = Object.assign(baseAdapter, {
      fail: <E extends Error>(error: E) =>
        new XFlowYieldWrap<never, E>(Result.Err(error)),
    })
    const iterator = genFn(adapter)
    let nextArg: unknown

    while (true) {
      const next = iterator.next(nextArg)
      if (next.done) return Result.Ok(next.value)

      // biome-ignore lint/suspicious/noExplicitAny: generic unwrap
      let wrapped = next.value as any
      let stack: string | undefined

      if (isCapturedTrace(wrapped)) {
        stack = wrapped.stack
        wrapped = wrapped.value as XFlowYieldWrap<unknown, unknown>
      } else {
        wrapped = wrapped as XFlowYieldWrap<unknown, unknown>
      }

      const value = wrapped.value

      if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone()
          if (stack) {
            const stackLines = stack.split("\n")
            // stackLines[0] is "Error"
            // stackLines[1] is the internal FlowYieldWrap.[Symbol.iterator] frame
            // We want to keep from stackLines[2] onwards
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return Result.Err(err) as Result<T, ExtractWrapError<Eff>>
        }
        nextArg = value.unwrap()
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr()
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n")
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return value as unknown as Result<T, ExtractWrapError<Eff>>
        }
        nextArg = value.unwrap()
      } else {
        throw new Error("ExperimentalFlow.genAdapter yielded unknown type")
      }
    }
  }

  // Async variants...
  static async asyncGen<
    // biome-ignore lint/suspicious/noExplicitAny: inference
    Eff extends Option<any> | Result<any, any> | ExperimentalFlowError,
    T,
  >(
    genFn: () => AsyncGenerator<Eff, T, unknown>,
  ): Promise<Result<T, ExtractXFlowError<Eff>>> {
    const iterator = genFn()
    let nextArg: unknown

    while (true) {
      const next = await iterator.next(nextArg)
      if (next.done) return Result.Ok(next.value)

      let value = next.value
      let stack: string | undefined

      if (isCapturedTrace(value)) {
        stack = value.stack
        value = value.value as Eff
      }

      if (isFlowError(value)) {
        // Handle FlowError - short-circuit with the error
        if (stack) {
          const stackLines = stack.split("\n")
          // stackLines[0] is "Error"
          // stackLines[1] is the internal FlowError.[Symbol.asyncIterator] frame
          // We want to keep from stackLines[2] onwards
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            value.stack = `${value.name}: ${value.message}\n${userStack}`
          }
        }
        return Result.Err(value) as Result<T, ExtractXFlowError<Eff>>
      } else if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone()
          if (stack) {
            const stackLines = stack.split("\n")
            // stackLines[0] is "Error"
            // stackLines[1] is the internal Option.[Symbol.iterator] frame
            // We want to keep from stackLines[2] onwards
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return Result.Err(err) as Result<T, ExtractXFlowError<Eff>>
        }
        nextArg = value.unwrap()
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr()
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n")
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return value as unknown as Result<T, ExtractXFlowError<Eff>>
        }
        nextArg = value.unwrap()
      } else {
        throw new Error("ExperimentalFlow.asyncGen yielded unknown type")
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static async asyncGenAdapter<Eff extends AsyncXFlowYieldWrap<any, any>, T>(
    genFn: (adapter: {
      <A>(
        val: Option<A> | Promise<Option<A>>,
      ): AsyncXFlowYieldWrap<A, UnwrappedNone>
      <A, E>(
        val: Result<A, E> | Promise<Result<A, E>>,
      ): AsyncXFlowYieldWrap<A, E>
      fail: <E extends Error>(error: E) => AsyncXFlowYieldWrap<never, E>
    }) => AsyncGenerator<Eff, T, unknown>,
  ): Promise<Result<T, ExtractAsyncWrapError<Eff>>> {
    const baseAdapter = <A, E>(
      val: Option<A> | Result<A, E> | Promise<Option<A> | Result<A, E>>,
    ) => new AsyncXFlowYieldWrap(val)
    const adapter = Object.assign(baseAdapter, {
      fail: <E extends Error>(error: E) =>
        new AsyncXFlowYieldWrap<never, E>(Result.Err(error)),
    })
    const iterator = genFn(adapter)
    let nextArg: unknown

    while (true) {
      const next = await iterator.next(nextArg)
      if (next.done) return Result.Ok(next.value)

      // biome-ignore lint/suspicious/noExplicitAny: generic unwrap
      let wrapped = next.value as any
      let stack: string | undefined

      if (isCapturedTrace(wrapped)) {
        stack = wrapped.stack
        wrapped = wrapped.value as AsyncXFlowYieldWrap<unknown, unknown>
      } else {
        wrapped = wrapped as AsyncXFlowYieldWrap<unknown, unknown>
      }

      let value: Option<unknown> | Result<unknown, unknown>
      try {
        value = await wrapped.value
      } catch (error) {
        if (stack && error instanceof Error) {
          const stackLines = stack.split("\n")
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            error.stack = `${error.name}: ${error.message}\n${userStack}`
          }
        }
        return Result.Err(error) as Result<T, ExtractAsyncWrapError<Eff>>
      }

      if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone()
          if (stack) {
            const stackLines = stack.split("\n")
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return Result.Err(err) as Result<T, ExtractAsyncWrapError<Eff>>
        }
        nextArg = value.unwrap()
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr()
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n")
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n")
              err.stack = `${err.name}: ${err.message}\n${userStack}`
            }
          }
          return value as unknown as Result<T, ExtractAsyncWrapError<Eff>>
        }
        nextArg = value.unwrap()
      } else {
        throw new Error("ExperimentalFlow.asyncGenAdapter yielded unknown type")
      }
    }
  }
}
