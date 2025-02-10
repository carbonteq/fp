import { isPromise } from "node:util/types";
import { setTimeout } from "node:timers/promises";
import { Option } from "./dist/index.js";

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

const abc = o.zip((n) => n + 2);
const rr = o.flatMap(leadsToNone);
const r3 = rr.zip((n) => n + 2);
