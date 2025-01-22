import { isPromise } from "node:util/types";
import { setTimeout } from "node:timers/promises";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type MapperArg<T, U> = Mapper<T, U> | AsyncMapper<T, U>;

type MapperReturn<Curr, Next> = Curr extends Promise<unknown>
  ? Option<Promise<Awaited<Next>>>
  : Option<Next>;

const NONE_VAL = Symbol.for("None");
class Option<T> {
  private constructor(readonly val: T) {}

  static readonly None: Option<never> = new Option(NONE_VAL) as Option<never>;

  static Some<Inner>(val: Inner): Option<Inner> {
    return new Option(val);
  }

  isSome(): this is Option<T> {
    return this.val !== NONE_VAL;
  }

  isNone(): this is Option<never> {
    return this.val === NONE_VAL;
  }

  safeUnwrap(): T | null {
    if (this.val !== NONE_VAL) return this.val;

    return null;
  }

  map<U, Curr = Awaited<T>>(mapper: (val: Curr) => U): MapperReturn<T, U>;
  map<U, Curr = Awaited<T>>(
    mapper: (val: Curr) => Promise<U>,
  ): Option<Promise<U>>;
  map<U, Curr = Awaited<T>>(
    mapper: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ) {
    if (this.isNone()) {
      return Option.None;
    }

    const curr = this.val;

    if (isPromise(curr)) {
      const p = curr as Promise<Curr>;
      const newPromise = new Promise<U>((resolve, reject) => {
        const t = p.then(mapper, reject) as Promise<U>;
        resolve(t);
      });
      const opt = new Option(newPromise);
      return opt;
    }

    const transformed = mapper(curr as unknown as Curr);
    if (isPromise(transformed)) {
      return new Option<Promise<U>>(transformed);
    }
    return new Option(transformed);
  }

  awaitable<Curr = Awaited<T>>(): Promise<Curr> {
    const curr = this.val;

    if (isPromise(curr)) return curr as Promise<Curr>;

    return Promise.resolve(curr) as Promise<Curr>;
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

    return new Option(inner);
  }
}

const print = console.debug;

const sq = (n: number) => `sq: ${n}`;
const asq = async (n: number) => `asq: ${n}`;

const strToNum = (s: string) => s.length;
const strToNumAsync = async (s: string) => s.length;

const gen = async (n: number) => n;

const a = Option.Some(3);
const b = Option.Some(gen(3));

print("a", a);
print("b", b);

const a_sq = a.map(sq);
print("a_sq", a_sq);
const a_asq = a.map(asq).map(strToNum);
print("a_asq", a_asq);

const b_sq = b.map(sq).map(strToNumAsync).map(sq);
print("b_sq", b_sq);
const b_asq = b.map(asq).map(sq).map(asq);
print("b_asq", b_asq);

await b_sq.val;
await b_asq.val;

print("b_sq", b_sq);
print("b_asq", b_asq);

print(a_asq.awaitable());

const waitSecs = (secs: number) =>
  setTimeout(secs * 1000, `after waiting ${secs} secs`);
const c = Option.Some(42);
const d = Option.Some(waitSecs(2));
print(await c);
print(await c.awaitable());
print(await d);
print(await d.awaitable());
print("async safe unwrap:", d.safeUnwrap());
print("async safe unwrap:", await d.safeUnwrap());

print(b_asq.toPromise());
print(await b_asq.toPromise());

const noComputation: Option<string> = Option.None;
const empty = noComputation.map(strToNumAsync).map(sq);

print(empty);
print(await empty);
print(await empty.toPromise());
print(empty.safeUnwrap());
