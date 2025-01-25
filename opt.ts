import { isPromise } from "node:util/types";
import { setTimeout } from "node:timers/promises";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type FlatMapper<T, U> = (val: T) => Option<U>;
type AsyncFlatMapper<T, U> = (val: T) => Promise<Option<U>>;

type MapperArg<T, U> = Mapper<T, U> | AsyncMapper<T, U>;

type MapperReturn<Curr, Next> = Curr extends Promise<unknown>
  ? Option<Promise<Awaited<Next>>>
  : Option<Next>;

type OptionCtx = { promiseNoneSlot: boolean };

const NONE_VAL = Symbol.for("None");
class Option<T> {
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

  static Some<Inner>(val: Inner): Option<Inner> {
    return new Option(val, { promiseNoneSlot: false });
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

  safeUnwrap(): T | null {
    if (this.val !== NONE_VAL) return this.val;

    return null;
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
      const safetlyMapped = p.then((v) =>
        v === NONE_VAL ? NONE_VAL : mapper(v),
      ) as Promise<U>;
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
            ctx.promiseNoneSlot = true;
            resolve(castedNone);
          } else {
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
}

const print = console.debug;

const sq = (n: number) => `sq: ${n}`;
const asq = async (n: number) => `asq: ${n}`;

const strToNum = (s: string) => s.length;
const strToNumAsync = async (s: string) => s.length;

const gen = async (n: number) => n;

// const nonGeneratingPromise: Promise<Option<number>> = Promise.resolve(
//   Option.None,
// );
// const noComp = Option.fromPromise(nonGeneratingPromise).map((v) => {
//   console.log("Shouldn't log");
//
//   return v.toString();
// });
// print(noComp);

const leadsToNone = async (_: number): Promise<Option<number>> => {
  print("leading to none");
  return Option.None;
};
const shouldntLogFlatMap = async (n: number): Promise<Option<number>> => {
  console.debug("logged flatMap after none");

  return Option.Some(n * 2);
};

const o = Option.Some(3)
  .map(sq)
  .flatMap(leadsToNone)
  .flatMap(shouldntLogFlatMap)
  .map((v) => {
    print(v);
    console.debug("logged map after none");

    return v * 2;
  });

await setTimeout(1000);
print(o.isNone());
console.debug(await o.toPromise());
