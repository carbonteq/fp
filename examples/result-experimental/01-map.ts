/**
 * Result.map() - Transform the success value
 *
 * map() applies a function to the Ok value, leaving Err unchanged.
 * If the Result is Err, the mapper function is NOT called.
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs";

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

// Example 4: Map to object
type UserId = number;
type User = { id: UserId; name: string };

const userId = Result.Ok<UserId>(42);
const user = userId.map((id): User => ({ id, name: `User ${id}` }));
console.log("4. Map to object:", user.unwrap()); // { id: 42, name: "User 42" }

// Example 5: Map that can fail (but doesn't affect Result)
const parsed = Result.Ok("123")
  .map((str) => parseInt(str, 10))
  .map((num) => num * 2);
console.log("5. Parse and double:", parsed.unwrap()); // 246

// Example 6: Map is synchronous - for async operations, use gen.async* methods
// See 07-asyncGen.ts and 08-asyncGenAdapter.ts for async patterns

// Example 7: Map with array operations
const numbers = Result.Ok([1, 2, 3, 4, 5]);
const sumSquared = numbers
  .map((arr) => arr.filter((x) => x % 2 === 0))
  .map((arr) => arr.reduce((sum, x) => sum + x, 0));
console.log("7. Filter and sum:", sumSquared.unwrap()); // 6 (2 + 4)

console.log("\n=== All map examples completed ===");
