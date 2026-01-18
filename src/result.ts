import { UnwrappedErrWithOk, UnwrappedOkWithErr } from "./errors.js";
import { Option } from "./option.js";
import { UNIT } from "./unit.js";
import { isPromiseLike } from "./utils.js";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;

type FlatMapper<T, U, E> = (val: T) => Result<U, E>;
type FlatPMapper<T, U, E> = (val: T) => Result<Promise<U>, E>;
type AsyncFlatMapper<T, U, E> = (val: T) => Promise<Result<U, E>>;
type AsyncFlatPMapper<T, U, E> = (val: T) => Promise<Result<Promise<U>, E>>;
type FlatZipInput<_T, U, E> =
  | Result<U, E>
  | Result<Promise<U>, E>
  | Promise<Result<U, E>>
  | Promise<Result<Promise<U>, E>>;

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

type UnwrapPromises<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: Awaited<UnwrapResult<T[K]>["ok"]>;
};

type IsPromise<T> = T extends Promise<unknown> ? true : false;

type HasPromise<T extends readonly Result<unknown, unknown>[]> = true extends {
  [K in keyof T]: IsPromise<T[K] extends Result<infer U, unknown> ? U : never>;
}[number]
  ? true
  : false;

/** Sentinel value stored in #val when Result is Err */
const ERR_VAL = Symbol("Result::Err");

/** NO_ERR sentinel indicates no async error has occurred */
const NO_ERR = Symbol("Result::NoErr");

/** Internal symbol for accessing private factory - not exported */
const RESULT_INTERNAL = Symbol("Result::Internal");
type NO_ERR = typeof NO_ERR;

type ResultCtx<E> = { asyncErr: E | NO_ERR };

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

/** Extract error type from yielded values */
type ExtractResultError<T> =
  T extends ResultYieldWrap<any, infer E> ? E : never;

export class Result<T, E> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Ok" | "Err";

  /** Value when Ok; ERR_VAL sentinel when Err */
  readonly #val: T;

  /** Error when Err (sync); undefined when Ok */
  readonly #err: E;

  /** Context for async error tracking - stores actual error value when async chain fails */
  readonly #ctx: ResultCtx<E>;

  private constructor(val: T, err: E, ctx: ResultCtx<E>, tag: "Ok" | "Err") {
    this.#val = val;
    this.#err = err;
    this.#ctx = ctx;
    this._tag = tag;
  }

  /** Internal factory for namespace functions - not part of public API */
  static [RESULT_INTERNAL] = {
    create<T, E>(
      val: T,
      err: E,
      ctx: ResultCtx<E>,
      tag: "Ok" | "Err",
    ): Result<T, E> {
      return new Result(val, err, ctx, tag);
    },
  };

  /** Get the actual error value (from async context or sync field) */
  private getErr(): E {
    return this.#ctx.asyncErr !== NO_ERR ? this.#ctx.asyncErr : this.#err;
  }

  /** Singleton UNIT_RESULT for void-success operations */
  static readonly UNIT_RESULT: Result<UNIT, never> = new Result(
    UNIT,
    undefined as never,
    { asyncErr: NO_ERR },
    "Ok",
  );

  /** Create an Ok containing the given value */
  static Ok<T, E = never>(this: void, val: T): Result<T, E> {
    return new Result(val, undefined as E, { asyncErr: NO_ERR }, "Ok");
  }

  /** Create an Err containing the given error */
  static Err<E, T = never>(this: void, err: E): Result<T, E> {
    return new Result(ERR_VAL as T, err, { asyncErr: NO_ERR }, "Err");
  }

  /** Type guard for Ok state */
  isOk(): this is Result<T, never> {
    return this._tag === "Ok" && this.#ctx.asyncErr === NO_ERR;
  }

  /** Type guard for Err state */
  isErr(): this is Result<never, E> {
    return (
      this._tag === "Err" ||
      this.#ctx.asyncErr !== NO_ERR ||
      (this._tag === "Ok" && this.#val === ERR_VAL)
    );
  }

  /** Type guard for Unit value */
  isUnit(): this is Result<UNIT, never> {
    return this.#val === UNIT;
  }

  toString(): string {
    if (this.isOk()) {
      return `Result::Ok<${String(this.#val)}>`;
    }
    return `Result::Err<${String(this.getErr())}>`;
  }

  /** Returns value or throws (re-throws if E extends Error) */
  unwrap(this: Result<Promise<T>, E>): Promise<T>;
  unwrap(this: Result<T, E>): T;
  unwrap() {
    if (this.isErr()) {
      const err = this.getErr();
      if (err instanceof Error) throw err;
      throw new UnwrappedOkWithErr(this.toString());
    }

    const curr = this.#val;
    if (isPromiseLike(curr)) {
      const ctx = this.#ctx;
      return new Promise((resolve, reject) => {
        curr.then((v) => {
          if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) {
            const e =
              ctx.asyncErr !== NO_ERR && ctx.asyncErr instanceof Error
                ? ctx.asyncErr
                : new UnwrappedOkWithErr(this.toString());
            reject(e);
          } else {
            resolve(v);
          }
        }, reject);
      });
    }

    return curr;
  }

  /** Returns error or throws UnwrapError */
  unwrapErr<T, E>(this: Result<T, E>): E;
  unwrapErr<T, E>(this: Result<Promise<T>, E>): Promise<E>;
  unwrapErr() {
    if (this._tag === "Err") {
      return this.getErr();
    }

    const curr = this.#val;
    const ctx = this.#ctx;

    if (isPromiseLike(curr)) {
      return new Promise((resolve, reject) => {
        curr.then((v) => {
          if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) {
            resolve(ctx.asyncErr !== NO_ERR ? ctx.asyncErr : this.#err);
          } else {
            reject(new UnwrappedErrWithOk(this.toString()));
          }
        }, reject);
      });
    }

    // Sync Ok - cannot unwrapErr
    throw new UnwrappedErrWithOk(this.toString());
  }

  /** Returns value or the provided default */
  unwrapOr<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
    defaultValue: Curr,
  ): Promise<Curr>;
  unwrapOr(this: Result<T, E>, defaultValue: T): T;
  unwrapOr(defaultValue: unknown): T | Promise<unknown> {
    if (this.isErr()) return defaultValue as T;

    const curr = this.#val;
    const ctx = this.#ctx;

    if (isPromiseLike(curr)) {
      return curr.then((v) => {
        if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) return defaultValue;
        return v;
      });
    }

    return curr as T;
  }

  /** Returns value or calls factory with error to get default */
  unwrapOrElse<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
    fn: (err: E) => Curr,
  ): Promise<Curr>;
  unwrapOrElse(this: Result<T, E>, fn: (err: E) => T): T;
  unwrapOrElse(fn: (err: E) => unknown): T | Promise<unknown> {
    if (this.isErr()) return fn(this.getErr()) as T;

    const curr = this.#val;
    const ctx = this.#ctx;

    if (isPromiseLike(curr)) {
      return curr.then((v) => {
        if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) {
          const errVal = ctx.asyncErr !== NO_ERR ? ctx.asyncErr : this.#err;
          return fn(errVal);
        }
        return v;
      });
    }

    return curr as T;
  }

  /** Safe unwrap - returns null for Err */
  safeUnwrap(this: Result<never, E>): null;
  safeUnwrap<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
  ): Promise<Curr | null> | null;
  safeUnwrap(this: Result<T, E>): T | null;
  safeUnwrap(): T | null | Promise<unknown> {
    if (this.isErr()) return null;

    const curr = this.#val;
    const ctx = this.#ctx;

    if (isPromiseLike(curr)) {
      return curr.then((v) => {
        if (v === ERR_VAL || ctx.asyncErr !== NO_ERR) return null;
        return v;
      });
    }

    return curr === ERR_VAL ? null : (curr as T);
  }

  /** Pattern match on Result state */
  match<U>(cases: MatchCases<T, E, U>): U {
    if (this.isErr()) {
      return cases.Err(this.getErr());
    }
    return cases.Ok(this.#val);
  }

  // -------------------------------------------------------------------------
  // map() - with async overloads per spec
  // -------------------------------------------------------------------------

  map<T, U, E>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<U>,
  ): Result<Promise<U>, E>;
  map<T, U, E>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => U,
  ): Result<Promise<U>, E>;
  map<In, U>(
    this: Result<In, E>,
    fn: (val: In) => Promise<U>,
  ): Result<Promise<U>, E>;
  map<In, U>(this: Result<In, E>, fn: (val: In) => U): Result<U, E>;
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
      );
    }

    const curr = this.#val;
    const parentErr = this.#err;

    if (isPromiseLike(curr)) {
      const p = curr as Promise<In | typeof ERR_VAL>;
      const newCtx: ResultCtx<E> = { asyncErr: NO_ERR };
      const out = Result.safeMap(p, fn, newCtx, this.#ctx);
      return new Result(out, parentErr, newCtx, "Ok");
    }

    const next = fn(curr as unknown as In);
    if (isPromiseLike(next)) {
      return new Result(next, parentErr, { asyncErr: NO_ERR }, "Ok");
    }
    return new Result(next, parentErr, { asyncErr: NO_ERR }, "Ok");
  }

  private static safeMap<In, U, E>(
    p: Promise<In | typeof ERR_VAL>,
    mapper: (val: In) => U | Promise<U>,
    ctx: ResultCtx<E>,
    parentCtx: ResultCtx<E>,
  ): Promise<U> {
    return p.then((v) => {
      if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
        ctx.asyncErr = parentCtx.asyncErr as E;
        return ERR_VAL as unknown as U;
      }
      return mapper(v as In);
    }) as Promise<U>;
  }

  // -------------------------------------------------------------------------
  // mapErr() - transforms error while preserving success value
  // -------------------------------------------------------------------------

  mapErr<U>(fn: Mapper<E, U>): Result<T, U> {
    if (this._tag === "Err") {
      const mappedErr = fn(this.getErr());
      return Result.Err(mappedErr);
    }

    const curr = this.#val;
    const parentCtx = this.#ctx;

    if (isPromiseLike(curr)) {
      const newCtx: ResultCtx<U> = { asyncErr: NO_ERR };
      const p = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          // Transform the error
          const origErr =
            parentCtx.asyncErr !== NO_ERR ? parentCtx.asyncErr : this.#err;
          newCtx.asyncErr = fn(origErr);
        }
        return v;
      });
      return new Result(p as unknown as T, undefined as U, newCtx, "Ok");
    }

    return new Result(this.#val, undefined as U, { asyncErr: NO_ERR }, "Ok");
  }

  // -------------------------------------------------------------------------
  // mapBoth() - transforms both tracks simultaneously
  // -------------------------------------------------------------------------

  mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (val: E) => E2): Result<T2, E2>;
  mapBoth<T2, E2, In = Awaited<T2>>(
    fnOk: (val: In) => T2,
    fnErr: (val: E) => E2,
  ): Result<Promise<In>, E2>;
  mapBoth<T2, E2, In = Awaited<T2>>(
    this: Result<Promise<In>, E>,
    fnOk: (val: In) => Promise<T2>,
    fnErr: (val: E) => E2,
  ): Result<Promise<In>, E2>;
  mapBoth<E2, In = Awaited<T>>(
    fnOk: (val: T) => In | Promise<In>,
    fnErr: (val: E) => E2,
  ): Result<Promise<In>, E> | Result<In, E> | Result<T, E2> {
    if (this.isErr()) {
      return this.mapErr(fnErr);
    }

    if (isPromiseLike(this.#val)) {
      return this.map(fnOk as AsyncMapper<T, In>);
    }

    return this.map(fnOk as Mapper<T, In>);
  }

  // -------------------------------------------------------------------------
  // flatMap() - chains Result-returning functions
  // -------------------------------------------------------------------------

  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Result<Promise<U>, E2>,
  ): Result<Promise<U>, E | E2>;
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<U>, E2>>,
  ): Result<Promise<U>, E | E2>;
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Result<Promise<U>, E | E2>;
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Result<U, E | E2>,
  ): Result<Promise<U>, E | E2>;
  flatMap<T, U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<Promise<U>, E | E2>>,
  ): Result<Promise<U>, E | E2>;
  flatMap<T, U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<U, E | E2>>,
  ): Result<Promise<U>, E | E2>;
  flatMap<T, U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Result<U, E2>,
  ): Result<U, E | E2>;
  flatMap<T, _U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E2>>,
  ): never;
  flatMap<T, _U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E | E2>>,
  ): never;
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
      );
    }

    const curr = this.#val as unknown as Promise<In> | In;
    const parentErr = this.#err;
    const parentCtx = this.#ctx;
    const newCtx: ResultCtx<E | E2> = { asyncErr: NO_ERR };

    if (isPromiseLike(curr)) {
      const newP = new Promise<U>((resolve, reject) => {
        curr.then((v) => {
          if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
            newCtx.asyncErr =
              parentCtx.asyncErr !== NO_ERR
                ? (parentCtx.asyncErr as E | E2)
                : (parentErr as E | E2);
            return resolve(ERR_VAL as U);
          }

          const mapped = fn(v as In);
          const p = Result.flatMapHelper<U, E, E2, T>(newCtx, mapped);
          resolve(p);
        }, reject);
      });

      return new Result(newP, parentErr as E | E2, newCtx, "Ok");
    }

    const mapped = fn(curr as In);
    if (isPromiseLike(mapped)) {
      const p = mapped.then((r) => Result.flatMapInnerHelper(newCtx, r));
      return new Result(p, parentErr as E | E2, newCtx, "Ok");
    }

    // Sync flatMap - return the inner result directly
    if (mapped._tag === "Err") {
      return new Result(
        ERR_VAL as U,
        mapped.getErr() as E | E2,
        { asyncErr: NO_ERR },
        "Err",
      );
    }
    return new Result(
      mapped.#val as U,
      parentErr as E | E2,
      { asyncErr: NO_ERR },
      "Ok",
    );
  }

  private static flatMapHelper<U, E, E2, T>(
    mutableCtx: ResultCtx<E | E2>,
    mapped: FlatZipInput<T, U, E | E2>,
  ): U | Promise<U> {
    if (isPromiseLike(mapped)) {
      return mapped.then((r) => Result.flatMapInnerHelper(mutableCtx, r));
    }
    return Result.flatMapInnerHelper(mutableCtx, mapped);
  }

  private static flatMapInnerHelper<U, E, E2>(
    mutableCtx: ResultCtx<E | E2>,
    r: Result<Promise<U>, E | E2> | Result<U, E | E2>,
  ): U | Promise<U> {
    if (r._tag === "Err") {
      mutableCtx.asyncErr = r.getErr();
      return ERR_VAL as U;
    }

    const innerVal = r.#val;
    if (isPromiseLike(innerVal)) {
      return innerVal.then((v) => {
        if (v === ERR_VAL || r.#ctx.asyncErr !== NO_ERR) {
          mutableCtx.asyncErr =
            r.#ctx.asyncErr !== NO_ERR ? r.#ctx.asyncErr : r.#err;
        }
        return v;
      });
    }

    if (innerVal === ERR_VAL) {
      mutableCtx.asyncErr = r.getErr();
      return ERR_VAL as U;
    }

    return innerVal;
  }

  zip<T, U, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => Promise<U>,
  ): Result<Promise<[In, U]>, E>;
  zip<T, U, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => U,
  ): Result<Promise<[In, U]>, E>;
  zip<T, U>(
    this: Result<T, E>,
    fn: (val: T) => Promise<U>,
  ): Result<Promise<[T, U]>, E>;
  zip<T, U>(this: Result<T, E>, fn: (val: T) => U): Result<[T, U], E>;
  zip<T, U, In = Awaited<T>>(fn: Mapper<In, U> | AsyncMapper<In, U>) {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as unknown as [In, U],
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      );
    }

    const curr = this.#val as Promise<In> | In;
    const parentErr = this.#err;
    const parentCtx = this.#ctx;
    const newCtx: ResultCtx<E> = { asyncErr: NO_ERR };

    if (isPromiseLike(curr)) {
      const newP = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR
              ? parentCtx.asyncErr
              : (parentErr as E);
          return ERR_VAL as unknown as [In, U];
        }

        const u = fn(v as In);
        if (isPromiseLike(u)) {
          return u.then((uu) => [v, uu] as [In, U]);
        }
        return [v, u] as [In, U];
      }) as Promise<[In, U]>;

      return new Result(newP, parentErr, newCtx, "Ok");
    }

    const u = fn(curr as In);
    if (isPromiseLike(u)) {
      const p = u.then((uu) => [curr, uu] as [In, U]);
      return new Result(p, parentErr, { asyncErr: NO_ERR }, "Ok");
    }

    return new Result(
      [curr, u] as [In, U],
      parentErr,
      { asyncErr: NO_ERR },
      "Ok",
    );
  }

  // -------------------------------------------------------------------------
  // flatZip() - pairs original value with value from another Result
  // -------------------------------------------------------------------------

  flatZip<U, E2, In = Awaited<T>>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => FlatZipInput<In, U, E | E2>,
  ): Result<Promise<[In, Awaited<U>]>, E | E2>;
  flatZip<U, E2, In = Awaited<T>>(
    this: Result<In, E>,
    fn: (
      val: In,
    ) =>
      | Promise<Result<U, E2>>
      | Promise<Result<Promise<U>, E2>>
      | Result<Promise<U>, E2>,
  ): Result<Promise<[In, Awaited<U>]>, E | E2>;
  flatZip<U, E2, In = Awaited<T>>(
    this: Result<In, E>,
    fn: (val: In) => Result<U, E2>,
  ): Result<[In, U], E | E2>;
  flatZip<U, E2, In = T>(
    fn: (val: In) => FlatZipInput<In, U, E | E2>,
  ): Result<[In, Awaited<U>] | Promise<[In, Awaited<U>]>, E | E2> {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as unknown as [In, Awaited<U>] | Promise<[In, Awaited<U>]>,
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      );
    }

    const curr = this.#val as Promise<In> | In;
    const parentErr = this.#err;
    const parentCtx = this.#ctx;
    const newCtx: ResultCtx<E | E2> = { asyncErr: NO_ERR };

    if (isPromiseLike(curr)) {
      const newP = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR
              ? (parentCtx.asyncErr as E | E2)
              : (parentErr as E | E2);
          return ERR_VAL as unknown as [In, Awaited<U>];
        }

        const mapped = fn(v as In);
        return Result.flatZipHelper(newCtx, v as In, mapped);
      }) as Promise<[In, Awaited<U>]>;

      return new Result(newP, parentErr as E | E2, newCtx, "Ok");
    }

    const mapped = fn(curr as In);
    const p = Result.flatZipHelper(newCtx, curr as In, mapped);

    if (isPromiseLike(p)) {
      return new Result(
        p as Promise<[In, Awaited<U>]>,
        parentErr as E | E2,
        newCtx,
        "Ok",
      );
    }

    if (p === ERR_VAL) {
      return new Result(
        ERR_VAL as unknown as [In, Awaited<U>],
        newCtx.asyncErr !== NO_ERR ? newCtx.asyncErr : (parentErr as E | E2),
        newCtx,
        "Err",
      );
    }

    return new Result(p as [In, Awaited<U>], parentErr as E | E2, newCtx, "Ok");
  }

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
      ) as Promise<[In, Awaited<U>]> | typeof ERR_VAL;
    }
    return Result.flatZipInnerHelper(mutableCtx, originalVal, mapped);
  }

  private static flatZipInnerHelper<U, E, E2, In>(
    mutableCtx: ResultCtx<E | E2>,
    originalVal: In,
    r: Result<Promise<U>, E | E2> | Result<U, E | E2>,
  ): [In, Awaited<U>] | Promise<[In, Awaited<U>]> | typeof ERR_VAL {
    if (r._tag === "Err") {
      mutableCtx.asyncErr = r.getErr();
      return ERR_VAL;
    }

    const innerVal = r.#val;
    if (isPromiseLike(innerVal)) {
      return innerVal.then((v) => {
        if (v === ERR_VAL || r.#ctx.asyncErr !== NO_ERR) {
          mutableCtx.asyncErr =
            r.#ctx.asyncErr !== NO_ERR ? r.#ctx.asyncErr : r.#err;
          return ERR_VAL as unknown as [In, Awaited<U>];
        }
        return [originalVal, v] as [In, Awaited<U>];
      });
    }

    if (innerVal === ERR_VAL) {
      mutableCtx.asyncErr = r.getErr();
      return ERR_VAL;
    }

    return [originalVal, innerVal] as [In, Awaited<U>];
  }

  // -------------------------------------------------------------------------
  // zipErr() - combines errors while retaining original value
  // -------------------------------------------------------------------------

  zipErr<E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<unknown, E2>>,
  ): Result<Promise<T>, E | E2>;
  zipErr<E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<unknown, E2>>,
  ): Result<Promise<T>, E | E2>;
  zipErr<E2>(
    this: Result<T, E>,
    fn: (val: T) => Result<unknown, E2>,
  ): Result<T, E | E2>;
  zipErr<E2, In = Awaited<T>>(
    fn: FlatMapper<In, unknown, E | E2> | AsyncFlatMapper<In, unknown, E | E2>,
  ) {
    if (this.isErr()) {
      return new Result(
        ERR_VAL as T,
        this.getErr(),
        { asyncErr: NO_ERR },
        "Err",
      );
    }

    const curr = this.#val as Promise<In> | In;
    const parentErr = this.#err;
    const parentCtx = this.#ctx;
    const newCtx: ResultCtx<E | E2> = { asyncErr: NO_ERR };

    if (isPromiseLike(curr)) {
      const newP = curr.then((v) => {
        if (v === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR
              ? (parentCtx.asyncErr as E | E2)
              : (parentErr as E | E2);
          return ERR_VAL as In;
        }

        const r = fn(v as In);
        return Result.zipErrHelper(v as In, r, newCtx);
      });

      return new Result(newP, parentErr as E | E2, newCtx, "Ok");
    }

    const r = fn(curr as In);
    const newP = Result.zipErrHelper(curr as In, r, newCtx);

    if (isPromiseLike(newP)) {
      return new Result(
        newP as unknown as T,
        parentErr as E | E2,
        newCtx,
        "Ok",
      );
    }

    if (newCtx.asyncErr !== NO_ERR) {
      return new Result(ERR_VAL as T, newCtx.asyncErr, newCtx, "Err");
    }

    return new Result(newP as unknown as T, parentErr as E | E2, newCtx, "Ok");
  }

  private static zipErrHelper<In, E>(
    v: In,
    r: Result<unknown, E> | Promise<Result<unknown, E>>,
    newCtx: ResultCtx<E>,
  ): In | Promise<In> {
    if (isPromiseLike(r)) {
      return r.then((newResult) => {
        if (newResult._tag === "Err") {
          newCtx.asyncErr = newResult.getErr() as E;
        }
        return v;
      });
    }

    if (r._tag === "Err") {
      newCtx.asyncErr = r.getErr() as E;
    }
    return v;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  validate<VE extends unknown[]>(
    this: Result<T, E>,
    validators: { [K in keyof VE]: (val: T) => Result<unknown, VE[K]> },
  ): Result<T, E | VE[number][]>;
  validate<VE extends unknown[]>(
    this: Result<T, E>,
    validators: {
      [K in keyof VE]: (val: T) => Promise<Result<unknown, VE[K]>>;
    },
  ): Result<Promise<T>, E | VE[number][]>;
  validate<VE extends unknown[], In = Awaited<T>>(
    this: Result<T, E> | Result<Promise<T>, E>,
    validators: {
      [K in keyof VE]: (
        val: In,
      ) => Promise<Result<unknown, VE[K]>> | Result<unknown, VE[K]>;
    },
  ): Result<Promise<T>, E | VE[number][]>;
  validate<VE extends unknown[]>(
    this: Result<T, E> | Result<Promise<T>, E>,
    validators: {
      [K in keyof VE]: (
        val: T,
      ) => Promise<Result<unknown, VE[K]>> | Result<unknown, VE[K]>;
    },
  ):
    | Result<T, E>
    | Result<T, E | VE[number][]>
    | Result<Promise<T>, E | VE[number][]> {
    if (this.isErr()) return this as Result<T, E[]>;

    const currVal = this.#val;
    const parentErr = this.#err;
    const parentCtx = this.#ctx;
    const mutableCtx: ResultCtx<E | VE[number][]> = { asyncErr: NO_ERR };

    if (isPromiseLike(currVal)) {
      return new Result(
        currVal.then(async (c) => {
          if (c === ERR_VAL || parentCtx.asyncErr !== NO_ERR) {
            mutableCtx.asyncErr =
              parentCtx.asyncErr !== NO_ERR
                ? (parentCtx.asyncErr as E | VE[number][])
                : (parentErr as E | VE[number][]);
            return ERR_VAL;
          }

          const awaitedVal = c as T;
          const results = validators.map((v) => v(awaitedVal));
          return Promise.all(results).then((resolved) =>
            Result.validateHelper(
              resolved as Result<unknown, unknown>[],
              mutableCtx,
              awaitedVal,
            ),
          );
        }),
        parentErr,
        mutableCtx,
        "Ok",
      ) as Result<Promise<T>, E[]>;
    }

    const baseVal: T = currVal as T;
    const results = validators.map((v) => v(baseVal));

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
      ) as Result<Promise<T>, E[]>;
    }

    const syncResults = results as Result<unknown, unknown>[];
    const hasPromiseVal = syncResults.some((r) => isPromiseLike(r.#val));

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
      ) as Result<Promise<T>, E>;
    }

    const combinedRes = Result.all(...(syncResults as Result<unknown, E>[]));

    return combinedRes.isErr() ? combinedRes : this;
  }

  private static validateHelper<Val, Err>(
    results: Result<unknown, unknown>[],
    currCtx: ResultCtx<Err>,
    currVal: Val | Promise<Val>,
  ): Val | Promise<Val> | typeof ERR_VAL {
    const combinedRes = Result.all(...results);

    if (isPromiseLike(combinedRes.#val)) {
      return combinedRes.#val.then((v) => {
        if (v === ERR_VAL || combinedRes.#ctx.asyncErr !== NO_ERR) {
          currCtx.asyncErr = combinedRes.getErr() as Err;
          return ERR_VAL as unknown as Val;
        }
        return currVal as Val;
      }) as Promise<Val>;
    }

    if (combinedRes.isErr()) {
      currCtx.asyncErr = combinedRes.getErr() as Err;
      return ERR_VAL as unknown as Val;
    }
    return currVal as Val;
  }

  // ==========================================================================
  // Aggregation
  // ==========================================================================

  static all<T extends Result<unknown, unknown>[]>(
    ...results: T
  ): HasPromise<T> extends true
    ? Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>
    : Result<CombinedResultOk<T>, CombinedResultErr<T>[]>;
  static all<T extends Result<unknown, unknown>[]>(
    ...results: T
  ):
    | Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>
    | Result<CombinedResultOk<T>, CombinedResultErr<T>[]> {
    const vals = results.map((r) => r.#val);
    const newCtx: ResultCtx<CombinedResultErr<T>[]> = { asyncErr: NO_ERR };

    if (vals.some(isPromiseLike)) {
      const p = Promise.all(vals).then((resolvedVals) => {
        const errs: unknown[] = [];
        for (let i = 0; i < results.length; i++) {
          if (
            results[i]._tag === "Err" ||
            results[i].#ctx.asyncErr !== NO_ERR ||
            resolvedVals[i] === ERR_VAL
          ) {
            errs.push(results[i].getErr());
          }
        }
        if (errs.length > 0) {
          newCtx.asyncErr = errs as CombinedResultErr<T>[];
          return ERR_VAL;
        }
        return resolvedVals;
      });

      return new Result(
        p,
        [] as CombinedResultErr<T>[],
        newCtx,
        "Ok",
      ) as Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>;
    }

    const errs: unknown[] = [];
    for (const r of results) {
      if (r._tag === "Err") {
        errs.push(r.getErr());
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

  /** Returns first Ok, or collects all errors */
  static any<U, F>(...results: Result<U, F>[]): Result<U, F[]> {
    for (const r of results) {
      if (r.isOk()) return r as Result<U, F[]>;
    }
    return Result.Err(results.map((r) => r.getErr()));
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /** Execute side effect for Ok, return self */
  tap<Curr = Awaited<T>>(
    this: Result<Promise<Curr>, E>,
    fn: (val: Curr) => void,
  ): Result<Promise<Curr>, E>;
  tap(this: Result<T, E>, fn: (val: T) => void): Result<T, E>;
  tap<Curr = Awaited<T>>(
    fn: (val: T | Curr) => void,
  ): Result<T, E> | Result<Promise<Curr>, E> {
    if (this.isErr()) return this;

    const curr = this.#val;
    const parentCtx = this.#ctx;
    if (isPromiseLike(curr)) {
      const newCtx: ResultCtx<E> = { asyncErr: NO_ERR };
      const newPromise = curr.then((v) => {
        if (v !== ERR_VAL && parentCtx.asyncErr === NO_ERR) {
          fn(v as Curr);
        } else {
          newCtx.asyncErr =
            parentCtx.asyncErr !== NO_ERR ? parentCtx.asyncErr : this.#err;
        }
        return v;
      });
      return new Result(newPromise as T, this.#err, newCtx, "Ok");
    }

    fn(curr as T);
    return this;
  }

  /** Execute side effect for Err, return self */
  tapErr(fn: (err: E) => void): Result<T, E> {
    if (this.isErr()) {
      fn(this.getErr());
    }
    return this;
  }

  /** Swap Ok and Err */
  flip(): Result<E, T> {
    if (this.isErr()) {
      return new Result(
        this.getErr(),
        undefined as T,
        { asyncErr: NO_ERR },
        "Ok",
      );
    }
    return new Result(
      ERR_VAL as E,
      this.#val as T,
      { asyncErr: NO_ERR },
      "Err",
    );
  }

  /** Convert Result to Option (discards error info) */
  toOption(): Option<T> {
    if (this.isErr()) return Option.None;
    return Option.Some(this.#val);
  }

  /** Resolve inner Promise and maintain Result structure */
  async toPromise(): Promise<Result<Awaited<T>, E>> {
    const v = await this.#val;

    if (v === ERR_VAL || this.#ctx.asyncErr !== NO_ERR) {
      const errVal =
        this.#ctx.asyncErr !== NO_ERR ? this.#ctx.asyncErr : this.#err;
      return new Result(
        ERR_VAL as Awaited<T>,
        errVal,
        { asyncErr: NO_ERR },
        "Err",
      );
    }

    return new Result(v as Awaited<T>, this.#err, { asyncErr: NO_ERR }, "Ok");
  }

  /** Map over array elements inside Result */
  innerMap<In, E, Out>(
    this: Result<Array<In>, E>,
    mapper: (val: NoInfer<In>) => Out,
  ): Result<Array<Out>, E> {
    if (this.isErr()) return this as unknown as Result<Array<Out>, E>;

    if (Array.isArray(this.#val)) {
      return new Result(this.#val.map(mapper), this.#err, this.#ctx, "Ok");
    }

    throw new Error("Can only be called for Result<Array<T>, E>");
  }

  /** Recover from error by providing fallback Result */
  orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T | T2, E2> {
    if (this.isOk()) return this as unknown as Result<T | T2, E2>;
    return fn(this.getErr());
  }

  /**
   * Makes Result iterable for use with generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   *
   * @example
   * ```ts
   * const result = Result.genSimple(function* () {
   *   const value = yield* Result.Ok(42);
   *   return value * 2;
   * });
   * ```
   */
  *[Symbol.iterator](): Generator<Result<T, E>, T, unknown> {
    return (yield this) as T;
  }
}

// ==========================================================================
// Static Constructors (added to Result namespace)
// ==========================================================================

export namespace Result {
  /** Create Result from nullable value - returns Err for null/undefined */
  export function fromNullable<T, E>(
    val: T | null | undefined,
    error: E,
  ): Result<NonNullable<T>, E> {
    return val === null || val === undefined
      ? Result.Err(error)
      : Result.Ok(val as NonNullable<T>);
  }

  /** Create Result based on predicate result */
  export function fromPredicate<T, E>(
    val: T,
    pred: (v: T) => boolean,
    error: E,
  ): Result<T, E> {
    return pred(val) ? Result.Ok(val) : Result.Err(error);
  }

  /** Wrap Promise<Result<T, E>> as Result<Promise<T>, E> */
  export function fromPromise<U, F>(
    promise: Promise<Result<U, F>>,
  ): Result<Promise<U>, F> {
    const ctx: ResultCtx<F> = { asyncErr: NO_ERR };
    const p = promise.then((innerResult) => {
      if (innerResult.isErr()) {
        // Access error via unwrapErr since getErr is private
        try {
          ctx.asyncErr = innerResult.unwrapErr();
        } catch {
          // Should not happen for Err result
        }
        return ERR_VAL as unknown as U;
      }
      return innerResult.unwrap();
    });

    return Result[RESULT_INTERNAL].create<Promise<U>, F>(
      p,
      undefined as F,
      ctx,
      "Ok",
    );
  }

  /** Catches sync exceptions */
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

  /** Catches async exceptions */
  export function tryAsyncCatch<T, E = unknown>(
    fn: () => Promise<T>,
    errorMapper?: (e: unknown) => E,
  ): Result<Promise<T>, E> {
    const ctx: ResultCtx<E> = { asyncErr: NO_ERR };

    const pWithErr = fn()
      .then((v) => v)
      .catch((e) => {
        ctx.asyncErr = errorMapper ? errorMapper(e) : (e as E);
        return ERR_VAL as unknown as T;
      });

    return Result[RESULT_INTERNAL].create<Promise<T>, E>(
      pWithErr,
      undefined as E,
      ctx,
      "Ok",
    );
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
   * const result = Result.genSimple(function* () {
   *   const a = yield* Result.Ok(1);
   *   const b = yield* Result.Ok(2);
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  export function genSimple<T, E>(
    genFn: () => Generator<Result<unknown, E>, T, unknown>,
  ): Result<T, E> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Result<T, E>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Ok
        currentResult = Result.Ok(next.value);
        break;
      }

      // next.value is the Result that was yielded
      const yielded = next.value as Result<unknown, E>;

      if (yielded.isErr()) {
        // Early termination on error - return the Err result
        currentResult = yielded as Result<T, E>;
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
   * const result = Result.gen(function* ($) {
   *   const a = yield* $(Result.Ok(1));
   *   const b = yield* $(Result.Ok(2));
   *   return a + b;
   * });
   * // Result<number, never>
   * ```
   */
  export function gen<Eff extends ResultYieldWrap<any, any>, T>(
    genFn: (
      adapter: <A, E>(result: Result<A, E>) => ResultYieldWrap<A, E>,
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
}
