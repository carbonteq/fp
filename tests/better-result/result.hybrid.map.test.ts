import { describe, expect, it } from "bun:test";
import { Result } from "@/result.hybrid";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

const double = (n: number) => n * 2;
const asyncDouble = async (n: number) => n * 2;

describe("Hybrid Result.map", () => {
  it("maps synchronous ok values synchronously", () => {
    const r = Result.Ok(2);
    const mapped = r.map(double);

    expect(mapped.unwrap()).toBe(4);
  });

  it("promotes to async when mapper returns a promise", async () => {
    const r = Result.Ok(2);
    const mapped = r.map(asyncDouble);

    const result = mapped.unwrap();
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(4);
  });

  it("remains async when initial value is async", async () => {
    const r = Result.Ok(Promise.resolve(3));
    const mapped = r.map(double);

    const result = mapped.unwrap();
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(6);
  });

  it("propagates Err without invoking mapper", () => {
    const err = new DummyError();
    const mapper = (n: number) => n * 10;
    const r = Result.Err(err);
    const mapped = r.map(mapper);

    expect(mapped.unwrapErr()).toBe(err);
  });

  it("captures synchronous exceptions thrown by mapper", () => {
    const err = new DummyError();
    const r = Result.Ok(2);
    const mapped = r.map(() => {
      throw err;
    });

    expect(mapped.unwrapErr()).toBe(err);
  });

  it("captures rejections from async mapper", async () => {
    const err = new DummyError();
    const r = Result.Ok(2);
    const mapped = r.map(async () => {
      throw err;
    });

    const asyncResult = mapped.unwrapErr();
    expect(asyncResult).toBeInstanceOf(Promise);
    await expect(asyncResult).resolves.toBe(err);
  });
});
