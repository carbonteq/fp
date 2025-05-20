import assert from "node:assert";
import { isPromise } from "node:util/types";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;

type FlatMapper<T, U, E> = (val: T) => Result<U, E>;
type FlatPMapper<T, U, E> = (val: T) => Result<Promise<U>, E>;
type AsyncFlatMapper<T, U, E> = (val: T) => Promise<Result<U, E>>;
type AsyncFlatPMapper<T, U, E> = (val: T) => Promise<Result<Promise<U>, E>>;

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

const Sentinel = Symbol.for("ResultSentinel");
type Sentinel = typeof Sentinel;

type ResultCtx<E> = { errSlot: E | Sentinel };

class Result<T, E> {
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

    return new Result(next, immutableCtx) as Result<U, E>;
  }

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
}

const asyncOp = async (n: number) => n;

const errOp = async (_n: number): Promise<Result<string, Error>> =>
  Result.Err(new Error("test"));

const okOp = async (n: number): Promise<Result<string, Error>> =>
  Result.Ok(n.toString());

const r1 = Result.Ok(1).map(asyncOp);
console.debug("r1", r1);

const r2 = r1.flatMap(errOp);
console.debug("r2", r2);
const r2Res = await r2.unwrapErr();
console.debug("r2Res", r2Res);

const r3 = r1.flatMap(okOp);
console.debug("r3", r3);
const r3Res = await r3.unwrap();
console.debug("r3Res", r3Res);
