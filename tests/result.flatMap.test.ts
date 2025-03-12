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
const errResIt = (_n: number) => Result.Err(new DummyError());

const asyncDoubleResIt = async (n: number) => Result.Ok(doubleIt(n));
const asyncErrResIt = async (_n: number) => Result.Err(new DummyError());

const doubleResPromiseIt = (n: number) =>
  Result.Ok(Promise.resolve(doubleIt(n)));
const errResPromiseIt = (_n: number) =>
  Result.Err(Promise.resolve(new DummyError()));

const asyncDoubleResPromiseIt = async (n: number) =>
  Result.Ok(Promise.resolve(doubleIt(n)));
const asyncErrResPromiseIt = async (_n: number) =>
  Result.Err(Promise.resolve(new DummyError()));

describe("Result.flatMap behavior", () => {
  it("should apply Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncDoubleResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncDoubleResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(doubleResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(doubleResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = t.mock.fn(doubleResIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<T, E> on Result<Promise<T>, E> correctly", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(doubleResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<Promise<T>, E>", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<T, E> on Result<T, Promise<E>> correctly", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(doubleResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, Promise<E>>", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncDoubleResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncErrResPromiseIt);
    const mockerB = t.mock.fn(asyncDoubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncDoubleResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(asyncDoubleResIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncDoubleResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncErrResIt);
    const mockerB = t.mock.fn(asyncDoubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockedDouble).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(doubleResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(doubleResPromiseIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(errResPromiseIt);
    const mockerB = t.mock.fn(doubleResPromiseIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Ok(2);
    const mockedDouble = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 4);
    assert.strictEqual(mockedDouble.mock.callCount(), 1);
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(doubleResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should apply Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Err(new DummyError());
    const mockedDouble = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockedDouble);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockedDouble.mock.callCount(), 0);
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(errResIt);
    const mockerB = t.mock.fn(doubleResIt);
    const mapped = r.flatMap(mockerA).flatMap(mockerB);

    assert.ok(mapped.isErr());
    assert.strictEqual(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const r = Result.Ok(2);
      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(errResIt);
      const r1 = r.flatMap(mockerA);
      const r2 = r.flatMap(mockerB);

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const r = Result.Ok(2);
      const mockerA = t.mock.fn(asyncDoubleResIt);
      const mockerB = t.mock.fn(asyncErrResIt);
      const r1 = await r.flatMap(mockerA).toPromise();
      const r2 = await r.flatMap(mockerB).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other", async (t) => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(errResIt);
      const r1 = await r.flatMap(mockerA).toPromise();
      const r2 = await r.flatMap(mockerB).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(await r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other (async)", async (t) => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = t.mock.fn(asyncDoubleResIt);
      const mockerB = t.mock.fn(asyncErrResIt);
      const r1 = await r.flatMap(mockerA).toPromise();
      const r2 = await r.flatMap(mockerB).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isErr());
      assert.strictEqual(await r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.throws(() => r2.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
  });

  describe("permutations", () => {
    it("P1", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P2", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P3", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P4", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P5", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P6", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .flatMap(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P7", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P8", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P9", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P10", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P11", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P12", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P13", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P14", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P15", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P16", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P17", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P18", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P19", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P20", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P21", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P22", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P23", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
    it("P24", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleResIt);
      const mockerB = t.mock.fn(asyncDoubleResIt);
      const mockerC = t.mock.fn(doubleResPromiseIt);
      const mockerD = t.mock.fn(asyncDoubleResPromiseIt);

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 32);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
      assert.strictEqual(mockerD.mock.callCount(), 1);
    });
  });
});
