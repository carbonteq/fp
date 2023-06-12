import { type TUnit, UNIT } from './unit';

export class UnwrappedErrWithOk extends Error {
  constructor(r: Result<any, any>) {
    super(`Attempted to call unwrapErr on an okay value: <${r}>`);
  }
}

export class UnwrappedOkWithErr extends Error {
  constructor(r: Result<any, any>) {
    super(`Attempted to call unwrap on an Err value: <${r}>`);
  }
}

export type UnitResult<E = never> = Result<TUnit, E>;

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type PureResMapper<T, U, E> = (val: T) => Result<U, E>;
type PureAsyncResMapper<T, U, E> = (val: T) => Promise<Result<U, E>>;

type OkOrErr = 'ok' | 'err';
const okPred = <T, E extends Error>(el: Result<T, E>): boolean => el.isOk();
const errPred = <T, E extends Error>(el: Result<T, E>): boolean => el.isErr();
const preds = [okPred, errPred];

type UnwrapResult<T extends Result<unknown, unknown>> = T extends Result<
  infer U,
  infer E
>
  ? { ok: U; err: E }
  : never;

type CombinedResultOk<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>['ok'];
};
type CombinedResultErr<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>['err'];
}[number];

export type CombineResults<T extends Result<unknown, unknown>[]> = Result<
  CombinedResultOk<T>,
  CombinedResultErr<T>
>;

export class Result<T, E> {
  static readonly UNIT_RESULT: UnitResult = new Result(UNIT, null as never);

  protected constructor(
    private readonly val: T | null,
    private readonly error: E | null,
  ) {}

  static Ok<T, E = never>(val: T): Result<T, E> {
    return new Result(val, null) as Result<T, E>;
  }

  static Err<E, T = never>(err: E): Result<T, E> {
    return new Result(null, err) as Result<T, E>;
  }

  isOk(): this is Result<T, never> {
    return this.val !== null;
  }

  isErr(): this is Result<never, E> {
    return this.error !== null;
  }

  toString(): string {
    if (this.val !== null) {
      return `Result::Ok<${this.val}>`;
    } else {
      return `Result::Err<${this.error}>`;
    }
  }

  unwrap(): T {
    if (this.isErr()) {
      if (this.error instanceof Error) throw this.error;

      throw new UnwrappedOkWithErr(this);
    }

    return this.val as T;
  }

  unwrapOr(def: T): T {
    if (this.val === null) return def;

    return this.val;
  }

  unwrapOrElse(def: () => T): T;
  unwrapOrElse(def: () => Promise<T>): Promise<T>;
  unwrapOrElse(def: () => T | Promise<T>): T | Promise<T> {
    if (this.val === null) return def();

    return this.val;
  }

  safeUnwrap(): T | null {
    return this.val;
  }

  unwrapErr(): E {
    if (this.isOk()) {
      throw new UnwrappedErrWithOk(this);
    }

    return this.error as E;
  }

  safeUnwrapErr(): E | null {
    return this.error;
  }

  map<U>(f: Mapper<T, U>): Result<U, E> {
    if (this.val === null) return new Result(null, this.error) as Result<U, E>;

    const valPrime = f(this.val);

    return new Result(valPrime, this.error);
  }

  mapErr<U>(fn: Mapper<E, U>): Result<T, U> {
    if (this.error !== null) {
      const mappedErr = fn(this.error);

      return Result.Err(mappedErr);
    }

    return Result.Ok(this.val as T);
  }

  mapOr<U>(default_: U, fn: Mapper<T, U>): U {
    if (this.val === null) return default_;

    return fn(this.val);
  }

  mapOrAsync<U>(default_: U, fn: AsyncMapper<T, U>): Promise<U> {
    if (this.val === null) return Promise.resolve(default_);

    return fn(this.val);
  }

  // // mapOrElse
  // ok(): Option<T> {
  // 	if (this.val === null) return Option.None;
  //
  // 	return Option.Some(this.val);
  // }
  //
  // err(): Option<E> {
  // 	if (this.error === null) return Option.None;
  //
  // 	return Option.Some(this.error);
  // }

  and<U, E2>(r: Result<U, E2>): Result<[T, U], E | E2> {
    if (this.isErr()) return this;

    // return r.map(v => [this.val, v] as [T, U])
    if (r.isErr()) return r;

    return Result.Ok([this.val, r.val] as [T, U]);
  }

  /**
   * Also known as `andThen` or `fmap`
   */
  bind<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E | E2>;
  bind<U, E2>(
    fn: (val: T) => Promise<Result<U, E | E2>>,
  ): Promise<Result<U, E | E2>>;
  bind<U, E2>(
    fn: PureResMapper<T, U, E | E2> | PureAsyncResMapper<T, U, E | E2>,
  ) {
    if (this.isOk()) return fn(this.val as T);

    return Result.Err(this.error as E);
  }

  do(fn: (val: T) => void): Result<T, E> {
    if (this.val !== null) {
      fn(this.val);
    }

    return this;
  }

  async doAsync(fn: (val: T) => Promise<void>): Promise<Result<T, E>> {
    if (this.val !== null) {
      await fn(this.val);
    }

    return this;
  }

  zipF<U, E2>(f: (val: T) => Result<U, E2>): Result<[T, U], E | E2> {
    if (this.error !== null) return Result.Err(this.error);

    return f(this.val as T).map((u) => [this.val, u] as [T, U]);
  }

  async zipFAsync<U, E2>(
    f: (val: T) => Promise<Result<U, E2>>,
  ): Promise<Result<[T, U], E | E2>> {
    if (this.error !== null) return Result.Err(this.error);

    return f(this.val as T).then((uRes) =>
      uRes.map((u) => [this.val, u] as [T, U]),
    );
  }

  //#region General combo functions
  static allM<T, E extends Error>(
    c: 'ok',
    seq: Result<T, E>[],
  ): seq is Result<T, never>[];
  static allM<T, E extends Error>(
    c: 'err',
    seq: Result<T, E>[],
  ): seq is Result<never, E>[];
  static allM<T, E extends Error>(c: OkOrErr, seq: Result<T, E>[]): boolean {
    const pred = preds[Number(c === 'ok')];

    for (const el of seq) {
      if (!pred(el)) return false;
    }

    return true;
  }

  static anyM<T, E extends Error>(c: OkOrErr, seq: Result<T, E>[]): boolean {
    const pred = preds[Number(c === 'ok')];

    for (const el of seq) {
      if (pred(el)) return true;
    }

    return false;
  }

  // static transpose<T, E>(r: Result<Option<T>, E>): Option<Result<T, E>> {
  // 	// if (r.isErr()) return Option.Some(Result.Err(r.error as E));
  // 	//
  // 	// const v = r.val as Option<T>;
  // 	//
  // 	// if (v === Option.None) return Option.None;
  // 	// return Option.Some(Result.Ok(v.val));
  //
  // 	if (r.val === Option.None) return Option.None;
  //
  // 	const rp = new Result(r.val?.val ?? null, r.error); // DO NOT CHANGE ?? TO ||
  //
  // 	return Option.Some(rp);
  // }

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

  static async lift<T, E extends Error>(
    r: Result<Promise<T>, E>,
  ): Promise<Result<T, E>> {
    if (r.isErr()) return r;

    return (r.val as Promise<T>).then((v) => Result.Ok(v));
  }
  //#endregion
}
