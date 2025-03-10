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
const tupleDoubleIt = (n: [number, number]) => n.map(doubleIt);

const asyncDoubleIt = async (n: number) => n * 2;
const tupleAsyncDoubleIt = async (n: [number, number]) => n.map(doubleIt);

describe("zip behavior", () => {
  it("should transform an Ok value that is a Promise asynchronously", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleIt);
    const zipped = await r.zip(mockerA).zip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value that is a Promise asynchronously", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleIt);
    const zipped = await r.zip(mockerA).zip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.equal(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should transform an Ok value that is a Promise synchronously", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(tupleDoubleIt);
    const zipped = await r.zip(mockerA).zip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value that is a Promise synchronously", (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(tupleDoubleIt);
    const zipped = r.zip(mockerA).zip(mockerB);

    assert.ok(zipped.isErr());
    assert.equal(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should transform an Ok value asynchronously", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleIt);
    const zipped = await r.zip(mockerA).zip(mockerB).toPromise();

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value asynchronously", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleIt);
    const zipped = await r.zip(mockerA).zip(mockerB).toPromise();

    assert.ok(zipped.isErr());
    assert.equal(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should transform an Ok value synchronously", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(tupleDoubleIt);
    const zipped = r.zip(mockerA).zip(mockerB);

    assert.ok(zipped.isOk());
    assert.deepStrictEqual(zipped.unwrap(), [
      [2, 4],
      [4, 8],
    ]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value synchronously", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(tupleDoubleIt);
    const zipped = r.zip(mockerA).zip(mockerB);

    assert.ok(zipped.isErr());
    assert.equal(zipped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should not call mappers if starting from Err", (t) => {
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(tupleDoubleIt);

    const r = Result.Err(new DummyError());
    const zipped = r.zip(mockerA).zip(mockerB);

    assert.ok(zipped.isErr());
    assert.throws(() => zipped.unwrap(), DummyError);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should not call mappers if starting from Err (async)", (t) => {
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(tupleAsyncDoubleIt);

    const r = Result.Err(new DummyError());
    const zipped = r.zip(mockerA).zip(mockerB);

    assert.ok(zipped.isErr());
    assert.throws(() => zipped.unwrap(), DummyError);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  describe("permutations", () => {
    it("P1", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(tupleAsyncDoubleIt);

      const mapped = await r.zip(mockerA).zip(mockerB).toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), [
        [2, 4],
        [4, 8],
      ]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
    it("P2", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(tupleDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);

      const mapped = await r.zip(mockerB).zip(mockerA).toPromise();

      assert.ok(mapped.isOk());
      assert.deepStrictEqual(mapped.unwrap(), [
        [2, 4],
        [4, 8],
      ]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
  });
});
