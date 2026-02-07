import { describe, expect, it, mock } from "bun:test"
import { Result } from "@/result.js"

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

describe("Result.map behavior", () => {
  it("should transform an Ok value that is a Promise asynchronously", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mapped = await r.map(mockerA).map(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should not transform an Err value that is a Promise asynchronously", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mapped = await r.map(mockerA).map(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  it("should transform an Ok value that is a Promise synchronously", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)
    const mapped = await r.map(mockerA).map(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should not transform an Err value that is a Promise synchronously", () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)
    const mapped = r.map(mockerA).map(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  it("should transform an Ok value asynchronously", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mapped = await r.map(mockerA).map(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should not transform an Err value asynchronously", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mapped = await r.map(mockerA).map(mockerB).toPromise()

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

  it("should not call mappers if starting from Err (async)", () => {
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)

    const r = Result.Err(new DummyError())
    const mapped = r.map(mockerA).map(mockerB)

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
      const r1 = await r.map(mockerA).toPromise()
      const r2 = await r.map(mockerB).toPromise()
      const r3 = await r.flatMap(mockerC).toPromise()

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

    it("two chained branches of computation starting from Promise should not affect parent or each other", async () => {
      const r = Result.Ok(Promise.resolve(2))
      const mockerA = mock(doubleIt)
      const mockerB = mock(doubleIt)
      const mockerC = mock(errResIt)
      const r1 = await r.map(mockerA).toPromise()
      const r2 = await r.map(mockerB).toPromise()
      const r3 = await r.flatMap(mockerC).toPromise()

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isOk()).toBeTrue()
      expect(r3.isErr()).toBeTrue()
      expect(await r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(r2.unwrap()).toBe(4)
      expect(() => r3.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
    })

    it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async () => {
      const r = Result.Ok(Promise.resolve(2))
      const mockerA = mock(asyncDoubleIt)
      const mockerB = mock(asyncDoubleIt)
      const mockerC = mock(asyncErrResIt)
      const r1 = await r.map(mockerA).toPromise()
      const r2 = await r.map(mockerB).toPromise()
      const r3 = await r.flatMap(mockerC).toPromise()

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isOk()).toBeTrue()
      expect(r3.isErr()).toBeTrue()
      expect(await r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(r2.unwrap()).toBe(4)
      expect(() => r3.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
    })
  })

  describe("permutations", () => {
    it("P1", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleIt)
      const mockerB = mock(asyncDoubleIt)

      const mapped = await r.map(mockerA).map(mockerB).toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })
    it("P2", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleIt)
      const mockerB = mock(asyncDoubleIt)

      const mapped = await r.map(mockerB).map(mockerA).toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(8)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })
  })
})
