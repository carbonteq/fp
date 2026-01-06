import { isPromise } from "node:util/types";
import { UNIT } from "./unit.js";

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
type ResMapper<T, U, E> = (val: T) => Result<U, E>;
type AsyncResMapper<T, U, E> = (val: T) => Promise<Result<U, E>>;

type OkOrErr = "ok" | "err";
const okPred = <T, E extends Error>(el: Result<T, E>): boolean => el.isOk();
const errPred = <T, E extends Error>(el: Result<T, E>): boolean => el.isErr();
const preds = [okPred, errPred];

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

type InnerMapMapper<T, U> =
  T extends Array<infer Inner> ? (val: Inner) => U : never;

type InnerMapReturn<T, E, U> =
  T extends Array<unknown> ? Result<Array<U>, E> : never;

/** Sentinel value */
const Sentinel = Symbol.for("ResultSentinel");
type Sentinel = typeof Sentinel;

export class Result<T, E> {
  static readonly UNIT_RESULT: UnitResult = new Result(UNIT, null as never);

  protected constructor(
    private readonly val: T | Sentinel,
    private readonly error: E | Sentinel,
  ) {}

  static Ok<T, E = never>(val: T): Result<T, E> {
    return new Result(val, Sentinel) as Result<T, E>;
  }

  static Err<E, T = never>(err: E): Result<T, E> {
    return new Result(Sentinel, err) as Result<T, E>;
  }

  isOk(): this is Result<T, never> {
    return this.val !== Sentinel;
  }

  isErr(): this is Result<never, E> {
    return this.error !== Sentinel;
  }

  isUnit(): this is Result<UNIT, never> {
    return this.val === UNIT;
  }

  toString(): string {
    if (this.val !== Sentinel) {
      return `Result::Ok<${this.val}>`;
    }

    return `Result::Err<${this.error as E}>`;
  }

  unwrap(): T {
    if (this.val === Sentinel) {
      if (this.error instanceof Error) throw this.error;

      throw new UnwrappedOkWithErr(this);
    }

    return this.val;
  }

  unwrapOr(def: T): T {
    if (this.val === Sentinel) return def;

    return this.val;
  }

  unwrapOrElse(def: () => T): T;
  unwrapOrElse(def: () => Promise<T>): Promise<T>;
  unwrapOrElse(def: () => T | Promise<T>): T | Promise<T> {
    if (this.val === Sentinel) return def();

    return this.val;
  }

  safeUnwrap(): T | null {
    return this.val === Sentinel ? null : this.val;
  }

  unwrapErr(): E {
    if (this.isOk()) {
      throw new UnwrappedErrWithOk(this);
    }

    return this.error as E;
  }

  safeUnwrapErr(): E | null {
    return this.error === Sentinel ? null : this.error;
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
  map<U>(fn: (val: T) => Promise<U>): Promise<Result<U, E>>;
  map<U>(fn: (val: T) => U): Result<U, E>;
  map<U>(
    fn: Mapper<T, U> | AsyncMapper<T, U>,
  ): Result<U, E> | Promise<Result<U, E>> {
    if (this.val === Sentinel) return Result.Err(this.error) as Result<U, E>;

    const r = fn(this.val);

    if (isPromise(r)) {
      return r.then((val) => Result.Ok(val) as Result<U, E>);
    }

    return Result.Ok(r) as Result<U, E>;
  }

  /** Same as map, but for the error value instead of the Ok value */
  mapErr<U>(fn: Mapper<E, U>): Result<T, U> {
    if (this.error !== Sentinel) {
      const mappedErr = fn(this.error);

      return Result.Err(mappedErr);
    }

    return Result.Ok(this.val as T);
  }

  mapOr<U>(default_: U, fn: Mapper<T, U>): U {
    if (this.val === Sentinel) return default_;

    return fn(this.val);
  }

  mapOrAsync<U>(default_: U, fn: AsyncMapper<T, U>): Promise<U> {
    if (this.val === Sentinel) return Promise.resolve(default_);

    return fn(this.val);
  }

  /** For combining two results. For the lazy eval version, see {@link flatZip} and {@link zipAsync} */
  and<U, E2>(r: Result<U, E2>): Result<[T, U], E | E2> {
    if (this.isErr()) return this;

    // return r.map(v => [this.val, v] as [T, U])
    if (r.isErr()) return r;

    return Result.Ok([this.val, r.val] as [T, U]);
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
  flatMap<U, E2>(
    fn: (val: T) => Promise<Result<U, E | E2>>,
  ): Promise<Result<U, E | E2>>;
  flatMap<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E | E2>;
  flatMap<U, E2>(fn: ResMapper<T, U, E | E2> | AsyncResMapper<T, U, E | E2>) {
    if (this.val !== Sentinel) return fn(this.val);

    return Result.Err(this.error);
  }

  /**
   * Also known as `andThen`, `fmap` or `flatMap`
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
   * const result2 = r.bind(mapper) // Type is Result<number, SomeError | InvalidNumStringError>
   */
  bind<U, E2>(
    fn: (val: T) => Promise<Result<U, E | E2>>,
  ): Promise<Result<U, E | E2>>;
  bind<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E | E2>;
  bind<U, E2>(fn: ResMapper<T, U, E | E2> | AsyncResMapper<T, U, E | E2>) {
    if (this.val !== Sentinel) return fn(this.val);

    return Result.Err(this.error);
  }

  /**
   * For combining the errors only while retaining the original value.
   * @example
   * const r: Result<string, SomeError> = Result.Ok('42')
   * const binderOk = (d: string) => Result.Ok<number, SomeOtherError>(0909)
   * const binderErr = (d: string) => Result.Err<number, SomeOtherError>(new SomeOtherError())
   *
   * const res1 = r.zipErr(binderOk) // Result<string, SomeError | SomeOtherError> - Value: Result.Ok('42') - No change in Ok type
   * const res2 = r.zipErr(binderErr) // Result<string, SomeError | SomeOtherError> - Value: Result.Err(new SomeOtherError())
   */
  zipErr<E2>(
    fn: (val: T) => Promise<Result<unknown, E2>>,
  ): Promise<Result<T, E | E2>>;
  zipErr<E2>(fn: (val: T) => Result<unknown, E2>): Result<T, E | E2>;
  zipErr<E2>(
    fn: ResMapper<T, unknown, E | E2> | AsyncResMapper<T, unknown, E | E2>,
  ) {
    if (this.val === Sentinel) return Result.Err(this.error);

    const r = fn(this.val);

    if (isPromise(r)) {
      return r.then((result) => result.map((_) => this.val));
    }

    return r.map((_) => this.val);
  }

  /** For running infallible side-effects on the contained value. Up to the programmer to ensure the underlying function doesn't fail */
  tap(fn: (val: T) => void): Result<T, E> {
    if (this.val !== Sentinel) {
      fn(this.val);
    }

    return this;
  }

  /**
   * Async version of {@link tap}
   * @see {@link tap}
   */
  async tapAsync(fn: (val: T) => Promise<void>): Promise<Result<T, E>> {
    if (this.val !== Sentinel) {
      await fn(this.val);
    }

    return this;
  }

  zip<U>(fn: (val: T) => Promise<U>): Promise<Result<[T, U], E>>;
  zip<U>(fn: (val: T) => U): Result<[T, U], E>;
  zip<U>(fn: Mapper<T, U> | AsyncMapper<T, U>) {
    if (this.val === Sentinel) return Result.Err(this.error);

    const r = fn(this.val);
    if (isPromise(r)) {
      return r.then((u) => Result.Ok([this.val, u]) as Result<[T, U], E>);
    }

    return Result.Ok([this.val, r]) as Result<[T, U], E>;
  }
  // zip<U>(fn: (val: T) => Promise<U>): Promise<Result<AppendToTuple<T, U>, E>>;
  // zip<U>(fn: (val: T) => U): Result<AppendToTuple<T, U>, E>;
  // zip<U>(fn: Mapper<T, U> | AsyncMapper<T, U>) {
  // 	if (this.val === Sentinel) return Result.Err(this.error);
  //
  // 	type Tup = AppendToTuple<T, U>;
  // 	const isTup = isTuple(this.val);
  //
  // 	const r = fn(this.val);
  // 	if (isPromise(r)) {
  // 		return r.then((u) => {
  // 			const tuple: Tuple<Tup> = setAsTuple(
  // 				//@ts-expect-error
  // 				isTup ? [...this.val, u] : [this.val, u],
  // 			);
  //
  // 			//@ts-expect-error
  // 			return Result.Ok(tuple) as Result<AppendToTuple<T, U>, E>;
  // 		});
  // 	}
  //
  // 	const tuple: Tuple<Tup> = setAsTuple(
  // 		//@ts-expect-error
  // 		isTup ? [...this.val, r] : [this.val, r],
  // 	);
  //
  // 	//@ts-expect-error
  // 	return Result.Ok(tuple) as Result<AppendToTuple<T, U>, E>;
  // }

  /** For combining two results lazily. For the eager eval version, see {@link and} */
  flatZip<U, E2>(
    fn: (val: T) => Promise<Result<U, E2>>,
  ): Promise<Result<[T, U], E | E2>>;
  flatZip<U, E2>(fn: (val: T) => Result<U, E2>): Result<[T, U], E | E2>;
  flatZip<U, E2>(fn: ResMapper<T, U, E | E2> | AsyncResMapper<T, U, E | E2>) {
    if (this.val === Sentinel) return Result.Err(this.error);

    const r = fn(this.val);
    if (isPromise(r)) {
      return r.then((other) => other.map((u) => [this.val, u]));
    }

    return r.map((u) => [this.val, u]);
  }
  // flatZip<U, E2>(
  // 	fn: (val: T) => Promise<Result<U, E2>>,
  // ): Promise<Result<AppendToTuple<T, U>, E | E2>>;
  // flatZip<U, E2>(
  // 	fn: (val: T) => Result<U, E2>,
  // ): Result<AppendToTuple<T, U>, E | E2>;
  // flatZip<U, E2>(fn: ResMapper<T, U, E | E2> | AsyncResMapper<T, U, E | E2>) {
  // 	if (this.val === Sentinel) return Result.Err(this.error);
  //
  // 	type Tup = AppendToTuple<T, U>;
  // 	const isTup = isTuple(this.val);
  //
  // 	const r = fn(this.val);
  // 	if (isPromise(r)) {
  // 		return r.then((other) =>
  // 			other.map((u) => (isTup ? [...this.val, u] : [this.val, u]) as Tup),
  // 		);
  // 	}
  //
  // 	return r.map((u) => (isTup ? [...this.val, u] : [this.val, u]) as Tup);
  // }

  //#region General combo functions
  /** Type guard specifying all array results as Ok/Err */
  static all<T, E extends Error>(
    c: "ok",
    seq: Result<T, E>[],
  ): seq is Result<T, never>[];
  static all<T, E extends Error>(
    c: "err",
    seq: Result<T, E>[],
  ): seq is Result<never, E>[];
  static all<T, E extends Error>(c: OkOrErr, seq: Result<T, E>[]): boolean {
    const pred = preds[Number(c === "ok")];

    for (const el of seq) {
      if (!pred(el)) return false;
    }

    return true;
  }

  /** Whether any of the underlying results are Ok or Err */
  static any<T, E extends Error>(c: OkOrErr, seq: Result<T, E>[]): boolean {
    const pred = preds[Number(c === "ok")];

    for (const el of seq) {
      if (pred(el)) return true;
    }

    return false;
  }

  /**
   * `Result.sequence(Result<T1, E1>, Result<T2, E2>, ...)` will return `Result<[T1, T2, ...], E1 | E2 | ...>`
   * @example
   * const r1 = Result.Ok<string, string>("abc")
   * const r2 = Result.Ok<number, Error>(123)
   * const r = Result.sequence(r1, r2) // r will be of type Result<[string, number], string | Error>
   */
  static sequence<T extends Result<unknown, unknown>[]>(
    ...results: T
  ): Result<CombinedResultOk<T>, CombinedResultErr<T>> {
    const vals = [] as CombinedResultOk<T>;

    for (const r of results) {
      if (r.isErr()) return r;

      vals.push(r.unwrap());
    }

    return Result.Ok(vals) as Result<CombinedResultOk<T>, CombinedResultErr<T>>;
  }

  /** Convert a Result of a Promise to the Promise of a Result */
  static async lift<T, E extends Error>(
    r: Result<Promise<T>, E>,
  ): Promise<Result<T, E>> {
    if (r.isErr()) return Promise.resolve(Result.Err(r.error as E));

    return (r.val as Promise<T>).then((v) => Result.Ok(v));
  }
  //#endregion

  // static innerMap<T, U, E>(
  // 	r: Result<Array<T>, E>,
  // 	mapper: (val: T) => U,
  // ): Result<Array<U>, E> {
  // 	return r.map((inner) => inner.map(mapper));
  // }
  // innerMap<Inner, U>(
  // 	this: Result<Array<Inner>, E>,
  // 	mapper: (val: T) => U,
  // ): Result<Array<U>, E>;
  // innerMap<U>(this: Result<unknown, E>, mapper: (val: T) => U): never;
  // innerMap<U>(this: Result<unknown, E>, mapper: (val: T) => U) {
  // 	if (this.val === Sentinel) return this;
  //
  // 	if (Array.isArray(this.val)) {
  // 		return Result.Ok(this.val.map(mapper));
  // 	}
  //
  // 	throw new Error("Can only be called for Result<Array<T>, E>");
  // }

  innerMap<U>(mapper: InnerMapMapper<T, U>): InnerMapReturn<T, E, U> {
    type RetType = InnerMapReturn<T, E, U>;

    // @ts-expect-error
    if (this.val === Sentinel) return this;

    if (Array.isArray(this.val)) {
      return Result.Ok(this.val.map(mapper)) as RetType;
    }

    throw new Error("Can only be called for Result<Array<T>, E>");
  }

  // @ts-expect-error
  pipe<U>(fn: (val: T) => U): Result<U, E>;
  pipe<U, V>(fn: (val: T) => U, fn2: (val: U) => V): Result<V, E>;
  pipe<U, V, W>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
  ): Result<W, E>;
  pipe<U, V, W, X>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
  ): Result<X, E>;
  pipe<U, V, W, X, Y>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
  ): Result<Y, E>;
  pipe<U, V, W, X, Y, Z>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
  ): Result<Z, E>;
  pipe<U, V, W, X, Y, Z, A>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
    fn7: (val: Z) => A,
  ): Result<A, E>;
  pipe<U, V, W, X, Y, Z, A, B>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
    fn7: (val: Z) => A,
    fn8: (val: A) => B,
  ): Result<B, E>;
  pipe<U, V, W, X, Y, Z, A, B, C>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
    fn7: (val: Z) => A,
    fn8: (val: A) => B,
    fn9: (val: B) => C,
  ): Result<C, E>;
  pipe<U, V, W, X, Y, Z, A, B, C, D>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
    fn7: (val: Z) => A,
    fn8: (val: A) => B,
    fn9: (val: B) => C,
    fn10: (val: C) => D,
  ): Result<D, E>;
  pipe(...fns: Mapper<unknown, unknown>[]) {
    let res = this;
    for (const fn of fns) {
      // @ts-expect-error
      res = res.map(fn);
    }
    return res;
  }
}

const _res = Result.Ok([1, 2, 3]);
const _res2 = Result.Ok(123);
