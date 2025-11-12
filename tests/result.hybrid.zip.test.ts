import { describe, expect, it } from "bun:test";
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

    expect(zipped.unwrap()).toEqual([2, 4]);
  });

  it("promotes to async when mapper returns a promise", async () => {
    const r = Result.Ok(2);
    const zipped = r.zip(asyncDouble);

    const value = zipped.unwrap();
    expect(value).toBeInstanceOf(Promise);
    expect(await value).toEqual([2, 4]);
  });

  it("propagates Err without invoking mapper", () => {
    const err = new DummyError();
    const r = Result.Err(err);
    const zipped = r.zip(double);

    expect(zipped.unwrapErr()).toBe(err);
  });
});

describe("Hybrid Result.flatZip", () => {
  it("combines synchronous mapper Result", () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip((n) => Result.Ok(n * 3));

    expect(zipped.unwrap()).toEqual([2, 6]);
  });

  it("promotes to async when mapper returns async Result", async () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip(async (n) => Result.Ok(n * 3));

    const value = zipped.unwrap();
    expect(value).toBeInstanceOf(Promise);
    expect(await value).toEqual([2, 6]);
  });

  it("propagates mapper Err", () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip(() => Result.Err(new DummyError()));

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.unwrapErr()).toBeInstanceOf(DummyError);
  });
});
