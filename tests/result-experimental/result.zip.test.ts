import { describe, expect, it, mock } from "bun:test";
import { ExperimentalResult as Result } from "@/result-experimental.js";

class DummyError extends Error {
  constructor() {
    super("dummyErr");
    this.name = "DummyError";
  }
}
const doubleIt = (n: number) => n * 2;
const tupleDoubleIt = (n: [number, number]) => n.map(doubleIt);

const asyncDoubleIt = async (n: number) => n * 2;
const tupleAsyncDoubleIt = async (n: [number, number]) => n.map(doubleIt);

const errResIt = (_n: number) => Result.Err(new DummyError());
const asyncErrResIt = async (_n: number) => Result.Err(new DummyError());

describe("Result.zip behavior", () => {
  it("should not transform an Err value that is a Promise synchronously", () => {
    const r = Result.Err(Promise.resolve(new DummyError()));
    const mockerA = mock(doubleIt);
    const mockerB = mock(tupleDoubleIt);
    const zipped = r.zip(mockerA).zip(mockerB);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should transform an Ok value synchronously", () => {
    const r = Result.Ok(2);
    const mockerA = mock(doubleIt);
    const mockerB = mock(tupleDoubleIt);
    const zipped = r.zip(mockerA).zip(mockerB);

    expect(zipped.isOk()).toBeTrue();

    const out = zipped.unwrap();
    expect(out).toEqual([
      [2, 4],
      [4, 8],
    ]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should not transform an Err value synchronously", () => {
    const r = Result.Err(new DummyError());
    const mockerA = mock(doubleIt);
    const mockerB = mock(tupleDoubleIt);
    const zipped = r.zip(mockerA).zip(mockerB);

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.safeUnwrap()).toBeNull();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should not call mappers if starting from Err", () => {
    const mockerA = mock(doubleIt);
    const mockerB = mock(tupleDoubleIt);

    const r = Result.Err(new DummyError());
    const zipped = r.zip(mockerA).zip(mockerB);

    expect(zipped.isErr()).toBeTrue();
    expect(() => zipped.unwrap()).toThrow(DummyError);
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  // it("should not call mappers if starting from Err (async)", () => {
  //   const mockerA = mock(asyncDoubleIt);
  //   const mockerB = mock(tupleAsyncDoubleIt);
  //
  //   const r = Result.Err(new DummyError());
  //   const zipped = r.zip(mockerA).zip(mockerB);
  //
  //   expect(zipped.isErr()).toBeTrue();
  //   expect(() => zipped.unwrap()).toThrow(DummyError);
  //   expect(mockerA).not.toHaveBeenCalled();
  //   expect(mockerB).not.toHaveBeenCalled();
  // });

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(doubleIt);
      const mockerB = mock(doubleIt);
      const mockerC = mock(errResIt);

      const r1 = r.zip(mockerA);
      const r2 = r.zip(mockerB);
      const r3 = r.flatMap(mockerC);

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isOk()).toBeTrue();
      expect(r3.isErr()).toBeTrue();
      expect(r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(r2.unwrap()).toEqual([2, 4]);
      expect(() => r3.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async () => {
      const r = Result.Ok(2);
      const mockerA = mock(asyncDoubleIt);
      const mockerB = mock(asyncDoubleIt);
      const mockerC = mock(asyncErrResIt);

      const r1 = await r.zipAsync(mockerA);
      const r2 = await r.zipAsync(mockerB);
      const r3 = await r.flatMapAsync(mockerC);

      expect(r.isOk()).toBeTrue();
      expect(r1.isOk()).toBeTrue();
      expect(r2.isOk()).toBeTrue();
      expect(r3.isErr()).toBeTrue();
      expect(r.unwrap()).toBe(2);
      expect(r1.unwrap()).toEqual([2, 4]);
      expect(r2.unwrap()).toEqual([2, 4]);
      expect(() => r3.unwrap()).toThrow(DummyError);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
      expect(mockerC).toHaveBeenCalledTimes(1);
    });

    // it("two chained branches of computation starting from Promise should not affect parent or each other", async () => {
    //   const r = Result.Ok(Promise.resolve(2));
    //
    //   const mockerA = mock(doubleIt);
    //   const mockerB = mock(doubleIt);
    //   const mockerC = mock(errResIt);
    //
    //   const r1 = await r.zip(mockerA);
    //   const r2 = r.zip(mockerB);
    //   const r3 = r.flatMap(mockerC);
    //
    //   expect(r.isOk()).toBeTrue();
    //   expect(r1.isOk()).toBeTrue();
    //   expect(r2.isOk()).toBeTrue();
    //   expect(r3.isErr()).toBeTrue();
    //   expect(await r.unwrap()).toBe(2);
    //   expect(r1.unwrap()).toEqual([2, 4]);
    //   expect(r2.unwrap()).toEqual([2, 4]);
    //   expect(() => r3.unwrap()).toThrow(DummyError);
    //   expect(mockerA).toHaveBeenCalledTimes(1);
    //   expect(mockerB).toHaveBeenCalledTimes(1);
    //   expect(mockerC).toHaveBeenCalledTimes(1);
    // });
    //
    // it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async () => {
    //   const r = Result.Ok(Promise.resolve(2));
    //   const mockerA = mock(asyncDoubleIt);
    //   const mockerB = mock(asyncDoubleIt);
    //   const mockerC = mock(asyncErrResIt);
    //   const r1 = await r.zip(mockerA).toPromise();
    //   const r2 = await r.zip(mockerB).toPromise();
    //   const r3 = await r.flatMap(mockerC).toPromise();
    //
    //   expect(r.isOk()).toBeTrue();
    //   expect(r1.isOk()).toBeTrue();
    //   expect(r2.isOk()).toBeTrue();
    //   expect(r3.isErr()).toBeTrue();
    //   expect(await r.unwrap()).toBe(2);
    //   expect(r1.unwrap()).toEqual([2, 4]);
    //   expect(r2.unwrap()).toEqual([2, 4]);
    //   expect(() => r3.unwrap()).toThrow(DummyError);
    //   expect(mockerA).toHaveBeenCalledTimes(1);
    //   expect(mockerB).toHaveBeenCalledTimes(1);
    //   expect(mockerC).toHaveBeenCalledTimes(1);
    // });
  });

  describe("permutations", () => {
    it("P1", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(doubleIt);
      const mockerB = mock(tupleAsyncDoubleIt);
      const mapped = await r.zip(mockerA).zipAsync(mockerB);

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual([
        [2, 4],
        [4, 8],
      ]);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });

    it("P2", async () => {
      const r = Result.Ok(2);

      const mockerA = mock(tupleDoubleIt);
      const mockerB = mock(asyncDoubleIt);

      const mapped = await r.zipAsync(mockerB).then((r) => r.zip(mockerA));

      expect(mapped.isOk()).toBeTrue();
      expect(mapped.unwrap()).toEqual([
        [2, 4],
        [4, 8],
      ]);
      expect(mockerA).toHaveBeenCalledTimes(1);
      expect(mockerB).toHaveBeenCalledTimes(1);
    });
  });
});
