import { Result } from "./result.js";
import { UNIT } from "./unit.js";
import { CapturedTrace, isPromiseLike } from "./utils.js";

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

export class Option<T> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Some" | "None";

  readonly #ctx: OptionCtx;
  readonly #val: T;

  /**
   * Creates a new Option instance with internal context.
   *
   * @param val - Stored value or sentinel
   * @param ctx - Internal async tracking context
   * @param tag - Discriminant tag for Some/None
   *
   * @internal
   */
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

  /**
   * Creates a Some variant containing the provided value.
   *
   * @template Inner - Type of the wrapped value
   * @param val - Value to wrap in Some
   * @returns Option in the Some state
   */
  static Some<Inner>(this: void, val: Inner): Option<Inner> {
    return new Option(val, { promiseNoneSlot: false }, "Some");
  }

  /**
   * Creates an Option from a nullable value, returning None for null/undefined.
   *
   * @template T - Input type that may include null/undefined
   * @param val - Value to convert
   * @returns Some for non-nullish values, otherwise None
   */
  static fromNullable<T>(val: T): Option<NonNullable<T>> {
    return val === null || val === undefined
      ? Option.None
      : Option.Some(val as NonNullable<T>);
  }

  /**
   * Creates an Option from a potentially falsy value, returning None for falsy.
   *
   * Treats false, 0, "", null, and undefined as absence.
   *
   * @template T - Input type
   * @param val - Value to convert
   * @returns Some for truthy values, otherwise None
   */
  static fromFalsy<T>(val: T | Falsy): Option<T> {
    return val ? Option.Some(val as T) : Option.None;
  }

  /**
   * Creates an Option based on a predicate.
   *
   * @template T - Input type
   * @param val - Value to test
   * @param pred - Predicate to decide Some vs None
   * @returns Some when predicate passes, otherwise None
   */
  static fromPredicate<T>(val: T, pred: Predicate<T>): Option<T> {
    return pred(val) ? Option.Some(val) : Option.None;
  }

  /**
   * Wraps a Promise<Option<T>> as Option<Promise<T>>.
   *
   * Preserves None by tracking a sentinel in the async context.
   *
   * @template U - Inner value type
   * @param o - Promise resolving to an Option
   * @returns Option containing a Promise of the inner value
   */
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

  /**
   * Combines multiple Options into a single Option of an array.
   *
   * Returns Some of all values if all inputs are Some; otherwise None.
   *
   * @template T - Variadic tuple of Option types
   * @param options - Options to combine
   * @returns Some of tuple values, or None if any input is None
   */
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

  /**
   * Returns the first Some in the list, or None if all are None.
   *
   * @template T - Value type
   * @param options - Options to search
   * @returns The first Some found, otherwise None
   */
  static any<T>(...options: Option<T>[]): Option<T> {
    for (const opt of options) {
      if (opt.isSome()) return opt;
    }
    return Option.None;
  }

  /**
   * Type guard that narrows to Some.
   *
   * @returns true if this Option is Some
   */
  isSome(): this is Option<T> & { readonly _tag: "Some" } {
    return this._tag === "Some" && !this.isNone();
  }

  /**
   * Type guard that narrows to None.
   *
   * Includes async None tracking for Option<Promise<T>>.
   *
   * @returns true if this Option is None
   */
  isNone(): this is Option<never> & { readonly _tag: "None" } {
    return (
      this._tag === "None" ||
      this.#val === NONE_VAL ||
      (isPromiseLike(this.#val) && this.#ctx.promiseNoneSlot)
    );
  }

  /**
   * Type guard for the UNIT sentinel value.
   *
   * @returns true if the contained value is UNIT
   */
  isUnit(): this is Option<UNIT> {
    return this.#val === UNIT;
  }

  /**
   * Returns the contained value or throws if None.
   *
   * @throws UnwrappedNone when called on None
   * @returns The contained value
   */
  unwrap(): T {
    if (this.isNone()) {
      throw UNWRAPPED_NONE_ERR;
    }
    return this.#val;
  }

  /**
   * Returns the contained value or the provided default.
   *
   * @param defaultValue - Value to use when None
   * @returns The contained value or default
   */
  unwrapOr(defaultValue: T): T {
    if (this.isNone()) return defaultValue;
    return this.#val;
  }

  /**
   * Returns the contained value or computes a default lazily.
   *
   * @param fn - Default factory invoked only when None
   * @returns The contained value or computed default
   */
  unwrapOrElse(fn: () => T): T {
    if (this.isNone()) return fn();
    return this.#val;
  }

  /**
   * Returns the contained value or null for None.
   *
   * @returns The contained value, or null when None
   */
  safeUnwrap(): T | null {
    if (this.isNone()) return null;
    return this.#val;
  }

  /**
   * Exhaustive pattern match on Option state.
   *
   * @template U - Result type
   * @param cases - Handlers for Some and None
   * @returns Result of the matching handler
   */
  match<U>(cases: MatchCases<T, U>): U {
    if (this.isNone()) {
      return cases.None();
    }
    return cases.Some(this.#val);
  }

  // -------------------------------------------------------------------------
  // map() - with async overloads per spec
  // -------------------------------------------------------------------------

  /**
   * Transforms the contained value and wraps it in a new Option.
   *
   * If None, returns None without calling the mapper. Supports async values
   * and async mappers; returns Option<Promise<U>> when async is involved.
   *
   * @template U - Result value type
   * @param mapper - Function to transform the contained value
   * @returns Option of the mapped value (sync or async)
   *
   * @see flatMap
   */
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

  /**
   * Safely maps a promised value while tracking None in async context.
   *
   * @template Curr - Input value type
   * @template U - Output value type
   * @param p - Promise to map over
   * @param mapper - Transform function
   * @param ctx - Async context for None tracking
   * @returns Promise of the transformed value or sentinel
   */
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

  /**
   * Maps the value or returns a default (unwrapped).
   *
   * If None, returns the default without calling fn. Supports async values
   * and async mappers; returns Promise<U> when async is involved.
   *
   * @template U - Result type
   * @param defaultVal - Value to return if None
   * @param fn - Mapper applied when Some
   * @returns Mapped value or default (sync or async)
   */
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

  /**
   * Chains operations that return Option, flattening nested Options.
   *
   * If None, returns None without calling the mapper. Supports async values
   * and async mappers; returns Option<Promise<U>> when async is involved.
   *
   * @template U - Result value type
   * @param mapper - Function returning an Option
   * @returns Flattened Option result (sync or async)
   *
   * @see map
   */
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
                resolve(NONE_VAL as U);
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

  /**
   * Filters the contained value by a predicate.
   *
   * If Some, returns Some when predicate passes, otherwise None. Supports
   * async values and async predicates; returns Option<Promise<T>> when async.
   *
   * @param pred - Predicate function
   * @returns Option filtered by the predicate (sync or async)
   */
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

  /**
   * Pairs the original value with a derived value in a tuple.
   *
   * If None, returns None. Supports async values and async derivation; returns
   * Option<Promise<[Curr, Awaited<U>]>> when async is involved.
   *
   * @template U - Derived value type
   * @param fn - Function to derive a value from the contained value
   * @returns Option of tuple with original and derived values
   */
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

  /**
   * Pairs the original value with a derived Option value, flattening the result.
   *
   * If None, returns None. Supports async values and async Option derivation;
   * returns Option<Promise<[Curr, U]>> when async is involved.
   *
   * @template U - Derived Option value type
   * @param fn - Function returning an Option
   * @returns Option of tuple with original and derived values
   */
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

  /**
   * Executes a side effect for Some values and returns self.
   *
   * @param fn - Side effect function
   * @returns The same Option (chainable)
   */
  tap(fn: (val: T) => void): Option<T> {
    if (this.isSome()) {
      fn(this.#val);
    }
    return this;
  }

  /**
   * Converts this Option to a Result, using the provided error for None.
   *
   * @template E - Error type
   * @param error - Error value for None
   * @returns Ok with value when Some, otherwise Err with error
   */
  toResult<E>(error: E): Result<T, E> {
    if (this.isNone()) {
      return Result.Err(error);
    }
    return Result.Ok(this.#val);
  }

  /**
   * Resolves the inner promise (if any) while preserving Option structure.
   *
   * @template Curr - Awaited value type
   * @returns Promise of Option with awaited value, or None
   */
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

  /**
   * Maps over array elements inside an Option<Array<T>>.
   *
   * @template Inner - Array element type
   * @template Out - Mapped element type
   * @param mapper - Function to map each element
   * @returns Option containing the mapped array
   * @throws TypeError if called on a non-array value
   */
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

  /**
   * Returns a string representation of the Option.
   *
   * @returns "Option::None" or "Option::Some(value)"
   */
  toString(): string {
    if (this.isNone()) return "Option::None";
    return `Option::Some(${String(this.#val)})`;
  }

  /**
   * Makes ExperimentalOption iterable for use with generator-based syntax.
   *
   * Yields self and returns the unwrapped value when resumed.
   * Used internally by {@link ExperimentalOption.gen} for `yield*` syntax.
   *
   * @example
   * ```ts
   * const result = ExperimentalOption.gen(function* () {
   *   const value = yield* ExperimentalOption.Some(42);
   *   return value * 2;
   * });
   * // Some(84)
   * ```
   *
   * @internal
   */
  *[Symbol.iterator](): Generator<Option<T>, T, unknown> {
    const trace = new Error().stack;
    return (yield new CapturedTrace(this, trace) as unknown as Option<T>) as T;
  }

  /**
   * Makes ExperimentalOption iterable for use with async generator-based syntax.
   *
   * Yields self and returns the unwrapped value when resumed.
   * Used internally by {@link ExperimentalOption.asyncGen} for `yield*` syntax.
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.asyncGen(async function* () {
   *   const value = yield* await Promise.resolve(ExperimentalOption.Some(42));
   *   return value * 2;
   * });
   * // Some(84)
   * ```
   *
   * @internal
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<
    Option<T>,
    Awaited<T>,
    unknown
  > {
    const trace = new Error().stack;
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as Option<T>) as Awaited<T>;
  }
}
