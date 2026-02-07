import { UnwrappedErrWithOk, UnwrappedOkWithErr } from "./errors.js"
import { ExperimentalOption as Option } from "./option-experimental.js"
import { UNIT } from "./unit.js"
import { CapturedTrace, isCapturedTrace, isPromiseLike } from "./utils.js"

export type UnitResult<E = never> = ExperimentalResult<UNIT, E>

export type UnwrapResult<T extends ExperimentalResult<unknown, unknown>> =
  T extends ExperimentalResult<infer U, infer E> ? { ok: U; err: E } : never

type CombinedResultOk<T extends ExperimentalResult<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["ok"]
}
type CombinedResultErr<T extends ExperimentalResult<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["err"]
}[number]

export type CombineResults<T extends ExperimentalResult<unknown, unknown>[]> =
  ExperimentalResult<CombinedResultOk<T>, CombinedResultErr<T>>

/** Sentinel value stored in #val when Result is Err */
const ERR_VAL = Symbol("Result::Err")

interface MatchCases<T, E, U> {
  Ok: (val: T) => U
  Err: (err: E) => U
}

/**
 * Wrapper that makes Result yieldable with proper type tracking.
 * The Generator signature ensures TypeScript tracks the inner type T.
 *
 * @internal
 */
class ResultYieldWrap<T, E> {
  constructor(readonly result: ExperimentalResult<T, E>) {}

  *[Symbol.iterator](): Generator<ResultYieldWrap<T, E>, T, unknown> {
    const trace = new Error().stack
    return (yield new CapturedTrace(this, trace) as unknown as ResultYieldWrap<
      T,
      E
    >) as T
  }
}

/**
 * Wrapper that makes Result yieldable in async generators with proper type tracking.
 * Supports Promise<Result<T, E>> for async result chaining.
 *
 * @internal
 */
class AsyncResultYieldWrap<T, E> {
  constructor(readonly result: Promise<ExperimentalResult<T, E>>) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<
    AsyncResultYieldWrap<T, E>,
    T,
    unknown
  > {
    const trace = new Error().stack
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as AsyncResultYieldWrap<T, E>) as T
  }
}

/** Extract error type from yielded values */
type ExtractResultError<T> =
  // biome-ignore lint/suspicious/noExplicitAny: inference
  T extends ResultYieldWrap<any, infer E> ? E : never

/** Extract error type from async yielded values */
type ExtractAsyncResultError<T> =
  // biome-ignore lint/suspicious/noExplicitAny: inference
  T extends AsyncResultYieldWrap<any, infer E> ? E : never

/** Extract error type directly from ExperimentalResult */
// biome-ignore lint/suspicious/noExplicitAny: inference
type ExtractError<T> = T extends ExperimentalResult<any, infer E> ? E : never

export class ExperimentalResult<T, E> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Ok" | "Err"

  /** Value when Ok; ERR_VAL sentinel when Err */
  readonly #val: T

  /** Error when Err (sync); undefined when Ok */
  readonly #err: E

  private constructor(val: T, err: E, tag: "Ok" | "Err") {
    this.#val = val
    this.#err = err
    this._tag = tag
  }

  /** Singleton UNIT_RESULT for void-success operations */
  static readonly UNIT_RESULT: ExperimentalResult<UNIT, never> =
    new ExperimentalResult(UNIT, undefined as never, "Ok")

  /** Create an Ok containing the given value */
  static Ok<T, E = never>(this: void, val: T): ExperimentalResult<T, E> {
    return new ExperimentalResult(val, undefined as E, "Ok")
  }

  /** Create an Err containing the given error */
  static Err<E, T = never>(this: void, err: E): ExperimentalResult<T, E> {
    return new ExperimentalResult(ERR_VAL as T, err, "Err")
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
   * const result = ExperimentalResult.Ok(42);
   * if (result.isOk()) {
   *   // TypeScript knows value is accessible: 42
   *   console.log(result.unwrap()); // 42
   * }
   * ```
   *
   * @see isErr
   */
  isOk(): this is ExperimentalResult<T, never> {
    return this._tag === "Ok" && this.#val !== ERR_VAL
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
  isErr(): this is ExperimentalResult<never, E> {
    return this._tag === "Err" || this.#val === ERR_VAL
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
  isUnit(): this is ExperimentalResult<UNIT, never> {
    return this.#val === UNIT
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
   * ExperimentalResult.Ok(42).toString();      // "Result::Ok<42>"
   * Result.Err("fail").toString(); // "Result::Err<fail>"
   * ```
   */
  toString(): string {
    if (this.isOk()) {
      return `Result::Ok<${String(this.#val)}>`
    }
    return `Result::Err<${String(this.#err)}>`
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
   * ExperimentalResult.Ok(42).unwrap();           // 42
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
      const err = this.#err
      if (err instanceof Error) throw err

      throw new UnwrappedOkWithErr(this.toString())
    }

    return this.#val
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
   * ExperimentalResult.Ok(42).unwrapErr();        // throws UnwrappedErrWithOk
   * ```
   */
  unwrapErr(): E {
    if (this._tag === "Err") {
      return this.#err
    }

    throw new UnwrappedErrWithOk(this.toString())
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
   * ExperimentalResult.Ok(42).unwrapOr(0);        // 42
   * Result.Err("fail").unwrapOr(0);   // 0
   * ```
   *
   * @see unwrapOrElse
   * @see safeUnwrap
   */
  unwrapOr(defaultValue: T): T {
    if (this.isErr()) return defaultValue

    return this.#val
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
   * ExperimentalResult.Ok(42).unwrapOrElse((err) => 0); // 42
   * ```
   *
   * @see unwrapOr
   * @see unwrap
   */
  unwrapOrElse(fn: (err: E) => T): T {
    if (this.isErr()) return fn(this.#err)

    return this.#val
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
   * ExperimentalResult.Ok(42).safeUnwrap();       // 42
   * Result.Err("fail").safeUnwrap();  // null
   *
   * // Useful for null coalescing
   * const value = result.safeUnwrap() ?? "default";
   * ```
   *
   * @see unwrapOr
   */
  safeUnwrap(): T | null {
    if (this.isErr()) return null

    return this.#val === ERR_VAL ? null : this.#val
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
   * const message = ExperimentalResult.Ok(42).match({
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
      return cases.Err(this.#err)
    }

    return cases.Ok(this.#val)
  }

  /**
   * Pattern matches using positional arguments (FP convention alias for `match`).
   *
   * This is a more concise alternative to `match` using positional arguments
   * instead of an object. Familiar to developers from Scala, Haskell, and other FP languages.
   *
   * @template U - The result type of both branches
   * @param onOk - Handler called with the value if `Ok`
   * @param onErr - Handler called with the error if `Err`
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * const result = ExperimentalResult.Ok(42).fold(
   *   (value) => `Success: ${value}`,
   *   (error) => `Failed: ${error}`
   * );
   * // "Success: 42"
   *
   * const errResult = Result.Err("network error").fold(
   *   (value) => `Success: ${value}`,
   *   (error) => `Failed: ${error}`
   * );
   * // "Failed: network error"
   *
   * // Equivalent to match:
   * result.fold(onOk, onErr);
   * result.match({ Ok: onOk, Err: onErr });
   * ```
   *
   * @see {@link match} for object-based pattern matching
   * @see {@link foldAsync} for async handlers
   */
  fold<U>(onOk: (val: T) => U, onErr: (err: E) => U): U {
    if (this.isErr()) {
      return onErr(this.#err)
    }
    return onOk(this.#val)
  }

  /**
   * Async pattern matching using positional arguments.
   *
   * Async variant of `fold` for when handlers return Promises.
   *
   * @template U - The result type of both branches
   * @param onOk - Async handler called with the value if `Ok`
   * @param onErr - Async handler called with the error if `Err`
   * @returns Promise resolving to the result of the appropriate handler
   *
   * @example
   * ```ts
   * const result = await ExperimentalResult.Ok(userId).foldAsync(
   *   async (id) => await fetchUserData(id),
   *   async (error) => await logAndGetFallback(error)
   * );
   *
   * // Error recovery with logging
   * const data = await apiResult.foldAsync(
   *   async (response) => await processResponse(response),
   *   async (error) => {
   *     await reportError(error);
   *     return getDefaultData();
   *   }
   * );
   * ```
   *
   * @see {@link fold} for synchronous handlers
   * @see {@link matchAsync} for object-based async pattern matching
   */
  async foldAsync<U>(
    onOk: (val: T) => Promise<U>,
    onErr: (err: E) => Promise<U>,
  ): Promise<U> {
    if (this.isErr()) {
      return onErr(this.#err)
    }
    return onOk(this.#val)
  }

  /**
   * Async pattern matching on both states of the Result.
   *
   * Async variant of `match` for when handlers return Promises.
   *
   * @template U - The result type of both branches
   * @param cases - Object containing async handlers for both states
   * @returns Promise resolving to the result of the appropriate handler
   *
   * @example
   * ```ts
   * const result = await apiResult.matchAsync({
   *   Ok: async (data) => await processData(data),
   *   Err: async (error) => await handleError(error)
   * });
   *
   * // With database operations
   * const user = await findUserResult.matchAsync({
   *   Ok: async (user) => await enrichUserData(user),
   *   Err: async (error) => {
   *     await logError(error);
   *     return createGuestUser();
   *   }
   * });
   * ```
   *
   * @see {@link match} for synchronous pattern matching
   * @see {@link foldAsync} for positional-argument async matching
   */
  async matchAsync<U>(cases: {
    Ok: (val: T) => Promise<U>
    Err: (err: E) => Promise<U>
  }): Promise<U> {
    if (this.isErr()) {
      return cases.Err(this.#err)
    }
    return cases.Ok(this.#val)
  }

  /**
   * Pattern matches with a subset of cases, using a default for unhandled cases.
   *
   * Unlike `match` which requires all cases, `matchPartial` allows handling
   * only specific cases with a fallback default value or function.
   *
   * @template U - The result type
   * @param cases - Partial object with optional `Ok` and `Err` handlers
   * @param getDefault - Lazy default function for unhandled cases
   * @returns The result of the matching handler or the default
   *
   * @example
   * ```ts
   * // Only handle Ok, default for Err
   * ExperimentalResult.Ok(42).matchPartial({ Ok: (v) => v * 2 }, () => 0); // 84
   * ExperimentalResult.Err("fail").matchPartial({ Ok: (v) => v * 2 }, () => 0); // 0
   *
   * // Only handle Err for logging
   * result.matchPartial({ Err: (e) => { logError(e); return null; } }, () => null);
   *
   * // Lazy default with function
   * result.matchPartial(
   *   { Ok: (v) => process(v) },
   *   () => computeExpensiveDefault()
   * );
   * ```
   *
   * @see {@link match} for exhaustive pattern matching
   */
  matchPartial<U>(cases: Partial<MatchCases<T, E, U>>, getDefault: () => U): U {
    if (this.isErr()) {
      return cases.Err ? cases.Err(this.#err) : getDefault()
    }

    return cases.Ok ? cases.Ok(this.#val) : getDefault()
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
   * ExperimentalResult.Ok(42).map((x) => x * 2);           // Ok(84)
   * Result.Err("fail").map((x) => x * 2);       // Err("fail")
   * ```
   *
   * @see mapAsync
   * @see flatMap
   */
  map<U>(fn: (val: T) => Promise<U>): never
  map<U>(fn: (val: T) => U): ExperimentalResult<U, E>
  map<U>(fn: (val: T) => U): ExperimentalResult<U, E> {
    if (this.isErr()) {
      return ExperimentalResult.Err(this.#err) as ExperimentalResult<U, E>
    }
    const curr = this.#val
    return ExperimentalResult.Ok(fn(curr as T))
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
   * await ExperimentalResult.Ok(42).mapAsync(async (x) => x * 2); // Promise<Ok(84)>
   * await Result.Err("fail").mapAsync(async (x) => x * 2); // Promise<Err("fail")>
   * ```
   *
   * @see map
   */
  async mapAsync<U>(
    fn: (val: T) => Promise<U>,
  ): Promise<ExperimentalResult<U, E>> {
    if (this.isErr()) {
      return Promise.resolve(ExperimentalResult.Err<E, U>(this.#err))
    }

    const curr = this.#val
    return fn(curr)
      .then((u) => ExperimentalResult.Ok(u))
      .catch((e) => ExperimentalResult.Err(e as E))
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
   * ExperimentalResult.Ok(42)
   *   .flatMap((x) => ExperimentalResult.Ok(x + 1))        // Ok(43)
   *   .flatMap((x) => Result.Err("too big"));  // Err("too big")
   *
   * // Error propagation
   * Result.Err("initial").flatMap((x) => ExperimentalResult.Ok(x + 1)); // Err("initial")
   * ```
   *
   * @see flatMapAsync
   * @see map
   * @see flatZip
   */
  flatMap<U, E2>(
    fn: (val: T) => ExperimentalResult<U, E2>,
  ): ExperimentalResult<U, E | E2> {
    if (this.isErr()) {
      return ExperimentalResult.Err<E | E2, U>(this.#err)
    }

    return fn(this.#val) as ExperimentalResult<U, E | E2>
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
   *   Promise.resolve(ExperimentalResult.Ok({ id, name: "Alice" }));
   *
   * await ExperimentalResult.Ok(42)
   *   .flatMapAsync(fetchUser)
   *   .then((r) => r.map((user) => user.name));
   * // Promise<Ok("Alice")>
   * ```
   *
   * @see flatMap
   */
  async flatMapAsync<U, E2>(
    fn: (val: T) => Promise<ExperimentalResult<U, E2>>,
  ): Promise<ExperimentalResult<U, E | E2>> {
    if (this.isErr()) {
      return ExperimentalResult.Err<E | E2, U>(this.#err)
    }

    return fn(this.#val as T)
      .then((r) =>
        r.isErr()
          ? ExperimentalResult.Err<E | E2, U>(r.#err)
          : (r as ExperimentalResult<U, E | E2>),
      )
      .catch((e) => ExperimentalResult.Err<E | E2, U>(e))
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
   * ExperimentalResult.Ok(42).zip((x) => x * 10);        // Ok([42, 420])
   * Result.Err("fail").zip((x) => x * 10);   // Err("fail")
   *
   * // Keep original while computing related value
   * ExperimentalResult.Ok(user).zip((u) => u.permissions.length); // Ok([user, 5])
   * ```
   *
   * @see zipAsync
   * @see flatZip
   * @see map
   */
  zip<U>(fn: (val: T) => Promise<U>): never
  zip<U>(fn: (val: T) => U): ExperimentalResult<[prev: T, current: U], E>
  zip<U>(fn: (val: T) => U): ExperimentalResult<[T, U], E> {
    if (this.isErr()) {
      return ExperimentalResult.Err<E, [T, U]>(this.#err)
    }

    const curr = this.#val
    return ExperimentalResult.Ok([curr, fn(curr)])
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
   * await ExperimentalResult.Ok(42).zipAsync(async (x) => x * 10); // Promise<Ok([42, 420])>
   * ```
   *
   * @see zip
   */
  async zipAsync<U>(
    fn: (val: T) => Promise<U>,
  ): Promise<ExperimentalResult<[T, U], E>> {
    if (this.isErr()) {
      return ExperimentalResult.Err<E, [T, U]>(this.#err)
    }

    const curr = this.#val
    return fn(curr).then((u) => ExperimentalResult.Ok([curr, u]))
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
   * ExperimentalResult.Ok(42)
   *   .flatZip((x) => ExperimentalResult.Ok(x + 5))       // Ok([42, 47])
   *   .flatZip(([a, b]) => Result.Err("x"));  // Err("x")
   *
   * ExperimentalResult.Ok(42).flatZip((x) => Result.Err("fail")); // Err("fail")
   * Result.Err("init").flatZip((x) => ExperimentalResult.Ok(5)); // Err("init")
   * ```
   *
   * @see flatZipAsync
   * @see zip
   * @see flatMap
   */
  flatZip<U, E2>(
    fn: (val: T) => ExperimentalResult<U, E2>,
  ): ExperimentalResult<[T, U], E | E2> {
    if (this.isErr()) {
      return ExperimentalResult.Err(this.#err) as ExperimentalResult<
        [T, U],
        E | E2
      >
    }
    const curr = this.#val as T
    const r = fn(curr)
    if (r.isErr()) {
      return ExperimentalResult.Err(r.unwrapErr() as E | E2)
    }
    return ExperimentalResult.Ok([curr, r.unwrap() as U])
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
   *   Promise.resolve(ExperimentalResult.Ok({ id, value: 100 }));
   *
   * await ExperimentalResult.Ok(42).flatZipAsync(fetchData); // Promise<Ok([42, {id: 42, value: 100}])>
   * ```
   *
   * @see flatZip
   */
  async flatZipAsync<U, E2>(
    fn: (val: T) => Promise<ExperimentalResult<U, E2>>,
  ): Promise<ExperimentalResult<[T, U], E | E2>> {
    if (this.isErr()) {
      return ExperimentalResult.Err<E | E2, [T, U]>(this.#err)
    }

    const curr = this.#val
    return fn(curr).then((r) => {
      if (r.isErr()) {
        return ExperimentalResult.Err(r.unwrapErr() as E | E2)
      }

      return ExperimentalResult.Ok([curr, r.unwrap() as U])
    })
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
   * ExperimentalResult.Ok(42).mapErr((e) => `Error: ${e}`);                  // Ok(42)
   *
   * // Add context to errors
   * fetchData()
   *   .mapErr((e) => new ContextualError("Failed to fetch data", e));
   * ```
   *
   * @see mapErrAsync
   * @see mapBoth
   */
  mapErr<E2>(fn: (err: E) => Promise<E2>): never
  mapErr<E2>(fn: (err: E) => E2): ExperimentalResult<T, E2>
  mapErr<E2>(fn: (err: E) => E2): ExperimentalResult<T, E2> {
    if (this.isErr()) {
      return ExperimentalResult.Err(fn(this.#err))
    }

    return ExperimentalResult.Ok(this.#val)
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
  async mapErrAsync<E2>(
    fn: (err: E) => Promise<E2>,
  ): Promise<ExperimentalResult<T, E2>> {
    if (this.isErr()) {
      return fn(this.#err).then((e) => ExperimentalResult.Err(e))
    }

    return ExperimentalResult.Ok(this.#val)
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
   * ExperimentalResult.Ok(42).mapBoth(
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
  mapBoth<T2, E2>(fnOk: (val: T) => Promise<T2>, fnErr: (err: E) => E2): never
  mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (err: E) => Promise<E2>): never
  mapBoth<T2, E2>(
    fnOk: (val: T) => T2,
    fnErr: (err: E) => E2,
  ): ExperimentalResult<T2, E2>
  mapBoth<T2, E2>(
    fnOk: (val: T) => T2,
    fnErr: (err: E) => E2,
  ): ExperimentalResult<T2, E2> {
    if (this.isErr()) {
      return ExperimentalResult.Err(fnErr(this.#err))
    }
    return ExperimentalResult.Ok(fnOk(this.#val))
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
   * await ExperimentalResult.Ok(42).mapBothAsync(
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
  ): Promise<ExperimentalResult<T2, E2>> {
    if (this.isErr()) {
      return fnErr(this.#err).then((e) => ExperimentalResult.Err(e))
    }

    return fnOk(this.#val).then((v) => ExperimentalResult.Ok(v))
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
   *   .orElse((e) => ExperimentalResult.Ok(defaultValue));
   *
   * // Ok passes through unchanged
   * ExperimentalResult.Ok(42).orElse((e) => ExperimentalResult.Ok(0)); // Ok(42)
   *
   * // Err triggers recovery
   * Result.Err("not found").orElse((e) => ExperimentalResult.Ok(0)); // Ok(0)
   * Result.Err("fail").orElse((e) => Result.Err("critical")); // Err("critical")
   * ```
   *
   * @see orElseAsync
   */
  orElse<E2>(
    fn: (err: E) => ExperimentalResult<T, E2>,
  ): ExperimentalResult<T, E2> {
    if (this.isOk()) return this as ExperimentalResult<T, E2>
    return fn(this.#err)
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
    fn: (err: E) => Promise<ExperimentalResult<T, E2>>,
  ): Promise<ExperimentalResult<T, E2>> {
    if (this.isOk()) {
      return this as ExperimentalResult<T, E2>
    }

    return fn(this.#err)
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
   *   (x: number) => x > 0 ? ExperimentalResult.Ok(true) : Result.Err("must be positive"),
   *   (x: number) => x < 100 ? ExperimentalResult.Ok(true) : Result.Err("must be < 100"),
   *   (x: number) => x % 2 === 0 ? ExperimentalResult.Ok(true) : Result.Err("must be even"),
   * ];
   *
   * ExperimentalResult.Ok(42).validate(validators);                // Ok(42)
   * ExperimentalResult.Ok(101).validate(validators);               // Err(["must be < 100"])
   * ExperimentalResult.Ok(-5).validate(validators);                // Err(["must be positive", "must be even"])
   * Result.Err("init").validate(validators);           // Err("init") - validators not run
   *
   * // With async validators (returns Promise<Result<...>>)
   * await ExperimentalResult.Ok(data).validate([
   *   async (d) => await validateEmail(d),
   *   async (d) => await validatePhone(d),
   * ]);
   * ```
   *
   * @see validateAsync
   * @see all
   */
  validate<VE extends unknown[]>(validators: {
    [K in keyof VE]: (val: T) => ExperimentalResult<unknown, VE[K]>
  }): ExperimentalResult<T, E | VE[number][]>
  validate<VE extends unknown[]>(validators: {
    [K in keyof VE]: (val: T) => Promise<ExperimentalResult<unknown, VE[K]>>
  }): Promise<ExperimentalResult<T, E | VE[number][]>>
  validate<VE extends unknown[]>(validators: {
    [K in keyof VE]:
      | ((val: T) => ExperimentalResult<unknown, VE[K]>)
      | ((val: T) => Promise<ExperimentalResult<unknown, VE[K]>>)
  }):
    | ExperimentalResult<T, E | VE[number][]>
    | Promise<ExperimentalResult<T, E | VE[number][]>> {
    if (this.isErr()) return this as ExperimentalResult<T, VE[number][]>

    const baseVal = this.#val as T
    const results = validators.map((v) => v(baseVal))

    // Check if any result is promise-like (includes thenables)
    if (results.some((r) => isPromiseLike(r))) {
      return Promise.all(results).then((resolved) => {
        const errs: unknown[] = []
        for (const r of resolved as ExperimentalResult<unknown, unknown>[]) {
          if (r.isErr()) errs.push(r.unwrapErr())
        }
        if (errs.length > 0) {
          return ExperimentalResult.Err(
            errs as VE[number][],
          ) as ExperimentalResult<T, VE[number][]>
        }
        return this as ExperimentalResult<T, VE[number][]>
      })
    }

    const syncResults = results as ExperimentalResult<unknown, unknown>[]
    const errs: unknown[] = []
    for (const r of syncResults) {
      if (r.isErr()) errs.push(r.#err)
    }
    if (errs.length > 0) {
      return ExperimentalResult.Err(errs as VE[number][]) as ExperimentalResult<
        T,
        VE[number][]
      >
    }
    return this as ExperimentalResult<T, VE[number][]>
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
   * const validated = await ExperimentalResult.Ok(formData).validateAsync([
   *   async (d) => await checkEmailUnique(d.email),
   *   async (d) => await checkUsernameAvailable(d.username),
   * ]);
   *
   * // Password validation against database
   * await ExperimentalResult.Ok("password123!").validateAsync([
   *   async (pw) => await checkNotPreviousPassword(pw),
   *   async (pw) => await checkNotCommonPassword(pw),
   * ]);
   * ```
   *
   * @see validate
   */
  async validateAsync<VE extends unknown[]>(validators: {
    [K in keyof VE]: (val: T) => Promise<ExperimentalResult<unknown, VE[K]>>
  }): Promise<ExperimentalResult<T, E | VE[number][]>> {
    if (this.isErr()) {
      return this as ExperimentalResult<T, VE[number][]>
    }

    const baseVal = this.#val as T
    return Promise.all(validators.map((v) => v(baseVal))).then((resolved) => {
      const errs: unknown[] = []

      for (const r of resolved as ExperimentalResult<unknown, unknown>[]) {
        if (r.isErr()) errs.push(r.#err)
      }

      if (errs.length > 0) {
        return ExperimentalResult.Err<VE[number][], T>(errs as VE[number][])
      }

      return this as ExperimentalResult<T, VE[number][]>
    })
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
   * Result.all(ExperimentalResult.Ok(1), ExperimentalResult.Ok(2), ExperimentalResult.Ok(3));     // Ok([1, 2, 3])
   * Result.all(ExperimentalResult.Ok(1), Result.Err("a"), Result.Err("b")); // Err(["a", "b"])
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
  static all<T extends ExperimentalResult<unknown, unknown>[]>(
    ...results: T
  ): ExperimentalResult<CombinedResultOk<T>, CombinedResultErr<T>[]> {
    const vals: unknown[] = []
    const errs: unknown[] = []

    for (const r of results) {
      if (r.isErr()) {
        errs.push(r.unwrapErr())
      } else {
        vals.push(r.unwrap())
      }
    }

    if (errs.length > 0) {
      return ExperimentalResult.Err(
        errs as CombinedResultErr<T>[],
      ) as ExperimentalResult<CombinedResultOk<T>, CombinedResultErr<T>[]>
    }

    return ExperimentalResult.Ok(
      vals as CombinedResultOk<T>,
    ) as ExperimentalResult<CombinedResultOk<T>, CombinedResultErr<T>[]>
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
   *   ExperimentalResult.Ok("First success"),
   *   ExperimentalResult.Ok("Second success"),
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
  static any<U, F>(
    ...results: ExperimentalResult<U, F>[]
  ): ExperimentalResult<U, F[]> {
    for (const r of results) {
      if (r.isOk()) return r as ExperimentalResult<U, F[]>
    }

    return ExperimentalResult.Err(results.map((r) => r.unwrapErr()))
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
   * ExperimentalResult.Ok(42)
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
  tap(fn: (val: T) => Promise<void>): never
  tap(fn: (val: T) => void): ExperimentalResult<T, E>
  tap(fn: (val: T) => void): ExperimentalResult<T, E> {
    if (this.isOk()) {
      fn(this.#val)
    }

    return this
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
   * await ExperimentalResult.Ok(user)
   *   .tapAsync(async (u) => await logAuditTrail(u))
   *   .map((u) => u.id);
   * ```
   *
   * @see tap
   */
  async tapAsync(
    fn: (val: T) => Promise<void>,
  ): Promise<ExperimentalResult<T, E>> {
    if (this.isOk()) {
      await fn(this.#val)
    }

    return this
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
   *   .orElse((e) => ExperimentalResult.Ok(defaultValue));
   * // Logs error timestamp
   * // Returns: Ok(defaultValue)
   *
   * // Ok - tapErr does nothing
   * ExperimentalResult.Ok(42).tapErr((e) => console.log(e)); // Ok(42)
   * ```
   *
   * @see tapErrAsync
   * @see tap
   */
  tapErr(fn: (err: E) => void): ExperimentalResult<T, E> {
    if (this.isErr()) {
      fn(this.#err)
    }

    return this
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
   *   .orElse((e) => ExperimentalResult.Ok(backupData));
   * ```
   *
   * @see tapErr
   */
  async tapErrAsync(
    fn: (err: E) => Promise<void>,
  ): Promise<ExperimentalResult<T, E>> {
    if (this.isErr()) {
      await fn(this.#err)
    }

    return this
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
   * ExperimentalResult.Ok("Success value").flip(); // Err("Success value")
   * Result.Err("Error value").flip();  // Ok("Error value")
   *
   * // Invert validation (fail if value is in blacklist)
   * const blacklist = ["admin", "root"];
   * const isBlacklisted = (name: string) =>
   *   Result.fromPredicate(name, (n) => !blacklist.includes(n), "blacklisted")
   *     .flip(); // Ok if blacklisted, Err if not
   * ```
   */
  flip(): ExperimentalResult<E, T> {
    if (this.isErr()) {
      return ExperimentalResult.Ok(this.#err)
    }

    return ExperimentalResult.Err(this.#val)
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
   * ExperimentalResult.Ok(42).toOption();   // Some(42)
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
    if (this.isErr()) return Option.None

    return Option.Some(this.#val)
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
   * ExperimentalResult.Ok([1, 2, 3]).innerMap((x) => x * 2); // Ok([2, 4, 6])
   * Result.Err("fail").innerMap((x) => x * 2);    // Err("fail")
   * ```
   */
  innerMap<In, E, Out>(
    this: ExperimentalResult<Array<In>, E>,
    mapper: (val: NoInfer<In>) => Out,
  ): ExperimentalResult<Array<Out>, E> {
    if (this.isErr()) return this as ExperimentalResult<Array<Out>, E>

    if (Array.isArray(this.#val)) {
      return new ExperimentalResult(this.#val.map(mapper), this.#err, "Ok")
    }

    throw new Error("Can only be called for Result<Array<T>, E>")
  }

  /**
   * Makes Result iterable for use with generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   *
   * @example
   * ```ts
   * const result = Result.gen(function* () {
   *   const value = yield* ExperimentalResult.Ok(42);
   *   return value * 2;
   * });
   * ```
   */
  *[Symbol.iterator](): Generator<ExperimentalResult<T, E>, T, unknown> {
    const trace = new Error().stack
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as ExperimentalResult<T, E>) as T
  }

  /**
   * Makes Result iterable for use with async generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   *
   * @example
   * ```ts
   * const result = await ExperimentalResult.asyncGen(async function* () {
   *   const value = yield* ExperimentalResult.Ok(42);
   *   return value * 2;
   * });
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<
    ExperimentalResult<T, E>,
    T,
    unknown
  > {
    const trace = new Error().stack
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as ExperimentalResult<T, E>) as T
  }

  // Static constructors

  static fromNullable<T, E>(
    val: T | null | undefined,
    error: E,
  ): ExperimentalResult<NonNullable<T>, E> {
    return val === null || val === undefined
      ? ExperimentalResult.Err(error)
      : ExperimentalResult.Ok(val as NonNullable<T>)
  }

  /** Create Result based on predicate result */
  static fromPredicate<T, E>(
    val: T,
    pred: (v: T) => boolean,
    error: E,
  ): ExperimentalResult<T, E> {
    return pred(val)
      ? ExperimentalResult.Ok(val)
      : ExperimentalResult.Err(error)
  }

  /** Catches sync exceptions */
  // export function tryCatch<_T, E = unknown>(
  //   fn: () => Promise<any>,
  //   errorMapper?: (e: unknown) => E,
  // ): never;
  // export function tryCatch<T, E = unknown>(
  //   fn: () => T,
  //   errorMapper?: (e: unknown) => E,
  // ): Result<T, E>;
  static tryCatch<T, E = unknown>(
    this: void,
    fn: () => T,
    errorMapper?: (e: unknown) => E,
  ): ExperimentalResult<T, E> {
    try {
      return ExperimentalResult.Ok(fn())
    } catch (e) {
      return ExperimentalResult.Err(errorMapper ? errorMapper(e) : (e as E))
    }
  }

  /** Catches async exceptions - returns Promise<Result<T, E>> */
  static async tryAsyncCatch<T, E = unknown>(
    this: void,
    fn: () => Promise<T>,
    errorMapper?: (e: unknown) => E,
  ): Promise<ExperimentalResult<T, E>> {
    try {
      return ExperimentalResult.Ok(await fn())
    } catch (e) {
      return ExperimentalResult.Err(errorMapper ? errorMapper(e) : (e as E))
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
   *   const a = yield* ExperimentalResult.Ok(1);
   *   const b = yield* ExperimentalResult.Ok(2);
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static gen<Eff extends ExperimentalResult<any, any>, T>(
    this: void,
    // biome-ignore lint/suspicious/noExplicitAny: inference
    genFn: () => Generator<Eff, T, any>,
  ): ExperimentalResult<T, ExtractError<Eff>> {
    const iterator = genFn()

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: ExperimentalResult<T, ExtractError<Eff>>

    while (true) {
      const next = iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = ExperimentalResult.Ok(next.value)
        break
      }

      // next.value is the Result that was yielded
      let yielded = next.value as ExperimentalResult<unknown, unknown>
      let stack: string | undefined

      if (isCapturedTrace(yielded)) {
        stack = yielded.stack
        yielded = yielded.value as ExperimentalResult<unknown, unknown>
      }

      if (yielded.isErr()) {
        const err = yielded.unwrapErr()
        if (stack && err instanceof Error) {
          const stackLines = stack.split("\n")
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            err.stack = `${err.name}: ${err.message}\n${userStack}`
          }
        }
        iterator.return?.(undefined as unknown as T)
        // Early termination on error - return the Err result
        currentResult = yielded as ExperimentalResult<T, ExtractError<Eff>>
        break
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = yielded.unwrap()
    }

    return currentResult
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
   *   const a = yield* $(ExperimentalResult.Ok(1));
   *   const b = yield* $(ExperimentalResult.Ok(2));
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static genAdapter<Eff extends ResultYieldWrap<any, any>, T>(
    this: void,
    genFn: (
      adapter: <A, E>(
        result: ExperimentalResult<A, E>,
      ) => ResultYieldWrap<A, E>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => Generator<Eff, T, any>,
  ): ExperimentalResult<T, ExtractResultError<Eff>> {
    const adapter = <A, E>(
      result: ExperimentalResult<A, E>,
    ): ResultYieldWrap<A, E> => new ResultYieldWrap(result)

    const iterator = genFn(adapter)

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: ExperimentalResult<T, ExtractResultError<Eff>>

    while (true) {
      const next = iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = ExperimentalResult.Ok(next.value)
        break
      }

      // next.value is the ResultYieldWrap that was yielded
      const wrapped = next.value as ResultYieldWrap<unknown, unknown>
      let result = wrapped.result
      let stack: string | undefined

      if (isCapturedTrace(wrapped)) {
        stack = wrapped.stack
        // biome-ignore lint/suspicious/noExplicitAny: generic unwrap
        result = (wrapped as any).value.result
      }

      if (result.isErr()) {
        const err = result.unwrapErr()
        if (stack && err instanceof Error) {
          const stackLines = stack.split("\n")
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            err.stack = `${err.name}: ${err.message}\n${userStack}`
          }
        }
        iterator.return?.(undefined as unknown as T)
        // Early termination on error - return the Err result
        currentResult = result as ExperimentalResult<T, ExtractResultError<Eff>>
        break
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap()
    }

    return currentResult
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
   * const fetchData = async (
   *   id: number,
   * ): Promise<ExperimentalResult<{ id: number }, string>> =>
   *   ExperimentalResult.Ok({ id });
   * const result = await ExperimentalResult.asyncGen(async function* () {
   *   const a = yield* ExperimentalResult.Ok(1);
   *   const dataResult = yield* (await fetchData(a));
   *   return a + dataResult.id;
   * });
   * // ExperimentalResult<number, string>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static async asyncGen<Eff extends ExperimentalResult<any, any>, T>(
    this: void,
    // biome-ignore lint/suspicious/noExplicitAny: inference
    genFn: () => AsyncGenerator<Eff, T, any>,
  ): Promise<ExperimentalResult<T, ExtractError<Eff>>> {
    const iterator = genFn()

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: ExperimentalResult<T, ExtractError<Eff>>

    while (true) {
      const next = await iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = ExperimentalResult.Ok(next.value)
        break
      }

      // next.value is a Result (user awaits promises before yielding)
      let result = next.value as ExperimentalResult<unknown, unknown>
      let stack: string | undefined

      if (isCapturedTrace(result)) {
        stack = result.stack
        result = result.value as ExperimentalResult<unknown, unknown>
      }

      if (result.isErr()) {
        const err = result.unwrapErr()
        if (stack && err instanceof Error) {
          const stackLines = stack.split("\n")
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            err.stack = `${err.name}: ${err.message}\n${userStack}`
          }
        }
        await iterator.return?.(undefined as unknown as T)
        // Early termination on error - return the Err result
        currentResult = result as ExperimentalResult<T, ExtractError<Eff>>
        break
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap()
    }

    return currentResult
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
   * const fetchData = async (
   *   id: number,
   * ): Promise<ExperimentalResult<{ id: number }, string>> =>
   *   ExperimentalResult.Ok({ id });
   * const result = await ExperimentalResult.asyncGenAdapter(async function* ($) {
   *   const a = yield* $(ExperimentalResult.Ok(1));
   *   const data = yield* $(fetchData(a));
   *   return a + data.id;
   * });
   * // ExperimentalResult<number, string>
   * ```
   */
  static async asyncGenAdapter<
    // biome-ignore lint/suspicious/noExplicitAny: inference
    Eff extends AsyncResultYieldWrap<any, any>,
    T,
  >(
    this: void,
    genFn: (
      adapter: <A, E2>(
        result: ExperimentalResult<A, E2> | Promise<ExperimentalResult<A, E2>>,
      ) => AsyncResultYieldWrap<A, E2>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => AsyncGenerator<Eff, T, any>,
  ): Promise<ExperimentalResult<T, ExtractAsyncResultError<Eff>>> {
    const adapter = <A, E2>(
      result: ExperimentalResult<A, E2> | Promise<ExperimentalResult<A, E2>>,
    ): AsyncResultYieldWrap<A, E2> =>
      new AsyncResultYieldWrap(Promise.resolve(result))

    const iterator = genFn(adapter)

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: ExperimentalResult<T, ExtractAsyncResultError<Eff>>

    while (true) {
      const next = await iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = ExperimentalResult.Ok(next.value)
        break
      }

      // next.value is the AsyncResultYieldWrap that was yielded
      const wrapped = next.value as AsyncResultYieldWrap<unknown, unknown>
      let result: ExperimentalResult<unknown, unknown>
      let stack: string | undefined

      if (isCapturedTrace(wrapped)) {
        stack = wrapped.stack
        // biome-ignore lint/suspicious/noExplicitAny: generic unwrap
        result = await (wrapped as any).value.result
      } else {
        result = await wrapped.result
      }

      if (result.isErr()) {
        const err = result.unwrapErr()
        if (stack && err instanceof Error) {
          const stackLines = stack.split("\n")
          if (stackLines.length > 2) {
            const userStack = stackLines.slice(2).join("\n")
            err.stack = `${err.name}: ${err.message}\n${userStack}`
          }
        }
        await iterator.return?.(undefined as unknown as T)
        // Early termination on error - return the Err result
        currentResult = result as ExperimentalResult<
          T,
          ExtractAsyncResultError<Eff>
        >
        break
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap()
    }

    return currentResult
  }
}
