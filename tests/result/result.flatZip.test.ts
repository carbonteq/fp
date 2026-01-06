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

const errResPromiseIt = <A = NestedTuple<number>>(
  _n: number,
): Result<A, Promise<DummyError>> =>
  Result.Err(Promise.resolve(new DummyError()));

const asyncErrResPromiseIt = async <A = NestedTuple<number>>(
  _n: number,
): Promise<Result<A, Promise<DummyError>>> =>
  Result.Err(Promise.resolve(new DummyError()));

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

const tupleDoubleResPromiseIt = (
  value: NestedTuple<number>,
): Result<Promise<NestedTuple<number>>, unknown> => {
  return Result.Ok(Promise.resolve(recursivelyTransform(value, doubleIt)));
};

const tupleAsyncDoubleResPromiseIt = async (
  value: NestedTuple<number>,
): Promise<Result<Promise<NestedTuple<number>>, unknown>> => {
  return Result.Ok(Promise.resolve(recursivelyTransform(value, doubleIt)));
};

describe("Result.flatZip behavior", () => {
  it("should apply Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(tupleAsyncDoubleResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(asyncErrResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(tupleAsyncDoubleResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(asyncErrResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(tupleAsyncDoubleResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(asyncErrResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(tupleAsyncDoubleResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(asyncErrResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(tupleDoubleResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(errResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(tupleDoubleResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(errResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Result<T, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockedDouble = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Result<T, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(tupleDoubleResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should short-circuit correctly applying Result<T, E> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2));
    const mockerA = mock(errResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Result<T, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockedDouble = mock(tupleDoubleResIt);
    const zipped = r.flatZip(mockedDouble);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Result<T, E> on Result<T, Promise<E>> correctly", () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(tupleDoubleResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(errResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2);
    const mockedDouble = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2);
    const mockerA = mock(tupleAsyncDoubleResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async () => {
    const r = Result.Ok(2);
    const mockerA = mock(asyncErrResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError());
    const mockedDouble = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = r.flatZip(mockedDouble);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(tupleAsyncDoubleResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(asyncErrResPromiseIt);
    const mockerB = mock(tupleAsyncDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2);
    const mockedDouble = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2);
    const mockerA = mock(tupleAsyncDoubleResIt);
    const mockerB = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

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
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError());
    const mockedDouble = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(tupleAsyncDoubleResIt);
    const mockerB = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(asyncErrResIt);
    const mockerB = mock(tupleAsyncDoubleResIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2);
    const mockedDouble = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([2, 4]);
    expect(mockedDouble).toHaveBeenCalledTimes(1);
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2);
    const mockerA = mock(tupleDoubleResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isOk()).toBeTrue();
    expect(zipped.unwrap()).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async () => {
    const r = Result.Ok(2);
    const mockerA = mock(errResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError());
    const mockedDouble = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockedDouble).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(tupleDoubleResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(errResPromiseIt);
    const mockerB = mock(tupleDoubleResPromiseIt);
    const zipped = await r.flatZip(mockerA).flatZip(mockerB).toPromise();

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

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

  it("should apply Result<T, E> on Result<T, E> correctly", () => {
    const r = Result.Err(new DummyError());
    const mockedDouble = mock(tupleDoubleResIt);
    const zipped = r.flatZip(mockedDouble);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should apply multiple Result<T, E> on Result<T, E> correctly", () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(tupleDoubleResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(tupleDoubleResIt);
    const mockerB = mock(tupleDoubleResIt);
    const zipped = r.flatZip(mockerA).flatZip(mockerB);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
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

    it("two chained branches of computation should not affect parent or each other (async)", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(tupleAsyncDoubleResIt);
      const mockerB = mock(asyncErrResIt);
      const r1 = await r.flatZip(mockerA).toPromise();
      const r2 = await r.flatZip(mockerB).toPromise();

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isErr()).toBeTrue();
      expect(r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(() => r2.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other", async () => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(errResIt);
      const r1 = await r.flatZip(mockerA).toPromise();
      const r2 = await r.flatZip(mockerB).toPromise();

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isErr()).toBeTrue();
      expect(await r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(() => r2.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other (async)", async () => {
      const r = Result.Ok(Promise.resolve(2));
      const mockerA = mock(tupleAsyncDoubleResIt);
      const mockerB = mock(asyncErrResIt);
      const r1 = await r.flatZip(mockerA).toPromise();
      const r2 = await r.flatZip(mockerB).toPromise();

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isErr()).toBeTrue();
      expect(await r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(() => r2.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });
  });

  describe("permutations", () => {
    const permResult: any = [
      [
        [
          [2, 4],
          [4, 8],
        ],
        [
          [4, 8],
          [8, 16],
        ],
      ],
      [
        [
          [4, 8],
          [8, 16],
        ],
        [
          [8, 16],
          [16, 32],
        ],
      ],
    ];

    it("P1", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P2", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P3", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P4", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P5", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P6", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .flatZip(mockerB)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P7", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P8", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P9", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P10", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P11", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P12", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P13", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P14", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P15", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerD)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P16", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerB)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P17", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P18", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerC)
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P19", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P20", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .flatZip(mockerB)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P21", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P22", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
    it("P23", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerC)
        .flatZip(mockerA)
        .flatZip(mockerB)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });

    it("P24", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleResIt);
      const mockerB = mock(tupleAsyncDoubleResIt);
      const mockerC = mock(tupleDoubleResPromiseIt);
      const mockerD = mock(tupleAsyncDoubleResPromiseIt);

      const mapped = await r
        .flatZip(mockerD)
        .flatZip(mockerB)
        .flatZip(mockerA)
        .flatZip(mockerC)
        .toPromise();

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual(permResult);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
      expect(mockerD).toHaveBeenCalledTimes(1);
    });
  });
});
