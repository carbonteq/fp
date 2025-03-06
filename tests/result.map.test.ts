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

describe("map behavior", () => {
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
});
