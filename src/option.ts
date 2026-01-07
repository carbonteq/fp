import { Result } from "./result.js";
import { UNIT } from "./unit.js";
import { isPromiseLike } from "./utils.js";

// ============================================================================
// Types
// ============================================================================

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type FlatMapper<T, U> = (val: T) => Option<U>;
type AsyncFlatMapper<T, U> = (val: T) => Promise<Option<U>>;
type Predicate<T> = (val: T) => boolean;
type AsyncPredicate<T> = (val: T) => Promise<boolean>;
type Falsy = false | 0 | "" | null | undefined;

// ============================================================================
// Error Types
// ============================================================================

export class UnwrappedNone extends Error {
  readonly name = "UnwrapError";

  constructor() {
    super("Attempted to unwrap Option::None");
  }
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();

// ============================================================================
// Internal Sentinel
// ============================================================================

const NONE_VAL = Symbol("Option::None");

// ============================================================================
// Exported Types
// ============================================================================

export type UnitOption = Option<UNIT>;
export type UnwrapOption<T> = T extends Option<infer R> ? R : never;

type CombinedOptions<T extends Option<unknown>[]> = {
  [K in keyof T]: UnwrapOption<T[K]>;
};

// ============================================================================
// Context for async tracking
// ============================================================================

type OptionCtx = { promiseNoneSlot: boolean };

// ============================================================================
// Match Cases Type
// ============================================================================

interface MatchCases<T, U> {
  Some: (val: T) => U;
  None: () => U;
}

// ============================================================================
// Option Class
// ============================================================================

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

  // ==========================================================================
  // Static Constructors
  // ==========================================================================

  /** Singleton None instance */
  static readonly None: Option<never> = new Option(
    NONE_VAL as never,
    { promiseNoneSlot: true },
    "None",
  );

  /** Create a Some containing the given value */
  static Some<Inner>(val: Inner): Option<Inner> {
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

  // ==========================================================================
  // Static Combinators
  // ==========================================================================

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

  // ==========================================================================
  // State Inspection
  // ==========================================================================

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

  // ==========================================================================
  // Value Extraction
  // ==========================================================================

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

  // ==========================================================================
  // Transformation Methods
  // ==========================================================================

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

  filter(pred: Predicate<T>): Option<T>;
  filter(pred: AsyncPredicate<T>): Option<Promise<T>>;
  filter(
    pred: Predicate<T> | AsyncPredicate<T>,
  ): Option<T> | Option<Promise<T>> {
    if (this.isNone()) return Option.None;

    const curr = this.#val;

    if (isPromiseLike(curr)) {
      const p = curr as Promise<T>;
      const newCtx: OptionCtx = { promiseNoneSlot: false };
      const next = p.then(async (v) => {
        if (v === NONE_VAL) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }
        const passed = await pred(v);
        if (!passed) {
          newCtx.promiseNoneSlot = true;
          return NONE_VAL;
        }
        return v;
      }) as Promise<T>;
      return new Option(next, newCtx, "Some");
    }

    const result = pred(curr as T);

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

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

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
    return `Option::Some(${this.#val})`;
  }
}
