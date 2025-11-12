import * as assert from "node:assert";
import { describe, it } from "node:test";
import { Result } from "@/result.hybrid.js";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

const double = (n: number) => n * 2;
const asyncDouble = async (n: number) => n * 2;

describe("Hybrid Result.zip", () => {
  it("zips synchronous mapper output", () => {
    const r = Result.Ok(2);
    const zipped = r.zip(double);

    assert.deepStrictEqual(zipped.unwrap(), [2, 4]);
  });

  it("promotes to async when mapper returns a promise", async () => {
    const r = Result.Ok(2);
    const zipped = r.zip(asyncDouble);

    const value = zipped.unwrap();
    assert.ok(value instanceof Promise);
    assert.deepStrictEqual(await value, [2, 4]);
  });

  it("propagates Err without invoking mapper", () => {
    const err = new DummyError();
    const r = Result.Err(err);
    const zipped = r.zip(double);

    assert.strictEqual(zipped.unwrapErr(), err);
  });
});

describe("Hybrid Result.flatZip", () => {
  it("combines synchronous mapper Result", () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip((n) => Result.Ok(n * 3));

    assert.deepStrictEqual(zipped.unwrap(), [2, 6]);
  });

  it("promotes to async when mapper returns async Result", async () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip(async (n) => Result.Ok(n * 3));

    const value = zipped.unwrap();
    assert.ok(value instanceof Promise);
    assert.deepStrictEqual(await value, [2, 6]);
  });

  it("propagates mapper Err", () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip(() => Result.Err(new DummyError()));

    assert.ok(zipped.isErr());
    assert.ok(zipped.unwrapErr() instanceof DummyError);
  });
});
