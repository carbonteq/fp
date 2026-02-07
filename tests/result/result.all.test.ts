import { describe, expect, it } from "bun:test"
import { Result } from "@/result.js"

const asyncErrResIt = async (n: number): Promise<Result<number, number>> =>
  Result.Err(n)

describe("Result.all behavior", () => {
  it("should combine all Ok values", () => {
    const r1 = Result.Ok(1)
    const r2 = Result.Ok(2)
    const r3 = Result.Ok(3)
    const r4 = Result.Ok(4)
    const r5 = Result.Ok(5)

    const combined = Result.all(r1, r2, r3, r4, r5)

    expect(combined.isOk()).toBeTrue()
    expect(combined.unwrap()).toEqual([1, 2, 3, 4, 5])
  })

  it("should combine all Err values", () => {
    const r1 = Result.Err(1)
    const r2 = Result.Err(2)
    const r3 = Result.Err(3)
    const r4 = Result.Err(4)
    const r5 = Result.Err(5)

    const combined = Result.all(r1, r2, r3, r4, r5)

    expect(combined.isErr()).toBeTrue()
    expect(combined.unwrapErr()).toEqual([1, 2, 3, 4, 5])
  })

  it("should return Err values if even one exists", () => {
    const r1 = Result.Ok(1)
    const r2 = Result.Ok(2)
    const r3 = Result.Ok(3)
    const r4 = Result.Ok(4)
    const r5 = Result.Err(5)

    const combined = Result.all(r1, r2, r3, r4, r5)

    expect(combined.isErr()).toBeTrue()
    expect(combined.unwrapErr()).toEqual([5])
  })

  it("should return Err values if even one exists async", async () => {
    const r1 = Result.Ok(1)
    const r2 = Result.Ok(2)
    const r3 = Result.Ok(3)
    const r4 = Result.Ok(4)
    const r5 = Result.Ok(5).flatMap(asyncErrResIt)

    const combined = await Result.all(r1, r2, r3, r4, r5).toPromise()

    expect(combined.isErr()).toBeTrue()
    expect(combined.unwrapErr()).toEqual([5])
  })

  it("should combine sync and async values", async () => {
    const r1 = Result.Ok(1)
    const r2 = Result.Ok(Promise.resolve(2))
    const r3 = Result.Ok(3)
    const r4 = Result.Ok(Promise.resolve(4))
    const r5 = Result.Ok(5)

    const combined = await Result.all(r1, r2, r3, r4, r5).toPromise()

    expect(combined.isOk()).toBeTrue()
    expect(combined.unwrap()).toEqual([1, 2, 3, 4, 5])
  })

  it("should combine sync and async errors", async () => {
    const r1 = Result.Err(1)
    const r2 = Result.Ok(2).flatMap(asyncErrResIt)
    const r3 = Result.Err(3)
    const r4 = Result.Ok(4).flatMap(asyncErrResIt)
    const r5 = Result.Err(5)

    const combined = await Result.all(r1, r2, r3, r4, r5).toPromise()

    expect(combined.isErr()).toBeTrue()
    expect(combined.unwrapErr()).toEqual([1, 2, 3, 4, 5])
  })
})
