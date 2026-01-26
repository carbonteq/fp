import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "./option-experimental.js";
import { ExperimentalResult as Result } from "./result-experimental.js";
import { CapturedTrace, isCapturedTrace, isPromiseLike } from "./utils.js";

function isOption<T>(value: unknown): value is Option<T> {
  return value instanceof Option;
}

function isResult<T, E>(value: unknown): value is Result<T, E> {
  return value instanceof Result;
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
export class FlowError extends Error {
  *[Symbol.iterator](): Generator<this, never, unknown> {
    const trace = new Error().stack;
    return (yield new CapturedTrace(this, trace) as unknown as this) as never;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<this, never, unknown> {
    const trace = new Error().stack;
    return (yield new CapturedTrace(this, trace) as unknown as this) as never;
  }
}

function isFlowError(value: unknown): value is FlowError {
  return value instanceof FlowError;
}

type ExtractFlowError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends Option<any>
    ? UnwrappedNone
    : // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
      Y extends Result<any, infer E>
      ? E
      : Y extends FlowError
        ? Y
        : never;

class FlowYieldWrap<T, E> {
  constructor(readonly value: Option<T> | Result<T, E>) {}

  *[Symbol.iterator](): Generator<FlowYieldWrap<T, E>, T, unknown> {
    const trace = new Error().stack;
    return (yield new CapturedTrace(this, trace) as unknown as FlowYieldWrap<
      T,
      E
    >) as T;
  }
}

class AsyncFlowYieldWrap<T, E> {
  readonly value: Promise<Option<T> | Result<T, E>>;

  constructor(
    value: Option<T> | Result<T, E> | Promise<Option<T> | Result<T, E>>,
  ) {
    this.value = (
      isPromiseLike(value) ? value : Promise.resolve(value)
    ) as Promise<Option<T> | Result<T, E>>;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<
    AsyncFlowYieldWrap<T, E>,
    T,
    unknown
  > {
    const trace = new Error().stack;
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as AsyncFlowYieldWrap<T, E>) as T;
  }
}

type ExtractWrapError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends FlowYieldWrap<any, infer E>
    ? E // UnwrappedNone is added via adapter overload for Option
    : never;

type ExtractAsyncWrapError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends AsyncFlowYieldWrap<any, infer E>
    ? E // UnwrappedNone is added via adapter overload for Option
    : never;

// biome-ignore lint/complexity/noStaticOnlyClass: Namespace-like class
export class Flow {
  // Direct generator (no adapter)
  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static gen<Eff extends Option<any> | Result<any, any> | FlowError, T>(
    genFn: () => Generator<Eff, T, unknown>,
  ): Result<T, ExtractFlowError<Eff>> {
    const iterator = genFn();
    let nextArg: unknown;

    while (true) {
      const next = iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      let value = next.value;
      let stack: string | undefined;

      if (isCapturedTrace(value)) {
        stack = value.stack;
        value = value.value as Eff;
      }

      if (isFlowError(value)) {
        // Handle FlowError - short-circuit with the error
        if (stack) {
          const stackLines = stack.split("\n");
          // stackLines[0] is "Error"
          // stackLines[1] is the internal FlowError.[Symbol.iterator] frame
          // We want to keep from stackLines[2] onwards
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n");
            value.stack = `${value.name}: ${value.message}\n${userStack}`;
          }
        }
        return Result.Err(value) as Result<T, ExtractFlowError<Eff>>;
      } else if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone();
          if (stack) {
            const stackLines = stack.split("\n");
            // stackLines[0] is "Error"
            // stackLines[1] is the internal Option.[Symbol.iterator] frame
            // We want to keep from stackLines[2] onwards
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return Result.Err(err) as Result<T, ExtractFlowError<Eff>>;
        }
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr();
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n");
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return value as unknown as Result<T, ExtractFlowError<Eff>>;
        }
        nextArg = value.unwrap();
      } else {
        // Should not happen if types are correct, but runtime safe
        // Could throw or just return generic error
        // For now, assuming strict usage or runtime error
        throw new Error("Flow.gen yielded unknown type");
      }
    }
  }

  // Adapter generator
  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static genAdapter<Eff extends FlowYieldWrap<any, any>, T>(
    genFn: (adapter: {
      <A>(val: Option<A>): FlowYieldWrap<A, UnwrappedNone>;
      <A, E>(val: Result<A, E>): FlowYieldWrap<A, E>;
      fail: <E extends Error>(error: E) => FlowYieldWrap<never, E>;
    }) => Generator<Eff, T, unknown>,
  ): Result<T, ExtractWrapError<Eff>> {
    const baseAdapter = <A, E>(val: Option<A> | Result<A, E>) =>
      new FlowYieldWrap(val);
    const adapter = Object.assign(baseAdapter, {
      fail: <E extends Error>(error: E) =>
        new FlowYieldWrap<never, E>(Result.Err(error)),
    });
    const iterator = genFn(adapter);
    let nextArg: unknown;

    while (true) {
      const next = iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      // biome-ignore lint/suspicious/noExplicitAny: generic unwrap
      let wrapped = next.value as any;
      let stack: string | undefined;

      if (isCapturedTrace(wrapped)) {
        stack = wrapped.stack;
        wrapped = wrapped.value as FlowYieldWrap<unknown, unknown>;
      } else {
        wrapped = wrapped as FlowYieldWrap<unknown, unknown>;
      }

      const value = wrapped.value;

      if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone();
          if (stack) {
            const stackLines = stack.split("\n");
            // stackLines[0] is "Error"
            // stackLines[1] is the internal FlowYieldWrap.[Symbol.iterator] frame
            // We want to keep from stackLines[2] onwards
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return Result.Err(err) as Result<T, ExtractWrapError<Eff>>;
        }
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr();
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n");
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return value as unknown as Result<T, ExtractWrapError<Eff>>;
        }
        nextArg = value.unwrap();
      }
    }
  }

  // Async variants...
  static async asyncGen<
    // biome-ignore lint/suspicious/noExplicitAny: inference
    Eff extends Option<any> | Result<any, any> | FlowError,
    T,
  >(
    genFn: () => AsyncGenerator<Eff, T, unknown>,
  ): Promise<Result<T, ExtractFlowError<Eff>>> {
    const iterator = genFn();
    let nextArg: unknown;

    while (true) {
      const next = await iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      let value = next.value;
      let stack: string | undefined;

      if (isCapturedTrace(value)) {
        stack = value.stack;
        value = value.value as Eff;
      }

      if (isFlowError(value)) {
        // Handle FlowError - short-circuit with the error
        if (stack) {
          const stackLines = stack.split("\n");
          // stackLines[0] is "Error"
          // stackLines[1] is the internal FlowError.[Symbol.asyncIterator] frame
          // We want to keep from stackLines[2] onwards
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n");
            value.stack = `${value.name}: ${value.message}\n${userStack}`;
          }
        }
        return Result.Err(value) as Result<T, ExtractFlowError<Eff>>;
      } else if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone();
          if (stack) {
            const stackLines = stack.split("\n");
            // stackLines[0] is "Error"
            // stackLines[1] is the internal Option.[Symbol.iterator] frame
            // We want to keep from stackLines[2] onwards
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return Result.Err(err) as Result<T, ExtractFlowError<Eff>>;
        }
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr();
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n");
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return value as unknown as Result<T, ExtractFlowError<Eff>>;
        }
        nextArg = value.unwrap();
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static async asyncGenAdapter<Eff extends AsyncFlowYieldWrap<any, any>, T>(
    genFn: (adapter: {
      <A>(
        val: Option<A> | Promise<Option<A>>,
      ): AsyncFlowYieldWrap<A, UnwrappedNone>;
      <A, E>(
        val: Result<A, E> | Promise<Result<A, E>>,
      ): AsyncFlowYieldWrap<A, E>;
      fail: <E extends Error>(error: E) => AsyncFlowYieldWrap<never, E>;
    }) => AsyncGenerator<Eff, T, unknown>,
  ): Promise<Result<T, ExtractAsyncWrapError<Eff>>> {
    const baseAdapter = <A, E>(
      val: Option<A> | Result<A, E> | Promise<Option<A> | Result<A, E>>,
    ) => new AsyncFlowYieldWrap(val);
    const adapter = Object.assign(baseAdapter, {
      fail: <E extends Error>(error: E) =>
        new AsyncFlowYieldWrap<never, E>(Result.Err(error)),
    });
    const iterator = genFn(adapter);
    let nextArg: unknown;

    while (true) {
      const next = await iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      // biome-ignore lint/suspicious/noExplicitAny: generic unwrap
      let wrapped = next.value as any;
      let stack: string | undefined;

      if (isCapturedTrace(wrapped)) {
        stack = wrapped.stack;
        wrapped = wrapped.value as AsyncFlowYieldWrap<unknown, unknown>;
      } else {
        wrapped = wrapped as AsyncFlowYieldWrap<unknown, unknown>;
      }

      const value = await wrapped.value;

      if (isOption(value)) {
        if (value.isNone()) {
          const err = new UnwrappedNone();
          if (stack) {
            const stackLines = stack.split("\n");
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return Result.Err(err) as Result<T, ExtractAsyncWrapError<Eff>>;
        }
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr()) {
          const err = value.unwrapErr();
          if (stack && err instanceof Error) {
            const stackLines = stack.split("\n");
            if (stackLines.length > 2) {
              const userStack = stackLines.slice(2).join("\n");
              err.stack = `${err.name}: ${err.message}\n${userStack}`;
            }
          }
          return value as unknown as Result<T, ExtractAsyncWrapError<Eff>>;
        }
        nextArg = value.unwrap();
      }
    }
  }
}
