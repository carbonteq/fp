/**
 * Option.flatMap() - Chain Option-returning functions
 *
 * flatMap() (also known as bind/chain) is used to sequence operations
 * that can return None. If the first Option is None, the subsequent function
 * is NOT called and None propagates.
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs"

// ============================================================================
// BASIC FLATMAP EXAMPLES
// ============================================================================

console.log("=== Option.flatMap() Examples ===\n")

// Example 1: Simple flatMap chain
const parseNumber = (str: string): Option<number> => {
  const num = Number(str)
  return Number.isNaN(num) ? Option.None : Option.Some(num)
}

const validatePositive = (n: number): Option<number> => {
  return n > 0 ? Option.Some(n) : Option.None
}

const result = parseNumber("42").flatMap((n) => validatePositive(n))
console.log("1. Valid chain:", result.unwrap()) // 42

// Example 2: Short-circuit on first None
const errorResult = parseNumber("invalid").flatMap((n) => validatePositive(n))
console.log("2. Parse error:", errorResult._tag) // "None"

// Example 3: Short-circuit on second None
const errorResult2 = parseNumber("-5").flatMap((n) => validatePositive(n))
console.log("3. Validation error:", errorResult2._tag) // "None"

// Example 4: Chaining multiple flatMaps
const divide = (a: number, b: number): Option<number> => {
  return b !== 0 ? Option.Some(a / b) : Option.None
}

const calculation = Option.Some(100)
  .flatMap((n) => divide(n, 2))
  .flatMap((n) => divide(n, 5))
  .flatMap((n) => validatePositive(n))
console.log("4. Chain calculations:", calculation.unwrap()) // 10

// Example 5: flatMap for fetching/looking up values
type UserId = number
type User = { id: UserId; name: string }
type PostId = number
type Post = { id: PostId; authorId: UserId; title: string }

const users: Map<UserId, User> = new Map([
  [1, { id: 1, name: "Alice" }],
  [2, { id: 2, name: "Bob" }],
])

const posts: Map<PostId, Post> = new Map([
  [101, { id: 101, authorId: 1, title: "Hello" }],
  [102, { id: 102, authorId: 2, title: "World" }],
])

const getUser = (id: UserId): Option<User> => {
  const user = users.get(id)
  return user ? Option.Some(user) : Option.None
}

const getPost = (id: PostId): Option<Post> => {
  const post = posts.get(id)
  return post ? Option.Some(post) : Option.None
}

const getPostAuthor = (postId: PostId): Option<User> => {
  return getPost(postId).flatMap((post) => getUser(post.authorId))
}

console.log("5. Get post author:", getPostAuthor(101).unwrap()) // { id: 1, name: "Alice" }

// Example 6: flatMap for validation pipeline
const requireString = (value: unknown): Option<string> => {
  return typeof value === "string" ? Option.Some(value) : Option.None
}

const requireNonEmpty = (str: string): Option<string> => {
  return str.length > 0 ? Option.Some(str) : Option.None
}

const validateInput = (value: unknown): Option<string> => {
  return requireString(value).flatMap((str) => requireNonEmpty(str))
}

console.log("6. Valid input:", validateInput("hello").unwrap()) // "hello"
console.log("   Invalid input:", validateInput(123)._tag) // "None"

// Example 7: flatMap vs map - when to use which
const mapExample = Option.Some(5).map((x) => Option.Some(x * 2)) // Option<Option<number>>
const flatMapExample = Option.Some(5).flatMap((x) => Option.Some(x * 2)) // Option<number>

console.log("7. map wraps Option:", mapExample.unwrap().unwrap()) // 10 (need double unwrap)
console.log("   flatMap flattens:", flatMapExample.unwrap()) // 10 (single unwrap)

// Example 8: Practical - User lookup chain
type Database = {
  users: Map<string, { id: string; name: string; email?: string }>
}

const db: Database = {
  users: new Map([
    ["user-123", { id: "user-123", name: "Alice", email: "alice@example.com" }],
    ["user-456", { id: "user-456", name: "Bob" }], // no email
  ]),
}

const findUser = (
  id: string,
): Option<{ id: string; name: string; email?: string }> => {
  const user = db.users.get(id)
  return user ? Option.Some(user) : Option.None
}

const getUserEmail = (id: string): Option<string> => {
  return findUser(id).flatMap((user) => Option.fromNullable(user.email))
}

console.log("8. User with email:", getUserEmail("user-123").unwrap()) // "alice@example.com"
console.log("   User without email:", getUserEmail("user-456")._tag) // "None"

// Example 9: flatMap is synchronous - for async operations, use gen.async* methods
// See 07-asyncGen.ts and 08-asyncGenAdapter.ts for async patterns

// Example 10: Nested object access with flatMap
type Address = { street: string; city: string }
type Company = { name: string; address?: Address }
type Employee = { name: string; company?: Company }

const getEmployeeCity = (employee: Employee): Option<string> => {
  return Option.fromNullable(employee.company)
    .flatMap((company) => Option.fromNullable(company.address))
    .map((address) => address.city)
}

const emp1: Employee = {
  name: "Alice",
  company: { name: "Acme", address: { street: "123 Main", city: "NYC" } },
}
const emp2: Employee = { name: "Bob", company: { name: "Acme" } }
const emp3: Employee = { name: "Charlie" }

console.log("9. Employee with city:", getEmployeeCity(emp1).unwrap()) // "NYC"
console.log("    Employee without address:", getEmployeeCity(emp2)._tag) // "None"
console.log("    Employee without company:", getEmployeeCity(emp3)._tag) // "None"

// Example 10: flatMap for safe array element access
const safeGetElement = <T>(arr: T[], index: number): Option<T> => {
  return index >= 0 && index < arr.length
    ? Option.Some(arr[index])
    : Option.None
}

const getSecondElement = <T>(arr: T[]): Option<T> => {
  return safeGetElement(arr, 1)
}

console.log("10. Second element:", getSecondElement([1, 2, 3]).unwrap()) // 2
console.log("    Out of bounds:", getSecondElement([1])._tag) // "None"

// Example 11: flatMap with Option.all
const getAllUsers = (...ids: UserId[]): Option<User[]> => {
  return Option.all(...ids.map((id) => getUser(id)))
}

console.log("11. All users found:", getAllUsers(1, 2).unwrap()) // [{ id: 1, ... }, { id: 2, ... }]
console.log("    Some users missing:", getAllUsers(1, 999)._tag) // "None"

// Example 12: flatMap for parsing and validating JSON
const safeParseJSON = (json: string): Option<unknown> => {
  try {
    return Option.Some(JSON.parse(json))
  } catch {
    return Option.None
  }
}

const validateString = (value: unknown): Option<string> => {
  return typeof value === "string" ? Option.Some(value) : Option.None
}

const parseAndValidateString = (json: string): Option<string> => {
  return safeParseJSON(json).flatMap((value) => validateString(value))
}

console.log(
  "12. Valid JSON string:",
  parseAndValidateString('"hello"').unwrap(),
) // "hello"
console.log("    Invalid JSON:", parseAndValidateString("invalid")._tag) // "None"
console.log("    Non-string JSON:", parseAndValidateString("123")._tag) // "None"

// Example 13: flatMap for configuration lookup
type Config = {
  api?: { key?: string; endpoint?: string }
  database?: { host?: string; port?: number }
}

const config: Config = {
  api: { key: "secret123", endpoint: "https://api.example.com" },
}

const getApiEndpoint = (cfg: Config): Option<string> => {
  return Option.fromNullable(cfg.api).flatMap((api) =>
    Option.fromNullable(api.endpoint),
  )
}

console.log("13. API endpoint:", getApiEndpoint(config).unwrap()) // "https://api.example.com"
console.log(
  "    Missing endpoint:",
  getApiEndpoint({ api: { key: "test" } })._tag,
) // "None"

// Example 14: flatMap with conditional logic
const findAdultUser = (id: UserId): Option<User> => {
  return getUser(id).flatMap((user) => {
    // Simulate age check
    const isAdult = true // Assume all users are adults for this example
    return isAdult ? Option.Some(user) : Option.None
  })
}

console.log("14. Adult user:", findAdultUser(1).unwrap()) // { id: 1, name: "Alice" }

console.log("\n=== All flatMap examples completed ===")
