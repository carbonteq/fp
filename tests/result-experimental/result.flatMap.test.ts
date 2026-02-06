import { describe, expect, it, mock } from "bun:test"
import { ExperimentalResult as Result } from "@/result-experimental.js"

class DummyError extends Error {
  constructor() {
    super("dummyErr")
    this.name = "DummyError"
  }
}

const doubleIt = (n: number) => n * 2

const doubleResIt = (n: number) => Result.Ok(doubleIt(n))
const errResIt = (_n: number): Result<number, DummyError> =>
  Result.Err(new DummyError())

const asyncDoubleResIt = async (n: number) => Result.Ok(doubleIt(n))
const asyncErrResIt = async (_n: number): Promise<Result<number, DummyError>> =>
  Result.Err(new DummyError())

describe("ExperimentalResult.flatMap behavior", () => {
  describe("sync flatMap", () => {
    it("should apply Result<T, E> on Result<T, E> correctly", () => {
      const r = Result.Ok(2)
      const mockedDouble = mock(doubleResIt)
      const mapped = r.flatMap(mockedDouble)

      expect(mapped).toBeInstanceOf(Result)
      expect(mapped).not.toBeInstanceOf(Promise)
      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(4)
      expect(mockedDouble).toHaveBeenCalledTimes(1)
    })

    it("should apply multiple Result<T, E> on Result<T, E> correctly", () => {
      const r = Result.Ok(2)
      const mockerA = mock(doubleResIt)
      const mockerB = mock(doubleResIt)
      const mapped = r.flatMap(mockerA).flatMap(mockerB)

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("should short-circuit correctly applying Result<T, E> on Result<T, E>", () => {
      const r = Result.Ok(2)
      const mockerA = mock(errResIt)
      const mockerB = mock(doubleResIt)
      const mapped = r.flatMap(mockerA).flatMap(mockerB)

      expect(mapped.isErr()).toBeTrue()
      expect(mapped.safeUnwrap()).toBeNull()
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(0)
    })

    it("should not call function on Err", () => {
      const r = Result.Err(new DummyError())
      const mockedDouble = mock(doubleResIt)
      const mapped = r.flatMap(mockedDouble)

      expect(mapped).toBeInstanceOf(Result)
      expect(mapped).not.toBeInstanceOf(Promise)
      expect(mapped.isErr()).toBeTrue()
      expect(mapped.safeUnwrap()).toBeNull()
      expect(mockedDouble).toHaveBeenCalledTimes(0)
    })

    it("should short-circuit correctly applying Result<T, E> on Result<T, E> with Err", () => {
      const r = Result.Err(new DummyError())
      const mockerA = mock(errResIt)
      const mockerB = mock(doubleResIt)
      const mapped = r.flatMap(mockerA).flatMap(mockerB)

      expect(mapped.isErr()).toBeTrue()
      expect(mapped.safeUnwrap()).toBeNull()
      expect(mockerA).toHaveBeenCalledTimes(0)
      expect(mockerB).toHaveBeenCalledTimes(0)
    })
  })

  describe("async flatMapAsync", () => {
    it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async () => {
      const r = Result.Ok(2)
      const mockedDouble = mock(asyncDoubleResIt)
      const mapped = await r.flatMapAsync(mockedDouble)

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(4)
      expect(mockedDouble).toHaveBeenCalledTimes(1)
    })

    it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(asyncDoubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mapped = await r
        .flatMapAsync(mockerA)
        .then((r) => r.flatMapAsync(mockerB))

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(asyncErrResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mapped = await r
        .flatMapAsync(mockerA)
        .then((r) => r.flatMapAsync(mockerB))

      expect(mapped.isErr()).toBeTrue()
      expect(mapped.safeUnwrap()).toBeNull()
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(0)
    })

    it("should not call function on Err", async () => {
      const r = Result.Err(new DummyError())
      const mockedDouble = mock(asyncDoubleResIt)
      const mapped = await r.flatMapAsync(mockedDouble)

      expect(mapped.isErr()).toBeTrue()
      expect(mapped.safeUnwrap()).toBeNull()
      expect(mockedDouble).toHaveBeenCalledTimes(0)
    })

    it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E> with Err", async () => {
      const r = Result.Err(new DummyError())
      const mockerA = mock(asyncErrResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mapped = await r
        .flatMapAsync(mockerA)
        .then((r) => r.flatMapAsync(mockerB))

      expect(mapped.isErr()).toBeTrue()
      expect(mapped.safeUnwrap()).toBeNull()
      expect(mockerA).toHaveBeenCalledTimes(0)
      expect(mockerB).toHaveBeenCalledTimes(0)
    })
  })

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", () => {
      const r = Result.Ok(2)
      const mockerA = mock(doubleResIt)
      const mockerB = mock(errResIt)
      const r1 = r.flatMap(mockerA)
      const r2 = r.flatMap(mockerB)

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isErr()).toBeTrue()
      expect(r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(() => r2.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("two chained branches of computation should not affect parent or each other (async)", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(asyncDoubleResIt)
      const mockerB = mock(asyncErrResIt)
      const r1 = await r.flatMapAsync(mockerA)
      const r2 = await r.flatMapAsync(mockerB)

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isErr()).toBeTrue()
      expect(r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(() => r2.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })
  })

  describe("permutations - sync and async mix", () => {
    it("sync flatMap then async flatMapAsync", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)

      // Do sync flatMap first, then async flatMap
      const syncMapped = r.flatMap(mockerA)
      const mapped = await syncMapped.flatMapAsync(mockerB)

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("async flatMapAsync then sync flatMap", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)

      const mapped = await r
        .flatMapAsync(mockerB)
        .then((res) => res.flatMap(mockerA))

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("multiple async flatMaps in sequence", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(asyncDoubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(asyncDoubleResIt)

      const mapped = await r
        .flatMapAsync(mockerA)
        .then((res) => res.flatMapAsync(mockerB))
        .then((res) => res.flatMapAsync(mockerC))

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(16)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
    })
  })

  describe("flatMapAsync returns Promise", () => {
    it("flatMapAsync should return a Promise", async () => {
      const r = Result.Ok(5)
      const result = r.flatMapAsync(async (x) => Result.Ok(x * 2))
      expect(result).toBeInstanceOf(Promise)
      const resolved = await result
      expect(resolved.unwrap()).toBe(10)
    })

    it("flatMapAsync should handle errors", async () => {
      const r = Result.Ok(5)
      const result = await r.flatMapAsync(async () => {
        throw new Error("test error")
      })
      expect(result.isErr()).toBeTrue()
    })
  })

  describe("mixed map and flatMap", () => {
    it("should short-circuit map after flatMap returns sync Err", () => {
      const mapperAfterErr = mock((y: number) => y * 2)
      const errFn = (): Result<number, string> => Result.Err("mid-chain error")
      const result = Result.Ok(5)
        .map((x) => x * 2)
        .flatMap(errFn)
        .map(mapperAfterErr)
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe("mid-chain error")
      expect(mapperAfterErr).toHaveBeenCalledTimes(0)
    })

    it("should short-circuit subsequent operations after async flatMap returns Err", async () => {
      const mapperAfterErr = mock((y: number) => y * 2)
      const asyncErrFn = async (): Promise<Result<number, string>> =>
        Result.Err("async-mid-chain error")
      const result = await Result.Ok(5)
        .mapAsync(async (x) => x * 2)
        .then((r) => r.flatMapAsync(asyncErrFn))
        .then((r) => r.map(mapperAfterErr))
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe("async-mid-chain error")
      expect(mapperAfterErr).toHaveBeenCalledTimes(0)
    })
  })
})
