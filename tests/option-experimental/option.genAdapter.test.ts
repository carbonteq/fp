/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it } from "bun:test"
import { ExperimentalOption as Option } from "@/option-experimental.js"

describe("ExperimentalOption.genAdapter", () => {
  describe("basic functionality", () => {
    it("should unwrap Some values", () => {
      const result = Option.genAdapter(function* ($) {
        const a = yield* $(Option.Some(1))
        const b = yield* $(Option.Some(2))
        return a + b
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(3)
    })

    it("should short-circuit on None", () => {
      let reached = false

      const result = Option.genAdapter(function* ($) {
        const a = yield* $(Option.Some(1))
        const b = yield* $(Option.None as Option<number>)
        reached = true
        return a + b
      })

      expect(result.isNone()).toBe(true)
      expect(reached).toBe(false)
    })

    it("should work with no yields", () => {
      const result = Option.genAdapter(function* (_$) {
        return 42
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    it("should return singleton None", () => {
      const result1 = Option.genAdapter(function* ($) {
        yield* $(Option.None)
        return 1
      })

      const result2 = Option.genAdapter(function* ($) {
        yield* $(Option.None)
        return 2
      })

      expect(result1).toBe(Option.None)
      expect(result2).toBe(Option.None)
      expect(result1).toBe(result2)
    })
  })

  describe("type inference", () => {
    it("should infer return type correctly", () => {
      const r = Option.genAdapter(function* ($) {
        const a = yield* $(Option.Some(42))
        return a.toString()
      })
      expectTypeOf(r).toEqualTypeOf<Option<string>>()
    })

    it("should infer number return type", () => {
      const r = Option.genAdapter(function* ($) {
        const a = yield* $(Option.Some(1))
        const b = yield* $(Option.Some(2))
        return a + b
      })

      expectTypeOf(r).toEqualTypeOf<Option<number>>()
      expect(r.unwrap()).toBe(3)
    })

    it("should preserve value types through yields", () => {
      const r = Option.genAdapter(function* ($) {
        const num = yield* $(Option.Some(42))
        const str = yield* $(Option.Some("hello"))
        const obj = yield* $(Option.Some({ x: 1 }))

        // These should all have correct types
        expectTypeOf(num).toBeNumber()
        expectTypeOf(str).toBeString()
        expectTypeOf(obj).toEqualTypeOf<{ x: number }>()

        return { num, str, obj }
      })

      expect(r.unwrap()).toEqual({ num: 42, str: "hello", obj: { x: 1 } })
    })
  })

  describe("real-world scenarios", () => {
    it("should handle validation flow", () => {
      const validatePositive = (n: number): Option<number> =>
        n > 0 ? Option.Some(n) : Option.None

      const result = Option.genAdapter(function* ($) {
        const input = yield* $(Option.Some(4))
        const positive = yield* $(validatePositive(input))
        return positive * 2
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(8)
    })

    it("should handle chained validation", () => {
      const validatePositive = (n: number): Option<number> =>
        n > 0 ? Option.Some(n) : Option.None

      const validateEven = (n: number): Option<number> =>
        n % 2 === 0 ? Option.Some(n) : Option.None

      const result = Option.genAdapter(function* ($) {
        const a = yield* $(Option.Some(4))
        const positive = yield* $(validatePositive(a))
        const even = yield* $(validateEven(positive))
        return even * 2
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(8)
    })
  })

  describe("comparison with genSimple", () => {
    it("should produce same result as genSimple", () => {
      const genResult = Option.genAdapter(function* ($) {
        const a = yield* $(Option.Some(1))
        const b = yield* $(Option.Some(2))
        return a + b
      })

      const genSimpleResult = Option.gen(function* () {
        const a = yield* Option.Some(1)
        const b = yield* Option.Some(2)
        return a + b
      })

      expect(genResult.isSome()).toBe(true)
      expect(genSimpleResult.isSome()).toBe(true)
      expect(genResult.unwrap()).toBe(genSimpleResult.unwrap())
    })
  })
})
