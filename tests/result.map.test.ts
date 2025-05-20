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
const asyncDoubleIt = async (n: number) => n * 2;

const errResIt = (_n: number) => Result.Err(new DummyError());
const asyncErrResIt = async (_n: number) => Result.Err(new DummyError());

describe("Result.map behavior", () => {
  it("should transform an Ok value that is a Promise asynchronously", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(asyncDoubleIt);
    const mapped = await r.map(mockerA).map(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value that is a Promise asynchronously", async (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(asyncDoubleIt);
    const mapped = await r.map(mockerA).map(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.equal(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should transform an Ok value that is a Promise synchronously", async (t) => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(doubleIt);
    const mapped = await r.map(mockerA).map(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value that is a Promise synchronously", (t) => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(doubleIt);
    const mapped = r.map(mockerA).map(mockerB);

    assert.ok(mapped.isErr());
    assert.equal(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should transform an Ok value asynchronously", async (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(asyncDoubleIt);
    const mapped = await r.map(mockerA).map(mockerB).toPromise();

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value asynchronously", async (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(asyncDoubleIt);
    const mapped = await r.map(mockerA).map(mockerB).toPromise();

    assert.ok(mapped.isErr());
    assert.equal(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should transform an Ok value synchronously", (t) => {
    const r = Result.Ok(2);
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(doubleIt);
    const mapped = r.map(mockerA).map(mockerB);

    assert.ok(mapped.isOk());
    assert.strictEqual(mapped.unwrap(), 8);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should not transform an Err value synchronously", (t) => {
    const r = Result.Err(new DummyError());
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(doubleIt);
    const mapped = r.map(mockerA).map(mockerB);

    assert.ok(mapped.isErr());
    assert.equal(mapped.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should not call mappers if starting from Err", (t) => {
    const mockerA = t.mock.fn(doubleIt);
    const mockerB = t.mock.fn(doubleIt);

    const r = Result.Err(new DummyError());
    const mapped = r.map(mockerA).map(mockerB);

    assert.ok(mapped.isErr());
    assert.throws(() => mapped.unwrap(), DummyError);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should not call mappers if starting from Err (async)", (t) => {
    const mockerA = t.mock.fn(asyncDoubleIt);
    const mockerB = t.mock.fn(asyncDoubleIt);

    const r = Result.Err(new DummyError());
    const mapped = r.map(mockerA).map(mockerB);

    assert.ok(mapped.isErr());
    assert.throws(() => mapped.unwrap(), DummyError);
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const r = Result.Ok(2);
      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(doubleIt);
      const mockerC = t.mock.fn(errResIt);
      const r1 = r.map(mockerA);
      const r2 = r.map(mockerB);
      const r3 = r.flatMap(mockerC);

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isOk());
      assert.ok(r3.isErr());
      assert.strictEqual(r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.strictEqual(r2.unwrap(), 4);
      assert.throws(() => r3.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const r = Result.Ok(2);
      const mockerA = t.mock.fn(asyncDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);
      const mockerC = t.mock.fn(asyncErrResIt);
      const r1 = await r.map(mockerA).toPromise();
      const r2 = await r.map(mockerB).toPromise();
      const r3 = await r.flatMap(mockerC).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isOk());
      assert.ok(r3.isErr());
      assert.strictEqual(r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.strictEqual(r2.unwrap(), 4);
      assert.throws(() => r3.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation starting from Promise should not affect parent or each other", async (t) => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(doubleIt);
      const mockerC = t.mock.fn(errResIt);
      const r1 = await r.map(mockerA).toPromise();
      const r2 = await r.map(mockerB).toPromise();
      const r3 = await r.flatMap(mockerC).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isOk());
      assert.ok(r3.isErr());
      assert.strictEqual(await r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.strictEqual(r2.unwrap(), 4);
      assert.throws(() => r3.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async (t) => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = t.mock.fn(asyncDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);
      const mockerC = t.mock.fn(asyncErrResIt);
      const r1 = await r.map(mockerA).toPromise();
      const r2 = await r.map(mockerB).toPromise();
      const r3 = await r.flatMap(mockerC).toPromise();

      assert.ok(r.isOk());
      assert.ok(r1.isOk());
      assert.ok(r2.isOk());
      assert.ok(r3.isErr());
      assert.strictEqual(await r.unwrap(), 2);
      assert.strictEqual(r1.unwrap(), 4);
      assert.strictEqual(r2.unwrap(), 4);
      assert.throws(() => r3.unwrap(), DummyError);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });
  });

  describe("permutations", () => {
    it("P1", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);

      const mapped = await r.map(mockerA).map(mockerB).toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 8);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
    it("P2", async (t) => {
      const r = Result.Ok(2);

      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);

      const mapped = await r.map(mockerB).map(mockerA).toPromise();

      assert.ok(mapped.isOk());
      assert.strictEqual(mapped.unwrap(), 8);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
  });
});
