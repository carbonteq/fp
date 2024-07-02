import { UNIT } from "./unit";

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
type PureResMapper<T, U, E> = (val: T) => Result<U, E>;
type PureAsyncResMapper<T, U, E> = (val: T) => Promise<Result<U, E>>;

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

	toString(): string {
		if (this.val !== Sentinel) {
			return `Result::Ok<${this.val}>`;
		}

		return `Result::Err<${this.error as E}>`;
	}

	unwrap(): T {
		if (this.isErr()) {
			if (this.error instanceof Error) throw this.error;

			throw new UnwrappedOkWithErr(this);
		}

		return this.val as T;
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
	 * @param {Mapper<T, U>} f The mapping/endofunctor to apply to the internal Ok value (T -> U)
	 * @returns Result<U, E> containing the mapped value
	 * @example
	 * const r = Result.Ok({data: 42})
	 * const r2 = Result.Err(new Error("something went wrong"))
	 * const mapper = (d: {data: 42}) => d.data * 2
	 * const result1 = r.map(mapper) // Result containing 64 as the ok value
	 * const result2 = r2.map(mapper) // mapper won't be applied, as r2 was in error state
	 */
	map<U>(f: Mapper<T, U>): Result<U, E> {
		if (this.val === Sentinel)
			return new Result(Sentinel, this.error) as Result<U, E>;

		const valPrime = f(this.val);

		return new Result(valPrime, this.error);
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

	/** For combining two results. For the lazy eval version, see {@link zip} and {@link zipAsync} */
	and<U, E2>(r: Result<U, E2>): Result<[T, U], E | E2> {
		if (this.isErr()) return this;

		// return r.map(v => [this.val, v] as [T, U])
		if (r.isErr()) return r;

		return Result.Ok([this.val, r.val] as [T, U]);
	}

	/**
	 * Also known as `andThen` or `fmap`
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

	/** For running infallible side-effects on the contained value. Up to the programmer to ensure the underlying function doesn't fail */
	do(fn: (val: T) => void): Result<T, E> {
		if (this.val !== Sentinel) {
			fn(this.val);
		}

		return this;
	}

	/**
	 * Async version of {@link do}
	 * @see {@link do}
	 */
	async doAsync(fn: (val: T) => Promise<void>): Promise<Result<T, E>> {
		if (this.val !== Sentinel) {
			await fn(this.val);
		}

		return this;
	}

	/** For combining two results lazily. For the eager eval version, see {@link and} */
	zip<U, E2>(f: (val: T) => Result<U, E2>): Result<[T, U], E | E2> {
		if (this.error !== Sentinel) return Result.Err(this.error);

		return f(this.val as T).map((u) => [this.val, u] as [T, U]);
	}

	/** For combining two results lazily. For the eager eval version, see {@link and} */
	async zipAsync<U, E2>(
		f: (val: T) => Promise<Result<U, E2>>,
	): Promise<Result<[T, U], E | E2>> {
		if (this.error !== Sentinel) return Promise.resolve(Result.Err(this.error));

		return f(this.val as T).then((uRes) =>
			uRes.map((u) => [this.val, u] as [T, U]),
		);
	}

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
}
