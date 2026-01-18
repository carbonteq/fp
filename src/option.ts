import { Result } from "./result.js";
import { UNIT } from "./unit.js";
import { isPromiseLike } from "./utils.js";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type FlatMapper<T, U> = (val: T) => Option<U>;
type AsyncFlatMapper<T, U> = (val: T) => Promise<Option<U>>;
type Predicate<T> = (val: T) => boolean;
type FilterPredicate<T> = (val: Awaited<T>) => boolean;
type AsyncPredicate<T> = (val: Awaited<T>) => Promise<boolean>;
type Falsy = false | 0 | "" | null | undefined;

export class UnwrappedNone extends Error {
  readonly name = "UnwrapError";

  constructor() {
    super("Attempted to unwrap Option::None");
  }
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();

const NONE_VAL = Symbol("Option::None");

export type UnitOption = Option<UNIT>;
export type UnwrapOption<T> = T extends Option<infer R> ? R : never;

type CombinedOptions<T extends Option<unknown>[]> = {
  [K in keyof T]: UnwrapOption<T[K]>;
};

type OptionCtx = { promiseNoneSlot: boolean };

interface MatchCases<T, U> {
  Some: (val: T) => U;
  None: () => U;
}

/**
 * Wrapper that makes Option yieldable with proper type tracking.
 *
 * @internal
 */
class OptionYieldWrap<T> {
  constructor(readonly option: Option<T>) {}

  *[Symbol.iterator](): Generator<OptionYieldWrap<T>, T, unknown> {
    return (yield this) as T;
  }
}

/**
 * Wrapper that makes Option yieldable in async generators with proper type tracking.
 * Supports both Option<T> and Promise<Option<T>> for flexibility.
 * Returns Awaited<T> to handle Option<Promise<U>> yielding U instead of Promise<U>.
 *
 * @internal
 */
class AsyncOptionYieldWrap<T> {
  constructor(readonly option: Option<T> | Promise<Option<T>>) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<
    AsyncOptionYieldWrap<T>,
    Awaited<T>,
    unknown
  > {
    return (yield this) as Awaited<T>;
  }
}

export class Option<T> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Some" | "None";

  readonly #ctx: OptionCtx;
  readonly #val: T;

  private constructor(val: T, ctx: OptionCtx, tag: "Some" | "None") {
    this.#val = val;
    this.#ctx = ctx;
    this._tag = tag;
  }

  /** Singleton None instance */
  static readonly None: Option<never> = new Option(
    NONE_VAL as never,
    { promiseNoneSlot: true },
    "None",
  );

  /** Create a Some containing the given value */
  static Some<Inner>(this: void, val: Inner): Option<Inner> {
    return new Option(val, { promiseNoneSlot: false }, "Some");
  }

  /** Create Option from nullable value - returns None for null/undefined */
  static fromNullable<T>(val: T): Option<NonNullable<T>> {
    return val === null || val === undefined
      ? Option.None
      : Option.Some(val as NonNullable<T>);
  }

  /** Create Option from potentially falsy value - returns None for falsy */
  static fromFalsy<T>(val: T | Falsy): Option<T> {
    return val ? Option.Some(val as T) : Option.None;
  }

  /** Create Option based on predicate result */
  static fromPredicate<T>(val: T, pred: Predicate<T>): Option<T> {
    return pred(val) ? Option.Some(val) : Option.None;
  }

  /** Wrap Promise<Option<T>> as Option<Promise<T>> */
  static fromPromise<U>(o: Promise<Option<U>>): Option<Promise<U>> {
    const ctx: OptionCtx = { promiseNoneSlot: false };
    const p = new Promise<U>((resolve, reject) =>
      o.then((innerOpt) => {
        if (innerOpt.isNone()) {
          ctx.promiseNoneSlot = true;
        }
        resolve(innerOpt.#val);
      }, reject),
    );

    return new Option(p, ctx, "Some");
  }

  /** Combine multiple Options - returns Some array if all are Some, else None */
  static all<T extends Option<unknown>[]>(
    ...options: T
  ): Option<CombinedOptions<T>> {
    const vals = [] as CombinedOptions<T>;

    for (const opt of options) {
      if (opt.isNone()) return Option.None;
      vals.push(opt.#val);
    }

    return Option.Some(vals);
  }

  /** Returns first Some, or None if all are None */
  static any<T>(...options: Option<T>[]): Option<T> {
    for (const opt of options) {
      if (opt.isSome()) return opt;
    }
    return Option.None;
  }

  /**
   * Generator-based syntax for chaining Option operations (simplified, no adapter).
   *
   * Short-circuits on first None, returning Option.None. Uses iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const result = Option.gen(function* () {
   *   const a = yield* Option.Some(1);
   *   const b = yield* Option.Some(2);
   *   return a + b;
   * });
   * // Option<number>
   * ```
   */
  static gen<T>(
    genFn: () => Generator<Option<unknown>, T, unknown>,
  ): Option<T> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is the Option that was yielded
      const yielded = next.value as Option<unknown>;

      if (yielded.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value and pass it back to the generator
      nextArg = yielded.unwrap();
    }

    return currentResult;
  }

  /**
   * Generator-based syntax for chaining Option operations (with adapter).
   * Uses an adapter function ($) for improved type inference.
   *
   * Short-circuits on first None, returning Option.None. Uses iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const result = Option.genAdapter(function* ($) {
   *   const a = yield* $(Option.Some(1));
   *   const b = yield* $(Option.Some(2));
   *   return a + b;
   * });
   * // Option<number>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static genAdapter<Eff extends OptionYieldWrap<any>, T>(
    genFn: (
      adapter: <A>(option: Option<A>) => OptionYieldWrap<A>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => Generator<Eff, T, any>,
  ): Option<T> {
    const adapter = <A>(option: Option<A>): OptionYieldWrap<A> =>
      new OptionYieldWrap(option);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is the OptionYieldWrap that was yielded
      const wrapped = next.value as OptionYieldWrap<unknown>;
      const option = wrapped.option;

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value and pass it back to the generator
      nextArg = option.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining Option operations (simplified, no adapter).
   * Use yield* with Option values directly. For Promise<Option<T>>, await first then yield*.
   * When yielding Option<Promise<U>>, the inner promise is automatically awaited.
   *
   * Short-circuits on first None, returning Option.None. Uses async iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const result = await Option.asyncGen(async function* () {
   *   const a = yield* Option.Some(1);
   *   const b = yield* await Promise.resolve(Option.Some(2));
   *   // Option<Promise<T>> - inner promise is auto-awaited
   *   const c = yield* Option.Some(Promise.resolve(3)); // c is number, not Promise<number>
   *   return a + b + c;
   * });
   * // Option<number>
   * ```
   */
  static async asyncGen<T>(
    genFn: () => AsyncGenerator<Option<unknown>, T, unknown>,
  ): Promise<Option<T>> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is an Option (user awaits promises before yielding)
      const option = next.value as Option<unknown>;

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value and await if it's a promise
      const unwrapped = option.unwrap();
      if (isPromiseLike(unwrapped)) {
        const awaited = await unwrapped;
        // Check if the awaited value is NONE_VAL (from Option<Promise<T>> when None)
        if (awaited === NONE_VAL) {
          currentResult = Option.None;
          break;
        }
        nextArg = awaited;
      } else {
        nextArg = unwrapped;
      }
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining Option operations (with adapter).
   * Uses an adapter function ($) for improved type inference.
   * Supports both Option<T> and Promise<Option<T>> for flexibility.
   * When yielding Option<Promise<U>>, the inner promise is automatically awaited.
   *
   * Short-circuits on first None, returning Option.None. Uses async iteration instead of
   * recursion to avoid stack overflow on deep chains.
   *
   * @example
   * ```ts
   * const result = await Option.asyncGenAdapter(async function* ($) {
   *   const a = yield* $(Option.Some(1));
   *   const b = yield* $(Promise.resolve(Option.Some(2)));
   *   // Option<Promise<T>> - inner promise is auto-awaited
   *   const c = yield* $(Option.Some(Promise.resolve(3))); // c is number, not Promise<number>
   *   return a + b + c;
   * });
   * // Option<number>
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static async asyncGenAdapter<Eff extends AsyncOptionYieldWrap<any>, T>(
    genFn: (
      adapter: <A>(
        option: Option<A> | Promise<Option<A>>,
      ) => AsyncOptionYieldWrap<A>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => AsyncGenerator<Eff, T, any>,
  ): Promise<Option<T>> {
    const adapter = <A>(
      option: Option<A> | Promise<Option<A>>,
    ): AsyncOptionYieldWrap<A> => new AsyncOptionYieldWrap(option);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is the AsyncOptionYieldWrap that was yielded
      const wrapped = next.value as AsyncOptionYieldWrap<unknown>;
      const optionOrPromise = wrapped.option;

      // Resolve promise if needed
      const option = isPromiseLike(optionOrPromise)
        ? await optionOrPromise
        : optionOrPromise;

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value and await if it's a promise
      const unwrapped = option.unwrap();
      if (isPromiseLike(unwrapped)) {
        const awaited = await unwrapped;
        // Check if the awaited value is NONE_VAL (from Option<Promise<T>> when None)
        if (awaited === NONE_VAL) {
          currentResult = Option.None;
          break;
        }
        nextArg = awaited;
      } else {
        nextArg = unwrapped;
      }
    }

    return currentResult;
  }

  /** Type guard for Some state */
  isSome(): this is Option<T> & { readonly _tag: "Some" } {
    return this._tag === "Some" && !this.isNone();
  }

  /** Type guard for None state */
  isNone(): this is Option<never> & { readonly _tag: "None" } {
    return (
      this._tag === "None" ||
      this.#val === NONE_VAL ||
      (isPromiseLike(this.#val) && this.#ctx.promiseNoneSlot)
    );
  }

  /** Type guard for Unit value */
  isUnit(): this is Option<UNIT> {
    return this.#val === UNIT;
  }

  /** Returns value or throws UnwrapError */
  unwrap(): T {
    if (this.isNone()) {
      throw UNWRAPPED_NONE_ERR;
    }
    return this.#val;
  }

  /** Returns value or the provided default */
  unwrapOr(defaultValue: T): T {
    if (this.isNone()) return defaultValue;
    return this.#val;
  }

  /** Returns value or calls factory to get default */
  unwrapOrElse(fn: () => T): T {
    if (this.isNone()) return fn();
    return this.#val;
  }

  /** Returns value or null for None */
  safeUnwrap(): T | null {
    if (this.isNone()) return null;
    return this.#val;
  }

  /** Pattern match on Option state */
  match<U>(cases: MatchCases<T, U>): U {
    if (this.isNone()) {
      return cases.None();
    }
    return cases.Some(this.#val);
  }

  // -------------------------------------------------------------------------
  // map() - with async overloads per spec
  // -------------------------------------------------------------------------

  map<U, Curr = Awaited<T>>(
    this: Option<Promise<Curr>>,
    mapper: AsyncMapper<Curr, U>,
  ): Option<Promise<U>>;
  map<U, Curr = Awaited<T>>(
    this: Option<Promise<Curr>>,
    mapper: Mapper<Curr, U>,
  ): Option<Promise<U>>;
  map<U>(this: Option<T>, mapper: AsyncMapper<T, U>): Option<Promise<U>>;
  map<U>(this: Option<T>, mapper: Mapper<T, U>): Option<U>;
  map<U, Curr = Awaited<T>>(
    mapper: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ) {
    if (this.isNone()) return Option.None;

    const curr = this.#val;

    if (isPromiseLike(curr)) {
      const p = curr as Promise<Curr>;
      // Create a NEW context for this branch to avoid cross-branch mutation
      const newCtx: OptionCtx = { promiseNoneSlot: false };
      const safetlyMapped = Option.safeMap(p, mapper, newCtx);
      return new Option(safetlyMapped, newCtx, "Some");
    }

    const transformed = mapper(curr as unknown as Curr);
    if (isPromiseLike(transformed)) {
      return new Option(transformed, { promiseNoneSlot: false }, "Some");
    }
    // Sync operations can share context since there's no async mutation
    return new Option(transformed, { promiseNoneSlot: false }, "Some");
  }

  private static safeMap<Curr, U>(
    p: Promise<Curr>,
    mapper: (val: Curr) => U | Promise<U>,
    ctx: OptionCtx,
  ) {
    return p.then((v) => {
      if (v === NONE_VAL) {
        ctx.promiseNoneSlot = true;
        return NONE_VAL;
      }
      return mapper(v);
    }) as Promise<U>;
  }

  // -------------------------------------------------------------------------
  // mapOr() - maps value or returns default (returns U, not Option<U>)
  // -------------------------------------------------------------------------

  mapOr<U, Curr = Awaited<T>>(
    this: Option<Promise<Curr>>,
    defaultVal: U,
    fn: Mapper<Curr, U>,
  ): Promise<U>;
  mapOr<U, Curr = Awaited<T>>(
    this: Option<Promise<Curr>>,
    defaultVal: U,
    fn: AsyncMapper<Curr, U>,
  ): Promise<U>;
  mapOr<U>(this: Option<T>, defaultVal: U, fn: Mapper<T, U>): U;
  mapOr<U, Curr = Awaited<T>>(
    defaultVal: U,
    fn: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ): U | Promise<U> {
    if (this.isNone()) {
      return isPromiseLike(this.#val)
        ? Promise.resolve(defaultVal)
        : defaultVal;
    }

    const curr = this.#val;
    if (isPromiseLike(curr)) {
      const p = curr as Promise<Curr>;
      return p.then(async (v) => {
        if (v === NONE_VAL) return defaultVal;
        return fn(v);
      });
    }

    return fn(curr as unknown as Curr);
  }

  // -------------------------------------------------------------------------
  // flatMap() - with async overloads per spec
  // -------------------------------------------------------------------------

  flatMap<U, Curr = Awaited<T>>(
    this: Option<Promise<Curr>>,
    mapper: AsyncFlatMapper<Curr, U>,
  ): Option<Promise<U>>;
  flatMap<U, Curr = Awaited<T>>(
    this: Option<Promise<Curr>>,
    mapper: FlatMapper<Curr, U>,
  ): Option<Promise<U>>;
  flatMap<U>(
    this: Option<T>,
    mapper: AsyncFlatMapper<T, U>,
  ): Option<Promise<U>>;
  flatMap<U>(this: Option<T>, mapper: FlatMapper<T, U>): Option<U>;
  flatMap<U, Curr = Awaited<T>>(
    mapper: FlatMapper<NoInfer<Curr>, U> | AsyncFlatMapper<NoInfer<Curr>, U>,
  ): Option<U> | Option<Promise<U>> {
    if (this.isNone()) return Option.None;

    const curr = this.#val;

    if (isPromiseLike(curr)) {
      const p = curr as Promise<Curr>;
      // Create a NEW context for this branch to avoid cross-branch mutation
      const newCtx: OptionCtx = { promiseNoneSlot: false };
      const castedNone = NONE_VAL as unknown as Promise<U>;
      const newP = new Promise<U>((resolve, reject) => {
        p.then((innerVal) => {
          if (innerVal === NONE_VAL) {
            newCtx.promiseNoneSlot = true;
            resolve(castedNone);
          } else {
            const r = mapper(innerVal);
            if (isPromiseLike(r)) {
              r.then((innerOpt) => {
                if (innerOpt.isNone()) {
                  newCtx.promiseNoneSlot = true;
                }
                resolve(innerOpt.#val);
              }, reject);
            } else {
              if (r.isNone()) {
                newCtx.promiseNoneSlot = true;
                resolve(NONE_VAL as unknown as U);
              } else {
                resolve(r.#val);
              }
            }
          }
        }, reject);
      });
      return new Option(newP, newCtx, "Some");
    }

    const mapped = mapper(curr as unknown as Curr);
    if (isPromiseLike(mapped)) {
      return Option.fromPromise(mapped);
    }
    return mapped;
  }

  // -------------------------------------------------------------------------
  // filter() - with async predicate support
  // -------------------------------------------------------------------------

  filter(pred: FilterPredicate<T>): Option<T>;
  filter(pred: AsyncPredicate<T>): Option<Promise<T>>;
  filter(
    pred: FilterPredicate<T> | AsyncPredicate<T>,
  ): Option<T> | Option<Promise<T>> {
    if (this.isNone()) return Option.None;

    const curr = this.#val;

    if (isPromiseLike(curr)) {
      const p = curr as Promise<Awaited<T>>;
      const newCtx: OptionCtx = { promiseNoneSlot: false };
      const next = p.then(async (v) => {
        if (v === NONE_VAL) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }
        const passed = await pred(v as Awaited<T>);
        if (!passed) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }
        return v;
      }) as Promise<T>;
      return new Option(next, newCtx, "Some");
    }

    const result = pred(curr as Awaited<T>);

    if (isPromiseLike(result)) {
      const newCtx: OptionCtx = { promiseNoneSlot: false };
      const p = result.then((passed) => {
        if (passed) return curr as T;
        newCtx.promiseNoneSlot = true;
        return NONE_VAL;
      }) as Promise<T>;
      return new Option(p, newCtx, "Some");
    }

    return result ? this : Option.None;
  }

  // -------------------------------------------------------------------------
  // zip() - with async overloads per spec
  // -------------------------------------------------------------------------

  zip<U, Curr>(
    this: Option<Promise<Curr>>,
    fn: (val: Curr) => U,
  ): Option<Promise<[Curr, Awaited<U>]>>;
  zip<U, Curr>(
    this: Option<Curr>,
    fn: (val: Curr) => Promise<U>,
  ): Option<Promise<[Curr, Awaited<U>]>>;
  zip<U, Curr>(this: Option<Curr>, fn: (val: Curr) => U): Option<[Curr, U]>;
  zip<U, Curr = Awaited<T>>(fn: Mapper<Curr, U> | AsyncMapper<Curr, U>) {
    if (this.isNone()) return Option.None;

    const curr = this.#val;

    if (isPromiseLike(curr)) {
      const val = curr as Promise<Curr>;
      // Create a NEW context for this branch to avoid cross-branch mutation
      const newCtx: OptionCtx = { promiseNoneSlot: false };

      const p = val.then(async (v) => {
        if (v === NONE_VAL) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }

        const next = await fn(v);
        return [v, next];
      }) as Promise<[Curr, Awaited<U>]>;

      return new Option(p, newCtx, "Some");
    }

    const value = curr as unknown as Curr;
    const u = fn(value);
    if (isPromiseLike(u)) {
      const p = u.then((uu) => [value, uu] as [Curr, Awaited<U>]);
      return new Option(p, { promiseNoneSlot: false }, "Some");
    }

    return new Option([value, u], { promiseNoneSlot: false }, "Some");
  }

  // -------------------------------------------------------------------------
  // flatZip() - with async overloads per spec
  // -------------------------------------------------------------------------

  flatZip<U, Curr>(
    this: Option<Promise<Curr>>,
    fn: (val: Curr) => Promise<Option<U>>,
  ): Option<Promise<[Curr, U]>>;
  flatZip<U, Curr>(
    this: Option<Promise<Curr>>,
    fn: (val: Curr) => Option<U>,
  ): Option<Promise<[Curr, U]>>;
  flatZip<U, Curr>(
    this: Option<Curr>,
    fn: (val: Curr) => Promise<Option<U>>,
  ): Option<Promise<[T, U]>>;
  flatZip<U, Curr>(
    this: Option<Curr>,
    fn: (val: Curr) => Option<U>,
  ): Option<[T, U]>;
  flatZip<U, Curr = Awaited<T>>(
    fn: Mapper<Curr, Option<U>> | AsyncMapper<Curr, Option<U>>,
  ) {
    if (this.isNone()) return Option.None;

    const curr = this.#val;

    if (isPromiseLike(curr)) {
      const val = curr as Promise<Curr>;
      // Create a NEW context for this branch to avoid cross-branch mutation
      const newCtx: OptionCtx = { promiseNoneSlot: false };

      const p = val.then(async (v) => {
        if (v === NONE_VAL) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }

        const next = await fn(v);
        if (next.isNone()) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }
        return [v, next.#val] as [Curr, U];
      }) as Promise<[Curr, U]>;

      return new Option(p, newCtx, "Some");
    }

    const c = curr as unknown as Curr;
    const u = fn(c);
    if (isPromiseLike(u)) {
      const newCtx: OptionCtx = { promiseNoneSlot: false };
      const p = u.then((uu) => {
        if (uu.isNone()) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }
        return [c, uu.#val] as [Curr, U];
      });
      return new Option(p, newCtx, "Some");
    }

    return u.map((inner) => [c, inner]);
  }

  /** Execute side effect for Some, return self */
  tap(fn: (val: T) => void): Option<T> {
    if (this.isSome()) {
      fn(this.#val);
    }
    return this;
  }

  /** Convert Option to Result */
  toResult<E>(error: E): Result<T, E> {
    if (this.isNone()) {
      return Result.Err(error);
    }
    return Result.Ok(this.#val);
  }

  /** Resolve inner Promise and maintain Option structure */
  async toPromise<Curr = Awaited<T>>(): Promise<Option<Curr>> {
    if (this.isNone()) {
      return Option.None;
    }

    const curr = this.#val;

    let inner: Curr;
    if (isPromiseLike(curr)) {
      const awaited = await curr;
      if (awaited === NONE_VAL) {
        return Option.None;
      }
      inner = awaited as Curr;
    } else {
      inner = curr as unknown as Curr;
    }

    return new Option(inner, this.#ctx, "Some");
  }

  /** Map over array elements inside Option */
  innerMap<Inner, Out>(
    this: Option<Array<Inner>>,
    mapper: (val: Inner) => Out,
  ): Option<NoInfer<Out>[]> {
    if (this.isNone()) return Option.None;

    if (!Array.isArray(this.#val)) {
      throw new TypeError("innerMap can only be called on Option<Array<T>>");
    }

    return new Option((this.#val as Inner[]).map(mapper), this.#ctx, "Some");
  }

  /** String representation */
  toString(): string {
    if (this.isNone()) return "Option::None";
    return `Option::Some(${String(this.#val)})`;
  }

  /**
   * Makes Option iterable for use with generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   *
   * @example
   * ```ts
   * const result = Option.gen(function* () {
   *   const value = yield* Option.Some(42);
   *   return value * 2;
   * });
   * ```
   */
  *[Symbol.iterator](): Generator<Option<T>, T, unknown> {
    return (yield this) as T;
  }

  /**
   * Makes Option iterable for use with async generator-based syntax.
   * Yields self and returns the unwrapped value when resumed.
   * Returns Awaited<T> for proper type inference when inner value is a Promise.
   *
   * @example
   * ```ts
   * const result = await Option.asyncGen(async function* () {
   *   const value = yield* Option.Some(42);
   *   const asyncValue = yield* Promise.resolve(Option.Some(10));
   *   return value + asyncValue;
   * });
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<
    Option<T>,
    Awaited<T>,
    unknown
  > {
    return (yield this) as Awaited<T>;
  }
}
