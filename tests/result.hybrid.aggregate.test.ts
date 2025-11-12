import { describe, expect, it } from "bun:test";
import { Result } from "@/result.hybrid.js";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

describe("Hybrid Result.all", () => {
  it("combines synchronous Ok results", () => {
    const combined = Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3));

    expect(combined.unwrap()).toEqual([1, 2, 3]);
  });

  it("returns Err when any result fails", () => {
    const err = new DummyError();
    const combined = Result.all(Result.Ok(1), Result.Err(err), Result.Ok(3));

    expect(combined.unwrapErr()).toEqual([err]);
  });

  it("handles async participants without rejecting", async () => {
    const err = new DummyError();
    const combined = Result.all(
      Result.Ok(1),
      Result.Ok(Promise.resolve(2)),
      Result.Err(err),
    );

    const settled = combined.unwrap();
    expect(settled).toBeInstanceOf(Promise);

    await expect(async () => {
      await settled;
    }).rejects.toThrow();

    const aggregated = await combined.toPromise();
    expect(aggregated.isErr()).toBeTrue();
    expect(aggregated.unwrapErr()).toEqual([err]);
  });
});

describe("Hybrid Result.validate", () => {
  const valueValidator = (value: number) =>
    value > 0 ? Result.Ok(value) : Result.Err("invalid");

  const asyncValidator = async (value: number) =>
    value % 2 === 0 ? Result.Ok(value) : Result.Err("odd");

  it("returns original value when all validators pass", () => {
    const res = Result.Ok(10).validate([valueValidator, asyncValidator]);

    expect(res.unwrap()).toBe(10);
  });

  it("collects validation errors", () => {
    const res = Result.Ok(-5).validate([valueValidator, asyncValidator]);

    expect(res.isErr()).toBeTrue();
    expect(res.unwrapErr()).toEqual(["invalid"]);
  });
});
