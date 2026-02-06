/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it } from "bun:test"
import { ExperimentalResult as Result } from "@/result-experimental.js"

describe("ExperimentalResult.genAdapter", () => {
  describe("basic functionality", () => {
    it("should unwrap Ok values", () => {
      const result = Result.genAdapter(function* ($) {
        const a = yield* $(Result.Ok(1))
        const b = yield* $(Result.Ok(2))
        return a + b
      })

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(3)
    })

    it("should short-circuit on Err", () => {
      let reached = false

      const result = Result.genAdapter(function* ($) {
        const a = yield* $(Result.Ok(1))
        const b = yield* $(Result.Err("error" as const))
        reached = true
        return a + b
      })

      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe("error")
      expect(reached).toBe(false)
    })

    it("should work with no yields", () => {
      const result = Result.genAdapter(function* (_$) {
        return 42
      })

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })
  })

  describe("type inference", () => {
    it("should infer return type correctly", () => {
      const r = Result.genAdapter(function* ($) {
        const a = yield* $(Result.Ok(42))
        return a.toString()
      })
      expectTypeOf(r).toEqualTypeOf<Result<string, never>>()
    })

    it("should infer error union type", () => {
      type E1 = "error1"
      type E2 = "error2"

      const r = Result.genAdapter(function* ($) {
        const a = yield* $(Result.Ok<number, E1>(1))
        const b = yield* $(Result.Ok<string, E2>("x"))
        return a + b.length
      })

      expectTypeOf(r).toEqualTypeOf<Result<number, E1 | E2>>()
    })

    it("should infer never for error when all Ok", () => {
      const r = Result.genAdapter(function* ($) {
        const a = yield* $(Result.Ok(1))
        const b = yield* $(Result.Ok(2))
        return a + b
      })

      expectTypeOf(r).toEqualTypeOf<Result<number, never>>()
    })

    it("should preserve value types through yields", () => {
      const r = Result.genAdapter(function* ($) {
        const num = yield* $(Result.Ok(42))
        const str = yield* $(Result.Ok("hello"))
        const obj = yield* $(Result.Ok({ x: 1 }))

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
      const validatePositive = (n: number): Result<number, "not_positive"> =>
        n > 0 ? Result.Ok(n) : Result.Err("not_positive")

      const validateEven = (n: number): Result<number, "not_even"> =>
        n % 2 === 0 ? Result.Ok(n) : Result.Err("not_even")

      const result = Result.genAdapter(function* ($) {
        const a = yield* $(validatePositive(4))
        const b = yield* $(validateEven(a))
        return b * 2
      })

      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(8)

      // Type should be Result<number, "not_positive" | "not_even">
    })

    it("should handle user registration example", () => {
      type User = { id: string; email: string }
      type ValidationError = "invalid_email" | "weak_password"
      type DbError = "duplicate_email" | "connection_failed"

      const validateEmail = (e: string): Result<string, "invalid_email"> =>
        e.includes("@") ? Result.Ok(e) : Result.Err("invalid_email")

      const validatePassword = (p: string): Result<string, "weak_password"> =>
        p.length >= 8 ? Result.Ok(p) : Result.Err("weak_password")

      const createUser = (
        email: string,
        _password: string,
      ): Result<User, DbError> => Result.Ok({ id: "123", email })

      const register = (
        email: string,
        password: string,
      ): Result<User, ValidationError | DbError> =>
        Result.genAdapter(function* ($) {
          const validEmail = yield* $(validateEmail(email))
          const validPassword = yield* $(validatePassword(password))
          const user = yield* $(createUser(validEmail, validPassword))
          return user
        })

      const success = register("test@example.com", "securepassword")
      expect(success.isOk()).toBe(true)

      const failure = register("invalid", "short")
      expect(failure.isErr()).toBe(true)
      expect(failure.unwrapErr()).toBe("invalid_email")
    })
  })

  describe("variable reuse", () => {
    it("should allow reusing intermediate values", () => {
      const result = Result.genAdapter(function* ($) {
        const config = yield* $(Result.Ok({ multiplier: 2, offset: 10 }))
        const base = yield* $(Result.Ok(5))

        // Reuse config multiple times
        const scaled = base * config.multiplier
        const final = scaled + config.offset

        return final
      })

      expect(result.unwrap()).toBe(20)
    })
  })

  describe("comparison with genSimple", () => {
    it("should produce same result as genSimple", () => {
      const genResult = Result.genAdapter(function* ($) {
        const a = yield* $(Result.Ok(1))
        const b = yield* $(Result.Ok(2))
        return a + b
      })

      const genSimpleResult = Result.gen(function* () {
        const a = yield* Result.Ok(1)
        const b = yield* Result.Ok(2)
        return a + b
      })

      expect(genResult.isOk()).toBe(true)
      expect(genSimpleResult.isOk()).toBe(true)
      expect(genResult.unwrap()).toBe(genSimpleResult.unwrap())
    })
  })
})
