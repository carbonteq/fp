import { Option } from "./dist/option.mjs";

const o1: Option<number> = Option.Some(42);
const o2: Option<string> = Option.None;
const o3 = Option.fromNullable<number | null>(null);
const o4 = Option.fromNullable("not null");
const o5: Option<number> = Option.fromFalsy(0);
const o6: Option<number> = Option.fromFalsy(100);
const o7 = Option.fromPredicate(50, (n) => n > 25);
const o8 = Option.fromPredicate(10, (n) => n > 25);

console.log("=== Basic Option creation ===");
console.log("o1 (Some 42):", o1._tag, o1.safeUnwrap());
console.log("o2 (None):", o2._tag, o2.safeUnwrap());
console.log("o3 (fromNullable null):", o3._tag, o3.safeUnwrap());
console.log("o4 (fromNullable 'not null'):", o4._tag, o4.safeUnwrap());
console.log("o5 (fromFalsy 0):", o5._tag, o5.safeUnwrap());
console.log("o6 (fromFalsy 100):", o6._tag, o6.safeUnwrap());
console.log("o7 (fromPredicate 50 > 25):", o7._tag, o7.safeUnwrap());
console.log("o8 (fromPredicate 10 > 25):", o8._tag, o8.safeUnwrap());

// Basic mapping
const mapped1 = o1.map((n) => n * 2);
const mapped2 = o1.map((n) => String(n));
const mapped3 = o2.map((n) => `${n} * 2`);

console.log("\n=== map() ===");
console.log("o1.map(n => n * 2):", mapped1._tag, mapped1.safeUnwrap());
console.log("o1.map(n => String(n)):", mapped2._tag, mapped2.safeUnwrap());
console.log("o2.map(n => n * 2):", mapped3._tag, mapped3.safeUnwrap());

// flatMap
const flatMapped1 = o1.flatMap((n) =>
  n > 20 ? Option.Some(n * 3) : Option.None,
);
const flatMapped2 = o1.flatMap((n) =>
  n < 20 ? Option.Some(n * 3) : Option.None,
);
const flatMapped3 = o2.flatMap((n) => Option.Some(n.length * 3));

console.log("\n=== flatMap() ===");
console.log(
  "o1.flatMap(n => n > 20 ? Some(n * 3) : None):",
  flatMapped1._tag,
  flatMapped1.safeUnwrap(),
);
console.log(
  "o1.flatMap(n => n < 20 ? Some(n * 3) : None):",
  flatMapped2._tag,
  flatMapped2.safeUnwrap(),
);
console.log(
  "o2.flatMap(n => Some(n * 3)):",
  flatMapped3._tag,
  flatMapped3.safeUnwrap(),
);

// zip
const zipped1 = o1.zip((n) => n * 10);
const zipped2 = o1.zip((n) => String(n));
const zipped3 = o2.zip((n) => n.length * 10);

console.log("\n=== zip() ===");
console.log("o1.zip(n => n * 10):", zipped1._tag, zipped1.safeUnwrap());
console.log("o1.zip(n => String(n)):", zipped2._tag, zipped2.safeUnwrap());
console.log("o2.zip(n => n * 10):", zipped3._tag, zipped3.safeUnwrap());

// flatZip
const flatZipped1 = o1.flatZip((n) =>
  n > 20 ? Option.Some(n * 10) : Option.None,
);
const flatZipped2 = o1.flatZip((n) =>
  n < 20 ? Option.Some(n * 10) : Option.None,
);
const flatZipped3 = o3.flatZip((n) => Option.Some(n * 10));

console.log("\n=== flatZip() ===");
console.log(
  "o1.flatZip(n => n > 20 ? Some(n * 10) : None):",
  flatZipped1._tag,
  flatZipped1.safeUnwrap(),
);
console.log(
  "o1.flatZip(n => n < 20 ? Some(n * 10) : None):",
  flatZipped2._tag,
  flatZipped2.safeUnwrap(),
);
console.log(
  "o2.flatZip(n => Some(n * 10)):",
  flatZipped3._tag,
  flatZipped3.safeUnwrap(),
);

// Option.all
const all1 = Option.all(o1, o4, o6);
const all2 = Option.all(o1, o2, o6);

console.log("\n=== Option.all() ===");
console.log("Option.all(o1, o4, o6):", all1._tag, all1.safeUnwrap());
console.log("Option.all(o1, o2, o6):", all2._tag, all2.safeUnwrap());

// Option.any
const any1 = Option.any(o1, o3);
const any2 = Option.any(o2, o4);

console.log("\n=== Option.any() ===");
console.log("Option.any(o1, o2):", any1._tag, any1.safeUnwrap());
console.log("Option.any(o2, o2):", any2._tag, any2.safeUnwrap());

// Async operations
const asyncO1 = Option.Some(Promise.resolve(42));
const asyncO2 = Option.Some(Promise.resolve(10));

const asyncRes = await Option.asyncGen(async function* () {
  const val1 = yield* o1;
  const val2 = yield* o4;
  const val3 = yield* asyncO1;
  const val4 = yield* asyncO2;

  return {
    val1,
    val2,
    val3,
    val4,
  };
});

console.log("\n=== Option.asyncGen ===");
console.log("asyncGen result:", asyncRes._tag, asyncRes.safeUnwrap());

const asyncResAdapter = await Option.asyncGenAdapter(async function* ($) {
  const val1 = yield* $(o1);
  const val2 = yield* $(o4);
  const val3 = yield* $(asyncO1);
  const val4 = yield* $(asyncO2);

  return {
    val1,
    val2,
    val3,
    val4,
  };
});

console.log("\n=== Option.asyncGenAdapter ===");
console.log(
  "asyncGenAdapter result:",
  asyncResAdapter._tag,
  asyncResAdapter.safeUnwrap(),
);

// Option.gen (simplified)
const genRes = Option.gen(function* () {
  const val1 = yield* o1;
  const val2 = yield* o4;
  const val3 = yield* o6;

  return {
    val1,
    val2,
    val3,
  };
});

console.log("\n=== Option.gen ===");
console.log("gen result:", genRes._tag, genRes.safeUnwrap());

// Option.genAdapter
const genAdapterRes = Option.genAdapter(function* ($) {
  const val1 = yield* $(o1);
  const val2 = yield* $(o4);
  const val3 = yield* $(o6);

  return {
    val1,
    val2,
    val3,
  };
});

console.log("\n=== Option.genAdapter ===");
console.log(
  "genAdapter result:",
  genAdapterRes._tag,
  genAdapterRes.safeUnwrap(),
);

// map with async mapper on Option<Promise<T>>
const asyncMap1 = asyncO1.map(async (n) => n * 2);
const asyncMap2 = await asyncMap1.toPromise();

console.log("\n=== map with async mapper ===");
console.log(
  "Option.Some(Promise.resolve(42)).map(async n => n * 2):",
  asyncMap2._tag,
  asyncMap2.safeUnwrap(),
);

// match
const matched1 = o1.match({
  Some: (val) => `Value is ${val}`,
  None: () => "No value",
});
const matched2 = o2.match({
  Some: (val) => `Value is ${val}`,
  None: () => "No value",
});

console.log("\n=== match() ===");
console.log(
  // biome-ignore lint/suspicious/noTemplateCurlyInString: false positive
  "o1.match({ Some: v => `Value is ${v}`, None: () => 'No value' }):",
  matched1,
);
console.log(
  // biome-ignore lint/suspicious/noTemplateCurlyInString: false positive
  "o2.match({ Some: v => `Value is ${v}`, None: () => 'No value' }):",
  matched2,
);

// unwrapOr
const unwrapped1 = o1.unwrapOr(0);
const unwrapped2 = o5.unwrapOr(0);

console.log("\n=== unwrapOr() ===");
console.log("o1.unwrapOr(0):", unwrapped1);
console.log("o2.unwrapOr(0):", unwrapped2);

// unwrapOrElse
const unwrappedOrElse1 = o1.unwrapOrElse(() => 999);
const unwrappedOrElse2 = o3.unwrapOrElse(() => 999);

console.log("\n=== unwrapOrElse() ===");
console.log("o1.unwrapOrElse(() => 999):", unwrappedOrElse1);
console.log("o2.unwrapOrElse(() => 999):", unwrappedOrElse2);

// toResult
const result1 = o1.toResult("Error occurred");
const result2 = o2.toResult("Error occurred");

console.log("\n=== toResult() ===");
console.log(
  "o1.toResult('Error occurred'):",
  result1._tag,
  result1.safeUnwrap(),
);
console.log(
  "o2.toResult('Error occurred'):",
  result2._tag,
  result2.unwrapErr(),
);

// filter
const filtered1 = o1.filter((n) => n > 20);
const filtered2 = o1.filter((n) => n < 20);
const filtered3 = o2.filter((n) => n.length > 20);

console.log("\n=== filter() ===");
console.log("o1.filter(n => n > 20):", filtered1._tag, filtered1.safeUnwrap());
console.log("o1.filter(n => n < 20):", filtered2._tag, filtered2.safeUnwrap());
console.log("o2.filter(n => n > 20):", filtered3._tag, filtered3.safeUnwrap());

// tap
console.log("\n=== tap() ===");
o1.tap((val) => console.log("Tapped o1:", val));
o2.tap((val) => console.log("Tapped o2:", val));

// innerMap
const arrayOfOpts = Option.Some([1, 2, 3, 4, 5]);
const innerMapped = arrayOfOpts.innerMap((n) => n * 2);

console.log("\n=== innerMap() ===");
console.log(
  "Option.Some([1, 2, 3, 4, 5]).innerMap(n => n * 2):",
  innerMapped._tag,
  innerMapped.safeUnwrap(),
);

// toString
console.log("\n=== toString() ===");
console.log("o1.toString():", o1.toString());
console.log("o2.toString():", o2.toString());
