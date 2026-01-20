import { Option, UnwrappedNone } from "./option.js";
import { Result } from "./result.js";
import { isPromiseLike } from "./utils.js";

function isOption<T>(value: unknown): value is Option<T> {
  return value instanceof Option;
}

function isResult<T, E>(value: unknown): value is Result<T, E> {
  return value instanceof Result;
}

type ExtractFlowError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends Option<any>
    ? UnwrappedNone
    : // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
      Y extends Result<any, infer E>
      ? E
      : never;

class FlowYieldWrap<T, E> {
  constructor(readonly value: Option<T> | Result<T, E>) {}

  *[Symbol.iterator](): Generator<FlowYieldWrap<T, E>, T, unknown> {
    return (yield this) as T;
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
    return (yield this) as T;
  }
}

type ExtractWrapError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends FlowYieldWrap<any, infer E>
    ? E | UnwrappedNone // Wrappers tracking Options need UnwrappedNone added
    : never;

type ExtractAsyncWrapError<Y> =
  // biome-ignore lint/suspicious/noExplicitAny: generic type extraction
  Y extends AsyncFlowYieldWrap<any, infer E> ? E | UnwrappedNone : never;

// biome-ignore lint/complexity/noStaticOnlyClass: Namespace-like class
export class Flow {
  // Direct generator (no adapter)
  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static gen<Eff extends Option<any> | Result<any, any>, T>(
    genFn: () => Generator<Eff, T, unknown>,
  ): Result<T, ExtractFlowError<Eff>> {
    const iterator = genFn();
    let nextArg: unknown;

    while (true) {
      const next = iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      const value = next.value;

      if (isOption(value)) {
        if (value.isNone())
          return Result.Err(new UnwrappedNone()) as Result<
            T,
            ExtractFlowError<Eff>
          >;
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr())
          return value as unknown as Result<T, ExtractFlowError<Eff>>;
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
    genFn: (
      adapter: <A, E>(val: Option<A> | Result<A, E>) => FlowYieldWrap<A, E>,
    ) => Generator<Eff, T, unknown>,
  ): Result<T, ExtractWrapError<Eff>> {
    const adapter = <A, E>(val: Option<A> | Result<A, E>) =>
      new FlowYieldWrap(val);
    const iterator = genFn(adapter);
    let nextArg: unknown;

    while (true) {
      const next = iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      const wrapped = next.value;
      const value = wrapped.value;

      if (isOption(value)) {
        if (value.isNone())
          return Result.Err(new UnwrappedNone()) as Result<
            T,
            ExtractWrapError<Eff>
          >;
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr())
          return value as unknown as Result<T, ExtractWrapError<Eff>>;
        nextArg = value.unwrap();
      }
    }
  }

  // Async variants...
  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static async asyncGen<Eff extends Option<any> | Result<any, any>, T>(
    genFn: () => AsyncGenerator<Eff, T, unknown>,
  ): Promise<Result<T, ExtractFlowError<Eff>>> {
    const iterator = genFn();
    let nextArg: unknown;

    while (true) {
      const next = await iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      const value = next.value;
      if (isOption(value)) {
        if (value.isNone())
          return Result.Err(new UnwrappedNone()) as Result<
            T,
            ExtractFlowError<Eff>
          >;
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr())
          return value as unknown as Result<T, ExtractFlowError<Eff>>;
        nextArg = value.unwrap();
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: generic type constraint
  static async asyncGenAdapter<Eff extends AsyncFlowYieldWrap<any, any>, T>(
    genFn: (
      adapter: <A, E>(
        val: Option<A> | Result<A, E> | Promise<Option<A> | Result<A, E>>,
      ) => AsyncFlowYieldWrap<A, E>,
    ) => AsyncGenerator<Eff, T, unknown>,
  ): Promise<Result<T, ExtractAsyncWrapError<Eff>>> {
    const adapter = <A, E>(
      val: Option<A> | Result<A, E> | Promise<Option<A> | Result<A, E>>,
    ) => new AsyncFlowYieldWrap(val);
    const iterator = genFn(adapter);
    let nextArg: unknown;

    while (true) {
      const next = await iterator.next(nextArg);
      if (next.done) return Result.Ok(next.value);

      const wrapped = next.value;
      const value = await wrapped.value;

      if (isOption(value)) {
        if (value.isNone())
          return Result.Err(new UnwrappedNone()) as Result<
            T,
            ExtractAsyncWrapError<Eff>
          >;
        nextArg = value.unwrap();
      } else if (isResult(value)) {
        if (value.isErr())
          return value as unknown as Result<T, ExtractAsyncWrapError<Eff>>;
        nextArg = value.unwrap();
      }
    }
  }
}
