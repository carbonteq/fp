import { isPromise } from "node:util/types";
import { UNIT } from "./unit.js";
import assert from "node:assert";

export class UnwrappedErrWithOk extends Error {
  constructor(r: Result<unknown, unknown>) {
    super(`Attempted to call unwrapErr on an okay value: <${r}>`);
  }
}

export class UnwrappedOkWithErr extends Error {
  constructor(r: Result<unknown, unknown>) {
    super(`Attempted to call unwrap on an Err value: <${r}>`);
  }
}

export type UnitResult<E = never> = Result<UNIT, E>;

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;

type FlatMapper<T, U, E> = (val: T) => Result<U, E>;
type FlatPMapper<T, U, E> = (val: T) => Result<Promise<U>, E>;
type AsyncFlatMapper<T, U, E> = (val: T) => Promise<Result<U, E>>;
type AsyncFlatPMapper<T, U, E> = (val: T) => Promise<Result<Promise<U>, E>>;

type OkOrErr = "ok" | "err";
const okPred = <T, E extends Error>(el: Result<T, E>): boolean => el.isOk();
const errPred = <T, E extends Error>(el: Result<T, E>): boolean => el.isErr();
const preds = [okPred, errPred];

export type UnwrapResult<T extends Result<unknown, unknown>> = T extends Result<
  infer U,
  infer E
>
  ? { ok: U; err: E }
  : never;

type CombinedResultOk<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["ok"];
};
type CombinedResultErr<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["err"];
}[number];
type CombinedErrs<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["err"];
};

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

/** Sentinel value */
const Sentinel = Symbol.for("ResultSentinel");
type Sentinel = typeof Sentinel;

type ResultCtx<E> = { errSlot: E | Sentinel };

export class Result<T, E> {
  static readonly UNIT_RESULT = new Result(UNIT, {
    errSlot: Sentinel,
  }) as UnitResult;

  // Actual value holder. In async ops, will be used to chain. Cannot go back to normal after promise chain starts, although that could be looked into
  readonly #val: T | Sentinel;

  // to prevent unnecessary chaining - no other purpose. Should be modifiable only within the creating method
  readonly #ctx: ResultCtx<E>;

  protected constructor(val: T | Sentinel, ctx: ResultCtx<E>) {
    this.#val = val;
    this.#ctx = ctx;
  }

  static Ok<T, E = never>(val: T): Result<T, E> {
    return new Result(val, { errSlot: Sentinel }) as Result<T, E>;
  }

  static Err<E, T = never>(err: E): Result<T, E> {
    return new Result(Sentinel as T, { errSlot: err });
  }

  isOk(): this is Result<T, never> {
    return this.#ctx.errSlot === Sentinel;
  }

  isErr(): this is Result<never, E> {
    return this.#ctx.errSlot !== Sentinel;
  }

  isUnit(): this is Result<UNIT, never> {
    return this.#val === UNIT;
  }

  toString(): string {
    if (this.isOk()) {
      return `Result::Ok<${String(this.#val)}>`;
    }

    return `Result::Err<${String(this.#ctx.errSlot)}>`;
  }

  unwrap(this: Result<Promise<T>, E>): Promise<T>;
  unwrap(this: Result<T, E>): T;
  unwrap() {
    const curr = this.#val;
    if (this.isErr()) {
      const err = this.#ctx.errSlot;

      if (err instanceof Error) throw err;

      throw new UnwrappedOkWithErr(this);
    }

    if (isPromise(curr)) {
      return new Promise((resolve, reject) => {
        curr.then((v) => {
          if (v === Sentinel) {
            let e: Error;
            if (this.#ctx.errSlot instanceof Error) e = this.#ctx.errSlot;
            else e = new UnwrappedOkWithErr(this);

            reject(e);
          }

          resolve(v);
        }, reject);
      });
    }

    return curr;
  }

  // unwrapOr(def: T): T {
  //   if (this.isErr()) return def;
  //
  //   return this.val as T;
  // }
  //
  // unwrapOrElse(def: () => T): T;
  // unwrapOrElse(def: () => Promise<T>): Promise<T>;
  // unwrapOrElse(def: () => T | Promise<T>): T | Promise<T> {
  //   if (this.isErr()) return def();
  //
  //   return this.val as T;
  // }

  unwrapErr<T, E>(this: Result<Promise<T>, E>): Promise<E>;
  unwrapErr<T, E>(this: Result<T, E>): E;
  unwrapErr() {
    const errSlot = this.#ctx.errSlot;

    if (errSlot !== Sentinel) {
      return errSlot;
    }

    // Either we are in okay result, or haven't gotten to error state yet
    // Only way to get to error state is if val is promise at this point

    const curr = this.#val;
    if (isPromise(curr)) {
      return new Promise((resolve, reject) => {
        curr.then((v) => {
          if (v !== Sentinel) {
            // Is okay
            reject(new UnwrappedErrWithOk(this));
          }

          resolve(this.#ctx.errSlot);
        }, reject);
      });
    }

    // val is not promise, which means val must contain a valid value, add sanity check
    assert(curr !== Sentinel, "value must not be Sentinel at this point");

    throw new UnwrappedErrWithOk(this);
  }

  safeUnwrap(): T | null {
    return this.#val === Sentinel ? null : this.#val;
  }

  /**
   *
   * @param {Mapper<T, U>} fn The mapping/endofunctor to apply to the internal Ok value (T -> U)
   * @returns Result<U, E> containing the mapped value
   * @example
   * const r = Result.Ok({data: 42})
   * const r2 = Result.Err(new Error("something went wrong"))
   * const mapper = (d: {data: 42}) => d.data * 2
   * const result1 = r.map(mapper) // Result containing 64 as the ok value
   * const result2 = r2.map(mapper) // mapper won't be applied, as r2 was in error state
   */
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
    // No computation if in Err track
    // if (this.isErr() || this.val === Sentinel)
    if (this.isErr()) return Result.Err(this.#ctx.errSlot) as Result<U, E>;
    assert(this.#val !== Sentinel, "cannot be Sentinel at this point");

    const curr = this.#val; // should not be sentinel, only promise or proper value
    const immutableCtx = this.#ctx;
    const mutableCtx: ResultCtx<E> = { errSlot: Sentinel };

    if (isPromise(curr)) {
      const p = curr as Promise<In | Sentinel>;
      const out = p.then((v) => {
        if (v === Sentinel) {
          mutableCtx.errSlot = immutableCtx.errSlot;
          return Sentinel;
        }

        const mapped = fn(v);
        return mapped;
      }) as Promise<U>;

      // Using mutable ctx as we cannot modify immutableCtx in the op above
      return new Result(out, mutableCtx);
    }

    //@ts-expect-error
    const next = fn(curr);

    return new Result(next, mutableCtx) as Result<U, E>;
  }

  /** Same as map, but for the error value instead of the Ok value */
  mapErr<U>(fn: Mapper<E, U>): Result<T, U> {
    if (this.isErr()) {
      // Easy case
      const mappedErr = fn(this.#ctx.errSlot as E);
      return Result.Err(mappedErr); // no need to retain context anymore
    }

    const curr = this.#val;
    const newCtx: ResultCtx<U> = { errSlot: Sentinel };
    const ctx = this.#ctx;
    if (isPromise(curr)) {
      // Can eventually lead to Err state
      const p = curr.then((v) => {
        // Could have fallen into this state by now
        if (ctx.errSlot !== Sentinel) {
          const mappedErr = fn(ctx.errSlot);
          newCtx.errSlot = mappedErr;
        }

        return v;
      });

      return new Result(p, newCtx) as Result<T, U>;
    }

    // we don't need to propagate the previous ctx, as closure will ensure the changes there are reflected in newCtx
    return new Result(this.#val, newCtx);
  }

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

    if (isPromise(this.#val)) {
      return this.map(fnOk as AsyncMapper<T, In>);
    }

    return this.map(fnOk as Mapper<T, In>);
  }

  /**
   * Also known as `andThen`, `bind` or `fmap`
   * Like Result.map but used in cases where the mapper func returns a Result instead of a containable value
   * @example
   * const r: Result<string, SomeError> = Result.Ok("42")
   * const mapper = (d: string) => {
   *   const n = Number.parseInt(d)
   *   if(Number.isNumber(n) && !Number.isNaN(n)) return Result.Ok(n)
   *
   *   return Result.Err(new InvalidNumStringError(d))
   * }
   * const result1 = r.map(mapper) // Type is Result<Result<number, InvalidNumStringError>, SomeError>
   * const result2 = r.flatMap(mapper) // Type is Result<number, SomeError | InvalidNumStringError>
   */
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
  flatMap<T, U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E2>>,
  ): never;
  flatMap<T, U, E2>(
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
    if (this.isErr()) return Result.Err(this.#ctx.errSlot);

    assert(this.#val !== Sentinel, "cannot be Sentinel at this point");

    const curr = this.#val as unknown as Promise<In> | In;
    const immutableCtx = this.#ctx;
    const mutableCtx: ResultCtx<E | E2> = { errSlot: Sentinel };

    if (isPromise(curr)) {
      const newP = new Promise<U>((resolve, reject) => {
        curr.then((v) => {
          if (v === Sentinel) {
            // the only place where previous ctx can have an effect in this method
            mutableCtx.errSlot = immutableCtx.errSlot;
            return resolve(Sentinel as U);
          }

          const mapped = fn(v);
          const p = Result.flatMapHelper(mutableCtx, mapped);

          resolve(p);
        }, reject);
      });

      return new Result(newP, mutableCtx);
    }

    const mapped = fn(curr);
    const p = Result.flatMapHelper(mutableCtx, mapped);

    return new Result(p, mutableCtx);
  }

  private static flatMapHelper<U, E, E2>(
    mutableCtx: ResultCtx<E | E2>,
    mapped:
      | Promise<Result<Promise<U>, E | E2>>
      | Promise<Result<U, E | E2>>
      | Result<Promise<U>, E | E2>
      | Result<U, E | E2>,
  ) {
    if (isPromise(mapped)) {
      return mapped.then((r) => Result.flatMapInnerHelper(mutableCtx, r));
    }

    return Result.flatMapInnerHelper(mutableCtx, mapped);
  }

  private static flatMapInnerHelper<U, E, E2>(
    mutableCtx: ResultCtx<E | E2>,
    r: Result<Promise<U>, E | E2> | Result<U, E | E2>,
  ) {
    if (isPromise(r.#val)) {
      return r.#val.then((v) => {
        if (v === Sentinel) {
          mutableCtx.errSlot = r.#ctx.errSlot;
        }

        return v;
      });
    }

    if (r.#val === Sentinel) {
      mutableCtx.errSlot = r.#ctx.errSlot;
      return Sentinel as U;
    }

    return r.#val;
  }

  /**
   * For combining the errors only while retaining the original value.
   * @example
   * const r: Result<string, SomeError> = Result.Ok('42')
   * const binderOk = (d: string) => Result.Ok<number, SomeOtherError>(0909)
   * const binderErr = (d: string) => Result.Err<number, SomeOtherError>(new SomeOtherError())
   * const binderErrAsync = async (d: string) => Result.Err<number, SomeOtherError>(new SomeOtherError())
   *
   * const res1 = r.zipErr(binderOk) // Result<string, SomeError | SomeOtherError> - Value: Result.Ok('42') - No change in Ok type
   * const res2 = r.zipErr(binderErr) // Result<string, SomeError | SomeOtherError> - Value: Result.Err(new SomeOtherError())
   * const res3 = r.zipErr(binderErrAsync) // Result<Promise<string>, SomeError | SomeOtherError> - Value: Result.Err(new SomeOtherError())
   */
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
      // Already in error state, zip should not compute as there's no T
      return Result.Err(this.#ctx.errSlot);
    }
    assert(this.#val !== Sentinel, "cannot be Sentinel at this point");

    const curr = this.#val as Promise<In> | In;
    const immutableCtx = this.#ctx;
    const mutableCtx: ResultCtx<E | E2> = { errSlot: Sentinel };
    if (isPromise(curr)) {
      // Only branch that can led to a non-Ok state in the future
      const newP = curr.then((v) => {
        // Check if returned value is Sentinel
        if (v === Sentinel) {
          // fallen into error slot
          mutableCtx.errSlot = immutableCtx.errSlot;
          return Sentinel as In;
        }

        const r = fn(v);
        return Result.zipErrHelper(v, r, mutableCtx);
      });

      return new Result(newP, mutableCtx);
    }

    // There is no computation in the chain, so let's resolve it directly with the value
    const r = fn(curr);
    const newP = Result.zipErrHelper(curr, r, mutableCtx);
    return new Result(newP, mutableCtx);
  }

  private static zipErrHelper<In, E>(
    v: In,
    r: Result<unknown, E> | Promise<Result<unknown, E>>,
    newCtx: ResultCtx<E>,
  ): In | Promise<In> {
    if (isPromise(r)) {
      const finalPromise = r.then((newResult) => {
        if (newResult.#ctx.errSlot !== Sentinel)
          newCtx.errSlot = newResult.#ctx.errSlot;

        return v;
      });
      return finalPromise;
    }

    if (r.#ctx.errSlot !== Sentinel) newCtx.errSlot = r.#ctx.errSlot;

    return v;
  }

  zip<U>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<U>,
  ): Result<Promise<[T, U]>, E>;
  zip<U>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => U,
  ): Result<Promise<[T, U]>, E>;
  zip<U>(
    this: Result<T, E>,
    fn: (val: T) => Promise<U>,
  ): Result<Promise<[T, U]>, E>;
  zip<U>(this: Result<T, E>, fn: (val: T) => U): Result<[T, U], E>;
  zip<U, In = Awaited<T>>(fn: Mapper<In, U> | AsyncMapper<In, U>) {
    if (this.isErr()) return Result.Err(this.#ctx.errSlot);

    const curr = this.#val as Promise<In> | In;
    assert(this.#val !== Sentinel, "cannot be Sentinel at this point");

    const immutableCtx = this.#ctx;
    const mutableCtx: ResultCtx<E> = { errSlot: Sentinel };

    if (isPromise(curr)) {
      const newP = curr.then((v) => {
        if (v === Sentinel) {
          mutableCtx.errSlot = immutableCtx.errSlot;
          return Sentinel;
        }

        const u = fn(v);
        if (isPromise(u)) return u.then((uu) => [v, uu]);

        return [v, u];
      }) as Promise<[In, U]>;

      return new Result(newP, mutableCtx);
    }

    const u = fn(curr);
    if (isPromise(u)) {
      return new Result(
        u.then((uu) => [curr, uu]) as Promise<[In, U]>,
        mutableCtx,
      );
    }

    return new Result([curr, u] as [In, U], mutableCtx);
  }

  /** For combining two results lazily. For the eager eval version, see {@link and} */
  flatZip<U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E2>>,
  ): never;

  flatZip<U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<Promise<U>, E2>>,
  ): Result<Promise<[T, U]>, E | E2>;
  flatZip<U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Result<Promise<[T, U]>, E | E2>;
  flatZip<U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Result<Promise<U>, E2>,
  ): Result<Promise<[T, U]>, E | E2>;
  flatZip<U, E2>(
    this: Result<Promise<T>, E>,
    fn: (val: T) => Result<U, E2>,
  ): Result<Promise<[T, U]>, E | E2>;

  flatZip<U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E2>>,
  ): never;
  flatZip<U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<Promise<U>, E2>>,
  ): Result<Promise<[T, U]>, E | E2>;
  flatZip<U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Result<Promise<[T, U]>, E | E2>;
  flatZip<U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Result<Promise<U>, E2>,
  ): Result<Promise<[T, U]>, E | E2>;
  flatZip<U, E2>(
    this: Result<T, E>,
    fn: (val: T) => Result<U, E2>,
  ): Result<[T, U], E | E2>;
  flatZip<U, E2, In = Awaited<T>>(
    fn:
      | FlatMapper<In, U, E | E2>
      | FlatPMapper<In, U, E | E2>
      | AsyncFlatMapper<In, U, E | E2>
      | AsyncFlatPMapper<In, U, E | E2>,
  ) {
    if (this.isErr()) return Result.Err(this.#ctx.errSlot);

    const curr = this.#val as Promise<In> | In;
    assert(this.#val !== Sentinel, "cannot be Sentinel at this point");

    const immutableCtx = this.#ctx;
    const mutableCtx: ResultCtx<E | E2> = { errSlot: Sentinel };

    if (isPromise(curr)) {
      const newP = curr.then((v) => {
        if (v === Sentinel) {
          mutableCtx.errSlot = immutableCtx.errSlot;
          return v;
        }

        const mapped = fn(v);
        return Result.flatZipHelper(mutableCtx, v, mapped);
      });
      return new Result(newP, mutableCtx);
    }

    const mapped = fn(curr);
    const p = Result.flatZipHelper(mutableCtx, curr, mapped);

    return new Result(p, mutableCtx);
  }

  private static flatZipHelper<U, E, E2, T>(
    mutableCtx: ResultCtx<E | E2>,
    originalVal: T,
    mapped:
      | Promise<Result<Promise<U>, E | E2>>
      | Promise<Result<U, E | E2>>
      | Result<Promise<U>, E | E2>
      | Result<U, E | E2>,
  ) {
    if (isPromise(mapped)) {
      return mapped.then((r) =>
        Result.flatZipInnerHelper(mutableCtx, originalVal, r),
      );
    }

    return Result.flatZipInnerHelper(mutableCtx, originalVal, mapped);
  }

  private static flatZipInnerHelper<U, E, E2, T>(
    mutableCtx: ResultCtx<E | E2>,
    originalVal: T,
    r: Result<Promise<U>, E | E2> | Result<U, E | E2>,
  ) {
    if (isPromise(r.#val)) {
      return r.#val.then((v) => {
        if (v === Sentinel) {
          mutableCtx.errSlot = r.#ctx.errSlot;
        }
        return [originalVal, v] as [T, U];
      });
    }

    if (r.#val === Sentinel) {
      mutableCtx.errSlot = r.#ctx.errSlot;
      return Sentinel;
    }

    return [originalVal, r.#val] as [T, U];
  }

  //#endregion

  innerMap<In, E, Out>(
    this: Result<Array<In>, E>,
    mapper: (val: NoInfer<In>) => Out,
  ): Result<Array<Out>, E> {
    if (this.isErr()) return this;

    if (Array.isArray(this.#val)) {
      return new Result(this.#val.map(mapper), this.#ctx);
    }

    throw new Error("Can only be called for Result<Array<T>, E>");
  }

  async toPromise(): Promise<Result<Awaited<T>, E>> {
    const v = await this.#val;

    return new Result(v, this.#ctx);
  }

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
    const currCtx = this.#ctx;
    const mutableCtx = { errSlot: Sentinel } as ResultCtx<E>;

    if (isPromise(currVal)) {
      return new Result(
        currVal.then(async (c) => {
          if (currCtx.errSlot !== Sentinel) {
            mutableCtx.errSlot = currCtx.errSlot as E;
            return Sentinel;
          }

          const results = validators.map((v) => v(currVal as T));
          return Promise.all(results).then((resolved) =>
            Result.validateHelper(resolved, mutableCtx, c),
          );
        }),
        mutableCtx,
      ) as Result<Promise<T>, E[]>;
    }

    const results = validators.map((v) => v(currVal as T));

    if (results.some(isPromise)) {
      return new Result(
        Promise.all(results).then((resolved) =>
          Result.validateHelper(resolved, mutableCtx, currVal),
        ),
        mutableCtx,
      ) as Result<Promise<T>, E[]>;
    }

    const values = (
      results as (
        | Result<unknown, unknown>
        | Result<Promise<unknown>, unknown>
      )[]
    ).map((r) => r.#val);

    if (values.some(isPromise)) {
      return new Result(
        Result.validateHelper(
          results as Result<unknown, E>[],
          mutableCtx,
          currVal,
        ),
        mutableCtx,
      ) as Result<Promise<T>, E>;
    }

    const combinedRes = Result.all(...(results as Result<unknown, E>[]));

    return combinedRes.isErr() ? combinedRes : this;
  }

  private static validateHelper<T, E>(
    results: Result<unknown, E>[],
    currCtx: ResultCtx<E>,
    currVal: T,
  ) {
    const combinedRes = this.all(...results);

    if (isPromise(combinedRes)) {
      return (combinedRes as Promise<Result<T, unknown[]>>).then((cRes) => {
        if (cRes.isErr()) {
          currCtx.errSlot = cRes.#ctx.errSlot as E;
          return Sentinel;
        }
        return currVal;
      }) as Promise<T>;
    }

    if (combinedRes.isErr()) {
      currCtx.errSlot = combinedRes.#ctx.errSlot as E;
      return Sentinel;
    }
    return currVal;
  }

  static all<T extends Result<unknown, unknown>[]>(
    ...results: T
  ): HasPromise<T> extends true
    ? Result<Promise<UnwrapPromises<T>>, CombinedResultErr<T>[]>
    : Result<CombinedResultOk<T>, CombinedResultErr<T>[]>;
  static all<T extends Result<unknown, unknown>[]>(...results: T) {
    const vals = results.map((r) => r.#val);

    const mutableCtx = { errSlot: Sentinel } as ResultCtx<unknown>;

    if (vals.some(isPromise)) {
      return new Result(
        Promise.all(vals).then((v) => {
          if (results.some((r) => r.isErr())) {
            mutableCtx.errSlot = results
              .filter((r) => r.isErr())
              .map((r) => r.#ctx.errSlot);
            return Sentinel;
          }
          return v;
        }),
        mutableCtx,
      );
    }

    if (results.some((r) => r.isErr())) {
      return Result.Err(
        results.filter((r) => r.isErr()).map((r) => r.#ctx.errSlot),
      ) as Result<CombinedResultOk<T>, CombinedResultErr<T>[]>;
    }

    return Result.Ok(vals) as Result<CombinedResultOk<T>, CombinedErrs<T>>;
  }
}
