import { UnwrappedErrWithOk, UnwrappedOkWithErr } from "./errors.js";
import { Option } from "./option.js";
import { UNIT } from "./unit.js";

export type UnitResult<E = never> = Result<UNIT, E>;

export type UnwrapResult<T extends Result<unknown, unknown>> =
  T extends Result<infer U, infer E> ? { ok: U; err: E } : never;

type CombinedResultOk<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["ok"];
};
type CombinedResultErr<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["err"];
}[number];

export type CombineResults<T extends Result<unknown, unknown>[]> = Result<
  CombinedResultOk<T>,
  CombinedResultErr<T>
>;

/** Sentinel value stored in #val when Result is Err */
const ERR_VAL = Symbol("Result::Err");

interface MatchCases<T, E, U> {
  Ok: (val: T) => U;
  Err: (err: E) => U;
}

/**
 * Wrapper that makes Result yieldable with proper type tracking.
 * The Generator signature ensures TypeScript tracks the inner type T.
 *
 * @internal
 */
class ResultYieldWrap<T, E> {
  constructor(readonly result: Result<T, E>) {}

  *[Symbol.iterator](): Generator<ResultYieldWrap<T, E>, T, unknown> {
    return (yield this) as T;
  }
}

/**
 * Wrapper that makes Result yieldable in async generators with proper type tracking.
 * Supports Promise<Result<T, E>> for async result chaining.
 *
 * @internal
 */
class AsyncResultYieldWrap<T, E> {
  constructor(readonly result: Promise<Result<T, E>>) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<
    AsyncResultYieldWrap<T, E>,
    T,
    unknown
  > {
    return (yield this) as T;
  }
}

/** Extract error type from yielded values */
type ExtractResultError<T> =
  // biome-ignore lint/suspicious/noExplicitAny: inference
  T extends ResultYieldWrap<any, infer E> ? E : never;

/** Extract error type from async yielded values */
type ExtractAsyncResultError<T> =
  // biome-ignore lint/suspicious/noExplicitAny: inference
  T extends AsyncResultYieldWrap<any, infer E> ? E : never;

/** Extract error type directly from Result */
// biome-ignore lint/suspicious/noExplicitAny: inference
type ExtractError<T> = T extends Result<any, infer E> ? E : never;

export class Result<T, E> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Ok" | "Err";

  /** Value when Ok; ERR_VAL sentinel when Err */
  readonly #val: T;

  /** Error when Err (sync); undefined when Ok */
  readonly #err: E;

  private constructor(val: T, err: E, tag: "Ok" | "Err") {
    this.#val = val;
    this.#err = err;
    this._tag = tag;
  }

  /** Singleton UNIT_RESULT for void-success operations */
  static readonly UNIT_RESULT: Result<UNIT, never> = new Result(
    UNIT,
    undefined as never,
    "Ok",
  );

  /** Create an Ok containing the given value */
  static Ok<T, E = never>(this: void, val: T): Result<T, E> {
    return new Result(val, undefined as E, "Ok");
  }

  /** Create an Err containing the given error */
  static Err<E, T = never>(this: void, err: E): Result<T, E> {
    return new Result(ERR_VAL as T, err, "Err");
  }

  /**
   * Type guard for Ok state.
   *
   * Narrows the type, making `T` accessible and `E` equivalent to `never` in
   * the true branch.
   *
   * @returns `true` if this Result is Ok
   *
   * @example
   * ```ts
   * const result = Result.Ok(42);
   * if (result.isOk()) {
   *   // TypeScript knows value is accessible: 42
   *   console.log(result.unwrap()); // 42
   * }
   * ```
   *
   * @see isErr
   */
  isOk(): this is Result<T, never> {
    return this._tag === "Ok" && this.#val !== ERR_VAL;
  }

  /**
   * Type guard for Err state.
   *
   * Narrows the type, making `E` accessible and `T` equivalent to `never` in
   * the true branch.
   *
   * @returns `true` if this Result is Err
   *
   * @example
   * ```ts
   * const result = Result.Err("failed");
   * if (result.isErr()) {
   *   // TypeScript knows error is accessible: "failed"
   *   console.log(result.unwrapErr()); // "failed"
   * }
   * ```
   *
   * @see isOk
   */
  isErr(): this is Result<never, E> {
    return this._tag === "Err" || this.#val === ERR_VAL;
  }

  /**
   * Type guard for Unit value.
   *
   * Returns `true` when the Ok value is the `UNIT` singleton, used for void-success
   * operations (e.g., side-effecting functions that return nothing on success).
   *
   * @returns `true` if this Result is Ok containing UNIT
   *
   * @example
   * ```ts
   * function saveToDb(): Result<UNIT, DbError> {
   *   // ... save logic
   *   return Result.UNIT_RESULT;
   * }
   *
   * const result = saveToDb();
   * if (result.isUnit()) {
   *   console.log("Saved successfully");
   * }
   * ```
   */
  isUnit(): this is Result<UNIT, never> {
    return this.#val === UNIT;
  }

  /**
   * Returns a string representation of the Result.
   *
   * Useful for debugging and logging. Shows "Result::Ok" or "Result::Err" with
   * the contained value or error.
   *
   * @returns String representation in format "Result::Ok<value>" or "Result::Err<error>"
   *
   * @example
   * ```ts
   * Result.Ok(42).toString();      // "Result::Ok<42>"
   * Result.Err("fail").toString(); // "Result::Err<fail>"
   * ```
   */
  toString(): string {
    if (this.isOk()) {
      return `Result::Ok<${String(this.#val)}>`;
    }
    return `Result::Err<${String(this.#err)}>`;
  }

  /**
   * Returns the contained value or throws.
   *
   * If the Result is Err and the error extends Error, the original error is re-thrown
   * (preserving stack trace). Otherwise, throws `UnwrappedOkWithErr`.
   *
   * **Use with caution**: Prefer `unwrapOr`, `unwrapOrElse`, or `match` for safer
   * error handling.
   *
   * @throws The original error if E extends Error, otherwise `UnwrappedOkWithErr`
   * @returns The contained value if Ok
   *
   * @example
   * ```ts
   * Result.Ok(42).unwrap();           // 42
   * Result.Err(new Error("fail")).unwrap(); // throws Error("fail")
   * Result.Err("fail").unwrap();      // throws UnwrappedOkWithErr
   * ```
   *
   * @see unwrapOr
   * @see unwrapOrElse
   * @see safeUnwrap
   */
  unwrap(): T {
    if (this.isErr()) {
      const err = this.#err;
      if (err instanceof Error) throw err;

      throw new UnwrappedOkWithErr(this.toString());
    }

    return this.#val;
  }

  /**
   * Returns the contained error or throws.
   *
   * **Use with caution**: Prefer `match` or `isErr` check for safer error access.
   *
   * @throws `UnwrappedErrWithOk` if the Result is Ok
   * @returns The contained error if Err
   *
   * @example
   * ```ts
   * Result.Err("fail").unwrapErr();   // "fail"
   * Result.Ok(42).unwrapErr();        // throws UnwrappedErrWithOk
   * ```
   */
  unwrapErr(): E {
    if (this._tag === "Err") {
      return this.#err;
    }

    throw new UnwrappedErrWithOk(this.toString());
  }

  /**
   * Returns the contained value or the provided default.
   *
   * A safe alternative to `unwrap` for providing fallback values.
   *
   * @param defaultValue - The value to return if Err
   * @returns The contained value if Ok, otherwise defaultValue
   *
   * @example
   * ```ts
   * Result.Ok(42).unwrapOr(0);        // 42
   * Result.Err("fail").unwrapOr(0);   // 0
   * ```
   *
   * @see unwrapOrElse
   * @see safeUnwrap
   */
  unwrapOr(defaultValue: T): T {
    if (this.isErr()) return defaultValue;

    return this.#val;
  }

  /**
   * Returns the contained value or computes a default from the error.
   *
   * Use when the fallback value depends on the error content.
   *
   * @param fn - Function that receives the error and returns a fallback value
   * @returns The contained value if Ok, otherwise the result of fn(error)
   *
   * @example
   * ```ts
   * const result = Result.Err("Not found");
   * result.unwrapOrElse((err) => `Default: ${err}`); // "Default: Not found"
   *
   * Result.Ok(42).unwrapOrElse((err) => 0); // 42
   * ```
   *
   * @see unwrapOr
   * @see unwrap
   */
  unwrapOrElse(fn: (err: E) => T): T {
    if (this.isErr()) return fn(this.#err);

    return this.#val;
  }

  /**
   * Safely unwraps the value, returning null for Err.
   *
   * A convenience method for JavaScript-friendly null handling.
   *
   * @returns The contained value if Ok, otherwise null
   *
   * @example
   * ```ts
   * Result.Ok(42).safeUnwrap();       // 42
   * Result.Err("fail").safeUnwrap();  // null
   *
   * // Useful for null coalescing
   * const value = result.safeUnwrap() ?? "default";
   * ```
   *
   * @see unwrapOr
   */
  safeUnwrap(): T | null {
    if (this.isErr()) return null;

    return this.#val === ERR_VAL ? null : this.#val;
  }

  /**
   * Exhaustive pattern matching on Result state.
   *
   * Handles both Ok and Err branches with provided functions, ensuring all cases
   * are covered. TypeScript enforces that both branches are specified.
   *
   * @param cases - Object containing Ok and Err handler functions
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * const message = Result.Ok(42).match({
   *   Ok: (val) => `Success: ${val}`,
   *   Err: (err) => `Failed: ${err}`,
   * });
   * // "Success: 42"
   *
   * // For side effects
   * result.match({
   *   Ok: (data) => console.log("Got:", data),
   *   Err: (error) => console.error("Error:", error),
   * });
   * ```
   */
  match<U>(cases: MatchCases<T, E, U>): U {
    if (this.isErr()) {
      return cases.Err(this.#err);
    }

    return cases.Ok(this.#val);
  }

  /**
   * Transforms the success value using the provided function.
   *
   * If the Result is Ok, applies the function to the value and wraps the result
   * in a new Ok. If Err, propagates the error unchanged without calling the function.
   *
   * For async transformations, use `mapAsync` instead.
   *
   * @param fn - Function to transform the success value
   * @returns Result<U, E> with transformed value or propagated error
   *
   * @example
   * ```ts
   * Result.Ok(42).map((x) => x * 2);           // Ok(84)
   * Result.Err("fail").map((x) => x * 2);       // Err("fail")
   * ```
   *
   * @see mapAsync
   * @see flatMap
   */
  map<U>(fn: (val: T) => Promise<U>): never;
  map<U>(fn: (val: T) => U): Result<U, E>;
  map<U>(fn: (val: T) => U): Result<U, E> {
    if (this.isErr()) {
      return Result.Err(this.#err) as Result<U, E>;
    }
    const curr = this.#val;
    return Result.Ok(fn(curr as T));
  }

  /**
   * Transforms the success value using an async function.
   *
   * Same as `map` but for async mappers. Returns `Promise<Result<U, E>>`.
   *
   * @param fn - Async function to transform the success value
   * @returns Promise resolving to Result<U, E> with transformed value or propagated error
   *
   * @example
   * ```ts
   * await Result.Ok(42).mapAsync(async (x) => x * 2); // Promise<Ok(84)>
   * await Result.Err("fail").mapAsync(async (x) => x * 2); // Promise<Err("fail")>
   * ```
   *
   * @see map
   */
  async mapAsync<U>(fn: (val: T) => Promise<U>): Promise<Result<U, E>> {
    if (this.isErr()) {
      return Promise.resolve(Result.Err<E, U>(this.#err));
    }

    const curr = this.#val;
    return fn(curr)
      .then((u) => Result.Ok(u))
      .catch((e) => Result.Err(e as E));
  }

  /**
   * Chains operations that return Results, flattening nested Results.
   *
   * If the Result is Ok, applies the function (which returns a new Result) and
   * returns that Result directly. If Err, propagates the error unchanged.
   *
   * Error types are unified: `Result<U, E | E2>`.
   *
   * For async operations, use `flatMapAsync` instead.
   *
   * @param fn - Function that returns a Result
   * @returns Result<U, E | E2> from the function or propagated error
   *
   * @example
   * ```ts
   * // Success chain
   * Result.Ok(42)
   *   .flatMap((x) => Result.Ok(x + 1))        // Ok(43)
   *   .flatMap((x) => Result.Err("too big"));  // Err("too big")
   *
   * // Error propagation
   * Result.Err("initial").flatMap((x) => Result.Ok(x + 1)); // Err("initial")
   * ```
   *
   * @see flatMapAsync
   * @see map
   * @see flatZip
   */
  flatMap<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E | E2> {
    if (this.isErr()) {
      return Result.Err<E | E2, U>(this.#err);
    }

    return fn(this.#val) as Result<U, E | E2>;
  }

  /**
   * Chains async operations that return Results.
   *
   * Same as `flatMap` but for async Result-returning functions.
   * Returns `Promise<Result<U, E | E2>>`.
   *
   * @param fn - Async function that returns a Promise resolving to Result
   * @returns Promise resolving to Result<U, E | E2>
   *
   * @example
   * ```ts
   * const fetchUser = (id: number): Promise<Result<User, string>> =>
   *   Promise.resolve(Result.Ok({ id, name: "Alice" }));
   *
   * await Result.Ok(42)
   *   .flatMapAsync(fetchUser)
   *   .then((r) => r.map((user) => user.name));
   * // Promise<Ok("Alice")>
   * ```
   *
   * @see flatMap
   */
  async flatMapAsync<U, E2>(
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Promise<Result<U, E | E2>> {
    if (this.isErr()) {
      return Result.Err<E | E2, U>(this.#err);
    }

    return fn(this.#val as T)
      .then((r) =>
        r.isErr() ? Result.Err<E | E2, U>(r.#err) : (r as Result<U, E | E2>),
      )
      .catch((e) => Result.Err<E | E2, U>(e));
  }

  /**
   * Pairs the original value with a derived value in a tuple.
   *
   * Unlike `map` which replaces the value, `zip` keeps the original and adds
   * the derived value, creating `[original, derived]`.
   *
   * For async derivations, use `zipAsync` instead.
   *
   * @param fn - Function to derive a value from the original
   * @returns Result<[T, U], E> containing tuple of original and derived values
   *
   * @example
   * ```ts
   * Result.Ok(42).zip((x) => x * 10);        // Ok([42, 420])
   * Result.Err("fail").zip((x) => x * 10);   // Err("fail")
   *
   * // Keep original while computing related value
   * Result.Ok(user).zip((u) => u.permissions.length); // Ok([user, 5])
   * ```
   *
   * @see zipAsync
   * @see flatZip
   * @see map
   */
  zip<U>(fn: (val: T) => Promise<U>): never;
  zip<U>(fn: (val: T) => U): Result<[prev: T, current: U], E>;
  zip<U>(fn: (val: T) => U): Result<[T, U], E> {
    if (this.isErr()) {
      return Result.Err<E, [T, U]>(this.#err);
    }

    const curr = this.#val;
    return Result.Ok([curr, fn(curr)]);
  }

  /**
   * Pairs the original value with a derived async value.
   *
   * Same as `zip` but for async derivation functions.
   * Returns `Promise<Result<[T, U], E>>`.
   *
   * @param fn - Async function to derive a value from the original
   * @returns Promise resolving to Result<[T, U], E>
   *
   * @example
   * ```ts
   * await Result.Ok(42).zipAsync(async (x) => x * 10); // Promise<Ok([42, 420])>
   * ```
   *
   * @see zip
   */
  async zipAsync<U>(fn: (val: T) => Promise<U>): Promise<Result<[T, U], E>> {
    if (this.isErr()) {
      return Result.Err<E, [T, U]>(this.#err);
    }

    const curr = this.#val;
    return fn(curr).then((u) => Result.Ok([curr, u]));
  }

  /**
   * Combines the current Result with another independent Result in a tuple.
   *
   * Unlike `zip` which derives a value from the original, `flatZip` works with
   * two independent Results. If either is Err, propagates the first error.
   *
   * For async Results, use `flatZipAsync` instead.
   *
   * @param fn - Function that receives the value and returns another Result
   * @returns Result<[T, U], E | E2> containing tuple of both values, or error
   *
   * @example
   * ```ts
   * Result.Ok(42)
   *   .flatZip((x) => Result.Ok(x + 5))       // Ok([42, 47])
   *   .flatZip(([a, b]) => Result.Err("x"));  // Err("x")
   *
   * Result.Ok(42).flatZip((x) => Result.Err("fail")); // Err("fail")
   * Result.Err("init").flatZip((x) => Result.Ok(5)); // Err("init")
   * ```
   *
   * @see flatZipAsync
   * @see zip
   * @see flatMap
   */
  flatZip<U, E2>(fn: (val: T) => Result<U, E2>): Result<[T, U], E | E2> {
    if (this.isErr()) {
      return Result.Err(this.#err) as Result<[T, U], E | E2>;
    }
    const curr = this.#val as T;
    const r = fn(curr);
    if (r.isErr()) {
      return Result.Err(r.unwrapErr() as E | E2);
    }
    return Result.Ok([curr, r.unwrap() as U]);
  }

  /**
   * Combines the current Result with another independent async Result in a tuple.
   *
   * Same as `flatZip` but for async Result-returning functions.
   * Returns `Promise<Result<[T, U], E | E2>>`.
   *
   * @param fn - Async function that receives the value and returns a Promise resolving to Result
   * @returns Promise resolving to Result<[T, U], E | E2>
   *
   * @example
   * ```ts
   * const fetchData = (id: number): Promise<Result<Data, string>> =>
   *   Promise.resolve(Result.Ok({ id, value: 100 }));
   *
   * await Result.Ok(42).flatZipAsync(fetchData); // Promise<Ok([42, {id: 42, value: 100}])>
   * ```
   *
   * @see flatZip
   */
  async flatZipAsync<U, E2>(
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Promise<Result<[T, U], E | E2>> {
    if (this.isErr()) {
      return Result.Err<E | E2, [T, U]>(this.#err);
    }

    const curr = this.#val;
    return fn(curr).then((r) => {
      if (r.isErr()) {
        return Result.Err(r.unwrapErr() as E | E2);
      }

      return Result.Ok([curr, r.unwrap() as U]);
    });
  }

  /**
   * Transforms the error value while preserving the success value.
   *
   * If the Result is Err, applies the function to the error. If Ok, returns
   * the Ok unchanged without calling the function.
   *
   * For async transformations, use `mapErrAsync` instead.
   *
   * @param fn - Function to transform the error
   * @returns Result<T, E2> with transformed error or original Ok
   *
   * @example
   * ```ts
   * Result.Err("network error").mapErr((e) => `Network: ${e}`); // Err("Network: network error")
   * Result.Ok(42).mapErr((e) => `Error: ${e}`);                  // Ok(42)
   *
   * // Add context to errors
   * fetchData()
   *   .mapErr((e) => new ContextualError("Failed to fetch data", e));
   * ```
   *
   * @see mapErrAsync
   * @see mapBoth
   */
  mapErr<E2>(fn: (err: E) => Promise<E2>): never;
  mapErr<E2>(fn: (err: E) => E2): Result<T, E2>;
  mapErr<E2>(fn: (err: E) => E2): Result<T, E2> {
    if (this.isErr()) {
      return Result.Err(fn(this.#err));
    }

    return Result.Ok(this.#val);
  }

  /**
   * Transforms the error value using an async function.
   *
   * Same as `mapErr` but for async error transformations.
   * Returns `Promise<Result<T, E2>>`.
   *
   * @param fn - Async function to transform the error
   * @returns Promise resolving to Result<T, E2> with transformed error or original Ok
   *
   * @example
   * ```ts
   * await Result.Err("timeout").mapErrAsync(async (e) => await formatError(e));
   * // Promise<Err("Timeout occurred: timeout")>
   * ```
   *
   * @see mapErr
   */
  async mapErrAsync<E2>(fn: (err: E) => Promise<E2>): Promise<Result<T, E2>> {
    if (this.isErr()) {
      return fn(this.#err).then((e) => Result.Err(e));
    }

    return Result.Ok(this.#val);
  }

  /**
   * Transforms both the success value and error value simultaneously.
   *
   * Applies the appropriate function based on the Result state. Useful for
   * formatting or decorating both branches.
   *
   * For async transformations, use `mapBothAsync` instead.
   *
   * @param fnOk - Function to transform the success value
   * @param fnErr - Function to transform the error
   * @returns Result<T2, E2> with transformed value or error
   *
   * @example
   * ```ts
   * Result.Ok(42).mapBoth(
   *   (val) => `Success: ${val}`,
   *   (err) => `Failure: ${err}`
   * );  // Ok("Success: 42")
   *
   * Result.Err("timeout").mapBoth(
   *   (val) => `Success: ${val}`,
   *   (err) => `Failure: ${err}`
   * );  // Err("Failure: timeout")
   * ```
   *
   * @see mapBothAsync
   * @see map
   * @see mapErr
   */
  mapBoth<T2, E2>(fnOk: (val: T) => Promise<T2>, fnErr: (err: E) => E2): never;
  mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (err: E) => Promise<E2>): never;
  mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (err: E) => E2): Result<T2, E2>;
  mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (err: E) => E2): Result<T2, E2> {
    if (this.isErr()) {
      return Result.Err(fnErr(this.#err));
    }
    return Result.Ok(fnOk(this.#val));
  }

  /**
   * Transforms both the success value and error value using async functions.
   *
   * Same as `mapBoth` but for async transformations.
   * Returns `Promise<Result<T2, E2>>`.
   *
   * @param fnOk - Async function to transform the success value
   * @param fnErr - Async function to transform the error
   * @returns Promise resolving to Result<T2, E2> with transformed value or error
   *
   * @example
   * ```ts
   * await Result.Ok(42).mapBothAsync(
   *   async (val) => await formatSuccess(val),
   *   async (err) => await formatError(err)
   * );
   * // Promise<Ok("Success: 42")>
   * ```
   *
   * @see mapBoth
   */
  async mapBothAsync<T2, E2>(
    fnOk: (val: T) => Promise<T2>,
    fnErr: (err: E) => Promise<E2>,
  ): Promise<Result<T2, E2>> {
    if (this.isErr()) {
      return fnErr(this.#err).then((e) => Result.Err(e));
    }

    return fnOk(this.#val).then((v) => Result.Ok(v));
  }

  /**
   * Recovers from an error by providing a fallback Result.
   *
   * If the Result is Ok, returns it unchanged. If Err, calls the function
   * with the error to produce a new Result.
   *
   * For async recovery, use `orElseAsync` instead.
   *
   * @param fn - Function that receives the error and returns a fallback Result
   * @returns Result<T, E2> - original Ok or fallback Result from fn
   *
   * @example
   * ```ts
   * // Recovery with fallback
   * fetchFromPrimary()
   *   .orElse((e) => fetchFromBackup())
   *   .orElse((e) => Result.Ok(defaultValue));
   *
   * // Ok passes through unchanged
   * Result.Ok(42).orElse((e) => Result.Ok(0)); // Ok(42)
   *
   * // Err triggers recovery
   * Result.Err("not found").orElse((e) => Result.Ok(0)); // Ok(0)
   * Result.Err("fail").orElse((e) => Result.Err("critical")); // Err("critical")
   * ```
   *
   * @see orElseAsync
   */
  orElse<E2>(fn: (err: E) => Result<T, E2>): Result<T, E2> {
    if (this.isOk()) return this as Result<T, E2>;
    return fn(this.#err);
  }

  /**
   * Recovers from an error by providing a fallback async Result.
   *
   * Same as `orElse` but for async Result-returning functions.
   * Returns `Promise<Result<T, E2>>`.
   *
   * @param fn - Async function that receives the error and returns a Promise resolving to fallback Result
   * @returns Promise resolving to Result<T, E2> - original Ok or fallback Result from fn
   *
   * @example
   * ```ts
   * await fetchData().orElseAsync(async (e) => {
   *   return await fetchBackupData();
   * });
   * ```
   *
   * @see orElse
   */
  async orElseAsync<E2>(
    fn: (err: E) => Promise<Result<T, E2>>,
  ): Promise<Result<T, E2>> {
    if (this.isOk()) {
      return this as Result<T, E2>;
    }

    return fn(this.#err);
  }

  /**
   * Runs multiple validators on the Ok value, collecting ALL errors.
   *
   * Unlike most Result methods which short-circuit on the first error,
   * `validate` runs ALL validators and collects all errors together.
   * This is useful for form validation where you want to show all errors at once.
   *
   * If the Result is Err, returns it unchanged without running validators.
   *
   * Supports both sync and async validators. If any validator is async,
   * returns `Promise<Result<T, E | VE[]>>`.
   *
   * @param validators - Array of validator functions that return Result
   * @returns Result<T, E | VE[]> with original value or array of all errors
   *
   * @example
   * ```ts
   * const validators = [
   *   (x: number) => x > 0 ? Result.Ok(true) : Result.Err("must be positive"),
   *   (x: number) => x < 100 ? Result.Ok(true) : Result.Err("must be < 100"),
   *   (x: number) => x % 2 === 0 ? Result.Ok(true) : Result.Err("must be even"),
   * ];
   *
   * Result.Ok(42).validate(validators);                // Ok(42)
   * Result.Ok(101).validate(validators);               // Err(["must be < 100"])
   * Result.Ok(-5).validate(validators);                // Err(["must be positive", "must be even"])
   * Result.Err("init").validate(validators);           // Err("init") - validators not run
   *
   * // With async validators (returns Promise<Result<...>>)
   * await Result.Ok(data).validate([
   *   async (d) => await validateEmail(d),
   *   async (d) => await validatePhone(d),
   * ]);
   * ```
   *
   * @see validateAsync
   * @see all
   */
  validate<VE extends unknown[]>(validators: {
    [K in keyof VE]: (val: T) => Result<unknown, VE[K]>;
  }): Result<T, E | VE[number][]>;
  validate<VE extends unknown[]>(validators: {
    [K in keyof VE]: (val: T) => Promise<Result<unknown, VE[K]>>;
  }): Promise<Result<T, E | VE[number][]>>;
  validate<VE extends unknown[]>(validators: {
    [K in keyof VE]:
      | ((val: T) => Result<unknown, VE[K]>)
      | ((val: T) => Promise<Result<unknown, VE[K]>>);
  }): Result<T, E | VE[number][]> | Promise<Result<T, E | VE[number][]>> {
    if (this.isErr()) return this as Result<T, VE[number][]>;

    const baseVal = this.#val as T;
    const results = validators.map((v) => v(baseVal));

    // Check if any result is a promise
    if (results.some((r) => r instanceof Promise)) {
      return Promise.all(results).then((resolved) => {
        const errs: unknown[] = [];
        for (const r of resolved as Result<unknown, unknown>[]) {
          if (r.isErr()) errs.push(r.unwrapErr());
        }
        if (errs.length > 0) {
          return Result.Err(errs as VE[number][]) as Result<T, VE[number][]>;
        }
        return this as Result<T, VE[number][]>;
      });
    }

    const syncResults = results as Result<unknown, unknown>[];
    const errs: unknown[] = [];
    for (const r of syncResults) {
      if (r.isErr()) errs.push(r.#err);
    }
    if (errs.length > 0) {
      return Result.Err(errs as VE[number][]) as Result<T, VE[number][]>;
    }
    return this as Result<T, VE[number][]>;
  }

  /**
   * Runs async validators on the Ok value, collecting ALL errors.
   *
   * Explicit async variant of `validate` for when all validators are async.
   * Always returns `Promise<Result<T, E | VE[]>>`.
   *
   * @param validators - Array of async validator functions
   * @returns Promise resolving to Result<T, E | VE[]> with original value or array of all errors
   *
   * @example
   * ```ts
   * // Form validation with async checks
   * const validated = await Result.Ok(formData).validateAsync([
   *   async (d) => await checkEmailUnique(d.email),
   *   async (d) => await checkUsernameAvailable(d.username),
   * ]);
   *
   * // Password validation against database
   * await Result.Ok("password123!").validateAsync([
   *   async (pw) => await checkNotPreviousPassword(pw),
   *   async (pw) => await checkNotCommonPassword(pw),
   * ]);
   * ```
   *
   * @see validate
   */
  async validateAsync<VE extends unknown[]>(validators: {
    [K in keyof VE]: (val: T) => Promise<Result<unknown, VE[K]>>;
  }): Promise<Result<T, E | VE[number][]>> {
    if (this.isErr()) {
      return this as Result<T, VE[number][]>;
    }

    const baseVal = this.#val as T;
    return Promise.all(validators.map((v) => v(baseVal))).then((resolved) => {
      const errs: unknown[] = [];

      for (const r of resolved as Result<unknown, unknown>[]) {
        if (r.isErr()) errs.push(r.#err);
      }

      if (errs.length > 0) {
        return Result.Err<VE[number][], T>(errs as VE[number][]);
      }

      return this as Result<T, VE[number][]>;
    });
  }

  /**
   * Combines multiple Results, collecting all values or all errors.
   *
   * Unlike typical Result behavior which short-circuits on first error,
   * `all` collects ALL errors from all Results. This is useful when you
   * want to show complete validation feedback.
   *
   * - All Ok → `Ok([...values])` with preserved tuple types
   * - Any Err → `Err([...errors])` collecting ALL errors
   *
   * @param results - Variable number of Results to combine
   * @returns Result with tuple of all values, or array of all errors
   *
   * @example
   * ```ts
   * Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3));     // Ok([1, 2, 3])
   * Result.all(Result.Ok(1), Result.Err("a"), Result.Err("b")); // Err(["a", "b"])
   * Result.all();                                            // Ok([])
   *
   * // Real-world: Parallel validation
   * const [user, posts, likes] = await Promise.all([
   *   fetchUser(id),
   *   fetchPosts(id),
   *   fetchLikes(id),
   * ]);
   *
   * const combined = Result.all(user, posts, likes);
   * // Ok([User, Post[], Like[]]) or Err([...errors])
   * ```
   *
   * @see any
   * @see validate
   */
  static all<T extends Result<unknown, unknown>[]>(
    ...results: T
  ): Result<CombinedResultOk<T>, CombinedResultErr<T>[]> {
    const vals: unknown[] = [];
    const errs: unknown[] = [];

    for (const r of results) {
      if (r.isErr()) {
        errs.push(r.unwrapErr());
      } else {
        vals.push(r.unwrap());
      }
    }

    if (errs.length > 0) {
      return Result.Err(errs as CombinedResultErr<T>[]) as Result<
        CombinedResultOk<T>,
        CombinedResultErr<T>[]
      >;
    }

    return Result.Ok(vals as CombinedResultOk<T>) as Result<
      CombinedResultOk<T>,
      CombinedResultErr<T>[]
    >;
  }

  /**
   * Returns the first Ok, or collects all errors if all are Err.
   *
   * Useful for fallback chains where you want the first success, but want
   * to collect all errors if everything fails.
   *
   * - First Ok → Returns that Ok immediately
   * - All Err → `Err([...all errors])`
   *
   * @param results - Variable number of Results to check
   * @returns First Ok found, or Err with array of all errors
   *
   * @example
   * ```ts
   * Result.any(
   *   Result.Err("Error 1"),
   *   Result.Ok("First success"),
   *   Result.Ok("Second success"),
   * ); // Ok("First success")
   *
   * Result.any(
   *   Result.Err("Error 1"),
   *   Result.Err("Error 2"),
   *   Result.Err("Error 3"),
   * ); // Err(["Error 1", "Error 2", "Error 3"])
   *
   * // Fallback chain
   * Result.any(
   *   fetchFromCache(key),
   *   fetchFromDb(key),
   *   fetchFromRemote(key),
   * );
   * ```
   *
   * @see all
   */
  static any<U, F>(...results: Result<U, F>[]): Result<U, F[]> {
    for (const r of results) {
      if (r.isOk()) return r as Result<U, F[]>;
    }

    return Result.Err(results.map((r) => r.unwrapErr()));
  }

  /**
   * Executes a side effect function for Ok values, then returns self.
   *
   * Useful for logging, debugging, or executing effects without breaking the
   * method chain. The function is only called if the Result is Ok.
   *
   * For async side effects, use `tapAsync` instead.
   *
   * @param fn - Function to execute with the Ok value
   * @returns The same Result (chainable)
   *
   * @example
   * ```ts
   * Result.Ok(42)
   *   .tap((x) => console.log(`Processing: ${x}`))
   *   .map((x) => x * 2);
   * // Logs: "Processing: 42"
   * // Returns: Ok(84)
   *
   * // Err - tap does nothing
   * Result.Err("fail").tap((x) => console.log(x)); // Err("fail")
   * ```
   *
   * @see tapAsync
   * @see tapErr
   */
  tap(fn: (val: T) => Promise<void>): never;
  tap(fn: (val: T) => void): Result<T, E>;
  tap(fn: (val: T) => void): Result<T, E> {
    if (this.isOk()) {
      fn(this.#val);
    }

    return this;
  }

  /**
   * Executes an async side effect function for Ok values, then returns self.
   *
   * Same as `tap` but for async side effect functions.
   * Returns `Promise<Result<T, E>>`.
   *
   * @param fn - Async function to execute with the Ok value
   * @returns Promise resolving to the same Result (chainable)
   *
   * @example
   * ```ts
   * await Result.Ok(user)
   *   .tapAsync(async (u) => await logAuditTrail(u))
   *   .map((u) => u.id);
   * ```
   *
   * @see tap
   */
  async tapAsync(fn: (val: T) => Promise<void>): Promise<Result<T, E>> {
    if (this.isOk()) {
      await fn(this.#val);
    }

    return this;
  }

  /**
   * Executes a side effect function for Err values, then returns self.
   *
   * Useful for logging errors or executing cleanup without breaking the chain.
   * The function is only called if the Result is Err.
   *
   * For async side effects, use `tapErrAsync` instead.
   *
   * @param fn - Function to execute with the error
   * @returns The same Result (chainable)
   *
   * @example
   * ```ts
   * Result.Err("Connection failed")
   *   .tapErr((err) => console.error(`[Error Log] ${new Date().toISOString()}: ${err}`))
   *   .orElse((e) => Result.Ok(defaultValue));
   * // Logs error timestamp
   * // Returns: Ok(defaultValue)
   *
   * // Ok - tapErr does nothing
   * Result.Ok(42).tapErr((e) => console.log(e)); // Ok(42)
   * ```
   *
   * @see tapErrAsync
   * @see tap
   */
  tapErr(fn: (err: E) => void): Result<T, E> {
    if (this.isErr()) {
      fn(this.#err);
    }

    return this;
  }

  /**
   * Executes an async side effect function for Err values, then returns self.
   *
   * Same as `tapErr` but for async side effect functions.
   * Returns `Promise<Result<T, E>>`.
   *
   * @param fn - Async function to execute with the error
   * @returns Promise resolving to the same Result (chainable)
   *
   * @example
   * ```ts
   * await Result.Err("API error")
   *   .tapErrAsync(async (e) => await reportToSentry(e))
   *   .orElse((e) => Result.Ok(backupData));
   * ```
   *
   * @see tapErr
   */
  async tapErrAsync(fn: (err: E) => Promise<void>): Promise<Result<T, E>> {
    if (this.isErr()) {
      await fn(this.#err);
    }

    return this;
  }

  /**
   * Swaps the Ok and Err states, turning success into failure and vice versa.
   *
   * Useful for inverting the meaning of a Result, such as converting
   * validation errors to successes and valid values to errors.
   *
   * @returns Result<E, T> with swapped states
   *
   * @example
   * ```ts
   * Result.Ok("Success value").flip(); // Err("Success value")
   * Result.Err("Error value").flip();  // Ok("Error value")
   *
   * // Invert validation (fail if value is in blacklist)
   * const blacklist = ["admin", "root"];
   * const isBlacklisted = (name: string) =>
   *   Result.fromPredicate(name, (n) => !blacklist.includes(n), "blacklisted")
   *     .flip(); // Ok if blacklisted, Err if not
   * ```
   */
  flip(): Result<E, T> {
    if (this.isErr()) {
      return Result.Ok(this.#err);
    }

    return Result.Err(this.#val);
  }

  /**
   * Converts Result to Option, discarding error information.
   *
   * - Ok(value) → Some(value)
   * - Err(error) → None
   *
   * Use when you only care about presence/absence of a value, not the error.
   *
   * @returns Option<T> - Some if Ok, None if Err
   *
   * @example
   * ```ts
   * Result.Ok(42).toOption();   // Some(42)
   * Result.Err("fail").toOption(); // None
   *
   * // Safe user lookup
   * const userOpt = fetchUser(id).toOption();
   * // User or None, regardless of why fetch failed
   * ```
   *
   * @see Option.toResult
   */
  toOption(): Option<T> {
    if (this.isErr()) return Option.None;

    return Option.Some(this.#val);
  }

  /**
   * Maps over array elements inside a Result<Array<T>, E>.
   *
   * Applies the mapper function to each element if the Result is Ok and
   * contains an array. Propagates Err unchanged.
   *
   * @param mapper - Function to map over each array element
   * @returns Result<Array<Out>, E> with mapped array or propagated error
   * @throws Error if the Result is Ok but value is not an array
   *
   * @example
   * ```ts
   * Result.Ok([1, 2, 3]).innerMap((x) => x * 2); // Ok([2, 4, 6])
   * Result.Err("fail").innerMap((x) => x * 2);    // Err("fail")
   * ```
   */
  innerMap<In, E, Out>(
    this: Result<Array<In>, E>,
    mapper: (val: NoInfer<In>) => Out,
  ): Result<Array<Out>, E> {
    if (this.isErr()) return this as Result<Array<Out>, E>;

    if (Array.isArray(this.#val)) {
      return new Result(this.#val.map(mapper), this.#err, "Ok");
    }

    throw new Error("Can only be called for Result<Array<T>, E>");
  }

  /**
   * Makes Result iterable for use with generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   *
   * @example
   * ```ts
   * const result = Result.gen(function* () {
   *   const value = yield* Result.Ok(42);
   *   return value * 2;
   * });
   * ```
   */
  *[Symbol.iterator](): Generator<Result<T, E>, T, unknown> {
    return (yield this) as T;
  }

  /**
   * Makes Result iterable for use with async generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   *
   * @example
   * ```ts
   * const result = await Result.asyncGen(async function* () {
   *   const value = yield* $(Result.Ok(42));
   *   return value * 2;
   * });
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, unknown> {
    return (yield this) as T;
  }

  // Static constructors

  static fromNullable<T, E>(
    val: T | null | undefined,
    error: E,
  ): Result<NonNullable<T>, E> {
    return val === null || val === undefined
      ? Result.Err(error)
      : Result.Ok(val as NonNullable<T>);
  }

  /** Create Result based on predicate result */
  static fromPredicate<T, E>(
    val: T,
    pred: (v: T) => boolean,
    error: E,
  ): Result<T, E> {
    return pred(val) ? Result.Ok(val) : Result.Err(error);
  }
}

export namespace Result {
  /** Catches sync exceptions */
  // export function tryCatch<_T, E = unknown>(
  //   fn: () => Promise<any>,
  //   errorMapper?: (e: unknown) => E,
  // ): never;
  // export function tryCatch<T, E = unknown>(
  //   fn: () => T,
  //   errorMapper?: (e: unknown) => E,
  // ): Result<T, E>;
  export function tryCatch<T, E = unknown>(
    fn: () => T,
    errorMapper?: (e: unknown) => E,
  ): Result<T, E> {
    try {
      return Result.Ok(fn());
    } catch (e) {
      return Result.Err(errorMapper ? errorMapper(e) : (e as E));
    }
  }

  /** Catches async exceptions - returns Promise<Result<T, E>> */
  export async function tryAsyncCatch<T, E = unknown>(
    fn: () => Promise<T>,
    errorMapper?: (e: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      return Result.Ok(await fn());
    } catch (e) {
      return Result.Err(errorMapper ? errorMapper(e) : (e as E));
    }
  }

  /**
   * Generator-based syntax for chaining Result operations (simplified, no adapter).
   * Provides imperative-style code while maintaining functional error handling.
   *
   * Short-circuits on first Err, returning that error. Uses iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const result = Result.gen(function* () {
   *   const a = yield* Result.Ok(1);
   *   const b = yield* Result.Ok(2);
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  export function gen<Eff extends Result<any, any>, T>(
    // biome-ignore lint/suspicious/noExplicitAny: inference
    genFn: () => Generator<Eff, T, any>,
  ): Result<T, ExtractError<Eff>> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Result<T, ExtractError<Eff>>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value);
        break;
      }

      // next.value is the Result that was yielded
      const yielded = next.value as Result<unknown, unknown>;

      if (yielded.isErr()) {
        // Early termination on error - return the Err result
        currentResult = yielded as unknown as Result<T, ExtractError<Eff>>;
        break;
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = yielded.unwrap();
    }

    return currentResult;
  }

  /**
   * Generator-based syntax for chaining Result operations (with adapter).
   * Uses an adapter function ($) for improved type inference.
   *
   * Short-circuits on first Err, returning that error. Uses iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const result = Result.genAdapter(function* ($) {
   *   const a = yield* $(Result.Ok(1));
   *   const b = yield* $(Result.Ok(2));
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  export function genAdapter<Eff extends ResultYieldWrap<any, any>, T>(
    genFn: (
      adapter: <A, E>(result: Result<A, E>) => ResultYieldWrap<A, E>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => Generator<Eff, T, any>,
  ): Result<T, ExtractResultError<Eff>> {
    const adapter = <A, E>(result: Result<A, E>): ResultYieldWrap<A, E> =>
      new ResultYieldWrap(result);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Result<T, ExtractResultError<Eff>>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value);
        break;
      }

      // next.value is the ResultYieldWrap that was yielded
      const wrapped = next.value as ResultYieldWrap<unknown, unknown>;
      const result = wrapped.result;

      if (result.isErr()) {
        // Early termination on error - return the Err result
        currentResult = result as unknown as Result<T, ExtractResultError<Eff>>;
        break;
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining Result operations (simplified, no adapter).
   * Use yield* with Result values directly. For Promise<Result<T, E>>, await first then yield*.
   *
   * Short-circuits on first Err, returning that error. Uses async iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const fetchData = (id: number): Promise<Result<{id: number}, string>> => ({ id });
   * const result = await Result.asyncGen(async function* () {
   *   const a = yield* Result.Ok(1);
   *   const dataResult = yield* $(await fetchData(a));
   *   return a + dataResult.id;
   * });
   * // Result<number, never>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  export async function asyncGen<Eff extends Result<any, any>, T>(
    // biome-ignore lint/suspicious/noExplicitAny: inference
    genFn: () => AsyncGenerator<Eff, T, any>,
  ): Promise<Result<T, ExtractError<Eff>>> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Result<T, ExtractError<Eff>>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value);
        break;
      }

      // next.value is a Result (user awaits promises before yielding)
      const result = next.value as Result<unknown, unknown>;

      if (result.isErr()) {
        // Early termination on error - return the Err result
        currentResult = result as unknown as Result<T, ExtractError<Eff>>;
        break;
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining Result operations (with adapter).
   * Uses an adapter function ($) for improved type inference.
   * Supports both Result<T, E> and Promise<Result<T, E>> for flexibility.
   *
   * Short-circuits on first Err, returning that error. Uses async iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const fetchData = (id: number): Promise<Result<{id: number}, string>> => ({ id });
   * const result = await Result.asyncGenAdapter(async function* ($) {
   *   const a = yield* $(Result.Ok(1));
   *   const data = yield* $(fetchData(a));
   *   return a + data.id;
   * });
   * // Result<number, never>
   * ```
   */
  export async function asyncGenAdapter<
    // biome-ignore lint/suspicious/noExplicitAny: inference
    Eff extends AsyncResultYieldWrap<any, any>,
    T,
  >(
    genFn: (
      adapter: <A, E2>(
        result: Result<A, E2> | Promise<Result<A, E2>>,
      ) => AsyncResultYieldWrap<A, E2>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => AsyncGenerator<Eff, T, any>,
  ): Promise<Result<T, ExtractAsyncResultError<Eff>>> {
    const adapter = <A, E2>(
      result: Result<A, E2> | Promise<Result<A, E2>>,
    ): AsyncResultYieldWrap<A, E2> =>
      new AsyncResultYieldWrap(Promise.resolve(result));

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Result<T, ExtractAsyncResultError<Eff>>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value);
        break;
      }

      // next.value is the AsyncResultYieldWrap that was yielded
      const wrapped = next.value as AsyncResultYieldWrap<unknown, unknown>;
      const result = await wrapped.result;

      if (result.isErr()) {
        // Early termination on error - return the Err result
        currentResult = result as unknown as Result<
          T,
          ExtractAsyncResultError<Eff>
        >;
        break;
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap();
    }

    return currentResult;
  }
}
