import { describe, expect, it } from "bun:test";
import { Result } from "@/result.js";

const asyncErrResIt = async (n: number): Promise<Result<number, number>> =>
  Result.Err(n);

const asyncOkResIt = async (n: number): Promise<Result<number, never>> =>
  Result.Ok(n);

describe("Result.all behavior", () => {
  it("should combine all Ok values", () => {
    const r1 = Result.Ok(1);
    const r2 = Result.Ok(2);
    const r3 = Result.Ok(3);
    const r4 = Result.Ok(4);
    const r5 = Result.Ok(5);

    const combined = Result.all(r1, r2, r3, r4, r5);

    expect(combined.isOk()).toBeTrue();
    expect(combined.unwrap()).toEqual([1, 2, 3, 4, 5]);
  });

  it("should combine all Err values", () => {
    const r1 = Result.Err(1);
    const r2 = Result.Err(2);
    const r3 = Result.Err(3);
    const r4 = Result.Err(4);
    const r5 = Result.Err(5);

    const combined = Result.all(r1, r2, r3, r4, r5);

    expect(combined.isErr()).toBeTrue();
    expect(combined.unwrapErr()).toEqual([1, 2, 3, 4, 5]);
  });

  it("should return Err values if even one exists", () => {
    const r1 = Result.Ok(1);
    const r2 = Result.Ok(2);
    const r3 = Result.Ok(3);
    const r4 = Result.Ok(4);
    const r5 = Result.Err(5);

    const combined = Result.all(r1, r2, r3, r4, r5);

    expect(combined.isErr()).toBeTrue();
    expect(combined.unwrapErr()).toEqual([5]);
  });

  it("should handle async flatMapAsync with Result.all", async () => {
    const r1 = Result.Ok(1);
    const r2 = Result.Ok(2);
    const r3 = Result.Ok(3);
    const r4 = Result.Ok(4);
    const r5 = await Result.Ok(5).flatMapAsync(asyncErrResIt);

    const combined = Result.all(r1, r2, r3, r4, r5);

    expect(combined.isErr()).toBeTrue();
    expect(combined.unwrapErr()).toEqual([5]);
  });

  it("should handle Promise<Result<T, E>> with Promise.all", async () => {
    // In the new model, we use Promise.all to combine Promise<Result<T, E>> values
    const r1 = Promise.resolve(Result.Ok(1));
    const r2 = Promise.resolve(Result.Ok(2));
    const r3 = Promise.resolve(Result.Ok(3));
    const r4 = Promise.resolve(Result.Ok(4));
    const r5 = Promise.resolve(Result.Ok(5));

    const results = await Promise.all([r1, r2, r3, r4, r5]);
    const combined = Result.all(...results);

    expect(combined.isOk()).toBeTrue();
    expect(combined.unwrap()).toEqual([1, 2, 3, 4, 5]);
  });

  it("should handle mixed sync and async with Promise.all then Result.all", async () => {
    // Combine async Results first, then combine with sync Results
    const r1 = Result.Ok(1);
    const r3 = Result.Ok(3);
    const r5 = Result.Ok(5);

    // Async values
    const r2 = await asyncOkResIt(2);
    const r4 = await asyncOkResIt(4);

    const combined = Result.all(r1, r2, r3, r4, r5);

    expect(combined.isOk()).toBeTrue();
    expect(combined.unwrap()).toEqual([1, 2, 3, 4, 5]);
  });

  it("should handle mixed sync and async errors", async () => {
    const r1 = Result.Err(1);
    const r2 = await Result.Ok(2).flatMapAsync(asyncErrResIt);
    const r3 = Result.Err(3);
    const r4 = await Result.Ok(4).flatMapAsync(asyncErrResIt);
    const r5 = Result.Err(5);

    const combined = Result.all(r1, r2, r3, r4, r5);

    expect(combined.isErr()).toBeTrue();
    expect(combined.unwrapErr()).toEqual([1, 2, 3, 4, 5]);
  });
});
