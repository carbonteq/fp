/**
 * Type inference tests for Flow generators.
 *
 * Uses Bun's expectTypeOf to verify that error types are correctly inferred
 * for FlowError subclasses (including inheritance chains), Result.Err, Option.None,
 * and combinations thereof.
 */
import { describe, expect, expectTypeOf, test } from "bun:test"
import {
  ExperimentalFlowError,
  ExperimentalFlow as XFlow,
} from "@/flow-experimental.js"
import {
  ExperimentalOption as Option,
  type UnwrappedNone,
} from "@/option-experimental.js"
import { ExperimentalResult as Result } from "@/result-experimental.js"

// ============================================================================
// Test Error Hierarchy
// ============================================================================

// Level 1: Direct FlowError subclasses
class AppError extends ExperimentalFlowError {
  readonly _tag = "AppError" as const
  constructor(message = "App error") {
    super(message)
  }
}

class NetworkError extends ExperimentalFlowError {
  readonly _tag = "NetworkError" as const
  constructor(message = "Network error") {
    super(message)
  }
}

// Level 2: Subclasses of AppError (2 levels deep)
class ValidationError extends AppError {
  readonly _tag2 = "ValidationError" as const
  constructor(message = "Validation error") {
    super(message)
  }
}

class NotFoundError extends AppError {
  readonly _tag2 = "NotFoundError" as const
  constructor(message = "Not found") {
    super(message)
  }
}

// Level 3: Subclasses of ValidationError (3 levels deep)
class FieldValidationError extends ValidationError {
  readonly _tag3 = "FieldValidationError" as const
  constructor(
    public field: string,
    message = "Field validation error",
  ) {
    super(message)
  }
}

// ============================================================================
// XFlow.gen Type Inference Tests
// ============================================================================

describe("XFlow.gen type inference", () => {
  describe("single error types", () => {
    test("infers direct FlowError subclass", () => {
      const result = XFlow.gen(function* () {
        yield* new AppError()
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<Result<number, AppError>>()
      expect(result.isErr()).toBe(true)
    })

    test("infers 2-level deep FlowError subclass", () => {
      const result = XFlow.gen(function* () {
        yield* new ValidationError()
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<Result<number, ValidationError>>()
      expect(result.isErr()).toBe(true)
    })

    test("infers 3-level deep FlowError subclass", () => {
      const result = XFlow.gen(function* () {
        yield* new FieldValidationError("email")
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<Result<number, FieldValidationError>>()
      expect(result.isErr()).toBe(true)
    })

    test("infers Result.Err error type", () => {
      const result = XFlow.gen(function* () {
        yield* Result.Err("string error" as const)
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<Result<number, "string error">>()
      expect(result.isErr()).toBe(true)
    })

    test("infers UnwrappedNone from Option.None", () => {
      const result = XFlow.gen(function* () {
        yield* Option.None
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<Result<number, UnwrappedNone>>()
      expect(result.isErr()).toBe(true)
    })
  })

  describe("union error types", () => {
    test("infers union of two FlowError subclasses", () => {
      const result = XFlow.gen(function* () {
        yield* new ValidationError()
        yield* new NotFoundError()
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<
        Result<number, ValidationError | NotFoundError>
      >()
    })

    test("infers union of sibling FlowError subclasses", () => {
      const result = XFlow.gen(function* () {
        yield* new AppError()
        yield* new NetworkError()
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<
        Result<number, AppError | NetworkError>
      >()
    })

    test("infers union of FlowError and Result.Err", () => {
      const result = XFlow.gen(function* () {
        yield* new ValidationError()
        yield* Result.Err("string error" as const)
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<
        Result<number, ValidationError | "string error">
      >()
    })

    test("infers union of FlowError and Option.None", () => {
      const result = XFlow.gen(function* () {
        yield* new ValidationError()
        yield* Option.None
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<
        Result<number, ValidationError | UnwrappedNone>
      >()
    })

    test("infers union of all three: FlowError, Result.Err, Option.None", () => {
      const result = XFlow.gen(function* () {
        yield* new ValidationError()
        yield* Result.Err(42 as const)
        yield* Option.None
        return 1
      })

      expectTypeOf(result).toEqualTypeOf<
        Result<number, ValidationError | 42 | UnwrappedNone>
      >()
    })

    test("infers complex union with multiple FlowError subclasses", () => {
      const result = XFlow.gen(function* () {
        yield* new AppError()
        yield* new ValidationError()
        yield* new NotFoundError()
        yield* new NetworkError()
        return 1
      })

      // Note: TypeScript normalizes union types - ValidationError and NotFoundError
      // are subtypes of AppError, so they get absorbed into AppError in the union
      expectTypeOf(result).toEqualTypeOf<
        Result<number, AppError | NetworkError>
      >()
    })
  })

  describe("conditional error types", () => {
    test("infers union from conditional yields", () => {
      const getValue = (input: number) =>
        XFlow.gen(function* () {
          if (input < 0) {
            yield* new ValidationError("Must be positive")
          }
          if (input === 0) {
            yield* new NotFoundError("Zero not allowed")
          }
          return input * 2
        })

      const result = getValue(5)

      expectTypeOf(result).toEqualTypeOf<
        Result<number, ValidationError | NotFoundError>
      >()
      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(10)
    })

    test("infers correct type when using Option.fromNullable", () => {
      const getValue = (input: number | null) =>
        XFlow.gen(function* () {
          const value = yield* Option.fromNullable(input)
          if (value < 0) {
            yield* new ValidationError()
          }
          return value * 2
        })

      const result = getValue(5)

      expectTypeOf(result).toEqualTypeOf<
        Result<number, UnwrappedNone | ValidationError>
      >()
      expect(result.isOk()).toBe(true)
    })
  })

  describe("return type inference", () => {
    test("infers correct success type", () => {
      const result = XFlow.gen(function* () {
        const a = yield* Option.Some(10)
        const b = yield* Result.Ok("hello")
        return { num: a, str: b }
      })

      expectTypeOf(result).toEqualTypeOf<
        Result<{ num: number; str: string }, UnwrappedNone>
      >()
      expect(result.isOk()).toBe(true)
    })

    test("infers array return type", () => {
      const result = XFlow.gen(function* () {
        const a = yield* Option.Some([1, 2, 3])
        return a.map((x) => x * 2)
      })

      expectTypeOf(result).toEqualTypeOf<Result<number[], UnwrappedNone>>()
      expect(result.isOk()).toBe(true)
    })
  })
})

// ============================================================================
// XFlow.asyncGen Type Inference Tests
// ============================================================================

describe("Flow.asyncGen type inference", () => {
  test("infers FlowError subclass in async context", async () => {
    const result = await XFlow.asyncGen(async function* () {
      yield* new ValidationError()
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, ValidationError>>()
    expect(result.isErr()).toBe(true)
  })

  test("infers union with awaited Result", async () => {
    const fetchData = async (): Promise<Result<string, NetworkError>> =>
      Result.Ok("data that is long enough")

    const result = await XFlow.asyncGen(async function* () {
      const data = yield* await fetchData()
      if (data.length < 10) {
        yield* new ValidationError("Too short")
      }
      return data
    })

    expectTypeOf(result).toEqualTypeOf<
      Result<string, NetworkError | ValidationError>
    >()
    expect(result.isOk()).toBe(true)
  })

  test("infers deep inheritance in async context", async () => {
    const result = await XFlow.asyncGen(async function* () {
      yield* new FieldValidationError("email")
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, FieldValidationError>>()
    expect(result.isErr()).toBe(true)
  })
})

// ============================================================================
// XFlow.genAdapter Type Inference Tests ($.fail)
// ============================================================================

describe("Flow.genAdapter type inference with $.fail", () => {
  test("infers error type from $.fail", () => {
    const result = XFlow.genAdapter(function* ($) {
      yield* $.fail(new ValidationError())
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, ValidationError>>()
    expect(result.isErr()).toBe(true)
  })

  test("infers union of $.fail and $() errors", () => {
    const result = XFlow.genAdapter(function* ($) {
      yield* $(Result.Err("string error" as const))
      yield* $.fail(new ValidationError())
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<
      Result<number, "string error" | ValidationError>
    >()
  })

  test("infers $.fail with deep inheritance", () => {
    const result = XFlow.genAdapter(function* ($) {
      yield* $.fail(new FieldValidationError("email"))
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, FieldValidationError>>()
    expect(result.isErr()).toBe(true)
  })

  test("infers union from conditional $.fail", () => {
    const getValue = (input: number) =>
      XFlow.genAdapter(function* ($) {
        if (input < 0) {
          yield* $.fail(new ValidationError())
        }
        if (input === 0) {
          yield* $.fail(new NotFoundError())
        }
        const doubled = yield* $(Option.Some(input * 2))
        return doubled
      })

    const result = getValue(5)

    expectTypeOf(result).toEqualTypeOf<
      Result<number, UnwrappedNone | ValidationError | NotFoundError>
    >()
    expect(result.isOk()).toBe(true)
  })
})

// ============================================================================
// XFlow.asyncGenAdapter Type Inference Tests ($.fail)
// ============================================================================

describe("Flow.asyncGenAdapter type inference with $.fail", () => {
  test("infers error type from $.fail async", async () => {
    const result = await XFlow.asyncGenAdapter(async function* ($) {
      yield* $.fail(new ValidationError())
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, ValidationError>>()
    expect(result.isErr()).toBe(true)
  })

  test("infers union with Promise and $.fail", async () => {
    const fetchData = async (): Promise<Result<string, NetworkError>> =>
      Result.Ok("data that is long enough")

    const result = await XFlow.asyncGenAdapter(async function* ($) {
      const data = yield* $(fetchData())
      if (data.length < 10) {
        yield* $.fail(new ValidationError("Too short"))
      }
      return data
    })

    expectTypeOf(result).toEqualTypeOf<
      Result<string, NetworkError | ValidationError>
    >()
    expect(result.isOk()).toBe(true)
  })

  test("infers complex union in real-world scenario", async () => {
    const fetchUser = async (
      id: number,
    ): Promise<Result<{ name: string }, NotFoundError>> =>
      id > 0 ? Result.Ok({ name: "Alice" }) : Result.Err(new NotFoundError())

    const fetchSettings = async (
      name: string,
    ): Promise<Option<{ theme: string }>> =>
      name ? Option.Some({ theme: "dark" }) : Option.None

    const getEnrichedUser = async (userId: number) =>
      XFlow.asyncGenAdapter(async function* ($) {
        if (userId <= 0) {
          yield* $.fail(new ValidationError("Invalid user ID"))
        }

        const user = yield* $(fetchUser(userId))
        const settings = yield* $(fetchSettings(user.name))

        return { user, settings }
      })

    const result = await getEnrichedUser(1)

    expectTypeOf(result).toEqualTypeOf<
      Result<
        { user: { name: string }; settings: { theme: string } },
        UnwrappedNone | NotFoundError | ValidationError
      >
    >()
    expect(result.isOk()).toBe(true)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe("type inference edge cases", () => {
  test("only Option.Some yields infer UnwrappedNone", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(1)
      const b = yield* Option.Some(2)
      return a + b
    })

    // Option.Some can't fail, but the type system still includes UnwrappedNone
    // because Option<T> could be None at runtime
    expectTypeOf(result).toEqualTypeOf<Result<number, UnwrappedNone>>()
    expect(result.isOk()).toBe(true)
  })

  test("only Result.Ok yields infer never for error", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Result.Ok(1)
      const b = yield* Result.Ok(2)
      return a + b
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, never>>()
    expect(result.isOk()).toBe(true)
  })

  test("preserves specific literal error types", () => {
    const result = XFlow.gen(function* () {
      yield* Result.Err("ERROR_A" as const)
      yield* Result.Err("ERROR_B" as const)
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<Result<number, "ERROR_A" | "ERROR_B">>()
  })

  test("preserves error object types", () => {
    const result = XFlow.gen(function* () {
      yield* Result.Err({ code: 404, message: "Not found" } as const)
      return 1
    })

    expectTypeOf(result).toEqualTypeOf<
      Result<number, { readonly code: 404; readonly message: "Not found" }>
    >()
  })
})
