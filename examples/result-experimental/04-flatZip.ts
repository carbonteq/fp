/**
 * Result.flatZip() - Pair original with value from another Result
 *
 * flatZip() is like zip() but the function returns a Result.
 * It pairs the original value with the unwrapped value from the Result.
 * If either Result is Err, the error propagates.
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs"

// ============================================================================
// BASIC FLATZIP EXAMPLES
// ============================================================================

console.log("=== Result.flatZip() Examples ===\n")

// Example 1: Basic flatZip - pair value with Result-returning function
const flatZipped = Result.Ok(5).flatZip((x) => Result.Ok(x * 2))
console.log("1. FlatZip 5 with Result.Ok(10):", flatZipped.unwrap()) // [5, 10]

// Example 2: flatZip with Err - error propagates
const flatZippedErr = Result.Ok(5).flatZip((_x) => Result.Err("error"))
console.log("2. FlatZip with Err:", flatZippedErr.unwrapErr()) // "error"

// Example 3: flatZip on initial Err - short-circuits
const initialErr = Result.Err<string, number>("initial").flatZip((x) =>
  Result.Ok(x * 2),
)
console.log("3. FlatZip on initial Err:", initialErr.unwrapErr()) // "initial"

// Example 4: Chaining flatZips - accumulate values
const chained = Result.Ok(1)
  .flatZip((a) => Result.Ok(a + 1)) // [1, 2]
  .flatZip(([a, b]) => Result.Ok(a + b)) // [[1, 2], 3]

console.log("4. Chained flatZip:", chained.unwrap()) // [[1, 2], 3]

// Example 5: flatZip is synchronous - for async operations, use gen.async* methods
// See 07-asyncGen.ts and 08-asyncGenAdapter.ts for async patterns

// Example 6: Practical - User and their posts
type UserId = number
type User = { id: UserId; name: string }
type Post = { id: number; authorId: UserId; title: string }

const getUser = (id: UserId): Result<User, "user_not_found"> => {
  return Result.Ok({ id, name: `User ${id}` })
}

const getUserPosts = (user: User): Result<Post[], "posts_error"> => {
  return Result.Ok([{ id: 1, authorId: user.id, title: `${user.name}'s Post` }])
}

const userWithPosts = getUser(1).flatZip((user) => getUserPosts(user))
console.log("6. User with posts:", userWithPosts.unwrap()) // [{ id: 1, name: "User 1" }, [{ ... }]]

// Example 7: flatZip for dependent lookups
type ProductId = number
type Product = { id: ProductId; name: string; price: number }
type Inventory = { productId: ProductId; quantity: number }

const getProduct = (id: ProductId): Result<Product, "product_not_found"> => {
  return Result.Ok({ id, name: "Widget", price: 10 })
}

const getInventory = (
  product: Product,
): Result<Inventory, "inventory_not_found"> => {
  return Result.Ok({ productId: product.id, quantity: 100 })
}

const productWithInventory = getProduct(1).flatZip((product) =>
  getInventory(product),
)
console.log("7. Product with inventory:", productWithInventory.unwrap()) // [{ id: 1, name: "Widget", price: 10 }, { productId: 1, quantity: 100 }]

// Example 8: flatZip for validation with context preservation
type ValidationError = { field: string; message: string }

const validateEmailBasic = (email: string): Result<string, ValidationError> => {
  return email.includes("@")
    ? Result.Ok(email)
    : Result.Err({ field: "email", message: "Invalid email" })
}

const normalizeEmail = (email: string): Result<string, ValidationError> => {
  return Result.Ok(email.toLowerCase().trim())
}

const emailWithValidation = Result.Ok("USER@EXAMPLE.COM")
  .flatZip((email) => normalizeEmail(email))
  .flatZip(([_original, normalized]) => validateEmailBasic(normalized))

console.log("8. Email validation chain:", emailWithValidation.unwrap()) // [["USER@EXAMPLE.COM", "user@example.com"], "user@example.com"]

// Example 9: flatMap for building complex objects step by step
// Use flatMap when you don't need to preserve the intermediate value
type Address = { street: string; city: string }
type Person = { name: string; age: number }

const validatePerson = (data: {
  name: string
  age: number
}): Result<Person, ValidationError> => {
  return data.age >= 18
    ? Result.Ok(data)
    : Result.Err({ field: "age", message: "Must be 18 or older" })
}

const fetchAddress = (_person: Person): Result<Address, ValidationError> => {
  return Result.Ok({ street: "123 Main St", city: "Anytown" })
}

const createPersonWithAddress = (data: { name: string; age: number }) => {
  return validatePerson(data).flatMap((person) =>
    fetchAddress(person).map((address) => ({
      ...person,
      address,
    })),
  )
}

console.log(
  "9. Person with address:",
  createPersonWithAddress({ name: "Alice", age: 25 }).unwrap(),
) // { name: "Alice", age: 25, address: { street: "123 Main St", city: "Anytown" } }

// Example 10: flatZip vs flatMap - preserving original
const flatMapResult = Result.Ok(5).flatMap((x) => Result.Ok(x * 2)) // Result<number, never>
const flatZipResult = Result.Ok(5).flatZip((x) => Result.Ok(x * 2)) // Result<[5, 10], never>

console.log("10. flatMap loses original:", flatMapResult.unwrap()) // 10
console.log("    flatZip preserves:", flatZipResult.unwrap()) // [5, 10]

// Example 11: flatZip for collecting audit trail
type AuditLog<T> = { timestamp: number; data: T }

const withAudit = <T, E>(result: Result<T, E>): Result<[T, AuditLog<T>], E> => {
  const timestamp = Date.now()
  return result.flatZip((data) => Result.Ok({ timestamp, data }))
}

const auditedResult = withAudit(Result.Ok({ value: 42 }))
console.log("11. Audited result:", auditedResult.unwrap()) // [{ value: 42 }, { timestamp: ..., data: { value: 42 } }]

// Example 12: flatZip for maintaining context through transformations
type Context<T> = { original: T; current: T }

const withContext = <T>(value: T): Result<Context<T>, never> => {
  return Result.Ok({ original: value, current: value })
}

const transformWithContext = <T, E>(
  context: Result<Context<T>, E>,
  fn: (value: T) => Result<T, E>,
): Result<Context<T>, E> => {
  return context.flatMap((ctx) =>
    fn(ctx.current).map((newCurrent) => ({
      original: ctx.original,
      current: newCurrent,
    })),
  )
}

const result = transformWithContext(withContext(10), (n) =>
  Result.Ok(n * 2),
).flatMap((ctx) =>
  transformWithContext(Result.Ok(ctx), (n) => Result.Ok(n + 5)),
)

console.log("12. Context through transformations:", result.unwrap()) // { original: 10, current: 25 }

// Example 13: flatZip for branching logic
const getConfig = (key: string): Result<string, "config_not_found"> => {
  const configs: Record<string, string> = {
    api_key: "secret123",
    timeout: "5000",
  }
  const value = configs[key]
  return value ? Result.Ok(value) : Result.Err("config_not_found")
}

const parseTimeout = (
  timeoutStr: string,
): Result<number, "invalid_timeout"> => {
  const parsed = parseInt(timeoutStr, 10)
  return Number.isNaN(parsed)
    ? Result.Err("invalid_timeout")
    : Result.Ok(parsed)
}

const getConfigValue = (
  key: string,
): Result<[string, number], "config_not_found" | "invalid_timeout"> => {
  return getConfig(key).flatZip((value) => parseTimeout(value))
}

console.log("13. Config value:", getConfigValue("timeout").unwrap()) // ["5000", 5000]
console.log("    Invalid config:", getConfigValue("api_key").unwrapErr()) // "invalid_timeout" (because "secret123" is not a number)

// Example 14: flatZip for multi-step validation pipeline
type ValidationResult<T> = Result<T, ValidationError>

interface UserData {
  email: string
  password: string
  age: number
}

const validateUserData = (data: UserData): ValidationResult<UserData> => {
  return Result.Ok(data)
    .flatMap((data) => validateEmail(data.email).map(() => data))
    .flatMap((data) => validatePassword(data.password).map(() => data))
    .flatMap((data) => validateAge(data.age).map(() => data))
}

const validateEmail = (email: string): ValidationResult<string> => {
  return email.includes("@")
    ? Result.Ok(email)
    : Result.Err({ field: "email", message: "Invalid" })
}

const validatePassword = (password: string): ValidationResult<string> => {
  return password.length >= 8
    ? Result.Ok(password)
    : Result.Err({ field: "password", message: "Too short" })
}

const validateAge = (age: number): ValidationResult<number> => {
  return age >= 18
    ? Result.Ok(age)
    : Result.Err({ field: "age", message: "Too young" })
}

console.log(
  "14. Valid user:",
  validateUserData({
    email: "test@example.com",
    password: "password123",
    age: 25,
  }).unwrap(),
) // { email: "test@example.com", password: "password123", age: 25 }
console.log(
  "    Invalid email:",
  validateUserData({
    email: "invalid",
    password: "password123",
    age: 25,
  }).unwrapErr(),
) // { field: "email", message: "Invalid" }

console.log("\n=== All flatZip examples completed ===")
