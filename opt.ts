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

  map<U, Curr = Awaited<T>>(mapper: (val: Curr) => U): Option<U>;
  map<U, Curr = Awaited<T>>(
    mapper: (val: Curr) => Promise<U>,
  ): Option<Promise<U>>;
  map<U, Curr = Awaited<T>>(
    mapper: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ) {
    if (this.isNone()) return Option.None;

    const curr = this.val;
    if (isPromise(curr)) {
      const p = curr as Promise<Curr>;
      return new Option(p.then(mapper));
    }

    const transformed = mapper(curr as unknown as Curr);
    return new Option(transformed);
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

  static fromPromise<U>(o: Promise<Option<U>>): Option<Promise<U>> {
    const p = new Promise<U>((resolve, reject) =>
      o.then((innerOpt) => resolve(innerOpt.val), reject),
    );

    return new Option(p);
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

const a = Option.Some(3);
const b = Option.Some(gen(3));

print("a", a);
print("b", b);

const awaitedB = await b;
print("awaited b", awaitedB);

const a_sq = a.map(sq);
print("a_sq", a_sq);
const a_asq = a.map(asq).map(strToNum);
print("a_asq", a_asq);

const b_sq = b.map(sq).map(strToNumAsync).map(sq);
print("b_sq", b_sq);
const b_asq = await b.map(asq).map(sq).map(asq).toPromise();
print("b_asq", b_asq);

await b_sq.val;
await b_asq.val;

print("b_sq", b_sq);
print("b_asq", b_asq);

const waitSecs = (secs: number) =>
  setTimeout(secs * 1000, `after waiting ${secs} secs`);
const c = Option.Some(42);
const d = Option.Some(waitSecs(2));
// print(await c);
print(await c.toPromise());
// print(await d);
print(await d.toPromise());
print("async safe unwrap:", d.safeUnwrap());
print("async safe unwrap:", await d.safeUnwrap());

print(b_asq.toPromise());
print(await b_asq.toPromise());

const nonGeneratingPromise: Promise<Option<number>> = Promise.resolve(
  Option.None,
);
const noComp = Option.fromPromise(nonGeneratingPromise).map((v) => {
  console.log("Shouldn't log");

  return v.toString();
});
print(noComp);
