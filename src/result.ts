import { UnwrappedErrWithOk, UnwrappedOkWithErr } from "./errors.js"
import { Option } from "./option.js"
import { UNIT } from "./unit.js"
import { CapturedTrace, isCapturedTrace, isPromiseLike } from "./utils.js"

type Mapper<T, U> = (val: T) => U
type AsyncMapper<T, U> = (val: T) => Promise<U>

type FlatMapper<T, U, E> = (val: T) => Result<U, E>
type FlatPMapper<T, U, E> = (val: T) => Result<Promise<U>, E>
type AsyncFlatMapper<T, U, E> = (val: T) => Promise<Result<U, E>>
type AsyncFlatPMapper<T, U, E> = (val: T) => Promise<Result<Promise<U>, E>>
type FlatZipInput<_T, U, E> =
  | Result<U, E>
  | Result<Promise<U>, E>
  | Promise<Result<U, E>>
  | Promise<Result<Promise<U>, E>>

export type UnitResult<E = never> = Result<UNIT, E>

export type UnwrapResult<T extends Result<unknown, unknown>> =
  T extends Result<infer U, infer E> ? { ok: U; err: E } : never

type CombinedResultOk<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["ok"]
}
type CombinedResultErr<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["err"]
}[number]

export type CombineResults<T extends Result<unknown, unknown>[]> = Result<
  CombinedResultOk<T>,
  CombinedResultErr<T>
>

type UnwrapPromises<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: Awaited<UnwrapResult<T[K]>["ok"]>
}

type IsPromise<T> = T extends Promise<unknown> ? true : false

type HasPromise<T extends readonly Result<unknown, unknown>[]> = true extends {
  [K in keyof T]: IsPromise<T[K] extends Result<infer U, unknown> ? U : never>
}[number]
  ? true
  : false

/** Sentinel value stored in #val when Result is Err */
const ERR_VAL = Symbol("Result::Err")

/** NO_ERR sentinel indicates no async error has occurred */
const NO_ERR = Symbol("Result::NoErr")

/** Internal symbol for accessing private factory - not exported */
const RESULT_INTERNAL = Symbol("Result::Internal")
type NO_ERR = typeof NO_ERR

type ResultCtx<E> = { asyncErr: E | NO_ERR }

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
  constructor(readonly result: Result<T, E>) {}

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
  constructor(readonly result: Promise<Result<T, E>>) {}

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

/** Extract error type directly from Result */
// biome-ignore lint/suspicious/noExplicitAny: inference
type ExtractError<T> = T extends Result<any, infer E> ? E : never

export class Result<T, E> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Ok" | "Err"

  /** Value when Ok; ERR_VAL sentinel when Err */
  readonly #val: T

  /** Error when Err (sync); undefined when Ok */
  readonly #err: E

  /** Context for async error tracking - stores actual error value when async chain fails */
  readonly #ctx: ResultCtx<E>

  private constructor(val: T, err: E, ctx: ResultCtx<E>, tag: "Ok" | "Err") {
    this.#val = val
    this.#err = err
    this.#ctx = ctx
    this._tag = tag
  }

  /** Internal factory for namespace functions - not part of public API */
  static [RESULT_INTERNAL] = {
    create<T, E>(
      val: T,
      err: E,
      ctx: ResultCtx<E>,
      tag: "Ok" | "Err",
    ): Result<T, E> {
      return new Result(val, err, ctx, tag)
    },
  }

  /** Get the actual error value (from async context or sync field) */
  private getErr(): E {
    return this.#ctx.asyncErr !== NO_ERR ? this.#ctx.asyncErr : this.#err
  }

  /** Singleton UNIT_RESULT for void-success operations */
  static readonly UNIT_RESULT: Result<UNIT, never> = new Result(
    UNIT,
    undefined as never,
    { asyncErr: NO_ERR },
    "Ok",
  )

  /**
   * Creates an Ok containing the given value.
   *
   * @template T - Success value type
   * @template E - Error type (defaults to never)
   * @param val - Success value
   * @returns Result in the Ok state
   */
  static Ok<T, E = never>(this: void, val: T): Result<T, E> {
    return new Result(val, undefined as E, { asyncErr: NO_ERR }, "Ok")
  }

  /**
   * Creates an Err containing the given error.
   *
   * @template E - Error type
   * @template T - Success value type (defaults to never)
   * @param err - Error value
   * @returns Result in the Err state
   */
  static Err<E, T = never>(this: void, err: E): Result<T, E> {
    return new Result(ERR_VAL as T, err, { asyncErr: NO_ERR }, "Err")
  }

  /**
   * Type guard for Ok state.
   *
   * @returns true if this Result is Ok
   */
  isOk(): this is Result<T, never> {
    return this._tag === "Ok" && this.#ctx.asyncErr === NO_ERR
  }

  /**
   * Type guard for Err state.
   *
   * @returns true if this Result is Err
   */
  isErr(): this is Result<never, E> {
    return (
      this._tag === "Err" ||
      this.#ctx.asyncErr !== NO_ERR ||
      (this._tag === "Ok" && this.#val === ERR_VAL)
    )
  }

  /**
   * Type guard for Ok containing UNIT.
   *
   * @returns true if the Ok value is UNIT
   */
  isUnit(): this is Result<UNIT, never> {
    return this.#val === UNIT
  }

  /**
   * Returns a string representation of the Result.
   *
   * @returns "Result::Ok<value>" or "Result::Err<error>"
   */
  toString(): string {
    if (this.isOk()) {
      return `Result::Ok<${String(this.#val)}>`
    }
    return `Result::Err<${String(this.getErr())}>`
  }

  /**
   * Returns the contained value or throws.
   *
   * If Err and the error is an Error, re-throws it; otherwise throws
   * UnwrappedOkWithErr. For async values, returns a Promise that rejects
   * on error.
   *
   * @returns The contained value (sync or async)
   * @throws Error or UnwrappedOkWithErr when Err
   */
  unwrap(this: Result<Promise<T>, E>): Promise<T>
  unwrap(this: Result<T, E>): T
  unwrap() {
    if (this.isErr()) {
      const err = this.getErr()
      if (err instanceof Error) throw err
      throw new UnwrappedOkWithErr(this.toString())
    }

    const curr = this.#val
    if (isPromiseLike(curr)) {
      const ctx = this.#ctx
      return new Promise((resolve, reject) => {
        curr.then((v) => {
          if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) {
            const e =
              ctx.asyncErr !== NO_ERR && ctx.asyncErr instanceof Error
                ? ctx.asyncErr
                : new UnwrappedOkWithErr(this.toString())
            reject(e)
          } else {
            resolve(v)
          }
        }, reject)
      })
    }

    return curr
  }

  /**
   * Returns the contained error or throws.
   *
   * For async values, returns a Promise resolving to the error or rejecting
   * with UnwrappedErrWithOk when Ok.
   *
   * @returns The contained error (sync or async)
   * @throws UnwrappedErrWithOk when called on Ok
   */
  unwrapErr<T, E>(this: Result<T, E>): E
  unwrapErr<T, E>(this: Result<Promise<T>, E>): Promise<E>
  unwrapErr() {
    if (this._tag === "Err") {
      return this.getErr()
    }

    const curr = this.#val
    const ctx = this.#ctx

    if (isPromiseLike(curr)) {
      return new Promise((resolve, reject) => {
        curr.then((v) => {
          if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) {
            resolve(ctx.asyncErr !== NO_ERR ? ctx.asyncErr : this.#err)
          } else {
            reject(new UnwrappedErrWithOk(this.toString()))
          }
        }, reject)
      })
    }

    // Sync Ok - cannot unwrapErr
    throw new UnwrappedErrWithOk(this.toString())
  }

  /**
   * Returns the contained value or the provided default.
   *
   * For async values, returns a Promise resolving to the value or default.
   *
   * @param defaultValue - Fallback value when Err
   * @returns The contained value or default (sync or async)
   */
  unwrapOr<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
    defaultValue: Curr,
  ): Promise<Curr>
  unwrapOr(this: Result<T, E>, defaultValue: T): T
  unwrapOr(defaultValue: unknown): T | Promise<unknown> {
    if (this.isErr()) return defaultValue as T

    const curr = this.#val
    const ctx = this.#ctx

    if (isPromiseLike(curr)) {
      return curr.then((v) => {
        if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) return defaultValue
        return v
      })
    }

    return curr as T
  }

  /**
   * Returns the contained value or computes a default from the error.
   *
   * For async values, returns a Promise resolving to the value or computed
   * default.
   *
   * @param fn - Function that maps the error to a fallback value
   * @returns The contained value or computed default (sync or async)
   */
  unwrapOrElse<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
    fn: (err: E) => Curr,
  ): Promise<Curr>
  unwrapOrElse(this: Result<T, E>, fn: (err: E) => T): T
  unwrapOrElse(fn: (err: E) => unknown): T | Promise<unknown> {
    if (this.isErr()) return fn(this.getErr()) as T

    const curr = this.#val
    const ctx = this.#ctx

    if (isPromiseLike(curr)) {
      return curr.then((v) => {
        if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) {
          const errVal = ctx.asyncErr !== NO_ERR ? ctx.asyncErr : this.#err
          return fn(errVal)
        }
        return v
      })
    }

    return curr as T
  }

  /**
   * Safely unwraps the value, returning null for Err.
   *
   * For async values, returns a Promise resolving to the value or null.
   *
   * @returns The contained value or null (sync or async)
   */
  safeUnwrap(this: Result<never, E>): null
  safeUnwrap<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
  ): Promise<Curr | null> | null
  safeUnwrap(this: Result<T, E>): T | null
  safeUnwrap(): T | null | Promise<unknown> {
    if (this.isErr()) return null

    const curr = this.#val
    const ctx = this.#ctx

    if (isPromiseLike(curr)) {
      return curr.then((v) => {
        if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) return null
        return v
      })
    }

    return curr === ERR_VAL ? null : (curr as T)
  }

  /**
   * Exhaustive pattern match on Result state.
   *
   * @template U - Result type of the handlers
   * @param cases - Handlers for Ok and Err
   * @returns Result of the matching handler
   */
  match<U>(cases: MatchCases<T, E, U>): U {
    if (this.isErr()) {
      return cases.Err(this.getErr())
    }
    return cases.Ok(this.#val)
  }

  // -------------------------------------------------------------------------
  // map() - with async overloads per spec
  // -------------------------------------------------------------------------

  /**
   * Transforms the success value using the provided function.
   *
   * If the Result is Ok, applies the function to the value and wraps the result
   * in a new Ok. If Err, propagates the error unchanged without calling the function.
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
   * @see flatMap
   */
  map<T, U, E>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<U>,
  ): Result<Promise<U>, E>
  map<T, U, E>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => U,
  ): Result<Promise<U>, E>
  map<In, U>(
    this: Result<In, E>,
    fn: (val: In) => Promise<U>,
  ): Result<Promise<U>, E>
  map<In, U>(this: Result<In, E>, fn: (val: In) => U): Result<U, E>
  map<U, In = Awaited<T>>(
    fn: Mapper<In, U> | AsyncMapper<In, U>,
  ): Result<Promise<U>, E> | Result<U, E> {
    // Short-circuit if in Err track
    if (this.isErr()) {
      return new Result(
        ERR_VAL as U,
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      )
    }

    const curr = this.#val
    const parentErr = this.#err

    if (isPromiseLike(curr)) {
      const p = curr as Promise<In | typeof ERR_VAL>
      const newCtx: ResultCtx<E> = { asyncErr: NO_ERR }
      const out = Result.safeMap(p, fn, newCtx, this.#ctx)
      return new Result(out, parentErr, newCtx, "Ok")
    }

    const next = fn(curr as unknown as In)
    if (isPromiseLike(next)) {
      return new Result(next, parentErr, { asyncErr: NO_ERR }, "Ok")
    }
    return new Result(next, parentErr, { asyncErr: NO_ERR }, "Ok")
  }

  /**
   * Safely maps a promised Ok value while propagating async errors.
   *
   * @template In - Input value type
   * @template U - Output value type
   * @template E - Error type
   * @param p - Promise of Ok value or ERR sentinel
   * @param mapper - Transform function
   * @param ctx - New async context to populate on error
   * @param parentCtx - Parent async context to read error from
   * @returns Promise of transformed value or ERR sentinel
   */
  private static safeMap<In, U, E>(
    p: Promise<In | typeof ERR_VAL>,
    mapper: (val: In) => U | Promise<U>,
    ctx: ResultCtx<E>,
    parentCtx: ResultCtx<E>,
  ): Promise<U> {
    return p.then((v) => {
      if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
        ctx.asyncErr = parentCtx.asyncErr as E
        return ERR_VAL as U
      }
      return mapper(v as In)
    }) as Promise<U>
  }

  // -------------------------------------------------------------------------
  // mapErr() - transforms error while preserving success value
  // -------------------------------------------------------------------------

  /**
   * Transforms the error value while preserving the success value.
   *
   * If the Result is Err, applies the function to the error. If Ok, returns
   * the Ok unchanged without calling the function.
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
   * @see mapBoth
   */
  mapErr<U>(fn: Mapper<E, U>): Result<T, U> {
    if (this._tag === "Err") {
      const mappedErr = fn(this.getErr())
      return Result.Err(mappedErr)
    }

    const curr = this.#val
    const parentCtx = this.#ctx

    if (isPromiseLike(curr)) {
      const newCtx: ResultCtx<U> = { asyncErr: NO_ERR }
      const p = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          // Transform the error
          const origErr =
            parentCtx.asyncErr !== NO_ERR ? parentCtx.asyncErr : this.#err
          newCtx.asyncErr = fn(origErr)
        }
        return v
      })
      return new Result(p as T, undefined as U, newCtx, "Ok")
    }

    return new Result(this.#val, undefined as U, { asyncErr: NO_ERR }, "Ok")
  }

  // -------------------------------------------------------------------------
  // mapBoth() - transforms both tracks simultaneously
  // -------------------------------------------------------------------------

  /**
   * Transforms both the Ok and Err values.
   *
   * Applies fnOk when Ok and fnErr when Err. Supports async Ok values via
   * overloads; returns Result with mapped types.
   *
   * @param fnOk - Mapper for Ok values
   * @param fnErr - Mapper for Err values
   * @returns Result with both branches transformed
   */
  mapBoth<T2, E2, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fnOk: (val: In) => T2 | Promise<T2>,
    fnErr: (val: E) => E2,
  ): Result<Promise<T2>, E2>
  mapBoth<T2, E2>(
    this: Result<T, E>,
    fnOk: (val: T) => Promise<T2>,
    fnErr: (val: E) => E2,
  ): Result<Promise<T2>, E2>
  mapBoth<T2, E2>(
    this: Result<T, E>,
    fnOk: (val: T) => T2,
    fnErr: (val: E) => E2,
  ): Result<T2, E2>
  mapBoth<T2, E2, In = Awaited<T>>(
    fnOk: (val: In) => T2 | Promise<T2>,
    fnErr: (val: E) => E2,
  ): Result<T2, E2> | Result<Promise<T2>, E2> {
    const mappedOk = (this as { map: (fn: unknown) => unknown }).map(
      fnOk,
    ) as Result<T2, E> | Result<Promise<T2>, E>
    return mappedOk.mapErr(fnErr)
  }

  // -------------------------------------------------------------------------
  // flatMap() - chains Result-returning functions
  // -------------------------------------------------------------------------

  /**
   * Chains operations that return Results, flattening nested Results.
   *
   * If the Result is Ok, applies the function (which returns a new Result) and
   * returns that Result directly. If Err, propagates the error unchanged.
   *
   * Error types are unified: `Result<U, E | E2>`.
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
   * @see map
   * @see flatZip
   */
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Result<Promise<U>, E2>,
  ): Result<Promise<U>, E | E2>
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<U>, E2>>,
  ): Result<Promise<U>, E | E2>
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Result<Promise<U>, E | E2>
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Result<U, E | E2>,
  ): Result<Promise<U>, E | E2>
  flatMap<T, U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<Promise<U>, E | E2>>,
  ): Result<Promise<U>, E | E2>
  flatMap<T, U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<U, E | E2>>,
  ): Result<Promise<U>, E | E2>
  flatMap<T, U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Result<U, E2>,
  ): Result<U, E | E2>
  flatMap<T, _U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E2>>,
  ): never
  flatMap<T, _U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E | E2>>,
  ): never
  flatMap<U, E2, In = Awaited<T>>(
    fn:
      | FlatMapper<In, U, E2>
      | FlatPMapper<In, U, E2>
      | AsyncFlatMapper<In, U, E2>
      | AsyncFlatPMapper<In, U, E2>,
  ) {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as U,
        this.getErr() as E | E2,
        { asyncErr: NO_ERR },
        "Err",
      )
    }

    const curr = this.#val as Promise<In> | In
    const parentErr = this.#err
    const parentCtx = this.#ctx
    const newCtx: ResultCtx<E | E2> = { asyncErr: NO_ERR }

    if (isPromiseLike(curr)) {
      const newP = new Promise<U>((resolve, reject) => {
        curr.then((v) => {
          if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
            newCtx.asyncErr =
              parentCtx.asyncErr !== NO_ERR
                ? (parentCtx.asyncErr as E | E2)
                : (parentErr as E | E2)
            return resolve(ERR_VAL as U)
          }

          const mapped = fn(v as In)
          const p = Result.flatMapHelper<U, E, E2, T>(newCtx, mapped)
          resolve(p)
        }, reject)
      })

      return new Result(newP, parentErr as E | E2, newCtx, "Ok")
    }

    const mapped = fn(curr as In)
    if (isPromiseLike(mapped)) {
      const p = mapped.then((r) => Result.flatMapInnerHelper(newCtx, r))
      return new Result(p, parentErr as E | E2, newCtx, "Ok")
    }

    const normalized = Result.flatMapInnerHelper(newCtx, mapped)

    if (isPromiseLike(normalized)) {
      return new Result(
        normalized as Promise<U>,
        parentErr as E | E2,
        newCtx,
        "Ok",
      )
    }

    if (normalized === ERR_VAL) {
      return new Result(
        ERR_VAL as U,
        newCtx.asyncErr !== NO_ERR ? newCtx.asyncErr : (parentErr as E | E2),
        newCtx,
        "Err",
      )
    }

    return new Result(normalized as U, parentErr as E | E2, newCtx, "Ok")
  }

  /**
   * Normalizes sync/async flatMap outputs to a value or Promise.
   *
   * @template U - Success value type
   * @template E - Original error type
   * @template E2 - Mapped error type
   * @template T - Input value type
   * @param mutableCtx - Mutable context for async error propagation
   * @param mapped - FlatMap output (sync or async Result)
   * @returns Value, Promise, or ERR sentinel
   */
  private static flatMapHelper<U, E, E2, T>(
    mutableCtx: ResultCtx<E | E2>,
    mapped: FlatZipInput<T, U, E | E2>,
  ): U | Promise<U> {
    if (isPromiseLike(mapped)) {
      return mapped.then((r) => Result.flatMapInnerHelper(mutableCtx, r))
    }
    return Result.flatMapInnerHelper(mutableCtx, mapped)
  }

  /**
   * Extracts the inner value from a Result, updating error context on failure.
   *
   * @template U - Success value type
   * @template E - Original error type
   * @template E2 - Mapped error type
   * @param mutableCtx - Mutable context for async error propagation
   * @param r - Inner Result to unwrap
   * @returns Value, Promise, or ERR sentinel
   */
  private static flatMapInnerHelper<U, E, E2>(
    mutableCtx: ResultCtx<E | E2>,
    r: Result<Promise<U>, E | E2> | Result<U, E | E2>,
  ): U | Promise<U> {
    if (r._tag === "Err") {
      mutableCtx.asyncErr = r.getErr()
      return ERR_VAL as U
    }

    const innerVal = r.#val
    if (isPromiseLike(innerVal)) {
      return innerVal.then((v) => {
        if (v === ERR_VAL || r.#ctx.asyncErr !== NO_ERR) {
          mutableCtx.asyncErr =
            r.#ctx.asyncErr !== NO_ERR ? r.#ctx.asyncErr : r.#err
        }
        return v
      })
    }

    if (innerVal === ERR_VAL) {
      mutableCtx.asyncErr = r.getErr()
      return ERR_VAL as U
    }

    return innerVal
  }

  /**
   * Pairs the original value with a derived value in a tuple.
   *
   * Unlike `map` which replaces the value, `zip` keeps the original and adds
   * the derived value, creating `[original, derived]`.
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
   * @see flatZip
   * @see map
   */
  zip<T, U, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => Promise<U>,
  ): Result<Promise<[In, U]>, E>
  zip<T, U, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => U,
  ): Result<Promise<[In, U]>, E>
  zip<T, U>(
    this: Result<T, E>,
    fn: (val: T) => Promise<U>,
  ): Result<Promise<[T, U]>, E>
  zip<T, U>(this: Result<T, E>, fn: (val: T) => U): Result<[T, U], E>
  zip<T, U, In = Awaited<T>>(fn: Mapper<In, U> | AsyncMapper<In, U>) {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as unknown as [In, U],
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      )
    }

    const curr = this.#val as Promise<In> | In
    const parentErr = this.#err
    const parentCtx = this.#ctx
    const newCtx: ResultCtx<E> = { asyncErr: NO_ERR }

    if (isPromiseLike(curr)) {
      const newP = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR
              ? parentCtx.asyncErr
              : (parentErr as E)
          return ERR_VAL as unknown as [In, U]
        }

        const u = fn(v as In)
        if (isPromiseLike(u)) {
          return u.then((uu) => [v, uu] as [In, U])
        }
        return [v, u] as [In, U]
      }) as Promise<[In, U]>

      return new Result(newP, parentErr, newCtx, "Ok")
    }

    const u = fn(curr as In)
    if (isPromiseLike(u)) {
      const p = u.then((uu) => [curr, uu] as [In, U])
      return new Result(p, parentErr, { asyncErr: NO_ERR }, "Ok")
    }

    return new Result(
      [curr, u] as [In, U],
      parentErr,
      { asyncErr: NO_ERR },
      "Ok",
    )
  }

  // -------------------------------------------------------------------------
  // flatZip() - pairs original value with value from another Result
  // -------------------------------------------------------------------------

  /**
   * Combines the current Result with another independent Result in a tuple.
   *
   * Unlike `zip` which derives a value from the original, `flatZip` works with
   * two independent Results. If either is Err, propagates the first error.
   *
   * Supports both sync and async Results. Async combinations return
   * `Result<Promise<[T, U]>, E | E2>`.
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
   * @see zip
   * @see flatMap
   */
  flatZip<U, E2, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => FlatZipInput<In, U, E | E2>,
  ): Result<Promise<[In, Awaited<U>]>, E | E2>
  flatZip<U, E2, In = Awaited<T>>(
    this: Result<In, E>,
    fn: (
      val: In,
    ) =>
      | Promise<Result<U, E2>>
      | Promise<Result<Promise<U>, E2>>
      | Result<Promise<U>, E2>,
  ): Result<Promise<[In, Awaited<U>]>, E | E2>
  flatZip<U, E2, In = Awaited<T>>(
    this: Result<In, E>,
    fn: (val: In) => Result<U, E2>,
  ): Result<[In, U], E | E2>
  flatZip<U, E2, In = T>(
    fn: (val: In) => FlatZipInput<In, U, E | E2>,
  ): Result<[In, Awaited<U>] | Promise<[In, Awaited<U>]>, E | E2> {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as unknown as [In, Awaited<U>] | Promise<[In, Awaited<U>]>,
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      )
    }

    const curr = this.#val as Promise<In> | In
    const parentErr = this.#err
    const parentCtx = this.#ctx
    const newCtx: ResultCtx<E | E2> = { asyncErr: NO_ERR }

    if (isPromiseLike(curr)) {
      const newP = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR
              ? (parentCtx.asyncErr as E | E2)
              : (parentErr as E | E2)
          return ERR_VAL as unknown as [In, Awaited<U>]
        }

        const mapped = fn(v as In)
        return Result.flatZipHelper(newCtx, v as In, mapped)
      }) as Promise<[In, Awaited<U>]>

      return new Result(newP, parentErr as E | E2, newCtx, "Ok")
    }

    const mapped = fn(curr as In)
    const p = Result.flatZipHelper(newCtx, curr as In, mapped)

    if (isPromiseLike(p)) {
      return new Result(
        p as Promise<[In, Awaited<U>]>,
        parentErr as E | E2,
        newCtx,
        "Ok",
      )
    }

    if (p === ERR_VAL) {
      return new Result(
        ERR_VAL as unknown as [In, Awaited<U>],
        newCtx.asyncErr !== NO_ERR ? newCtx.asyncErr : (parentErr as E | E2),
        newCtx,
        "Err",
      )
    }

    return new Result(p as [In, Awaited<U>], parentErr as E | E2, newCtx, "Ok")
  }

  /**
   * Normalizes sync/async flatZip outputs to a tuple or ERR sentinel.
   *
   * @template U - Derived value type
   * @template E - Original error type
   * @template E2 - Mapped error type
   * @template In - Original value type
   * @param mutableCtx - Mutable context for async error propagation
   * @param originalVal - Original value to preserve
   * @param mapped - FlatZip output (sync or async Result)
   * @returns Tuple, Promise of tuple, or ERR sentinel
   */
  private static flatZipHelper<U, E, E2, In>(
    mutableCtx: ResultCtx<E | E2>,
    originalVal: In,
    mapped:
      | Promise<Result<Promise<U>, E | E2>>
      | Promise<Result<U, E | E2>>
      | Result<Promise<U>, E | E2>
      | Result<U, E | E2>,
  ): [In, Awaited<U>] | Promise<[In, Awaited<U>]> | typeof ERR_VAL {
    if (isPromiseLike(mapped)) {
      return mapped.then((r) =>
        Result.flatZipInnerHelper(mutableCtx, originalVal, r),
      ) as Promise<[In, Awaited<U>]> | typeof ERR_VAL
    }
    return Result.flatZipInnerHelper(mutableCtx, originalVal, mapped)
  }

  /**
   * Extracts the inner value for flatZip, updating error context on failure.
   *
   * @template U - Derived value type
   * @template E - Original error type
   * @template E2 - Mapped error type
   * @template In - Original value type
   * @param mutableCtx - Mutable context for async error propagation
   * @param originalVal - Original value to preserve
   * @param r - Inner Result to unwrap
   * @returns Tuple, Promise of tuple, or ERR sentinel
   */
  private static flatZipInnerHelper<U, E, E2, In>(
    mutableCtx: ResultCtx<E | E2>,
    originalVal: In,
    r: Result<Promise<U>, E | E2> | Result<U, E | E2>,
  ): [In, Awaited<U>] | Promise<[In, Awaited<U>]> | typeof ERR_VAL {
    if (r._tag === "Err") {
      mutableCtx.asyncErr = r.getErr()
      return ERR_VAL
    }

    const innerVal = r.#val
    if (isPromiseLike(innerVal)) {
      return innerVal.then((v) => {
        if (v === ERR_VAL || r.#ctx.asyncErr !== NO_ERR) {
          mutableCtx.asyncErr =
            r.#ctx.asyncErr !== NO_ERR ? r.#ctx.asyncErr : r.#err
          return ERR_VAL as unknown as [In, Awaited<U>]
        }
        return [originalVal, v] as [In, Awaited<U>]
      })
    }

    if (innerVal === ERR_VAL) {
      mutableCtx.asyncErr = r.getErr()
      return ERR_VAL
    }

    return [originalVal, innerVal] as [In, Awaited<U>]
  }

  // -------------------------------------------------------------------------
  // zipErr() - combines errors while retaining original value
  // -------------------------------------------------------------------------

  /**
   * Runs a Result-producing function and turns Ok into Err on failure.
   *
   * If this Result is Ok, calls fn with the value. If fn returns Err, the
   * resulting Result becomes Err while the original Ok value is preserved
   * when fn succeeds.
   *
   * @template E2 - Additional error type
   * @param fn - Function producing a Result
   * @returns Result with original value or combined error
   */
  zipErr<E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<unknown, E2>>,
  ): Result<Promise<T>, E | E2>
  zipErr<E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<unknown, E2>>,
  ): Result<Promise<T>, E | E2>
  zipErr<E2>(
    this: Result<T, E>,
    fn: (val: T) => Result<unknown, E2>,
  ): Result<T, E | E2>
  zipErr<E2, In = Awaited<T>>(
    fn: FlatMapper<In, unknown, E | E2> | AsyncFlatMapper<In, unknown, E | E2>,
  ) {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as T,
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      )
    }

    const curr = this.#val as Promise<In> | In
    const parentErr = this.#err
    const parentCtx = this.#ctx
    const newCtx: ResultCtx<E | E2> = { asyncErr: NO_ERR }

    if (isPromiseLike(curr)) {
      const newP = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR
              ? (parentCtx.asyncErr as E | E2)
              : (parentErr as E | E2)
          return ERR_VAL as In
        }

        const r = fn(v as In)
        return Result.zipErrHelper(v as In, r, newCtx)
      })

      return new Result(newP, parentErr as E | E2, newCtx, "Ok")
    }

    const r = fn(curr as In)
    const newP = Result.zipErrHelper(curr as In, r, newCtx)

    if (isPromiseLike(newP)) {
      return new Result(newP as T, parentErr as E | E2, newCtx, "Ok")
    }

    if (newCtx.asyncErr !== NO_ERR) {
      return new Result(ERR_VAL as T, newCtx.asyncErr, newCtx, "Err")
    }

    return new Result(newP as unknown as T, parentErr as E | E2, newCtx, "Ok")
  }

  /**
   * Tracks errors from a Result while preserving the original value.
   *
   * @template In - Original value type
   * @template E - Error type
   * @param v - Original value to preserve
   * @param r - Result to inspect for errors
   * @param newCtx - Context to populate on error
   * @returns Original value or Promise of value
   */
  private static zipErrHelper<In, E>(
    v: In,
    r: Result<unknown, E> | Promise<Result<unknown, E>>,
    newCtx: ResultCtx<E>,
  ): In | Promise<In> {
    if (isPromiseLike(r)) {
      return r.then((newResult) => {
        const maybeAwaited = Result.captureZipErr(newResult, newCtx)
        if (isPromiseLike(maybeAwaited)) {
          return maybeAwaited.then(() => v)
        }
        return v
      })
    }

    const maybeAwaited = Result.captureZipErr(r, newCtx)
    if (isPromiseLike(maybeAwaited)) {
      return maybeAwaited.then(() => v)
    }
    return v
  }

  private static captureZipErr<E>(
    result: Result<unknown, E>,
    newCtx: ResultCtx<E>,
  ): void | Promise<void> {
    if (result._tag === "Err") {
      newCtx.asyncErr = result.getErr() as E
      return
    }

    const innerVal = result.#val
    if (isPromiseLike(innerVal)) {
      return innerVal.then((resolved) => {
        if (resolved === ERR_VAL || result.#ctx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            result.#ctx.asyncErr !== NO_ERR
              ? (result.#ctx.asyncErr as E)
              : (result.#err as E)
        }
      })
    }

    if (innerVal === ERR_VAL || result.#ctx.asyncErr !== NO_ERR) {
      newCtx.asyncErr =
        result.#ctx.asyncErr !== NO_ERR
          ? (result.#ctx.asyncErr as E)
          : (result.#err as E)
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

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
   * returns `Result<Promise<T>, E | VE[]>`.
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
   * // With async validators (returns Result<Promise<T>, ...>)
   * await Result.Ok(data).validate([
   *   async (d) => await validateEmail(d),
   *   async (d) => await validatePhone(d),
   * ]);
   * ```
   *
   * @see all
   */
  validate<VE extends unknown[]>(
    this: Result<T, E>,
    validators: { [K in keyof VE]: (val: T) => Result<unknown, VE[K]> },
  ): Result<T, E | VE[number][]>
  validate<VE extends unknown[]>(
    this: Result<T, E>,
    validators: {
      [K in keyof VE]: (val: T) => Promise<Result<unknown, VE[K]>>
    },
  ): Result<Promise<T>, E | VE[number][]>
  validate<VE extends unknown[], In = Awaited<T>>(
    this: Result<T, E> | Result<Promise<T>, E>,
    validators: {
      [K in keyof VE]: (
        val: In,
      ) => Promise<Result<unknown, VE[K]>> | Result<unknown, VE[K]>
    },
  ): Result<Promise<T>, E | VE[number][]>
  validate<VE extends unknown[]>(
    this: Result<T, E> | Result<Promise<T>, E>,
    validators: {
      [K in keyof VE]: (
        val: T,
      ) => Promise<Result<unknown, VE[K]>> | Result<unknown, VE[K]>
    },
  ):
    | Result<T, E>
    | Result<T, E | VE[number][]>
    | Result<Promise<T>, E | VE[number][]> {
    if (this.isErr()) return this as Result<T, E[]>

    const currVal = this.#val
    const parentErr = this.#err
    const parentCtx = this.#ctx
    const mutableCtx: ResultCtx<E | VE[number][]> = { asyncErr: NO_ERR }

    if (isPromiseLike(currVal)) {
      return new Result(
        currVal.then(async (c) => {
          if (c === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
            mutableCtx.asyncErr =
              parentCtx.asyncErr !== NO_ERR
                ? (parentCtx.asyncErr as E | VE[number][])
                : (parentErr as E | VE[number][])
            return ERR_VAL
          }

          const awaitedVal = c as T
          const results = validators.map((v) => v(awaitedVal))
          return Promise.all(results).then((resolved) =>
            Result.validateHelper(
              resolved as Result<unknown, unknown>[],
              mutableCtx,
              awaitedVal,
            ),
          )
        }),
        parentErr,
        mutableCtx,
        "Ok",
      ) as Result<Promise<T>, E[]>
    }

    const baseVal: T = currVal as T
    const results = validators.map((v) => v(baseVal))

    if (results.some(isPromiseLike)) {
      return new Result(
        Promise.all(results).then((resolved) =>
          Result.validateHelper(
            resolved as Result<unknown, unknown>[],
            mutableCtx,
            baseVal,
          ),
        ),
        parentErr,
        mutableCtx,
        "Ok",
      ) as Result<Promise<T>, E[]>
    }

    const syncResults = results as Result<unknown, unknown>[]
    const hasPromiseVal = syncResults.some((r) => isPromiseLike(r.#val))

    if (hasPromiseVal) {
      return new Result(
        Result.validateHelper<T, E | VE[number][]>(
          syncResults,
          mutableCtx,
          baseVal as T,
        ),
        parentErr,
        mutableCtx,
        "Ok",
      ) as Result<Promise<T>, E>
    }

    const combinedRes = Result.all(...(syncResults as Result<unknown, E>[]))

    return combinedRes.isErr() ? combinedRes : this
  }

  /**
   * Collapses validator Results into a single value or ERR sentinel.
   *
   * @template Val - Success value type
   * @template Err - Error type
   * @param results - Validator Results to combine
   * @param currCtx - Context to populate on error
   * @param currVal - Original value to return on success
   * @returns Original value, Promise of value, or ERR sentinel
   */
  private static validateHelper<Val, Err>(
    results: Result<unknown, unknown>[],
    currCtx: ResultCtx<Err>,
    currVal: Val | Promise<Val>,
  ): Val | Promise<Val> | typeof ERR_VAL {
    const combinedRes = Result.all(...results)

    if (isPromiseLike(combinedRes.#val)) {
      return combinedRes.#val.then((v) => {
        if (v === ERR_VAL || combinedRes.#ctx.asyncErr !== NO_ERR) {
          currCtx.asyncErr = combinedRes.getErr() as Err
          return ERR_VAL as Val
        }
        return currVal as Val
      }) as Promise<Val>
    }

    if (combinedRes.isErr()) {
      currCtx.asyncErr = combinedRes.getErr() as Err
      return ERR_VAL as Val
    }
    return currVal as Val
  }

  // ==========================================================================
  // Aggregation
  // ==========================================================================

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
  ): HasPromise<T> extends true
    ? Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>
    : Result<CombinedResultOk<T>, CombinedResultErr<T>[]>
  static all<T extends Result<unknown, unknown>[]>(
    ...results: T
  ):
    | Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>
    | Result<CombinedResultOk<T>, CombinedResultErr<T>[]> {
    const vals = results.map((r) => r.#val)
    const newCtx: ResultCtx<CombinedResultErr<T>[]> = { asyncErr: NO_ERR }

    if (vals.some(isPromiseLike)) {
      const p = Promise.all(vals).then((resolvedVals) => {
        const errs: unknown[] = []
        for (let i = 0; i < results.length; i++) {
          if (
            results[i]._tag === "Err" ||
            results[i].#ctx.asyncErr !== NO_ERR ||
            resolvedVals[i] === ERR_VAL
          ) {
            errs.push(results[i].getErr())
          }
        }
        if (errs.length > 0) {
          newCtx.asyncErr = errs as CombinedResultErr<T>[]
          return ERR_VAL
        }
        return resolvedVals
      })

      return new Result(
        p,
        [] as CombinedResultErr<T>[],
        newCtx,
        "Ok",
      ) as Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>
    }

    const errs: unknown[] = []
    for (const r of results) {
      if (r._tag === "Err") {
        errs.push(r.getErr())
      }
    }

    if (errs.length > 0) {
      return Result.Err(errs as CombinedResultErr<T>[]) as Result<
        CombinedResultOk<T>,
        CombinedResultErr<T>[]
      >
    }

    return Result.Ok(vals as CombinedResultOk<T>) as Result<
      CombinedResultOk<T>,
      CombinedResultErr<T>[]
    >
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
    const errs: F[] = []
    const pending: Result<U, F>[] = []

    for (const r of results) {
      if (r.isOk()) {
        if (isPromiseLike(r.#val)) {
          pending.push(r)
          continue
        }
        return r as Result<U, F[]>
      }

      errs.push(r.getErr())
    }

    if (pending.length === 0) {
      return Result.Err(errs)
    }

    const ctx: ResultCtx<F[]> = { asyncErr: NO_ERR }
    const p = Promise.all(
      pending.map(async (r) => {
        const val = await (r.#val as Promise<unknown>)
        const failed = r.#ctx.asyncErr !== NO_ERR || val === ERR_VAL
        return { failed, val, err: r.getErr() }
      }),
    ).then((settled) => {
      for (const item of settled) {
        if (!item.failed) {
          return item.val
        }
        errs.push(item.err)
      }

      ctx.asyncErr = errs
      return ERR_VAL
    })

    return new Result(p as U, undefined as unknown as F[], ctx, "Ok")
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Executes a side effect function for Ok values, then returns self.
   *
   * Useful for logging, debugging, or executing effects without breaking the
   * method chain. The function is only called if the Result is Ok.
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
   * @see tapErr
   */

  tap<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
    fn: (val: Curr) => void,
  ): Result<Promise<Curr>, E>
  tap(this: Result<T, E>, fn: (val: T) => void): Result<T, E>
  tap<Curr = Awaited<T>>(
    fn: (val: T | Curr) => void,
  ): Result<T, E> | Result<Promise<Curr>, E> {
    if (this.isErr()) return this

    const curr = this.#val
    const parentCtx = this.#ctx
    if (isPromiseLike(curr)) {
      const newCtx: ResultCtx<E> = { asyncErr: NO_ERR }
      const newPromise = curr.then((v) => {
        if (v !== ERR_VAL && parentCtx.asyncErr === NO_ERR) {
          fn(v as Curr)
        } else {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR ? parentCtx.asyncErr : this.#err
        }
        return v
      })
      return new Result(newPromise as T, this.#err, newCtx, "Ok")
    }

    fn(curr as T)
    return this
  }

  /**
   * Executes a side effect function for Err values, then returns self.
   *
   * Useful for logging errors or executing cleanup without breaking the chain.
   * The function is only called if the Result is Err.
   *
   * @param fn - Function to execute with the error (sync or async)
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
   * @see tap
   */
  tapErr(fn: (err: E) => void): Result<T, E> {
    if (this.isErr()) {
      fn(this.getErr())
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
      return new Result(
        this.getErr(),
        undefined as T,
        { asyncErr: NO_ERR },
        "Ok",
      )
    }
    return new Result(ERR_VAL as E, this.#val as T, { asyncErr: NO_ERR }, "Err")
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
    if (this.isErr()) return Option.None
    return Option.Some(this.#val)
  }

  /**
   * Resolves the inner promise while preserving Result structure.
   *
   * @returns Promise of Result with awaited value or Err
   */
  async toPromise(): Promise<Result<Awaited<T>, E>> {
    const v = await this.#val

    if (v === ERR_VAL || this.#ctx.asyncErr !== NO_ERR) {
      const errVal =
        this.#ctx.asyncErr !== NO_ERR ? this.#ctx.asyncErr : this.#err
      return new Result(
        ERR_VAL as Awaited<T>,
        errVal,
        { asyncErr: NO_ERR },
        "Err",
      )
    }

    return new Result(v as Awaited<T>, this.#err, { asyncErr: NO_ERR }, "Ok")
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
    if (this.isErr()) return this as Result<Array<Out>, E>

    if (Array.isArray(this.#val)) {
      return new Result(this.#val.map(mapper), this.#err, this.#ctx, "Ok")
    }

    throw new Error("Can only be called for Result<Array<T>, E>")
  }

  /**
   * Recovers from Err by providing a fallback Result.
   *
   * If Ok, returns self unchanged.
   *
   * @template T2 - Fallback success type
   * @template E2 - Fallback error type
   * @param fn - Function to produce a fallback Result from the error
   * @returns Original Ok or fallback Result
   */
  orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T | T2, E2> {
    if (this.isOk()) return this as Result<T | T2, E2>
    return fn(this.getErr())
  }

  // Static Constructors

  /**
   * Creates a Result from a nullable value.
   *
   * Returns Err when the value is null or undefined, otherwise Ok.
   *
   * @template T - Input value type
   * @template E - Error type
   * @param val - Value to wrap
   * @param error - Error value for null/undefined
   * @returns Ok with value or Err with error
   */
  static fromNullable<T, E>(
    this: void,
    val: T | null | undefined,
    error: E,
  ): Result<NonNullable<T>, E> {
    return val === null || val === undefined
      ? Result.Err(error)
      : Result.Ok(val as NonNullable<T>)
  }

  /**
   * Creates a Result based on a predicate.
   *
   * Returns Ok when predicate passes, otherwise Err.
   *
   * @template T - Input value type
   * @template E - Error type
   * @param val - Value to test
   * @param pred - Predicate to decide Ok vs Err
   * @param error - Error value for predicate failure
   * @returns Ok with value or Err with error
   */
  static fromPredicate<T, E>(
    this: void,
    val: T,
    pred: (v: T) => boolean,
    error: E,
  ): Result<T, E> {
    return pred(val) ? Result.Ok(val) : Result.Err(error)
  }

  /**
   * Wraps a Promise<Result<T, E>> as Result<Promise<T>, E>.
   *
   * Preserves Err by tracking async error context.
   *
   * @template U - Success value type
   * @template F - Error type
   * @param promise - Promise resolving to a Result
   * @returns Result containing a Promise of the success value
   */
  static fromPromise<U, F>(
    this: void,
    promise: Promise<Result<U, F>>,
  ): Result<Promise<U>, F> {
    const ctx: ResultCtx<F> = { asyncErr: NO_ERR }
    const p = promise.then((innerResult) => {
      if (innerResult.isErr()) {
        // Access error via unwrapErr since getErr is private
        try {
          ctx.asyncErr = innerResult.unwrapErr()
        } catch {
          // Should not happen for Err result
        }
        return ERR_VAL as U
      }
      return innerResult.unwrap()
    })

    return Result[RESULT_INTERNAL].create<Promise<U>, F>(
      p,
      undefined as F,
      ctx,
      "Ok",
    )
  }

  /**
   * Catches synchronous exceptions and converts them to Err.
   *
   * @template T - Success value type
   * @template E - Error type
   * @param fn - Function that may throw
   * @param errorMapper - Optional mapper for thrown errors
   * @returns Ok with return value or Err with mapped error
   */
  static tryCatch<T, E = unknown>(
    this: void,
    fn: () => T,
    errorMapper?: (e: unknown) => E,
  ): Result<T, E> {
    try {
      return Result.Ok(fn())
    } catch (e) {
      return Result.Err(errorMapper ? errorMapper(e) : (e as E))
    }
  }

  /**
   * Catches async exceptions and converts them to Err.
   *
   * @template T - Success value type
   * @template E - Error type
   * @param fn - Async function that may throw
   * @param errorMapper - Optional mapper for thrown errors
   * @returns Result containing a Promise of the success value
   */
  static tryAsyncCatch<T, E = unknown>(
    this: void,
    fn: () => Promise<T>,
    errorMapper?: (e: unknown) => E,
  ): Result<Promise<T>, E> {
    const ctx: ResultCtx<E> = { asyncErr: NO_ERR }

    const pWithErr = fn()
      .then((v) => v)
      .catch((e) => {
        ctx.asyncErr = errorMapper ? errorMapper(e) : (e as E)
        return ERR_VAL as T
      })

    return Result[RESULT_INTERNAL].create<Promise<T>, E>(
      pWithErr,
      undefined as E,
      ctx,
      "Ok",
    )
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
    const trace = new Error().stack
    return (yield new CapturedTrace(this, trace) as unknown as Result<
      T,
      E
    >) as T
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
    const trace = new Error().stack
    return (yield new CapturedTrace(this, trace) as unknown as Result<
      T,
      E
    >) as T
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
  static gen<Eff extends Result<any, any>, T>(
    this: void,
    // biome-ignore lint/suspicious/noExplicitAny: inference
    genFn: () => Generator<Eff, T, any>,
  ): Result<T, ExtractError<Eff>> {
    const iterator = genFn()

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: Result<T, ExtractError<Eff>>

    while (true) {
      const next = iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value)
        break
      }

      // next.value is the Result that was yielded
      let yielded = next.value as Result<unknown, unknown>
      let stack: string | undefined

      if (isCapturedTrace(yielded)) {
        stack = yielded.stack
        yielded = yielded.value as Result<unknown, unknown>
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
        // Early termination on error - return the Err result
        currentResult = yielded as Result<T, ExtractError<Eff>>
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
   *   const a = yield* $(Result.Ok(1));
   *   const b = yield* $(Result.Ok(2));
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static genAdapter<Eff extends ResultYieldWrap<any, any>, T>(
    this: void,
    genFn: (
      adapter: <A, E>(result: Result<A, E>) => ResultYieldWrap<A, E>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => Generator<Eff, T, any>,
  ): Result<T, ExtractResultError<Eff>> {
    const adapter = <A, E>(result: Result<A, E>): ResultYieldWrap<A, E> =>
      new ResultYieldWrap(result)

    const iterator = genFn(adapter)

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: Result<T, ExtractResultError<Eff>>

    while (true) {
      const next = iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value)
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
        // Early termination on error - return the Err result
        currentResult = result as unknown as Result<T, ExtractResultError<Eff>>
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
  static async asyncGen<Eff extends Result<any, any>, T>(
    this: void,
    // biome-ignore lint/suspicious/noExplicitAny: inference
    genFn: () => AsyncGenerator<Eff, T, any>,
  ): Promise<Result<T, ExtractError<Eff>>> {
    const iterator = genFn()

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: Result<T, ExtractError<Eff>>

    while (true) {
      const next = await iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value)
        break
      }

      // next.value is a Result (user awaits promises before yielding)
      let result = next.value as Result<unknown, unknown>
      let stack: string | undefined

      if (isCapturedTrace(result)) {
        stack = result.stack
        result = result.value as Result<unknown, unknown>
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
        // Early termination on error - return the Err result
        currentResult = result as Result<T, ExtractError<Eff>>
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
   * const fetchData = (id: number): Promise<Result<{id: number}, string>> => ({ id });
   * const result = await Result.asyncGenAdapter(async function* ($) {
   *   const a = yield* $(Result.Ok(1));
   *   const data = yield* $(fetchData(a));
   *   return a + data.id;
   * });
   * // Result<number, never>
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
        result: Result<A, E2> | Promise<Result<A, E2>>,
      ) => AsyncResultYieldWrap<A, E2>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => AsyncGenerator<Eff, T, any>,
  ): Promise<Result<T, ExtractAsyncResultError<Eff>>> {
    const adapter = <A, E2>(
      result: Result<A, E2> | Promise<Result<A, E2>>,
    ): AsyncResultYieldWrap<A, E2> =>
      new AsyncResultYieldWrap(Promise.resolve(result))

    const iterator = genFn(adapter)

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown
    let currentResult: Result<T, ExtractAsyncResultError<Eff>>

    while (true) {
      const next = await iterator.next(nextArg)

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value)
        break
      }

      // next.value is the AsyncResultYieldWrap that was yielded
      const wrapped = next.value as AsyncResultYieldWrap<unknown, unknown>
      let result: Result<unknown, unknown>
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
        // Early termination on error - return the Err result
        currentResult = result as Result<T, ExtractAsyncResultError<Eff>>
        break
      }

      // Unwrap the Ok value and pass it back to the generator
      nextArg = result.unwrap()
    }

    return currentResult
  }
}
