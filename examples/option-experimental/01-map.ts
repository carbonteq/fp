/**
 * Option.map() - Transform the Some value
 *
 * map() applies a function to the Some value, leaving None unchanged.
 * If the Option is None, the mapper function is NOT called.
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs"

// ============================================================================
// BASIC MAP EXAMPLES
// ============================================================================

console.log("=== Option.map() Examples ===\n")

// Example 1: Simple number transformation
const numberSome = Option.Some(5)
const doubled = numberSome.map((x) => x * 2)
console.log("1. Double 5:", doubled.unwrap()) // 10

// Example 2: Map on None - mapper is NOT called
const numberNone = Option.None
const doubledNone = numberNone.map((x) => {
  console.log("  This will NOT be printed!")
  return x * 2
})
console.log("2. Map on None:", doubledNone.toString()) // Option::None

// Example 3: Chaining multiple maps
const result = Option.Some(10)
  .map((x) => x + 5)
  .map((x) => x * 2)
  .map((x) => x.toString())
console.log("3. Chain maps:", result.unwrap()) // "30"

// Example 4: Map to object
type UserId = number
type User = { id: UserId; name: string }

const userId = Option.Some(42)
const user = userId.map((id): User => ({ id, name: `User ${id}` }))
console.log("4. Map to object:", user.unwrap()) // { id: 42, name: "User 42" }

// Example 5: Map that transforms type
const parsed = Option.Some("123")
  .map((str) => parseInt(str, 10))
  .map((num) => num * 2)
console.log("5. Parse and double:", parsed.unwrap()) // 246

// Example 6: Map is synchronous - for async operations, use gen.async* methods
// See 07-asyncGen.ts and 08-asyncGenAdapter.ts for async patterns

// Example 7: Map with array operations
const numbers = Option.Some([1, 2, 3, 4, 5])
const sumSquared = numbers
  .map((arr) => arr.filter((x) => x % 2 === 0))
  .map((arr) => arr.reduce((sum, x) => sum + x, 0))
console.log("7. Filter and sum:", sumSquared.unwrap()) // 6 (2 + 4)

// Example 8: Map for type transformation
type SerializedUser = { user_id: number; display_name: string }

const userId2 = Option.Some(123)
const serialized = userId2.map(
  (id): SerializedUser => ({
    user_id: id,
    display_name: `User_${id}`,
  }),
)
console.log("8. Type transformation:", serialized.unwrap()) // { user_id: 123, display_name: "User_123" }

// Example 9: MapOr - map or return default
const mapOrSome = Option.Some(5).mapOr(0, (x) => x * 2)
console.log("9. mapOr on Some:", mapOrSome) // 10

const mapOrNone = Option.None.mapOr(0, (x) => x * 2)
console.log("    mapOr on None:", mapOrNone) // 0

// Example 10: Chaining map with different transformations
const chained = Option.Some("  hello world  ")
  .map((s) => s.trim())
  .map((s) => s.toUpperCase())
  .map((s) => s.split(" "))
  .map((arr) => arr.join("-"))
console.log("10. Chain transformations:", chained.unwrap()) // "HELLO-WORLD"

// Example 11: Using map for safe property access
type Person = { name: string; age?: number }
const person = Option.Some<Person>({ name: "Alice", age: 30 })
const ageDoubled = person
  .map((p) => p.age)
  .map((age) => age ?? 0)
  .map((age) => age * 2)
console.log("11. Safe property access:", ageDoubled.unwrap()) // 60

// Example 12: Map with None from nullable
const fromNull = Option.fromNullable(null)
const mappedNull = fromNull.map((x) => x * 2)
console.log("12. Map from null:", mappedNull.toString()) // Option::None

// Example 13: Map with filter-like behavior
const numbers2 = Option.Some([1, 2, 3, 4, 5])
const filteredSum = numbers2.map((arr) => {
  const filtered = arr.filter((x) => x > 2)
  return filtered.reduce((sum, x) => sum + x, 0)
})
console.log("13. Filter-like map:", filteredSum.unwrap()) // 12 (3 + 4 + 5)

console.log("\n=== All map examples completed ===")
