import { describe, expect, it, mock } from "bun:test"
import { Result } from "@/result.js"

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

const doubleResPromiseIt = (n: number) =>
  Result.Ok(Promise.resolve(doubleIt(n)))
const errResPromiseIt = (
  _n: number,
): Result<Promise<number>, Promise<DummyError>> =>
  Result.Err(Promise.resolve(new DummyError()))

const asyncDoubleResPromiseIt = async (n: number) =>
  Result.Ok(Promise.resolve(doubleIt(n)))
const asyncErrResPromiseIt = async (
  _n: number,
): Promise<Result<Promise<number>, Promise<DummyError>>> =>
  Result.Err(Promise.resolve(new DummyError()))

describe("Result.flatMap behavior", () => {
  it("should apply Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockedDouble = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.safeUnwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(asyncDoubleResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.safeUnwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(asyncErrResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockedDouble = mock(asyncDoubleResPromiseIt)
    const mapped = r.flatMap(mockedDouble)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(asyncDoubleResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(asyncErrResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockedDouble = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Promise<Result<T, E>> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(asyncDoubleResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(asyncErrResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockedDouble = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Promise<Result<T, E>> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(asyncDoubleResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(asyncErrResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockedDouble = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Result<Promise<T>, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(doubleResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(errResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockedDouble = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Result<Promise<T>, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(doubleResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(errResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Result<T, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockedDouble = mock(doubleResIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Result<T, E> on Result<Promise<T>, E> correctly", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(doubleResIt)
    const mockerB = mock(doubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Result<T, E> on Result<Promise<T>, E>", async () => {
    const r = Result.Ok(Promise.resolve(2))
    const mockerA = mock(errResIt)
    const mockerB = mock(doubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Result<T, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockedDouble = mock(doubleResIt)
    const mapped = r.flatMap(mockedDouble)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Result<T, E> on Result<T, Promise<E>> correctly", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(doubleResIt)
    const mockerB = mock(doubleResIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Result<T, E> on Result<T, Promise<E>>", async () => {
    const r = Result.Err(Promise.resolve(new DummyError()))
    const mockerA = mock(errResIt)
    const mockerB = mock(doubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2)
    const mockedDouble = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(asyncDoubleResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(asyncErrResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError())
    const mockedDouble = mock(asyncDoubleResPromiseIt)
    const mapped = r.flatMap(mockedDouble)

    expect(mapped).toBeInstanceOf(Result)
    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Promise<Result<Promise<T>, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(asyncDoubleResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Promise<Result<Promise<T>, E>> on Result<T, E>", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(asyncErrResPromiseIt)
    const mockerB = mock(asyncDoubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2)
    const mockedDouble = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(asyncDoubleResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(asyncErrResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError())
    const mockedDouble = mock(asyncDoubleResIt)
    const mapped = r.flatMap(mockedDouble)

    expect(mapped).toBeInstanceOf(Result)
    expect(mapped).not.toBeInstanceOf(Promise)
    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Promise<Result<T, E>> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(asyncDoubleResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Promise<Result<T, E>> on Result<T, E>", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(asyncErrResIt)
    const mockerB = mock(asyncDoubleResIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2)
    const mockedDouble = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockedDouble).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
    expect(mockedDouble).toHaveBeenCalledTimes(1)
  })

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(doubleResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = await r.flatMap(mockerA).flatMap(mockerB).toPromise()

    expect(mapped.isOk()).toBeTrue()
    expect(mapped.unwrap()).toBe(8)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async () => {
    const r = Result.Ok(2)
    const mockerA = mock(errResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should apply Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError())
    const mockedDouble = mock(doubleResPromiseIt)
    const mapped = r.flatMap(mockedDouble)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Result<Promise<T>, E> on Result<T, E> correctly", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(doubleResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Result<Promise<T>, E> on Result<T, E>", async () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(errResPromiseIt)
    const mockerB = mock(doubleResPromiseIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

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

  it("should apply Result<T, E> on Result<T, E> correctly", () => {
    const r = Result.Err(new DummyError())
    const mockedDouble = mock(doubleResIt)
    const mapped = r.flatMap(mockedDouble)

    expect(mapped).toBeInstanceOf(Result)
    expect(mapped).not.toBeInstanceOf(Promise)
    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockedDouble).toHaveBeenCalledTimes(0)
  })

  it("should apply multiple Result<T, E> on Result<T, E> correctly", () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(doubleResIt)
    const mockerB = mock(doubleResIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
  })

  it("should short-circuit correctly applying Result<T, E> on Result<T, E>", () => {
    const r = Result.Err(new DummyError())
    const mockerA = mock(errResIt)
    const mockerB = mock(doubleResIt)
    const mapped = r.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isErr()).toBeTrue()
    expect(mapped.safeUnwrap()).toBeNull()
    expect(mockerA).toHaveBeenCalledTimes(0)
    expect(mockerB).toHaveBeenCalledTimes(0)
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
      const r1 = await r.flatMap(mockerA).toPromise()
      const r2 = await r.flatMap(mockerB).toPromise()

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isErr()).toBeTrue()
      expect(r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(() => r2.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("two chained branches of computation from Promise should not affect parent or each other", async () => {
      const r = Result.Ok(Promise.resolve(2))
      const mockerA = mock(doubleResIt)
      const mockerB = mock(errResIt)
      const r1 = await r.flatMap(mockerA).toPromise()
      const r2 = await r.flatMap(mockerB).toPromise()

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isErr()).toBeTrue()
      expect(await r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(() => r2.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("two chained branches of computation from Promise should not affect parent or each other (async)", async () => {
      const r = Result.Ok(Promise.resolve(2))
      const mockerA = mock(asyncDoubleResIt)
      const mockerB = mock(asyncErrResIt)
      const r1 = await r.flatMap(mockerA).toPromise()
      const r2 = await r.flatMap(mockerB).toPromise()

      expect(r.isOk()).toBeTrue()
      expect(r1.isOk()).toBeTrue()
      expect(r2.isErr()).toBeTrue()
      expect(await r.unwrap()).toBe(2)
      expect(r1.unwrap()).toBe(4)
      expect(() => r2.unwrap()).toThrow(DummyError)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
    })

    it("should short-circuit map after flatMap returns sync Err in async chain", async () => {
      const mapperAfterErr = mock((y: number) => y * 2)
      const errFn = (): Result<number, string> => Result.Err("mid-chain error")
      const result = await Result.Ok(5)
        .map(async (x) => x * 2)
        .flatMap(errFn)
        .map(mapperAfterErr)
        .toPromise()
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe("mid-chain error")
      // The mapper after the error should not be called
      expect(mapperAfterErr).toHaveBeenCalledTimes(0)
    })

    it("should short-circuit subsequent operations after async flatMap returns Err", async () => {
      const mapperAfterErr = mock((y: number) => y * 2)
      const asyncErrFn = async (): Promise<Result<number, string>> =>
        Result.Err("async-mid-chain error")
      const result = await Result.Ok(5)
        .map(async (x) => x * 2)
        .flatMap(asyncErrFn)
        .map(mapperAfterErr)
        .toPromise()
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe("async-mid-chain error")
      expect(mapperAfterErr).toHaveBeenCalledTimes(0)
    })
  })

  describe("permutations", () => {
    it("P1", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P2", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P3", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P4", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P5", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P6", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .flatMap(mockerB)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P7", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P8", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P9", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P10", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P11", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P12", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P13", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P14", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P15", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerD)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P16", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerB)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P17", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P18", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerC)
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P19", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P20", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .flatMap(mockerB)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P21", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P22", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P23", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerC)
        .flatMap(mockerA)
        .flatMap(mockerB)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
    it("P24", async () => {
      const r = Result.Ok(2)

      const mockerA = mock(doubleResIt)
      const mockerB = mock(asyncDoubleResIt)
      const mockerC = mock(doubleResPromiseIt)
      const mockerD = mock(asyncDoubleResPromiseIt)

      const mapped = await r
        .flatMap(mockerD)
        .flatMap(mockerB)
        .flatMap(mockerA)
        .flatMap(mockerC)
        .toPromise()

      expect(mapped.isOk()).toBeTrue()
      expect(mapped.unwrap()).toBe(32)
      expect(mockerA).toHaveBeenCalledTimes(1)
      expect(mockerB).toHaveBeenCalledTimes(1)
      expect(mockerC).toHaveBeenCalledTimes(1)
      expect(mockerD).toHaveBeenCalledTimes(1)
    })
  })
})
