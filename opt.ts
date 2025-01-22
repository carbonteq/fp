import { isPromise } from "node:util/types";
import { setTimeout } from "node:timers/promises";

type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type MapperArg<T, U> = Mapper<T, U> | AsyncMapper<T, U>;

type MapperReturn<Curr, Next> = Curr extends Promise<unknown>
  ? Option<Promise<Awaited<Next>>>
  : Option<Next>;

type ABC = MapperReturn<Promise<number>, string>;
type ABC2 = MapperReturn<number, string>;

class Option<T> {
  constructor(readonly val: T) {}

  map<U, Curr = Awaited<T>>(mapper: (val: Curr) => U): MapperReturn<T, U>;
  map<U, Curr = Awaited<T>>(
    mapper: (val: Curr) => Promise<U>,
  ): Option<Promise<U>>;
  map<U, Curr = Awaited<T>>(
    mapper: Mapper<NoInfer<Curr>, U> | AsyncMapper<NoInfer<Curr>, U>,
  ) {
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
}

const print = console.debug;

const sq = (n: number) => `sq: ${n}`;
const asq = async (n: number) => `asq: ${n}`;

const strToNum = (s: string) => s.length;
const strToNumAsync = async (s: string) => s.length;

const gen = async (n: number) => n;

const a = new Option(3);
const b = new Option(gen(3));

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
const c = new Option(42);
const d = new Option(waitSecs(2));
print(await c);
print(await c.awaitable());
print(await d);
print(await d.awaitable());
