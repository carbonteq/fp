import { describe, expect, expectTypeOf, it, mock } from "bun:test"
import { ExperimentalResult as Result } from "@/result-experimental.js"

class DummyError extends Error {
  constructor() {
    super("dummyErr")
    this.name = "DummyError"
  }
}
const doubleIt = (n: number) => n * 2
const asyncDoubleIt = async (n: number) => n * 2

const errResIt = (_n: number) => Result.Err(new DummyError())
const asyncErrResIt = async (_n: number) => Result.Err(new DummyError())

describe("ExperimentalResult.map behavior", () => {
  for (const method of ["mapAsync", "flatMapAsync"] as const) {
    it(`${method} preserves arbitrary returned-promise rejection values`, async () => {
      const reason = { code: "rejected" }
      const mapper = (): Promise<never> => Promise.reject(reason)
      const original = Result.Ok<number, string>(2)
      const pending = method === "mapAsync"
        ? original.mapAsync<number>(mapper)
        : original.flatMapAsync<number, string>(mapper)
      expectTypeOf(pending).toEqualTypeOf<Promise<Result<number, unknown>>>()
      const result = await pending
      expectTypeOf(result.unwrapErr()).toEqualTypeOf<unknown>()
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe(reason)
      if (false) {
        // @ts-expect-error Arbitrary rejection values need narrowing.
        result.unwrapErr().message
      }
    })

    it(`${method} still rejects when a promise-typed mapper throws synchronously`, async () => {
      const reason = { code: "thrown" }
      const mapper = (): Promise<never> => {
        throw reason
      }
      const original = Result.Ok(2)
      const pending = method === "mapAsync"
        ? original.mapAsync<number>(mapper)
        : original.flatMapAsync<number, string>(mapper)
      const reasonCaught = await pending.then(
        () => { throw new Error("Expected mapper throw to reject") },
        (error: unknown) => error,
      )
      expect(reasonCaught).toBe(reason)
    })

    it(`${method} skips its mapper on Err`, async () => {
      const reason = { code: "original" }
      const mapper = mock((): Promise<never> => Promise.reject("not called"))
      const original = Result.Err<typeof reason, number>(reason)
      const result = await (method === "mapAsync"
        ? original.mapAsync<number>(mapper)
        : original.flatMapAsync<number, string>(mapper))
      expect(result.unwrapErr()).toBe(reason)
      expect(mapper).not.toHaveBeenCalled()
    })
  }

  it("keeps successful async mapper values precise while widening errors", async () => {
    const mapped = Result.Ok<number, string>(2).mapAsync(async (n) => n.toString())
    const chained = Result.Ok<number, string>(2).flatMapAsync(async (n) =>
      Result.Ok<string, RangeError>(n.toString()),
    )
    expectTypeOf(mapped).toEqualTypeOf<Promise<Result<string, unknown>>>()
    expectTypeOf(chained).toEqualTypeOf<Promise<Result<string, unknown>>>()
    expect((await mapped).unwrap()).toBe("2")
    expect((await chained).unwrap()).toBe("2")
  })

  it("should transform an Ok value asynchronously with mapAsync", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mapped = await r
      .mapAsync(mockerA)
      .then((r) => r.mapAsync(mockerB).then((r2) => r2))

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should not transform an Err value asynchronously with mapAsync", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mapped = await r
      .mapAsync(mockerA)
      .then((r) => r.mapAsync(mockerB).then((r2) => r2))

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  it("should transform an Ok value synchronously", () => {
    const r = Result.Ok(2)
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)
    const mapped = r.map(mockerA).map(mockerB)

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should not transform an Err value synchronously", () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)
    const mapped = r.map(mockerA).map(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  it("should not call mappers if starting from Err", () => {
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)

    const r = Result.Err(new DummyError())
    const mapped = r.map(mockerA).map(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(() => mapped.unwrap()).toThrow(DummyError)
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  it("should not call mappers if starting from Err (async)", async () => {
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)

    const r = Result.Err(new DummyError())
    const mapped = await r.mapAsync(mockerA)

    expect(mapped.isErr()).toBeTrue()
    expect(() => mapped.unwrap()).toThrow(DummyError)
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  describe("branching", () => {
    it("two chained branches of computation should not affect parent or each other", () => {
      const r = Result.Ok(2)
      const mockerA = mock(doubleIt)
      const mockerB = mock(doubleIt)
      const mockerC = mock(errResIt)
      const r1 = r.map(mockerA)
      const r2 = r.map(mockerB)
      const r3 = r.flatMap(mockerC)

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isOk()).toBeTrue()
      expect(r3.isErr()).toBeTrue()
      expect(r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(r2.unwrap()).toBe(4)
      expect(() => r3.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
    })

    it("two chained branches of computation should not affect parent or each other (async)", async () => {
      const r = Result.Ok(2)
      const mockerA = mock(asyncDoubleIt)
      const mockerB = mock(asyncDoubleIt)
      const mockerC = mock(asyncErrResIt)
      const r1 = await r.mapAsync(mockerA)
      const r2 = await r.mapAsync(mockerB)
      const r3 = await r.flatMapAsync(mockerC)

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isOk()).toBeTrue()
      expect(r3.isErr()).toBeTrue()
      expect(r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(r2.unwrap()).toBe(4)
      expect(() => r3.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
    })
  })

  describe("permutations", () => {
    it("P1 - sync then async", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleIt)
      const mockerB = mock(asyncDoubleIt)

      // Do sync map first, then async map
      const syncMapped = r.map(mockerA)
      const mapped = await syncMapped.mapAsync(mockerB)

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("P2 - async then sync", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleIt)
      const mockerB = mock(asyncDoubleIt)

      const mapped = await r.mapAsync(mockerB).then((res) => res.map(mockerA))

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("P3 - chaining multiple async maps", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(asyncDoubleIt)
      const mockerB = mock(asyncDoubleIt)
      const mockerC = mock(asyncDoubleIt)

      const mapped = await r
        .mapAsync(mockerA)
        .then((res) => res.mapAsync(mockerB))
        .then((res) => res.mapAsync(mockerC))

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(16)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
    })
  })

  describe("mapAsync returns Promise", () => {
    it("mapAsync should return a Promise", async () => {
      const r = Result.Ok(5)
      const result = r.mapAsync(async (x) => x * 2)
      expect(result).toBeInstanceOf(Promise)
      const resolved = await result
      expect(resolved.unwrap()).toBe(10)
    })

    it("mapAsync should handle errors", async () => {
      const r = Result.Ok(5)
      const result = await r.mapAsync(async () => {
        throw new Error("test error")
      })
      expect(result.isErr()).toBeTrue()
    })
  })
})
