/**
 * Result.map() - Transform the success value
 *
 * map() applies a function to the Ok value, leaving Err unchanged.
 * If the Result is Err, the mapper function is NOT called.
 */

import { Result } from "../../dist/result.mjs";

// ============================================================================
// BASIC MAP EXAMPLES
// ============================================================================

console.log("=== Result.map() Examples ===\n");

// Example 1: Simple number transformation
const numberOk = Result.Ok(5);
const doubled = numberOk.map((x) => x * 2);
console.log("1. Double 5:", doubled.unwrap()); // 10

// Example 2: Map on Err - mapper is NOT called
const numberErr = Result.Err<string, number>("something went wrong");
const doubledErr = numberErr.map((x) => {
  console.log("  This will NOT be printed!");
  return x * 2;
});
console.log("2. Map on Err:", doubledErr.unwrapErr()); // "something went wrong"

// Example 3: Chaining multiple maps
const result = Result.Ok(10)
  .map((x) => x + 5)
  .map((x) => x * 2)
  .map((x) => x.toString());
console.log("3. Chain maps:", result.unwrap()); // "30"

const userId = Result.Ok(42);
type User = { id: UserId; name: string };

const user = userId.map((id): User => ({ id, name: `User ${id}` }));
console.log("4. Map to object:", user.unwrap()); // { id: 42, name: "User 42" }

// Example 5: Map that can fail (but doesn't affect Result)
const parsed = Result.Ok("123")
  .map((str) => parseInt(str, 10))
  .map((num) => num * 2);
console.log("5. Parse and double:", parsed.unwrap()); // 246

// Example 6: Map with async function
// Note: map(async fn) returns Result<Promise<T>, E>
const asyncResult = Result.Ok(5).map(async (x) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return x * 2;
});

console.log("6. Map with async fn:", asyncResult); // Result<Promise<...>>

// Resolve the async result
asyncResult.unwrap().then((value) => {
  console.log("   Resolved:", value); // 10
});

// Example 7: Map with array operations
const numbers = Result.Ok([1, 2, 3, 4, 5]);
const sumSquared = numbers
  .map((arr) => arr.filter((x) => x % 2 === 0))
  .map((arr) => arr.reduce((sum, x) => sum + x, 0));
console.log("7. Filter and sum:", sumSquared.unwrap()); // 6 (2 + 4)

// Example 8: Map for type transformation
type UserId = number;
type SerializedUser = { user_id: UserId; display_name: string };

const userId2: Result<UserId, string> = Result.Ok(123);
const serialized = userId2.map(
  (id): SerializedUser => ({
    user_id: id,
    display_name: `User_${id}`,
  }),
);
console.log("8. Type transformation:", serialized.unwrap()); // { user_id: 123, display_name: "User_123" }

console.log("\n=== All map examples completed ===");
