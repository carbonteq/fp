import { isPromise } from "node:util/types";
import { UNIT } from "./unit.js";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type OptMapper<T, U> = (val: T) => OptionOld<U>;
type AsyncOptMapper<T, U> = (val: T) => Promise<OptionOld<U>>;

type InnerMapMapper<T, U> =
  T extends Array<infer Inner> ? (val: Inner) => U : never;

type InnerMapReturn<T, U> =
  T extends Array<unknown> ? OptionOld<Array<U>> : never;
// type ArrayInner<T> = T extends Array<infer R> ? R : never;
// type ArrayOpt<Opt extends Option<unknown>> = Opt extends Option<infer T>
// 	? T extends Array<infer Inner>
// 		? Inner
// 		: never
// 	: never;

export class UnwrappedNone extends Error {
  constructor() {
    super("Unwrapped Option<None>");
  }
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();
const NONE_VAL = Symbol.for("None");

export type UnitOption = OptionOld<UNIT>;
export type UnwrapOption<T> = T extends OptionOld<infer R> ? R : never;
type CombinedOptions<T extends OptionOld<unknown>[]> = {
  [K in keyof T]: UnwrapOption<T[K]>;
};

class OptionOld<T> {
  private constructor(readonly val: T) {}

  static readonly None: OptionOld<never> = new OptionOld(
    NONE_VAL,
  ) as OptionOld<never>;
  static readonly UNIT_OPT: UnitOption = new OptionOld(UNIT);

  static Some<Inner>(val: Inner): OptionOld<Inner> {
    return new OptionOld(val);
  }

  static fromNullable<T>(val: T): OptionOld<NonNullable<T>> {
    return val === null
      ? OptionOld.None
      : OptionOld.Some(val as NonNullable<T>);
  }

  isSome(): this is OptionOld<T> {
    return this.val !== NONE_VAL;
  }

  isNone(): this is OptionOld<never> {
    return this.val === NONE_VAL;
  }

  isUnit(): this is OptionOld<UNIT> {
    return this.val === UNIT;
  }

  unwrap(): T {
    if (this.val !== NONE_VAL) {
      return this.val;
    }

    throw UNWRAPPED_NONE_ERR;
  }

  /* Useful to serialize. Inverse operation for `fromNullable` */
  safeUnwrap(): T | null {
    if (this.val !== NONE_VAL) return this.val;

    return null;
  }

  toString(): string {
    if (this.isNone()) return "Option::None";

    return `Option::Some(${this.val})`;
  }

  map<U>(fn: (val: T) => U): OptionOld<U>;
  map<U>(fn: (val: T) => Promise<U>): Promise<OptionOld<U>>;
  map<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
    if (this.isNone()) return OptionOld.None;

    const val = fn(this.val);
    if (isPromise(val)) return val.then((u) => OptionOld.Some(u));

    return OptionOld.Some(val);
  }

  mapOr<U>(def: U, fn: (val: T) => U): OptionOld<U>;
  mapOr<U>(def: U, fn: (val: T) => Promise<U>): Promise<OptionOld<U>>;
  mapOr<U>(def: U, fn: (val: T) => U) {
    if (this.isNone()) return OptionOld.Some(def);

    const val = fn(this.val);
    if (isPromise(val)) return val.then((u) => OptionOld.Some(u));

    return OptionOld.Some(val);
  }

  flatMap<U>(fn: (val: T) => OptionOld<U>): OptionOld<U>;
  flatMap<U>(fn: (val: T) => Promise<OptionOld<U>>): Promise<OptionOld<U>>;
  flatMap<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
    if (this.val !== NONE_VAL) return fn(this.val);

    return OptionOld.None;
  }

  /* Alias for flatMap  */
  bind<U>(fn: (val: T) => OptionOld<U>): OptionOld<U>;
  bind<U>(fn: (val: T) => Promise<OptionOld<U>>): Promise<OptionOld<U>>;
  bind<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
    if (this.val !== NONE_VAL) return fn(this.val);

    return OptionOld.None;
  }

  and<U>(opt: OptionOld<U>): OptionOld<[T, U]> {
    if (this.val !== NONE_VAL && opt.val !== NONE_VAL)
      return OptionOld.Some([this.val, opt.val]);

    return OptionOld.None;
  }

  tap(fn: (val: T) => void): OptionOld<T> {
    if (this.val !== NONE_VAL) fn(this.val);

    return this;
  }

  async tapAsync(fn: (val: T) => Promise<unknown>): Promise<OptionOld<T>> {
    if (this.val !== NONE_VAL) {
      await fn(this.val);
    }

    return this;
  }

  zip<U>(fn: (val: T) => Promise<U>): Promise<OptionOld<[T, U]>>;
  zip<U>(fn: (val: T) => U): OptionOld<[T, U]>;
  zip<U>(fn: Mapper<T, U> | AsyncMapper<T, U>) {
    if (this.val === NONE_VAL) return OptionOld.None; // await won't hurt it

    const r = fn(this.val);
    if (isPromise(r)) {
      return r.then((u) => OptionOld.Some([this.val, u]));
    }

    return OptionOld.Some([this.val, r]);
  }
  // zip<U>(
  // 	fn: (val: T) => Promise<U>,
  // ): Promise<Option<Tuple<AppendToTuple<T, U>>>>;
  // zip<U>(fn: (val: T) => U): Option<Tuple<AppendToTuple<T, U>>>;
  // zip<U>(fn: Mapper<T, U> | AsyncMapper<T, U>) {
  // 	if (this.val === NONE_VAL) return Option.None; // await won't hurt it
  //
  // 	type Tup = AppendToTuple<T, U>;
  // 	const isTuple = Array.isArray(this.val);
  //
  // 	const r = fn(this.val);
  // 	if (isPromise(r)) {
  // 		return r.then((u) => {
  // 			const inner: Tuple<Tup> = setAsTuple(
  // 				isTuple ? [...this.val, u] : [this.val, u],
  // 			);
  //
  // 			return Option.Some(inner) as Option<Tuple<Tup>>;
  // 		});
  // 	}
  //
  // 	const inner: Tuple<Tup> = setAsTuple(
  // 		isTuple ? [...this.val, r] : [this.val, r],
  // 	);
  //
  // 	return Option.Some(inner) as Option<Tuple<Tup>>;
  // }

  flatZip<U>(fn: (val: T) => Promise<OptionOld<U>>): Promise<OptionOld<[T, U]>>;
  flatZip<U>(fn: (val: T) => OptionOld<U>): OptionOld<[T, U]>;
  flatZip<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
    if (this.val === NONE_VAL) return OptionOld.None;

    const r = fn(this.val);
    if (isPromise(r)) {
      return r.then((opt) => opt.map((u) => [this.val, u]));
    }

    return r.map((u) => [this.val, u]);
  }
  // flatZip<U>(
  // 	fn: (val: T) => Promise<Option<U>>,
  // ): Promise<Option<AppendToTuple<T, U>>>;
  // flatZip<U>(fn: (val: T) => Option<U>): Option<AppendToTuple<T, U>>;
  // flatZip<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
  // 	if (this.val === NONE_VAL) return Option.None;
  //
  // 	type Tup = AppendToTuple<T, U>;
  // 	const isTuple = Array.isArray(this.val);
  // 	const r = fn(this.val);
  // 	if (isPromise(r)) {
  // 		return r.then((opt) =>
  // 			opt.map(
  // 				(u) =>
  // 					setAsTuple(
  // 						isTuple ? [...this.val, u] : [this.val, u],
  // 					) as Tuple<Tup>,
  // 			),
  // 		);
  // 	}
  //
  // 	return r.map(
  // 		(u) =>
  // 			setAsTuple(isTuple ? [...this.val, u] : [this.val, u]) as Tuple<Tup>,
  // 	);
  // }

  static any<T>(seq: OptionOld<T>[]): boolean {
    for (const el of seq) {
      if (el.val !== NONE_VAL) return true;
    }

    return false;
  }

  static all<T>(seq: OptionOld<T>[]): boolean {
    for (const el of seq) {
      if (el.val === NONE_VAL) return false;
    }

    return true;
  }

  static sequence<T extends OptionOld<unknown>[]>(
    ...options: T
  ): OptionOld<CombinedOptions<T>> {
    const vals = [] as CombinedOptions<T>;

    for (const opt of options) {
      if (opt.val === NONE_VAL) return OptionOld.None;

      vals.push(opt.val);
    }

    return OptionOld.Some(vals);
  }

  static async lift<T>(opt: OptionOld<Promise<T>>): Promise<OptionOld<T>> {
    if (opt.isNone()) return Promise.resolve(OptionOld.None);

    return opt.val.then((val) => OptionOld.Some(val));
  }

  // innerMap<Inner, U>(
  // 	this: Option<Array<Inner>>,
  // 	mapper: (val: Inner) => U,
  // ): Option<Array<U>>;
  // innerMap<U>(this: Option<T>, mapper: (val: never) => U): never;
  // innerMap<U>(this: Option<T>, mapper: (val: T) => U) {
  // 	if (this.isNone()) return this;
  //
  // 	if (Array.isArray(this.val)) {
  // 		return Option.Some(this.val.map(mapper));
  // 	}
  //
  // 	throw new Error("Can only be called for Option<Array<T>>");
  // }

  innerMap<U>(mapper: InnerMapMapper<T, U>): InnerMapReturn<T, U> {
    type Ret = InnerMapReturn<T, U>;

    //@ts-expect-error
    if (this.val === NONE_VAL) return this as Ret;

    if (Array.isArray(this.val)) {
      return OptionOld.Some(this.val.map(mapper)) as Ret;
    }

    throw new Error("Can only be called for Option<Array<T>>");
  }

  //@ts-expect-error
  pipe<U>(fn: (val: T) => U): OptionOld<U>;
  pipe<U, V>(fn: (val: T) => U, fn2: (val: U) => V): OptionOld<V>;
  pipe<U, V, W>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
  ): OptionOld<W>;
  pipe<U, V, W, X>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
  ): OptionOld<X>;
  pipe<U, V, W, X, Y>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
  ): OptionOld<Y>;
  pipe<U, V, W, X, Y, Z>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
  ): OptionOld<Z>;
  pipe<U, V, W, X, Y, Z, A>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
    fn7: (val: Z) => A,
  ): OptionOld<A>;
  pipe<U, V, W, X, Y, Z, A, B>(
    fn: (val: T) => U,
    fn2: (val: U) => V,
    fn3: (val: V) => W,
    fn4: (val: W) => X,
    fn5: (val: X) => Y,
    fn6: (val: Y) => Z,
    fn7: (val: Z) => A,
    fn8: (val: A) => B,
  ): OptionOld<B>;
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
  ): OptionOld<C>;
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
  ): OptionOld<D>;
  pipe(...fns: Mapper<unknown, unknown>[]) {
    let x = this;
    for (const fn of fns) {
      // @ts-expect-error
      x = x.map(fn);
    }
    return x;
  }
}
