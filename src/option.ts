type OptMapper<T, U> = (val: T) => Option<U>;
type AsyncOptMapper<T, U> = (val: T) => Promise<Option<U>>;

export class UnwrappedNone extends Error {
	constructor() {
		super("Unwrapped Option<None>");
	}
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();

export class Option<T> {
	private constructor(readonly val: T, private readonly ok: boolean) {}

	static readonly None: Option<never> = new Option({} as never, false);

	static Some<X>(val: X): Option<X> {
		return new Option(val, true);
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

	toString(): string {
		if (this.isNone()) return `Option::None`;

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

	// okOr<E>(err: E): Result<T, E> {
	// 	if (this.isNone()) return Result.Err(err);
	//
	// 	return Result.Ok(this.val);
	// }
	//
	// okOrElse<E>(f: () => E): Result<T, E> {
	// 	if (this.isNone()) return Result.Err(f());
	//
	// 	return Result.Ok(this.val);
	// }
}
