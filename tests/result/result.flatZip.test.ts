import { describe, expect, it, mock } from "bun:test";
import { Result } from "@/result.js";

class DummyError extends Error {
  constructor() {
    super("dummyErr");
    this.name = "DummyError";
  }
}

const doubleIt = (n: number) => n * 2;

const errResIt = <A = NestedTuple<number>>(_n: number): Result<A, DummyError> =>
  Result.Err(new DummyError());

const asyncErrResIt = async <A = NestedTuple<number>>(
  _n: number,
): Promise<Result<A, DummyError>> => Result.Err(new DummyError());

type NestedTuple<T> = T | [NestedTuple<T>, NestedTuple<T>];

const recursivelyTransform = <T, R>(
  value: NestedTuple<T>,
  transform: (val: T) => R,
): NestedTuple<R> => {
  if (!Array.isArray(value)) {
    return transform(value as T);
  }

  const [first, second] = value;
  return [
    recursivelyTransform(first, transform),
    recursivelyTransform(second, transform),
  ] as [NestedTuple<R>, NestedTuple<R>];
};

const tupleDoubleResIt = (
  value: NestedTuple<number>,
): Result<NestedTuple<number>, unknown> => {
  return Result.Ok(recursivelyTransform(value, doubleIt));
};

const tupleAsyncDoubleResIt = async (
  value: NestedTuple<number>,
): Promise<Result<NestedTuple<number>, unknown>> => {
  return Result.Ok(recursivelyTransform(value, doubleIt));
};

describe("Result.flatZip behavior", () => {
  describe("async operations with flatZipAsync", () => {
    it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async () => {
      const r = Result.Ok(2);
      const mockedDouble = mock(tupleAsyncDoubleResIt);
      const zipped = await r.flatZipAsync(mockedDouble);

      expect(zipped.isOk()).toBeTrue();
      expect(zipped.unwrap()).toEqual([2, 4]);
      expect(mockedDouble).toHaveBeenCalledTimes(1);
    });

    it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleAsyncDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);

      const zipped = await r
        .flatZipAsync(mockerA)
        .then((r) => r.flatZipAsync(mockerB));

      expect(zipped.isOk()).toBeTrue();
      expect(zipped.unwrap()).toEqual([
        [2, 4],
        [4, 8],
      ]);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(asyncErrResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);

      const zipped = await r
        .flatZipAsync(mockerA)
        .then((r) => r.flatZipAsync(mockerB));

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).not.toHaveBeenCalled();
    });

    it("should apply Promise<Result<T, E>> on Result<T, E> correctly when starting with Err", async () => {
      const r = Result.Err(new DummyError());
      const mockedDouble = mock(tupleAsyncDoubleResIt);

      const zipped = await r.flatZipAsync(mockedDouble);

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockedDouble).not.toHaveBeenCalled();
    });

    it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly when starting with Err", async () => {
      const r = Result.Err(new DummyError());
      const mockerA = mock(tupleAsyncDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);

      const zipped = await r
        .flatZipAsync(mockerA)
        .then((r) => r.flatZipAsync(mockerB));

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockerA).not.toHaveBeenCalled();
      expect(mockerB).not.toHaveBeenCalled();
    });

    it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E> when starting with Err", async () => {
      const r = Result.Err(new DummyError());
      const mockerA = mock(asyncErrResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);

      const zipped = await r
        .flatZipAsync(mockerA)
        .then((r) => r.flatZipAsync(mockerB));

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockerA).not.toHaveBeenCalled();
      expect(mockerB).not.toHaveBeenCalled();
    });
  });

  describe("sync operations with flatZip", () => {
    it("should apply Result<T, E> on Result<T, E> correctly", () => {
      const r = Result.Ok(2);
      const mockedDouble = mock(tupleDoubleResIt);
      const zipped = r.flatZip(mockedDouble);

      expect(zipped.isOk()).toBeTrue();
      expect(zipped.unwrap()).toEqual([2, 4]);
      expect(mockedDouble).toHaveBeenCalledTimes(1);
    });

    it("should apply multiple Result<T, E> on Result<T, E> correctly", () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleDoubleResIt);
      const zipped = r.flatZip(mockerA).flatZip(mockerB);

      expect(zipped.isOk()).toBeTrue();
      expect(zipped.unwrap()).toEqual([
        [2, 4],
        [4, 8],
      ]);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("should short-circuit correctly applying Result<T, E> on Result<T, E>", () => {
      const r = Result.Ok(2);
      const mockerA = mock(errResIt);
      const mockerB = mock(tupleDoubleResIt);
      const zipped = r.flatZip(mockerA).flatZip(mockerB);

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).not.toHaveBeenCalled();
    });

    it("should apply Result<T, E> on Result<T, E> correctly when starting with Err", () => {
      const r = Result.Err(new DummyError());
      const mockedDouble = mock(tupleDoubleResIt);
      const zipped = r.flatZip(mockedDouble);

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockedDouble).not.toHaveBeenCalled();
    });

    it("should apply multiple Result<T, E> on Result<T, E> correctly when starting with Err", () => {
      const r = Result.Err(new DummyError());
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleDoubleResIt);
      const zipped = r.flatZip(mockerA).flatZip(mockerB);

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockerA).not.toHaveBeenCalled();
      expect(mockerB).not.toHaveBeenCalled();
    });

    it("should short-circuit correctly applying Result<T, E> on Result<T, E> when starting with Err", () => {
      const r = Result.Err(new DummyError());
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleDoubleResIt);
      const zipped = r.flatZip(mockerA).flatZip(mockerB);

      expect(zipped.isErr()).toBeTrue();
      expect(zipped.safeUnwrap()).toBeNull();
      expect(mockerA).not.toHaveBeenCalled();
      expect(mockerB).not.toHaveBeenCalled();
    });
  });

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(errResIt);
      const r1 = r.flatZip(mockerA);
      const r2 = r.flatZip(mockerB);

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isErr()).toBeTrue();
      expect(r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(() => r2.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("two chained branches of async computation should not affect parent or each other", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleAsyncDoubleResIt);
      const mockerB = mock(asyncErrResIt);
      const r1 = await r.flatZipAsync(mockerA);
      const r2 = await r.flatZipAsync(mockerB);

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isErr()).toBeTrue();
      expect(r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(() => r2.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });
  });

  describe("permutations (mixed sync and async)", () => {
    it("should handle sync followed by async operations", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);

      // First flatZip: tupleDoubleResIt(2) returns Result.Ok(4) (2 is not an array, so just doubleIt)
      // Result becomes: [2, 4]
      const syncResult = r.flatZip(mockerA);
      expect(syncResult.isOk()).toBeTrue();
      expect(syncResult.unwrap()).toEqual([2, 4]);

      // Second flatZipAsync: tupleAsyncDoubleResIt([2, 4]) receives an array
      // recursivelyTransform([2, 4], doubleIt) = [4, 8]
      // Result becomes: [[2, 4], [4, 8]]
      const result = await syncResult.flatZipAsync(mockerB);

      expect(result.isOk()).toBeTrue();
      expect(result.unwrap()).toEqual([
        [2, 4],
        [4, 8],
      ]);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("should handle async followed by sync operations", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);

      // First flatZipAsync: tupleAsyncDoubleResIt(2) returns Result.Ok(4)
      // Result becomes: [2, 4]
      const asyncResult = await r.flatZipAsync(mockerB);
      expect(asyncResult.isOk()).toBeTrue();
      expect(asyncResult.unwrap()).toEqual([2, 4]);

      // Second flatZip: tupleDoubleResIt([2, 4]) receives an array
      // recursivelyTransform([2, 4], doubleIt) = [4, 8]
      // Result becomes: [[2, 4], [4, 8]]
      const result = asyncResult.flatZip(mockerA);

      expect(result.isOk()).toBeTrue();
      expect(result.unwrap()).toEqual([
        [2, 4],
        [4, 8],
      ]);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });
  });
});
