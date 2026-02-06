/**
 * Result.gen() - Generator-based syntax for Result composition
 *
 * Result.gen() provides imperative-style code while maintaining
 * functional error handling. Short-circuits on first Err.
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs"

// ============================================================================
// BASIC GEN EXAMPLES
// ============================================================================

console.log("=== Result.gen() Examples ===\n")

// Example 1: Simple gen with single yield
const simple = Result.gen(function* () {
  const value = yield* Result.Ok(42)
  return value
})
console.log("1. Simple gen:", simple.unwrap()) // 42

// Example 2: Multiple yields - sequence operations
const multiple = Result.gen(function* () {
  const a = yield* Result.Ok(5)
  const b = yield* Result.Ok(10)
  return a + b
})
console.log("2. Multiple yields:", multiple.unwrap()) // 15

// Example 3: Short-circuit on first Err
const shortCircuit = Result.gen(function* () {
  const a = yield* Result.Ok(5)
  const b = yield* Result.Err<string, number>("error")
  const c = yield* Result.Ok(10) // This is never reached
  return a + b + c
})
console.log("3. Short-circuit:", shortCircuit.unwrapErr()) // "error"

// Example 4: gen with function calls
const fetchValue = (key: string): Result<number, "not_found"> => {
  if (key === "valid") return Result.Ok(42)
  return Result.Err("not_found")
}

const withFetch = Result.gen(function* () {
  const a = yield* fetchValue("valid")
  const b = yield* fetchValue("valid")
  return a + b
})
console.log("4. With fetch:", withFetch.unwrap()) // 84

// Example 5: gen for validation pipeline
const validatePositive = (n: number): Result<number, "not_positive"> => {
  return n > 0 ? Result.Ok(n) : Result.Err("not_positive")
}

const validateEven = (n: number): Result<number, "not_even"> => {
  return n % 2 === 0 ? Result.Ok(n) : Result.Err("not_even")
}

const validate = Result.gen(function* () {
  const input = yield* Result.Ok(4)
  const positive = yield* validatePositive(input)
  const even = yield* validateEven(positive)
  return even * 2
})
console.log("5. Validation pipeline:", validate.unwrap()) // 8

// Example 6: gen vs flatMap readability
// flatMap version (nested)
const flatMapVersion = Result.Ok(5).flatMap((a) =>
  Result.Ok(a * 2).flatMap((b) => Result.Ok(b + 10)),
)

// gen version (linear)
const genVersion = Result.gen(function* () {
  const a = yield* Result.Ok(5)
  const b = yield* Result.Ok(a * 2)
  return b + 10
})
console.log("6. flatMap:", flatMapVersion.unwrap()) // 20
console.log("   gen:", genVersion.unwrap()) // 20

// Example 7: gen for complex object building
interface User {
  id: number
  name: string
  email: string
}

const buildUser = Result.gen(function* () {
  const id = yield* Result.Ok(123)
  const name = yield* Result.Ok("Alice")
  const email = yield* Result.Ok("alice@example.com")

  return { id, name, email } as User
})
console.log("7. Build user:", buildUser.unwrap()) // { id: 123, name: "Alice", email: "alice@example.com" }

// Example 8: gen with intermediate processing
const processData = Result.gen(function* () {
  const rawData = yield* Result.Ok("  hello world  ")
  const trimmed = rawData.trim()
  const upper = trimmed.toUpperCase()
  const words = upper.split(" ")
  return words
})
console.log("8. Process data:", processData.unwrap()) // ["HELLO", "WORLD"]

// Example 9: gen with array operations
const arrayOps = Result.gen(function* () {
  const numbers = yield* Result.Ok([1, 2, 3, 4, 5])
  const doubled = numbers.map((n) => n * 2)
  const filtered = doubled.filter((n) => n > 5)
  const sum = filtered.reduce((a, b) => a + b, 0)
  return sum
})
console.log("9. Array operations:", arrayOps.unwrap()) // 24 (6 + 8 + 10)

// Example 10: gen for dependent operations
type UserId = number
type BasicUser = { id: UserId; name: string }
type PostId = number
type Post = { id: PostId; authorId: UserId; title: string }

const getUser = (id: UserId): Result<BasicUser, "user_not_found"> => {
  return Result.Ok({ id, name: `User ${id}` })
}

const getPostsByUser = (user: BasicUser): Result<Post[], "posts_error"> => {
  return Result.Ok([{ id: 1, authorId: user.id, title: `${user.name}'s Post` }])
}

const getUserWithPosts = (userId: UserId) => {
  return Result.gen(function* () {
    const user = yield* getUser(userId)
    const posts = yield* getPostsByUser(user)
    return { user, posts }
  })
}
console.log("10. User with posts:", getUserWithPosts(1).unwrap()) // { user: { id: 1, name: "User 1" }, posts: [...] }

// Example 11: gen with no yields (just returns value)
// biome-ignore lint/correctness/useYield: no worries
const noYields = Result.gen(function* () {
  // oxlint-disable-next-line require-yield
  return 42
})
console.log("11. No yields:", noYields.unwrap()) // 42

// Example 12: gen for error context collection
type ValidationError = { field: string; message: string }

const validateName = (name: string): Result<string, ValidationError> => {
  return name.length > 0
    ? Result.Ok(name)
    : Result.Err({ field: "name", message: "Required" })
}

const validateEmail = (email: string): Result<string, ValidationError> => {
  return email.includes("@")
    ? Result.Ok(email)
    : Result.Err({ field: "email", message: "Invalid" })
}

const validateForm = (name: string, email: string) => {
  return Result.gen(function* () {
    const validName = yield* validateName(name)
    const validEmail = yield* validateEmail(email)
    return { name: validName, email: validEmail }
  })
}
console.log(
  "12. Valid form:",
  validateForm("Alice", "alice@example.com").unwrap(),
) // { name: "Alice", email: "alice@example.com" }
console.log("    Invalid form:", validateForm("", "invalid").unwrapErr()) // { field: "name", message: "Required" }

// Example 13: gen handles many yields without stack overflow
const manyYields = Result.gen(function* () {
  let sum = 0
  for (let i = 0; i < 100; i++) {
    const value = yield* Result.Ok(i)
    sum += value
  }
  return sum
})
console.log("13. Many yields:", manyYields.unwrap()) // 4950 (sum of 0-99)

// Example 14: gen with conditional logic
const conditional = Result.gen(function* () {
  const input = yield* Result.Ok(5)
  if (input > 0) {
    return input * 2
  }
  return input
})
console.log("14. Conditional:", conditional.unwrap()) // 10

// Example 15: gen with early return on error
const earlyReturn = Result.gen(function* () {
  const a = yield* Result.Ok(5)
  const b = yield* validatePositive(a)
  const c = yield* validateEven(b)

  // If we reach here, all validations passed
  return c
})
console.log("15. Early return:", earlyReturn.unwrapErr()) // "not_even" (5 is not even)

// Example 16: gen for sequential API call pattern
type Config = { apiKey: string; endpoint: string }
const fetchConfig = (): Result<Config, "config_error"> => {
  return Result.Ok({ apiKey: "secret", endpoint: "/api" })
}

const validateConfig = (config: Config): Result<Config, "invalid_config"> => {
  return config.apiKey.length > 0
    ? Result.Ok(config)
    : Result.Err("invalid_config")
}

const initialize = () => {
  return Result.gen(function* () {
    const config = yield* fetchConfig()
    const validated = yield* validateConfig(config)
    return { initialized: true, config: validated }
  })
}
console.log("16. Initialize:", initialize().unwrap()) // { initialized: true, config: { apiKey: "secret", endpoint: "/api" } }

// Example 17: gen preserves type information through yields
type NumberResult = Result<number, "error">
type StringResult = Result<string, "error">

const typedPipeline = Result.gen(function* () {
  const num = yield* Result.Ok(42) as NumberResult
  const str = yield* Result.Ok(num.toString()) as StringResult
  return { num, str }
})
console.log("17. Typed pipeline:", typedPipeline.unwrap()) // { num: 42, str: "42" }

// Example 18: gen with error recovery pattern
const withFallback = Result.gen(function* () {
  const primary = yield* fetchValue("invalid")
  return primary
}).orElse(() => Result.Ok(0)) // Fallback to 0 on error
console.log("18. With fallback:", withFallback.unwrap()) // 0

// Example 19: gen for data transformation pipeline
type RawData = { value: string }
type ParsedData = { value: number }
type ValidatedData = { value: number; isValid: true }

const parse = (data: RawData): Result<ParsedData, "parse_error"> => {
  const num = Number(data.value)
  return Number.isNaN(num)
    ? Result.Err("parse_error")
    : Result.Ok({ value: num })
}

const validateRawData = (
  data: ParsedData,
): Result<ValidatedData, "validation_error"> => {
  return data.value > 0
    ? Result.Ok({ value: data.value, isValid: true })
    : Result.Err("validation_error")
}

const processRawData = (raw: RawData) => {
  return Result.gen(function* () {
    const parsed = yield* parse(raw)
    const validated = yield* validateRawData(parsed)
    return validated
  })
}
console.log("19. Process raw data:", processRawData({ value: "42" }).unwrap()) // { value: 42, isValid: true }

// Example 20: gen with accumulator pattern
const accumulator = Result.gen(function* () {
  let acc = 0
  const values = yield* Result.Ok([1, 2, 3, 4, 5])

  for (const value of values) {
    acc += value
  }

  return acc
})
console.log("20. Accumulator:", accumulator.unwrap()) // 15

console.log("\n=== All gen examples completed ===")
