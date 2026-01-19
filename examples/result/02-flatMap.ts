/**
 * Result.flatMap() - Chain Result-returning functions
 *
 * flatMap() (also known as bind/chain) is used to sequence operations
 * that can fail. If the first Result is Err, the subsequent function
 * is NOT called and the error propagates.
 */

import { Result } from "../../dist/result.mjs";

// ============================================================================
// BASIC FLATMAP EXAMPLES
// ============================================================================

console.log("=== Result.flatMap() Examples ===\n");

// Example 1: Simple flatMap chain
const parseNumber = (str: string): Result<number, "parse_error"> => {
  const num = Number(str);
  return Number.isNaN(num) ? Result.Err("parse_error") : Result.Ok(num);
};

const validatePositive = (n: number): Result<number, "not_positive"> => {
  return n > 0 ? Result.Ok(n) : Result.Err("not_positive");
};

const result = parseNumber("42").flatMap((n) => validatePositive(n));
console.log("1. Valid chain:", result.unwrap()); // 42

// Example 2: Short-circuit on first error
const errorResult = parseNumber("invalid").flatMap((n) => validatePositive(n));
console.log("2. Parse error:", errorResult.unwrapErr()); // "parse_error"

// Example 3: Short-circuit on second error
const errorResult2 = parseNumber("-5").flatMap((n) => validatePositive(n));
console.log("3. Validation error:", errorResult2.unwrapErr()); // "not_positive"

// Example 4: Chaining multiple flatMaps
const divide = (a: number, b: number): Result<number, "division_error"> => {
  return b !== 0 ? Result.Ok(a / b) : Result.Err("division_error");
};

const calculation = Result.Ok(100)
  .flatMap((n) => divide(n, 2))
  .flatMap((n) => divide(n, 5))
  .flatMap((n) => validatePositive(n));
console.log("4. Chain calculations:", calculation.unwrap()); // 10

// Example 5: flatMap for fetching/looking up values
type UserId = number;
type User = { id: UserId; name: string };
type PostId = number;
type Post = { id: PostId; authorId: UserId; title: string };

const users: Map<UserId, User> = new Map([
  [1, { id: 1, name: "Alice" }],
  [2, { id: 2, name: "Bob" }],
]);

const posts: Map<PostId, Post> = new Map([
  [101, { id: 101, authorId: 1, title: "Hello" }],
  [102, { id: 102, authorId: 2, title: "World" }],
]);

const getUser = (id: UserId): Result<User, "user_not_found"> => {
  const user = users.get(id);
  return user ? Result.Ok(user) : Result.Err("user_not_found");
};

const getPost = (id: PostId): Result<Post, "post_not_found"> => {
  const post = posts.get(id);
  return post ? Result.Ok(post) : Result.Err("post_not_found");
};

const getPostAuthor = (
  postId: PostId,
): Result<User, "post_not_found" | "user_not_found"> => {
  return getPost(postId).flatMap((post) => getUser(post.authorId));
};

console.log("5. Get post author:", getPostAuthor(101).unwrap()); // { id: 1, name: "Alice" }

// Example 6: Error type union (errors accumulate)
const resultWithUnionError = parseNumber("invalid").flatMap((n) =>
  validatePositive(n),
);
// Type is Result<number, "parse_error" | "not_positive">
console.log("6. Union error type:", resultWithUnionError.unwrapErr()); // "parse_error"

// Example 7: flatMap is synchronous - for async operations, use gen.async* methods
// See 07-asyncGen.ts and 08-asyncGenAdapter.ts for async patterns

// Example 8: Using flatMap for validation pipeline
type ValidationError = { field: string; message: string };

const requireString = (value: unknown): Result<string, ValidationError> => {
  return typeof value === "string"
    ? Result.Ok(value)
    : Result.Err({ field: "value", message: "Must be a string" });
};

const requireNonEmpty = (str: string): Result<string, ValidationError> => {
  return str.length > 0
    ? Result.Ok(str)
    : Result.Err({ field: "value", message: "Cannot be empty" });
};

const validateInput = (value: unknown): Result<string, ValidationError> => {
  return requireString(value).flatMap((str) => requireNonEmpty(str));
};

console.log("8. Valid input:", validateInput("hello").unwrap()); // "hello"
console.log("   Invalid input:", validateInput(123).unwrapErr()); // { field: "value", message: "Must be a string" }

// Example 9: flatMap vs map - when to use which
const mapExample = Result.Ok(5).map((x) => Result.Ok(x * 2)); // Result<Result<number, never>, never>
const flatMapExample = Result.Ok(5).flatMap((x) => Result.Ok(x * 2)); // Result<number, never>

console.log("9. map wraps Result:", mapExample.unwrap().unwrap()); // 10 (need double unwrap)
console.log("   flatMap flattens:", flatMapExample.unwrap()); // 10 (single unwrap)

// Example 10: Practical - User registration flow
type Email = string;
type Password = string;
type UserId2 = number;

const validateEmail = (email: string): Result<Email, ValidationError> => {
  return email.includes("@")
    ? Result.Ok(email)
    : Result.Err({ field: "email", message: "Invalid email" });
};

const validatePassword = (
  password: string,
): Result<Password, ValidationError> => {
  return password.length >= 8
    ? Result.Ok(password)
    : Result.Err({ field: "password", message: "Password too short" });
};

const createUser = (
  _email: Email,
  _password: Password,
): Result<UserId2, ValidationError> => {
  // Simulate user creation
  return Result.Ok(Math.floor(Math.random() * 1000));
};

const registerUser = (
  email: string,
  password: string,
): Result<UserId2, ValidationError> => {
  return validateEmail(email).flatMap((validEmail) =>
    validatePassword(password).flatMap((validPassword) =>
      createUser(validEmail, validPassword),
    ),
  );
};

console.log(
  "10. Register valid user:",
  registerUser("user@example.com", "password123")._tag,
); // "Ok"
console.log(
  "    Register invalid email:",
  registerUser("invalid", "password123").unwrapErr(),
); // { field: "email", message: "Invalid email" }

console.log("\n=== All flatMap examples completed ===");
