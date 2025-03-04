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

export type CombineResults<T extends Result<unknown, unknown>[]> = Result<
  CombinedResultOk<T>,
  CombinedResultErr<T>
>;

/** Sentinel value */
const Sentinel = Symbol.for("ResultSentinel");
type Sentinel = typeof Sentinel;

type ResultCtx<E> = { errSlot: E | Sentinel };

export class Result<T, E> {
  static readonly UNIT_RESULT = new Result(UNIT, {
    errSlot: Sentinel,
  }) as UnitResult;

  #ctx: ResultCtx<E>;

  protected constructor(
    private readonly val: T | Sentinel,
    ctx: ResultCtx<E>,
  ) {
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
    return this.val === UNIT;
  }

  toString(): string {
    if (this.isOk()) {
      return `Result::Ok<${String(this.val)}>`;
    }

    return `Result::Err<${String(this.#ctx.errSlot)}>`;
  }

  unwrap(this: Result<Promise<T>, E>): Promise<T>;
  unwrap(this: Result<T, E>): T;
  unwrap() {
    const curr = this.val;
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

    const curr = this.val;
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
    return this.val === Sentinel ? null : this.val;
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
  map<In, U>(
    this: Result<Promise<In>, E>,
    fn: (val: In) => U,
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
    assert(this.val !== Sentinel, "cannot be Sentinel at this point");

    const curr = this.val; // should not be sentinel, only promise or proper value
    const ctx = this.#ctx;

    if (isPromise(curr)) {
      const p = curr as Promise<In | Sentinel>;
      const out = p.then((v) => {
        if (v === Sentinel) {
          // this can only be possible in two cases: started with error, or fMap got us there
          // in either case, no need to change ctx
          return Sentinel;
        }

        const mapped = fn(v);
        return mapped;
      }) as Promise<U>;

      return new Result(out, ctx);
    }

    //@ts-expect-error
    const next = fn(curr);

    return new Result(next, ctx) as Result<U, E>;
  }

  /** Same as map, but for the error value instead of the Ok value */
  mapErr<U>(fn: Mapper<E, U>): Result<T, U> {
    if (this.isErr()) {
      // Easy case
      const mappedErr = fn(this.#ctx.errSlot as E);
      return Result.Err(mappedErr); // no need to retain context anymore
    }

    const curr = this.val;
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
    return new Result(this.val, newCtx);
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
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E2>>,
  ): never;
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
    fn: (val: T) => Promise<Result<Promise<Result<unknown, unknown>>, E | E2>>,
  ): never;
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
  flatMap<U, E2, In = Awaited<T>>(
    fn: FlatMapper<In, U, E | E2> | AsyncFlatMapper<In, U, E | E2>,
  ) {
    if (this.isErr()) return Result.Err(this.#ctx.errSlot);

    assert(this.val !== Sentinel, "cannot be Sentinel at this point");

    const curr = this.val as unknown as Promise<In> | In;
    const ctx = this.#ctx as ResultCtx<E | E2>;

    if (isPromise(curr)) {
      const p = curr;
      const newP = p.then(async (v) => {
        if (v === Sentinel) return Sentinel;

        const next = fn(v);

        if (isPromise(next)) {
          const nextRes = await next;
          ctx.errSlot = nextRes.#ctx.errSlot;

          return nextRes.val;
        }

        ctx.errSlot = next.#ctx.errSlot;
        return next.val;
      }) as Promise<U>;
      return new Result(newP, ctx);
    }

    const next = fn(curr);
    console.debug(next);
    if (isPromise(next)) {
      return new Result(
        next.then((nextRes) => {
          ctx.errSlot = nextRes.#ctx.errSlot;
          return nextRes.val;
        }),
        ctx,
      );
    }

    ctx.errSlot = next.#ctx.errSlot;

    return new Result(next.val, ctx);
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
    assert(this.val !== Sentinel, "cannot be Sentinel at this point");

    const curr = this.val as Promise<In> | In;
    const ctx = this.#ctx;
    const newCtx: ResultCtx<E | E2> = { errSlot: Sentinel };
    if (isPromise(curr)) {
      // Only branch that can led to a non-Ok state in the future
      const newP = curr.then((v) => {
        // Check if returned value is Sentinel
        if (v === Sentinel) {
          // fallen into error slot
          newCtx.errSlot = ctx.errSlot;
          return Sentinel as In;
        }

        const r = fn(v);
        return Result.zipErrHelper(v, r, newCtx);
      });

      return new Result(newP, newCtx);
    }

    // There is no computation in the chain, so let's resolve it directly with the value
    const r = fn(curr);
    const newP = Result.zipErrHelper(curr, r, newCtx);
    return new Result(newP, newCtx);
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

    const curr = this.val as Promise<In> | In;
    assert(this.val !== Sentinel, "cannot be Sentinel at this point");

    const ctx = this.#ctx;

    if (isPromise(curr)) {
      const newP = curr.then((v) => {
        if (v === Sentinel) return Sentinel;

        const u = fn(v);
        if (isPromise(u)) return u.then((uu) => [v, uu]);

        return [v, u];
      }) as Promise<[In, U]>;

      return new Result(newP, ctx);
    }

    const u = fn(curr);
    if (isPromise(u)) {
      return new Result(u.then((uu) => [curr, uu]) as Promise<[In, U]>, ctx);
    }

    return new Result([curr, u] as [In, U], ctx);
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

    const curr = this.val as Promise<In> | In;
    assert(this.val !== Sentinel, "cannot be Sentinel at this point");

    const ctx = this.#ctx as ResultCtx<E | E2>;

    if (isPromise(curr)) {
      const newP = curr.then(async (v) => {
        if (v === Sentinel) return Sentinel;

        // WARN: Could lead to bad error stacks, can perhaps be better using then chaining
        const uR = await fn(v);
        if (uR.#ctx.errSlot !== Sentinel) ctx.errSlot = uR.#ctx.errSlot;

        const uRVal = await uR.val;

        if (uRVal === Sentinel) return Sentinel;

        return [v, uRVal];
      }) as Promise<[T, U]>;

      return new Result(newP, ctx);
    }

    const uP = fn(curr);
    if (isPromise(uP)) {
      const newP = uP.then(async (uR) => {
        if (uR.#ctx.errSlot !== Sentinel) ctx.errSlot = uR.#ctx.errSlot;

        const uRVal = await uR.val;

        if (uRVal === Sentinel) return Sentinel;

        return [curr, uRVal];
      }) as Promise<[T, U]>;

      return new Result(newP, ctx);
    }

    if (uP.#ctx.errSlot) {
      ctx.errSlot = uP.#ctx.errSlot;

      return new Result(Sentinel, ctx);
    }

    return new Result([curr, uP.val], ctx);
  }

  //#endregion

  innerMap<In, E, Out>(
    this: Result<Array<In>, E>,
    mapper: (val: NoInfer<In>) => Out,
  ): Result<Array<Out>, E> {
    if (this.isErr()) return this;

    if (Array.isArray(this.val)) {
      return new Result(this.val.map(mapper), this.#ctx);
    }

    throw new Error("Can only be called for Result<Array<T>, E>");
  }

  toPromise(this: Result<Promise<T>, E>): Promise<Result<T, E>>;
  toPromise(this: Result<T, E>): Promise<Result<T, E>>;
  async toPromise() {
    const v = await this.val;

    return new Result(v, this.#ctx);
  }
}
