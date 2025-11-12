import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  Result,
  UnwrappedErrWithOk,
  UnwrappedOkWithErr,
} from "@/result.hybrid.js";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

describe("Hybrid Result construction", () => {
  it("creates an Ok result synchronously", () => {
    const r = Result.Ok(42);

    assert.strictEqual(r.unwrap(), 42);
    assert.strictEqual(r.isOk(), true);
    assert.strictEqual(r.isErr(), false);
  });

  it("creates an Err result synchronously", () => {
    const r = Result.Err(new DummyError());

    assert.throws(() => r.unwrap(), DummyError);
    assert.strictEqual(r.isOk(), false);
    assert.strictEqual(r.isErr(), true);
  });

  it("wraps async Ok values and exposes them via promises", async () => {
    const r = Result.Ok(Promise.resolve(21));

    const asyncValue = r.unwrap();
    assert.ok(asyncValue instanceof Promise);
    assert.strictEqual(await asyncValue, 21);
  });

  it("wraps async Err values and exposes them via promises", async () => {
    const err = new DummyError();
    const r = Result.Err(Promise.resolve(err));

    const asyncErr = r.unwrapErr();
    assert.ok(asyncErr instanceof Promise);
    await assert.rejects(async () => r.unwrap(), DummyError);
    assert.strictEqual(await asyncErr, err);
  });
});

describe("Hybrid Result unwrapping behaviour", () => {
  it("throws UnwrappedOkWithErr when unwrapping Err synchronously", () => {
    const r = Result.Err("boom");

    assert.throws(() => r.unwrap(), UnwrappedOkWithErr);
  });

  it("throws UnwrappedErrWithOk when unwrapping Ok error synchronously", () => {
    const r = Result.Ok("ok");

    assert.throws(() => r.unwrapErr(), UnwrappedErrWithOk);
  });

  it("safeUnwrap returns null for Err", () => {
    const r = Result.Err(new DummyError());

    assert.strictEqual(r.safeUnwrap(), null);
  });

  it("toPromise resolves to a settled Result", async () => {
    const r = Result.Ok(Promise.resolve(10));
    const settled = await r.toPromise();

    assert.strictEqual(settled.unwrap(), 10);
  });

  it("toPromise preserves Err state", async () => {
    const err = new DummyError();
    const r = Result.Err(Promise.resolve(err));
    const settled = await r.toPromise();

    assert.strictEqual(settled.unwrapErr(), err);
  });
});

describe("Hybrid Result flip", () => {
  it("flips synchronous values", () => {
    const r = Result.Ok(1).flip();

    assert.strictEqual(r.unwrapErr(), 1);
  });

  it("flips asynchronous values", async () => {
    const r = Result.Ok(Promise.resolve(5)).flip();

    await assert.rejects(async () => r.unwrap(), UnwrappedOkWithErr);
    const errVal = await r.unwrapErr();
    assert.strictEqual(errVal, 5);
  });
});
