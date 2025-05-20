import { isPromise } from "node:util/types";
import { UNIT } from "./unit.js";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;

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

type OptionCtx = { promiseNoneSlot: boolean };
type FlatMapper<T, U> = (val: T) => Option<U>;
type AsyncFlatMapper<T, U> = (val: T) => Promise<Option<U>>;

export class Option<T> {
  readonly #ctx: OptionCtx;

  private constructor(
    private val: T,
    ctx: OptionCtx,
  ) {
    this.#ctx = ctx;
  }

  static readonly None: Option<never> = new Option(NONE_VAL, {
    promiseNoneSlot: true,
  }) as Option<never>;

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

  static Some<Inner>(val: Inner): Option<Inner> {
    return new Option(val, { promiseNoneSlot: false });
  }

  static fromNullable<T, Out = NonNullable<T>>(val: T): Option<Out> {
    return val === null ? Option.None : Option.Some(val as Out);
  }

  isSome(): this is Option<T> {
    return this.val !== NONE_VAL;
  }

  isNone(): this is Option<never> {
    return (
      this.val === NONE_VAL ||
      (isPromise(this.val) && this.#ctx.promiseNoneSlot)
    );
  }

  isUnit(): this is Option<UNIT> {
    return this.val === UNIT;
  }

  unwrap(): T {
    if (this.isNone()) {
      throw UNWRAPPED_NONE_ERR;
    }

    return this.val;
  }

  safeUnwrap(): T | null {
    if (this.isNone()) return null;

    return this.val;
  }

  map<U, Curr = Awaited<T>>(mapper: (val: Curr) => U): Option<U>;
  map<U, Curr = Awaited<T>>(
    mapper: (val: Curr) => Promise<U>,
  ): Option<Promise<U>>;
  map<U, Curr = Awaited<T>>(
    mapper: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ) {
    if (this.isNone()) return Option.None;

    const ctx = this.#ctx;

    const curr = this.val;
    if (isPromise(curr)) {
      // this promise may return an option, but we'll treat the returned value as the inner type, and won't force flatMap semantics
      // it's up to the caller to choose the correct mapper
      const p = curr as Promise<Curr>;
      const safetlyMapped = Option.safeMap(p, mapper, ctx);
      return new Option(safetlyMapped, ctx);
    }

    const transformed = mapper(curr as unknown as Curr);
    return new Option(transformed, ctx);
  }

  mapOr<U, Curr = Awaited<T>>(default_: U, fn: (val: Curr) => U): Option<U>;
  mapOr<U, Curr = Awaited<T>>(
    default_: U,
    fn: (val: Curr) => Promise<U>,
  ): Option<Promise<U>>;
  mapOr<U, Curr = Awaited<T>>(
    default_: U,
    mapper: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ) {
    if (this.isNone()) return new Option(default_, this.#ctx);

    const ctx = this.#ctx;
    const curr = this.val;

    if (isPromise(curr)) {
      const p = curr as Promise<Curr>;
      const safetlyMapped = Option.safeMap(p, mapper, ctx);
      return new Option(safetlyMapped, ctx);
    }

    const transformed = mapper(curr as unknown as Curr);
    return new Option(transformed, ctx);
  }

  flatMap<U, Curr = Awaited<T>>(mapper: (val: Curr) => Option<U>): Option<U>;
  flatMap<U, Curr = Awaited<T>>(
    mapper: (val: Curr) => Promise<Option<U>>,
  ): Option<Promise<U>>;
  flatMap<U, Curr = Awaited<T>>(
    mapper: FlatMapper<NoInfer<Curr>, U> | AsyncFlatMapper<NoInfer<Curr>, U>,
  ): Option<U> | Option<Promise<U>> {
    if (this.isNone()) return Option.None;

    const ctx = this.#ctx;
    const curr = this.val;
    if (isPromise(curr)) {
      const p = curr as Promise<Curr>;
      const castedNone = NONE_VAL as unknown as Promise<U>;
      const newP = new Promise<U>((resolve, reject) => {
        p.then((curr) => {
          if (curr === NONE_VAL) {
            // ensure that Option transitions to a NONE slot and doesn't enqueue any more operations
            ctx.promiseNoneSlot = true; // not required, but makes subsequent checks faster due to ctx being shared across the computation chain
            resolve(castedNone);
          } else {
            // Call mapper only if the previous async computation didn't lead to None state
            const r = mapper(curr);
            if (isPromise(r)) {
              r.then((innerOpt) => resolve(innerOpt.val), reject);
            } else {
              resolve(r.val);
            }
          }
        });
      });
      return new Option(newP, ctx);
    }

    const mapped = mapper(curr as unknown as Curr);
    if (isPromise(mapped)) {
      return Option.fromPromise(mapped);
    }
    return mapped;
  }

  zip<U, Curr>(
    this: Option<Promise<Curr>>,
    fn: (val: Curr) => U,
  ): Option<Promise<[Curr, U]>>;
  zip<U, Curr>(
    this: Option<Curr>,
    fn: (val: Curr) => Promise<U>,
  ): Option<Promise<[T, U]>>;
  zip<U, Curr>(this: Option<Curr>, fn: (val: Curr) => U): Option<[T, U]>;
  zip<U, Curr = Awaited<T>>(fn: Mapper<Curr, U> | AsyncMapper<Curr, U>) {
    if (this.isNone()) return Option.None;

    const curr = this.val;
    const ctx = this.#ctx;

    if (isPromise(curr)) {
      const val = curr as Promise<Curr>;

      const p = val.then(async (v) => {
        if (v === NONE_VAL) {
          ctx.promiseNoneSlot = true;
          return NONE_VAL;
        }

        const next = await fn(v);

        return [v, next];
      }) as Promise<[Curr, U]>;

      return new Option(p, ctx);
    }

    // Curr is normal value, mapper can return promise
    const u = fn(curr as unknown as Curr);
    if (isPromise(u)) {
      const p = u.then((uu) => [curr, uu] as [T, U]);
      return new Option(p, ctx);
    }

    return new Option([curr, u], ctx);
  }

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

    const curr = this.val;
    const ctx = this.#ctx;

    if (isPromise(curr)) {
      const val = curr as Promise<Curr>;

      const p = val.then(async (v) => {
        if (v === NONE_VAL) {
          ctx.promiseNoneSlot = true;
          return NONE_VAL;
        }

        const next = await fn(v);
        if (next.isNone()) {
          return NONE_VAL;
        }
        return [v, next.val] as [Curr, U];
      }) as Promise<[Curr, U]>;

      return new Option(p, ctx);
    }

    // Curr is normal value, mapper can return promise
    const c = curr as unknown as Curr;
    const u = fn(c);
    if (isPromise(u)) {
      const p = u.then((uu) => {
        if (uu.isNone()) {
          return NONE_VAL;
        }
        return [c, uu.val] as [Curr, U];
      });
      return new Option(p, ctx);
    }

    return u.map((inner) => [c, inner]);
  }

  async toPromise<Curr = Awaited<T>>(): Promise<Option<Curr>> {
    const curr = this.val;

    let inner: Curr;
    if (isPromise(curr)) {
      const awaited = await curr;
      inner = awaited as Curr;
    } else {
      inner = curr as unknown as Curr;
    }

    return new Option(inner, this.#ctx);
  }

  static fromPromise<U>(o: Promise<Option<U>>): Option<Promise<U>> {
    // while this may look okay, it doesn't take care of cases where the promise returns None
    // should treat it as flatMap on Unit Option
    const ctx: OptionCtx = { promiseNoneSlot: false };
    const p = new Promise<U>((resolve, reject) =>
      o.then((innerOpt) => {
        // only changes if this new opt returned none
        ctx.promiseNoneSlot ||= innerOpt.#ctx.promiseNoneSlot;
        resolve(innerOpt.val);
      }, reject),
    );

    return new Option(p, ctx);
  }

  toString(): string {
    if (this.isNone()) return "Option::None";

    return `Option::Some(${this.val})`;
  }

  innerMap<Inner, Out>(
    this: Option<Array<Inner>>,
    mapper: (val: Inner) => Out,
  ): Option<NoInfer<Out>[]> {
    if (this.isNone()) return Option.None;

    if (!Array.isArray(this.val)) {
      throw new Error("Can only be called for Option<Array<T>>");
    }

    return new Option(this.val.map(mapper), this.#ctx);
  }
}
