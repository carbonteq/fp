import * as assert from "node:assert";
import { describe, it } from "node:test";
import { Result } from "@/result.js";

class DummyError extends Error {
  constructor() {
    super("dummyErr");
    this.name = "DummyError";
  }
}

const doubleIt = (n: number) => n * 2;

const errResIt = (_n: number) => Result.Err(new DummyError());

const asyncErrResIt = async (_n: number) => Result.Err(new DummyError());

const errResPromiseIt = (_n: number) =>
  Result.Err(Promise.resolve(new DummyError()));

const asyncErrResPromiseIt = async (_n: number) =>
  Result.Err(Promise.resolve(new DummyError()));

type NestedTuple<T> = T | [NestedTuple<T>, NestedTuple<T>];

const recursivelyTransform = <T, R>(
  value: NestedTuple<T>,
  transform: (val: T) => R,
): NestedTuple<R> => {
  if (!Array.isArray(value)) {
    return transform(value as T);
  }

  const [first, second] = value;
  return [
    recursivelyTransform(first, transform),
    recursivelyTransform(second, transform),
  ];
};

const tupleDoubleResIt = (
  value: NestedTuple<number>,
): Result<NestedTuple<number>, unknown> => {
  return Result.Ok(recursivelyTransform(value, doubleIt));
};

const tupleAsyncDoubleResIt = async (
  value: NestedTuple<number>,
): Promise<Result<NestedTuple<number>, unknown>> => {
  return Result.Ok(recursivelyTransform(value, doubleIt));
};

const tupleDoubleResPromiseIt = (
  value: NestedTuple<number>,
): Result<Promise<NestedTuple<number>>, unknown> => {
  return Result.Ok(Promise.resolve(recursivelyTransform(value, doubleIt)));
};

const tupleAsyncDoubleResPromiseIt = async (
  value: NestedTuple<number>,
): Promise<Result<Promise<NestedTuple<number>>, unknown>> => {
  return Result.Ok(Promise.resolve(recursivelyTransform(value, doubleIt)));
};

describe("Result.flatZip behavior", () => {
  it("should apply Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(tupleAsyncDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(tupleAsyncDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(tupleDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(tupleDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<T, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(tupleDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<T, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(tupleDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(tupleAsyncDoubleResIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(tupleAsyncDoubleResIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(tupleDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(tupleDoubleResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(tupleDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(tupleDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(tupleDoubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const r = Result.Ok(2);
      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(errResIt);
      const r1 = r.flatZip(mockerA);
      const r2 = r.flatZip(mockerB);

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(r.unwrap(), 2);
      assert.deepStrictEqual(r1.unwrap(), [2, 4]);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const r = Result.Ok(2);
      const mockerA = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerB = t.mock.fn(asyncErrResIt);
      const r1 = await r.flatZip(mockerA).toPromise();
      const r2 = await r.flatZip(mockerB).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(r.unwrap(), 2);
      assert.deepStrictEqual(r1.unwrap(), [2, 4]);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other", async (t) => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(errResIt);
      const r1 = await r.flatZip(mockerA).toPromise();
      const r2 = await r.flatZip(mockerB).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(await r.unwrap(), 2);
      assert.deepStrictEqual(r1.unwrap(), [2, 4]);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other (async)", async (t) => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerB = t.mock.fn(asyncErrResIt);
      const r1 = await r.flatZip(mockerA).toPromise();
      const r2 = await r.flatZip(mockerB).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(await r.unwrap(), 2);
      assert.deepStrictEqual(r1.unwrap(), [2, 4]);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
  });

  describe("permutations", () => {
    const permResult = [
      [
        [
          [2, 4],
          [4, 8],
        ],
        [
          [4, 8],
          [8, 16],
        ],
      ],
      [
        [
          [4, 8],
          [8, 16],
        ],
        [
          [8, 16],
          [16, 32],
        ],
      ],
    ];
    it("P1", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P2", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P3", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P4", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P5", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P6", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .flatZip(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P7", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P8", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P9", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P10", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P11", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P12", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P13", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P14", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P15", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P16", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P17", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P18", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P19", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P20", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P21", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P22", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P23", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P24", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleResIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleResIt);
      const mockerC = t.mock.fn(tupleDoubleResPromiseIt);
      const mockerD = t.mock.fn(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), permResult);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
  });
});
