/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it, mock } from "bun:test"
import { ExperimentalOption as Option } from "@/option-experimental.js"

describe("ExperimentalOption.gen", () => {
  describe("basic functionality", () => {
    it("should unwrap a single Some value", () => {
      const result = Option.gen(function* () {
        const value = yield* Option.Some(42)
        return value
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    it("should unwrap multiple Some values in sequence", () => {
      const result = Option.gen(function* () {
        const a = yield* Option.Some(1)
        const b = yield* Option.Some(2)
        const c = yield* Option.Some(3)
        return a + b + c
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(6)
    })

    it("should work with no yields", () => {
      const result = Option.gen(function* () {
        return 42
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    it("should short-circuit on first None", () => {
      let reachedAfterNone = false

      const result = Option.gen(function* () {
        const a = yield* Option.Some(1)
        const b = yield* Option.None
        reachedAfterNone = true
        const c = yield* Option.Some(3)
        return a + b + c
      })

      expect(result.isNone()).toBe(true)
      expect(reachedAfterNone).toBe(false)
    })

    it("should run finally block on None short-circuit", () => {
      let finalized = false

      const result = Option.gen(function* () {
        try {
          yield* Option.None
          return 1
        } finally {
          finalized = true
        }
      })

      expect(result.isNone()).toBe(true)
      expect(finalized).toBe(true)
    })

    it("should return singleton None", () => {
      const result1 = Option.gen(function* () {
        yield* Option.None
        return 1
      })

      const result2 = Option.gen(function* () {
        yield* Option.None
        return 2
      })

      expect(result1).toBe(Option.None)
      expect(result2).toBe(Option.None)
      expect(result1).toBe(result2)
    })

    it("should track intermediate variables", () => {
      const result = Option.gen(function* () {
        const a = yield* Option.Some(10)
        const b = yield* Option.Some(5)
        return a + b + a
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(25)
    })
  })

  describe("type inference", () => {
    it("should infer return type correctly", () => {
      const result = Option.gen(function* () {
        const a = yield* Option.Some(42)
        return a.toString()
      })

      expectTypeOf(result).toEqualTypeOf<Option<string>>()
      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe("42")
    })

    it("should infer number return type", () => {
      const result = Option.gen(function* () {
        const a = yield* Option.Some(1)
        const b = yield* Option.Some(2)
        return a + b
      })

      expectTypeOf(result).toEqualTypeOf<Option<number>>()
      expect(result.unwrap()).toBe(3)
    })
  })

  describe("real-world scenarios", () => {
    it("should handle validation flow", () => {
      const validatePositive = (n: number): Option<number> =>
        n > 0 ? Option.Some(n) : Option.None

      const result = Option.gen(function* () {
        const input = yield* Option.Some(4)
        const positive = yield* validatePositive(input)
        return positive * 2
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(8)
    })

    it("should not execute functions after None", () => {
      const mockFn = mock(() => Option.Some(10))

      const result = Option.gen(function* () {
        const a = yield* Option.None
        const b = yield* mockFn()
        return a + b
      })

      expect(result.isNone()).toBe(true)
      expect(mockFn).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("should handle many yields without stack overflow", () => {
      const result = Option.gen(function* () {
        let sum = 0
        for (let i = 0; i < 100; i++) {
          const value = yield* Option.Some(i)
          sum += value
        }
        return sum
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(4950)
    })

    it("should work with fromNullable", () => {
      const result = Option.gen(function* () {
        const value = yield* Option.fromNullable(null)
        return value
      })

      expect(result.isNone()).toBe(true)
    })
  })

  describe("comparison with flatMap", () => {
    it("should be equivalent to flatMap chain", () => {
      const genResult = Option.gen(function* () {
        const a = yield* Option.Some(1)
        const b = yield* Option.Some(2)
        return a + b
      })

      const flatMapResult = Option.Some(1).flatMap((a) =>
        Option.Some(2).map((b) => a + b),
      )

      expect(genResult.isSome()).toBe(true)
      expect(flatMapResult.isSome()).toBe(true)
      expect(genResult.unwrap()).toBe(flatMapResult.unwrap())
    })
  })
})
