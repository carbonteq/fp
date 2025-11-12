import { describe, expect, it } from "bun:test";
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
    const res = Result.Ok(2).flatMap(doubleResult).flatMap(doubleResult);

    expect(res.unwrap()).toBe(8);
  });

  it("promotes to async when mapper returns a promise of Result", async () => {
    const res = Result.Ok(2).flatMap(asyncDoubleResult);

    const value = res.unwrap();
    expect(value).toBeInstanceOf(Promise);
    expect(await value).toBe(4);
  });

  it("bubbles up synchronous Err from mapper", () => {
    const res = Result.Ok(2).flatMap(errResult);

    expect(res.isErr()).toBeTrue();
    expect(res.unwrapErr()).toBeInstanceOf(DummyError);
  });

  it("bubbles up asynchronous Err from mapper", async () => {
    const res = Result.Ok(2).flatMap(asyncErrResult);

    const err = res.unwrapErr();
    expect(err).toBeInstanceOf(Promise);
    expect(await err).toBeInstanceOf(DummyError);
  });

  it("skips mapper when initial Result is Err", () => {
    const err = new DummyError();
    const mapper = (n: number) => Result.Ok(n * 5);
    const res = Result.Err(err).flatMap(mapper);

    expect(res.unwrapErr()).toBe(err);
  });
});
