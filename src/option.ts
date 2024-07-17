import { UNIT } from "./unit";

type OptMapper<T, U> = (val: T) => Option<U>;
type AsyncOptMapper<T, U> = (val: T) => Promise<Option<U>>;

export class UnwrappedNone extends Error {
	constructor() {
		super("Unwrapped Option<None>");
	}
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();

export type UnitOption = Option<UNIT>;
export type UnwrapOption<T> = T extends Option<infer R> ? R : never;
type CombinedOptions<T extends Option<unknown>[]> = {
	[K in keyof T]: UnwrapOption<T[K]>;
};

export class Option<T> {
	private constructor(
		readonly val: T,
		private readonly ok: boolean,
	) {}

	static readonly None: Option<never> = new Option({} as never, false);
	static readonly UNIT_OPT: UnitOption = new Option(UNIT, true);

	static Some<Inner>(val: Inner): Option<Inner> {
		return new Option(val, true);
	}

	static fromNullable<T>(val: T): Option<NonNullable<T>> {
		return val === null ? Option.None : Option.Some(val as NonNullable<T>);
	}

	isSome(): this is Option<T> {
		return this.ok;
	}

	isNone(): this is Option<never> {
		return !this.ok;
	}

	unwrap(): T {
		if (this.ok) {
			return this.val;
		}

		throw UNWRAPPED_NONE_ERR;
	}

	/* Useful to serialize. Inverse operation for `fromNullable` */
	safeUnwrap(): T | null {
		if (this.ok) return this.val;

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
		if (val instanceof Promise) return val.then((u) => Option.Some(u));

		return Option.Some(val);
	}

	mapOr<U>(def: U, fn: (val: T) => U): Option<U>;
	mapOr<U>(def: U, fn: (val: T) => Promise<U>): Promise<Option<U>>;
	mapOr<U>(def: U, fn: (val: T) => U) {
		if (this.isNone()) return Option.Some(def);

		const val = fn(this.val);
		if (val instanceof Promise) return val.then((u) => Option.Some(u));

		return Option.Some(val);
	}

	bind<U>(fn: (val: T) => Option<U>): Option<U>;
	bind<U>(fn: (val: T) => Promise<Option<U>>): Promise<Option<U>>;
	bind<U>(fn: OptMapper<T, U> | AsyncOptMapper<T, U>) {
		if (this.ok) return fn(this.val);

		return Option.None;
	}

	and<U>(opt: Option<U>): Option<[T, U]> {
		if (this.ok && opt.ok) return Option.Some([this.val, opt.val]);

		return Option.None;
	}

	do(fn: (val: T) => void): Option<T> {
		if (this.ok) fn(this.val);

		return this;
	}

	async doAsync(fn: (val: T) => Promise<unknown>): Promise<Option<T>> {
		if (this.ok) {
			await fn(this.val);
		}

		return this;
	}

	zip<U>(f: (val: T) => Option<U>): Option<[T, U]> {
		if (!this.ok) return Option.None;

		return f(this.val).map((u) => [this.val, u] as [T, U]);
	}

	async zipAsync<U>(
		f: (val: T) => Promise<Option<U>>,
	): Promise<Option<[T, U]>> {
		if (!this.ok) return Promise.resolve(Option.None);

		const opt = await f(this.val);
		return opt.map((u) => [this.val, u] as [T, U]);
	}

	static any<T>(seq: Option<T>[]): boolean {
		for (const el of seq) {
			if (el.ok) return true;
		}

		return false;
	}

	static all<T>(seq: Option<T>[]): boolean {
		for (const el of seq) {
			if (!el.ok) return false;
		}

		return true;
	}

	static sequence<T extends Option<unknown>[]>(
		...options: T
	): Option<CombinedOptions<T>> {
		const vals = [] as CombinedOptions<T>;

		for (const opt of options) {
			if (!opt.ok) return Option.None;

			vals.push(opt.val);
		}

		return Option.Some(vals);
	}

	static async lift<T>(opt: Option<Promise<T>>): Promise<Option<T>> {
		if (!opt.ok) return Promise.resolve(Option.None);

		return opt.val.then((val) => Option.Some(val));
	}
}
