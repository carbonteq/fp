import { Result } from "./dist/result.mjs";

class Err1 extends Error {}
class Err2 extends Error {}
class Err3 extends Error {}
class Err4 extends Error {}

const r1: Result<number, Err1> = Result.Ok(42);
const r2: Result<string, Err2> = Result.Err(new Err2("An error occurred"));
// const r2: Result<string, Err2> = Result.Ok('no error');
const r3 = Result.Ok<null, Err3>(null).map((_) => {
  return `null`;
});

const r4 = Result.Ok<number, Err4>(10).map(async (n) => {
  return n * 2;
});
const promiseRes = async (): Promise<Result<number, Err4>> => {
  console.debug("Running async function");

  return Result.Ok<number, Err4>(20);
};

const res1 = await Result.asyncGen(async function* () {
  const val1 = yield* r1;
  const val2 = yield* r2;
  const val3 = yield* r3;
  const val4 = yield* r4;
  const val5 = yield* await promiseRes();

  return {
    val1,
    val2,
    val3,
    val4,
    val5,
  };
});

console.log(res1._tag, res1.safeUnwrap());
