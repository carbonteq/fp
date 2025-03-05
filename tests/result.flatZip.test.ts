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

const doubleResIt = (n: number) => Result.Ok(doubleIt(n));
const tupleDoubleResIt = (n: [number, number]) => Result.Ok(n.map(doubleIt));
const errResIt = (_n: number) => Result.Err(new DummyError());

const asyncDoubleResIt = async (n: number) => Result.Ok(doubleIt(n));
const tupleAsyncDoubleResIt = async (n: [number, number]) =>
  Result.Ok(n.map(doubleIt));
const asyncErrResIt = async (_n: number) => Result.Err(new DummyError());

const doubleResPromiseIt = (n: number) =>
  Result.Ok(Promise.resolve(doubleIt(n)));
const tupleDoubleResPromiseIt = (n: [number, number]) =>
  Result.Ok(Promise.resolve(n.map(doubleIt)));
const errResPromiseIt = (_n: number) =>
  Result.Err(Promise.resolve(new DummyError()));

const asyncDoubleResPromiseIt = async (n: number) =>
  Result.Ok(Promise.resolve(doubleIt(n)));
const tupleAsyncDoubleResPromiseIt = async (n: [number, number]) =>
  Result.Ok(Promise.resolve(n.map(doubleIt)));
const asyncErrResPromiseIt = async (_n: number) =>
  Result.Err(Promise.resolve(new DummyError()));

describe("flatZip behavior", () => {
  it("should apply Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
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
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncDoubleResIt);
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
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncDoubleResIt);
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
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(doubleResPromiseIt);
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
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(doubleResPromiseIt);
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
    const mockedDouble = t.mock.fn(doubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<T, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(doubleResIt);
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
    const mockedDouble = t.mock.fn(doubleResIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<T, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(doubleResIt);
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
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
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
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
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
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncDoubleResIt);
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
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncDoubleResIt);
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
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(doubleResPromiseIt);
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
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleResPromiseIt);
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
    const mockedDouble = t.mock.fn(doubleResIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(doubleResIt);
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
    const mockedDouble = t.mock.fn(doubleResIt);
    const zipped = r.flatZip(mockedDouble);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleResIt);
    const mockerB = t.mock.fn(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    assert.ok(zipped.isErr());
    assert.strictEqual(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });
});
