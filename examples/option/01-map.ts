/**
 * Option.map() - Transform the Some value
 *
 * map() applies a function to the Some value, leaving None unchanged.
 * If the Option is None, the mapper function is NOT called.
 */

import { Option } from "../../dist/option.mjs";

// ============================================================================
// BASIC MAP EXAMPLES
// ============================================================================

console.log("=== Option.map() Examples ===\n");

// Example 1: Simple number transformation
const numberSome = Option.Some(5);
const doubled = numberSome.map((x) => x * 2);
console.log("1. Double 5:", doubled.unwrap()); // 10

// Example 2: Map on None - mapper is NOT called
const numberNone = Option.None;
const doubledNone = numberNone.map((x) => {
  console.log("  This will NOT be printed!");
  return x * 2;
});
console.log("2. Map on None:", doubledNone); // Option::None

// Example 3: Chaining multiple maps
const result = Option.Some(10)
  .map((x) => x + 5)
  .map((x) => x * 2)
  .map((x) => x.toString());
console.log("3. Chain maps:", result.unwrap()); // "30"

// Example 4: Map to object
type UserId = number;
type User = { id: UserId; name: string };

const userId = Option.Some(42);
const user = userId.map((id): User => ({ id, name: `User ${id}` }));
console.log("4. Map to object:", user.unwrap()); // { id: 42, name: "User 42" }

// Example 5: Map that transforms type
const parsed = Option.Some("123")
  .map((str) => parseInt(str, 10))
  .map((num) => num * 2);
console.log("5. Parse and double:", parsed.unwrap()); // 246

// Example 6: Map with async function
// Note: map(async fn) returns Option<Promise<T>>
const asyncResult = Option.Some(5).map(async (x) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return x * 2;
});

console.log("6. Map with async fn:", asyncResult); // Option<Promise<...>>

// Resolve the async result
(async () => {
  const awaited = await asyncResult.unwrap();
  console.log("   Resolved:", awaited); // 10
})();

// Example 7: Map with array operations
const numbers = Option.Some([1, 2, 3, 4, 5]);
const sumSquared = numbers
  .map((arr) => arr.filter((x) => x % 2 === 0))
  .map((arr) => arr.reduce((sum, x) => sum + x, 0));
console.log("7. Filter and sum:", sumSquared.unwrap()); // 6 (2 + 4)

// Example 8: Map for type transformation
type SerializedUser = { user_id: number; display_name: string };

const userId2 = Option.Some(123);
const serialized = userId2.map(
  (id): SerializedUser => ({
    user_id: id,
    display_name: `User_${id}`,
  }),
);
console.log("8. Type transformation:", serialized.unwrap()); // { user_id: 123, display_name: "User_123" }

// Example 9: Map on Option<Promise<T>>
const asyncOption = Option.Some(Promise.resolve(5));
const asyncMapped = asyncOption.map((x) => x * 2);

(async () => {
  const value = await asyncMapped.unwrap();
  console.log("9. Map on Option<Promise<T>>:", value); // 10
})();

// Example 10: MapOr - map or return default
const mapOrSome = Option.Some(5).mapOr(0, (x) => x * 2);
console.log("10. mapOr on Some:", mapOrSome); // 10

const mapOrNone = Option.None.mapOr(0, (x) => x * 2);
console.log("    mapOr on None:", mapOrNone); // 0

// Example 11: mapOr with async
const asyncMapOr = Option.Some(5).mapOr(0, async (x) => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return x * 2;
});

(async () => {
  const result = await asyncMapOr;
  console.log("11. Async mapOr:", result); // 10
})();

// Example 12: Chaining map with different transformations
const chained = Option.Some("  hello world  ")
  .map((s) => s.trim())
  .map((s) => s.toUpperCase())
  .map((s) => s.split(" "))
  .map((arr) => arr.join("-"));
console.log("12. Chain transformations:", chained.unwrap()); // "HELLO-WORLD"

// Example 13: Using map for safe property access
type Person = { name: string; age?: number };
const person = Option.Some<Person>({ name: "Alice", age: 30 });
const ageDoubled = person
  .map((p) => p.age)
  .map((age) => age ?? 0)
  .map((age) => age * 2);
console.log("13. Safe property access:", ageDoubled.unwrap()); // 60

// Example 14: Map with None from nullable
const fromNull = Option.fromNullable(null);
const mappedNull = fromNull.map((x) => x * 2);
console.log("14. Map from null:", mappedNull); // Option::None

// Example 15: Map with filter-like behavior
const numbers2 = Option.Some([1, 2, 3, 4, 5]);
const filteredSum = numbers2.map((arr) => {
  const filtered = arr.filter((x) => x > 2);
  return filtered.reduce((sum, x) => sum + x, 0);
});
console.log("15. Filter-like map:", filteredSum.unwrap()); // 12 (3 + 4 + 5)

console.log("\n=== All map examples completed ===");

// Wait for async examples to complete
await new Promise((resolve) => setTimeout(resolve, 50));
