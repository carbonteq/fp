import * as assert from "node:assert";
import { describe, it } from "node:test";
import { Result } from "@/result.hybrid.js";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

const doubleResult = (n: number) => Result.Ok(n * 2);
const asyncDoubleResult = async (n: number) => Result.Ok(n * 2);
const errResult = (_: number) => Result.Err(new DummyError());
const asyncErrResult = async (_: number) => Result.Err(new DummyError());

describe("Hybrid Result.flatMap", () => {
  it("chains synchronous Result-returning mappers", () => {
    const res = Result.Ok(2)
      .flatMap(doubleResult)
      .flatMap(doubleResult);

    assert.strictEqual(res.unwrap(), 8);
  });

  it("promotes to async when mapper returns a promise of Result", async () => {
    const res = Result.Ok(2).flatMap(asyncDoubleResult);

    const value = res.unwrap();
    assert.ok(value instanceof Promise);
    assert.strictEqual(await value, 4);
  });

  it("bubbles up synchronous Err from mapper", () => {
    const res = Result.Ok(2).flatMap(errResult);

    assert.ok(res.isErr());
    assert.ok(res.unwrapErr() instanceof DummyError);
  });

  it("bubbles up asynchronous Err from mapper", async () => {
    const res = Result.Ok(2).flatMap(asyncErrResult);

    const err = res.unwrapErr();
    assert.ok(err instanceof Promise);
    assert.ok((await err) instanceof DummyError);
  });

  it("skips mapper when initial Result is Err", () => {
    const err = new DummyError();
    const mapper = (n: number) => Result.Ok(n * 5);
    const res = Result.Err(err).flatMap(mapper);

    assert.strictEqual(res.unwrapErr(), err);
  });
});
