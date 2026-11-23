import { describe, expect, expectTypeOf, it } from "bun:test"
import { isTuple, setAsTuple, type Tuple } from "@/tuple.js"

describe("isTuple", () => {
  it("returns false for null and undefined without throwing", () => {
    expect(isTuple(null)).toBe(false)
    expect(isTuple(undefined)).toBe(false)
  })

  it("returns false for primitives", () => {
    for (const value of [false, true, 0, 42, "", "tuple", 0n, Symbol("tuple")]) {
      expect(isTuple(value)).toBe(false)
    }
  })

  it("returns false for unbranded arrays and objects", () => {
    expect(isTuple([])).toBe(false)
    expect(isTuple([1, 2])).toBe(false)
    expect(isTuple({})).toBe(false)
    expect(isTuple({ 0: 1, length: 1 })).toBe(false)
  })

  it("recognizes arrays branded by setAsTuple", () => {
    expect(isTuple(setAsTuple([]))).toBe(true)
    expect(isTuple(setAsTuple([1, 2]))).toBe(true)
  })

  it("narrows unknown values to Tuple", () => {
    const value: unknown = setAsTuple([1, 2])

    if (!isTuple<number>(value)) {
      throw new Error("Expected a branded Tuple")
    }

    expectTypeOf(value).toEqualTypeOf<Tuple<number>>()
    const doubled: number[] = value.map((item) => item * 2)
    expect(doubled).toEqual([2, 4])
  })
})
