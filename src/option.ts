import { isPromise } from "node:util/types";
import { UNIT } from "./unit";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type OptMapper<T, U> = (val: T) => Option<U>;
type AsyncOptMapper<T, U> = (val: T) => Promise<Option<U>>;

type InnerMapMapper<T, U> = T extends Array<infer Inner>
	? (val: Inner) => U
	: never;

type InnerMapReturn<T, U> = T extends Array<unknown> ? Option<Array<U>> : never;
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

export type UnitOption = Option<UNIT>;
export type UnwrapOption<T> = T extends Option<infer R> ? R : never;
type CombinedOptions<T extends Option<unknown>[]> = {
	[K in keyof T]: UnwrapOption<T[K]>;
};

export class Option<T> {
	private constructor(readonly val: T) {}

	static readonly None: Option<never> = new Option(NONE_VAL) as Option<never>;
	static readonly UNIT_OPT: UnitOption = new Option(UNIT);

	static Some<Inner>(val: Inner): Option<Inner> {
		return new Option(val);
	}

	static fromNullable<T>(val: T): Option<NonNullable<T>> {
		return val === null ? Option.None : Option.Some(val as NonNullable<T>);
	}

	isSome(): this is Option<T> {
		return this.val !== NONE_VAL;
	}

	isNone(): this is Option<never> {
		return this.val === NONE_VAL;
	}

	isUnit(): this is Option<UNIT> {
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

	map<U>(fn: (val: T) => U): Option<U>;
	map<U>(fn: (val: T) => Promise<U>): Promise<Option<U>>;
	map<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
		if (this.isNone()) return Option.None;

		const val = fn(this.val);
		if (isPromise(val)) return val.then((u) => Option.Some(u));

		return Option.Some(val);
	}

	mapOr<U>(def: U, fn: (val: T) => U): Option<U>;
	mapOr<U>(def: U, fn: (val: T) => Promise<U>): Promise<Option<U>>;
	mapOr<U>(def: U, fn: (val: T) => U) {
		if (this.isNone()) return Option.Some(def);

		const val = fn(this.val);
		if (isPromise(val)) return val.then((u) => Option.Some(u));

		return Option.Some(val);
	}

	flatMap<U>(fn: (val: T) => Option<U>): Option<U>;
	flatMap<U>(fn: (val: T) => Promise<Option<U>>): Promise<Option<U>>;
	flatMap<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
		if (this.val !== NONE_VAL) return fn(this.val);

		return Option.None;
	}

	/* Alias for flatMap  */
	bind<U>(fn: (val: T) => Option<U>): Option<U>;
	bind<U>(fn: (val: T) => Promise<Option<U>>): Promise<Option<U>>;
	bind<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
		if (this.val !== NONE_VAL) return fn(this.val);

		return Option.None;
	}

	and<U>(opt: Option<U>): Option<[T, U]> {
		if (this.val !== NONE_VAL && opt.val !== NONE_VAL)
			return Option.Some([this.val, opt.val]);

		return Option.None;
	}

	tap(fn: (val: T) => void): Option<T> {
		if (this.val !== NONE_VAL) fn(this.val);

		return this;
	}

	async tapAsync(fn: (val: T) => Promise<unknown>): Promise<Option<T>> {
		if (this.val !== NONE_VAL) {
			await fn(this.val);
		}

		return this;
	}

	zip<U>(fn: (val: T) => Promise<U>): Promise<Option<[T, U]>>;
	zip<U>(fn: (val: T) => U): Option<[T, U]>;
	zip<U>(fn: Mapper<T, U> | AsyncMapper<T, U>) {
		if (this.val === NONE_VAL) return Option.None; // await won't hurt it

		const r = fn(this.val);
		if (isPromise(r)) {
			return r.then((u) => Option.Some([this.val, u]));
		}

		return Option.Some([this.val, r]);
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

	flatZip<U>(fn: (val: T) => Promise<Option<U>>): Promise<Option<[T, U]>>;
	flatZip<U>(fn: (val: T) => Option<U>): Option<[T, U]>;
	flatZip<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
		if (this.val === NONE_VAL) return Option.None;

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

	static any<T>(seq: Option<T>[]): boolean {
		for (const el of seq) {
			if (el.val !== NONE_VAL) return true;
		}

		return false;
	}

	static all<T>(seq: Option<T>[]): boolean {
		for (const el of seq) {
			if (el.val === NONE_VAL) return false;
		}

		return true;
	}

	static sequence<T extends Option<unknown>[]>(
		...options: T
	): Option<CombinedOptions<T>> {
		const vals = [] as CombinedOptions<T>;

		for (const opt of options) {
			if (opt.val === NONE_VAL) return Option.None;

			vals.push(opt.val);
		}

		return Option.Some(vals);
	}

	static async lift<T>(opt: Option<Promise<T>>): Promise<Option<T>> {
		if (opt.isNone()) return Promise.resolve(Option.None);

		return opt.val.then((val) => Option.Some(val));
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
			return Option.Some(this.val.map(mapper)) as Ret;
		}

		throw new Error("Can only be called for Option<Array<T>>");
	}

	//@ts-expect-error
	pipe<U>(fn: (val: T) => U): Option<U>;
	pipe<U, V>(fn: (val: T) => U, fn2: (val: U) => V): Option<V>;
	pipe<U, V, W>(
		fn: (val: T) => U,
		fn2: (val: U) => V,
		fn3: (val: V) => W,
	): Option<W>;
	pipe<U, V, W, X>(
		fn: (val: T) => U,
		fn2: (val: U) => V,
		fn3: (val: V) => W,
		fn4: (val: W) => X,
	): Option<X>;
	pipe<U, V, W, X, Y>(
		fn: (val: T) => U,
		fn2: (val: U) => V,
		fn3: (val: V) => W,
		fn4: (val: W) => X,
		fn5: (val: X) => Y,
	): Option<Y>;
	pipe<U, V, W, X, Y, Z>(
		fn: (val: T) => U,
		fn2: (val: U) => V,
		fn3: (val: V) => W,
		fn4: (val: W) => X,
		fn5: (val: X) => Y,
		fn6: (val: Y) => Z,
	): Option<Z>;
	pipe<U, V, W, X, Y, Z, A>(
		fn: (val: T) => U,
		fn2: (val: U) => V,
		fn3: (val: V) => W,
		fn4: (val: W) => X,
		fn5: (val: X) => Y,
		fn6: (val: Y) => Z,
		fn7: (val: Z) => A,
	): Option<A>;
	pipe<U, V, W, X, Y, Z, A, B>(
		fn: (val: T) => U,
		fn2: (val: U) => V,
		fn3: (val: V) => W,
		fn4: (val: W) => X,
		fn5: (val: X) => Y,
		fn6: (val: Y) => Z,
		fn7: (val: Z) => A,
		fn8: (val: A) => B,
	): Option<B>;
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
	): Option<C>;
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
	): Option<D>;
	pipe(...fns: Mapper<unknown, unknown>[]) {
		let x = this;
		for (const fn of fns) {
			// @ts-expect-error
			x = x.map(fn);
		}
		return x;
	}
}
