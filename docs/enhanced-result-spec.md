# Enhanced Result<T, E> Specification

## 🎯 Overview

The `Result<T, E>` type provides a **type-safe, composable way to handle operations that can succeed or fail**. It represents either success (`Ok<T>`) containing a value of type `T`, or failure (`Err<E>`) containing an error of type `E`. This enables explicit error handling without exceptions and facilitates clean, functional programming patterns.

### Key Benefits

- **Type Safety**: Compile-time guarantees about success/failure states
- **Composability**: Chain operations without nested try-catch blocks
- **Async Support**: Seamless handling of both sync and async operations
- **Error Context**: Rich error information and propagation
- **Functional Style**: Pure functions with predictable behavior

---

## 📋 Core API Reference

### 🔧 Transformation Methods

#### `map<U>(fn): Result<U, E>`

Transforms the success value while preserving the error state.

```typescript
// Synchronous transformation
Result.Ok(42).map((x) => x * 2); // → Ok(84)
Result.Err("error").map((x) => x * 2); // → Err("error")

// Asynchronous transformation
Result.Ok(42).map(async (x) => x + 10); // → Result<Promise<52>, string>
Result.Ok(Promise.resolve(42)).map((x) => x * 2); // → Result<Promise<84>, string>
```

**Signatures:**

```typescript
map<U>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<U>): Result<Promise<U>, E>;
map<U>(this: Result<Promise<T>, E>, fn: (val: T) => U): Result<Promise<U>, E>;
map<U>(this: Result<T, E>, fn: (val: T) => Promise<U>): Result<Promise<U>, E>;
map<U>(this: Result<T, E>, fn: (val: T) => U): Result<U, E>;
```

#### `flatMap<U, E2>(fn): Result<U, E | E2>`

Chains operations that can fail, flattening nested Results.

```typescript
// Success chain
Result.Ok(42)
  .flatMap((x) => Result.Ok(x + 1)) // → Ok(43)
  .flatMap((x) => Result.Err("too big")); // → Err("too big")

// Error propagation
Result.Err("initial").flatMap((x) => Result.Ok(x + 1)); // → Err("initial")

// Async support
Result.Ok(42).flatMap(async (x) => Result.Ok(x * 3)); // → Result<Promise<126>, string>
```

#### `zip<U>(fn): Result<[T, U], E>`

Combines the original value with a transformed value in a tuple.

```typescript
Result.Ok(42).zip((x) => x * 10); // → Ok([42, 420])
Result.Err("error").zip((x) => x * 10); // → Err("error")

Result.Ok(Promise.resolve(42)).zip(async (x) => x + 50); // → Result<Promise<[100, 150]>, string>
```

#### `flatZip<U, E2>(fn): Result<[T, U], E | E2>`

Combines original value with another Result's success value.

```typescript
Result.Ok(42)
  .flatZip((x) => Result.Ok(x + 5)) // → Ok([42, 47])
  .flatZip((x) => Result.Err("invalid")); // → Err("invalid")
```

### 🔀 Error Handling Methods

#### `mapErr<E2>(fn): Result<T, E2>`

Transforms the error while preserving the success value.

```typescript
Result.Err("network error").mapErr((err) => `Network: ${err}`); // → Err("Network: network error")

Result.Ok(42).mapErr((err) => `Error: ${err}`); // → Ok(42) // unchanged
```

#### `mapBoth<T2, E2>(fnOk, fnErr): Result<T2, E2>`

Transforms both success and error values simultaneously.

```typescript
Result.Ok(42).mapBoth(
  (val) => `Success: ${val}`,
  (err) => `Failure: ${err}`,
); // → Ok("Success: 42")

Result.Err("timeout").mapBoth(
  (val) => `Success: ${val}`,
  (err) => `Failure: ${err}`,
); // → Err("Failure: timeout")
```

#### `zipErr<E2>(fn): Result<T, E | E2>`

Executes a function that returns a Result, combining errors.

```typescript
Result.Ok(42).zipErr((x) => Result.Err("validation")); // → Err("validation")

Result.Err("initial").zipErr((x) => Result.Err("validation")); // → Err(["initial", "validation"])
```

### ✅ Validation Methods

#### `validate<VE>(validators): Result<T, E | VE[number][]>`

Runs multiple validators against the contained value, collecting all errors.

```typescript
const validators = [
  (val: number) => (val > 0 ? Result.Ok(true) : Result.Err("Must be positive")),
  (val: number) => (val < 100 ? Result.Ok(true) : Result.Err("Must be < 100")),
  (val: number) =>
    val % 2 === 0 ? Result.Ok(true) : Result.Err("Must be even"),
];

Result.Ok(42).validate(validators); // → Ok(42) // passes all
Result.Ok(101).validate(validators); // → Err(["Must be < 100"])
Result.Ok(-5).validate(validators); // → Err(["Must be positive", "Must be even"])
```

### 🔗 Aggregation Methods

#### `Result.all(...results): Result<T[], E[]>`

Combines multiple Results into a single Result.

```typescript
// All succeed
Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3)); // → Ok([1, 2, 3])

// Some fail
Result.all(
  Result.Ok(1),
  Result.Err("network error"),
  Result.Err("validation error"),
); // → Err(["network error", "validation error"])

// Mixed sync/async
Result.all(Result.Ok(1), Result.Ok(Promise.resolve(2)), Result.Err("error")); // → Result<Promise<[1, 2]>, ["error"]>
```

### 🛠️ Utility Methods

#### `flip(): Result<E, T>`

Swaps success and error types.

```typescript
Result.Ok(42).flip(); // → Err(42)
Result.Err("error").flip(); // → Ok("error")
```

#### `innerMap<Out>(mapper): Result<Array<Out>, E>`

Maps over values inside an Array contained within a Result.

```typescript
Result.Ok([1, 2, 3]).innerMap((x) => x * 2); // → Ok([2, 4, 6])

Result.Err("error").innerMap((x) => x * 2); // → Err("error")
```

#### `toPromise(): Promise<Result<Awaited<T>, E>>`

Converts a Result containing a Promise to a Promise containing a Result.

```typescript
const result: Result<Promise<number>, string> = Result.Ok(Promise.resolve(42));
await result.toPromise(); // → Promise<Result<number, string>> → Ok(42)
```

### 🔍 State Inspection Methods

#### State Checking

```typescript
result.isOk(); // boolean - true if Ok
result.isErr(); // boolean - true if Err
result.isUnit(); // boolean - true if unit Ok value
```

#### Value Extraction

```typescript
result.unwrap(); // T | throws Error
result.unwrapErr(); // E | throws Error
result.safeUnwrap(); // T | null
```

#### String Representation

```typescript
result.toString(); // string - "Ok(value)" or "Err(error)"
```

---

## 🏗️ Constructors & Constants

### Static Constructors

```typescript
Result.Ok<T, E>(value: T): Result<T, E>
Result.Err<E, T>(error: E): Result<T, E>
```

### Special Values

```typescript
Result.UNIT_RESULT; // UnitResult = Ok(undefined)
```

### Usage Examples

```typescript
// Creating Results
const success = Result.Ok<number, string>(42);
const failure = Result.Err<number, string>("Something went wrong");
const asyncSuccess = Result.Ok<Promise<number>, string>(Promise.resolve(100));
```

---

## 💡 Real-World Examples

### API Response Handling

```typescript
async function fetchUserData(userId: string): Result<User, Error> {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      return Result.Err(new Error(`HTTP ${response.status}`));
    }
    const user = await response.json();
    return Result.Ok(user);
  } catch (error) {
    return Result.Err(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// Usage
const result = await fetchUserData("123");
const userName = result
  .map((user) => user.name)
  .map((name) => name.toUpperCase())
  .safeUnwrap(); // string | null
```

### Form Validation

```typescript
function validateEmail(email: string): Result<string, string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email)
    ? Result.Ok(email)
    : Result.Err("Invalid email format");
}

function validateAge(age: number): Result<number, string> {
  return age >= 0 && age <= 150
    ? Result.Ok(age)
    : Result.Err("Age must be between 0 and 150");
}

function validateUser(data: {
  email: string;
  age: number;
}): Result<User, string[]> {
  return Result.Ok(data)
    .flatMap((user) =>
      Result.all(validateEmail(user.email), validateAge(user.age)),
    )
    .map(([email, age]) => ({ email, age }));
}

// Usage
const validationResult = validateUser({
  email: "user@example.com",
  age: 25,
}); // → Ok({ email: "user@example.com", age: 25 })
```

### File Operations

```typescript
async function readFile(path: string): Result<string, Error> {
  try {
    const content = await fs.readFile(path, "utf-8");
    return Result.Ok(content);
  } catch (error) {
    return Result.Err(
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

async function parseJson(json: string): Result<unknown, Error> {
  try {
    const parsed = JSON.parse(json);
    return Result.Ok(parsed);
  } catch (error) {
    return Result.Err(
      error instanceof Error ? error : new Error("Invalid JSON"),
    );
  }
}

// Chained operations
const config = await readFile("config.json")
  .flatMap((content) => parseJson(content))
  .map((obj) => obj as Config)
  .mapErr((err) => new Error(`Failed to load config: ${err.message}`));

if (config.isOk()) {
  console.log("Config loaded:", config.unwrap());
} else {
  console.error("Config error:", config.unwrapErr().message);
}
```

---

## 🔧 Advanced Patterns

### Async Operation Chaining

```typescript
async function processOrder(orderId: string): Result<Order, Error> {
  return fetchOrder(orderId)
    .flatMap((order) => validateOrder(order))
    .flatMap((order) => processPayment(order))
    .flatMap((payment) => updateInventory(payment))
    .flatMap((result) => sendConfirmation(result));
}

// Each function returns Result<T, Error> or Result<Promise<T>, Error>
```

### Error Accumulation

```typescript
type ValidationError = string;

function validateComplexData(
  data: ComplexData,
): Result<ComplexData, ValidationError[]> {
  const validators = [
    (d: ComplexData) =>
      d.field1 ? Result.Ok(true) : Result.Err("Field 1 required"),
    (d: ComplexData) =>
      d.field2?.length > 0 ? Result.Ok(true) : Result.Err("Field 2 empty"),
    (d: ComplexData) =>
      d.field3 > 0 ? Result.Ok(true) : Result.Err("Field 3 must be positive"),
  ];

  return Result.Ok(data).validate(validators);
}
```

### Result Composition

```typescript
function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  return Result.all(...results);
}

// Alternative: Collect all values and errors separately
function partitionResults<T, E>(
  results: Result<T, E>[],
): { ok: T[]; err: E[] } {
  const ok: T[] = [];
  const err: E[] = [];

  for (const result of results) {
    if (result.isOk()) {
      ok.push(result.unwrap());
    } else {
      err.push(result.unwrapErr());
    }
  }

  return { ok, err };
}
```

---

## 🚀 Performance Considerations

### Optimizations

- **Lazy Evaluation**: `zip` and `flatZip` operations are evaluated only when needed
- **Promise Preservation**: Avoids unnecessary promise wrapping for async operations
- **Error Propagation**: Efficient error handling without intermediate object creation
- **Memory Management**: Context reuse minimizes allocations during chaining

### Best Practices

```typescript
// ✅ Good: Chain operations efficiently
const result = fetchData()
  .flatMap((data) => processData(data))
  .map((processed) => formatOutput(processed));

// ❌ Avoid: Unnecessary intermediate variables
const data = fetchData();
const processed = data.flatMap((d) => processData(d));
const formatted = processed.map((p) => formatOutput(p));

// ✅ Good: Use validate for multiple validations
const validated = input.validate([validator1, validator2, validator3]);

// ❌ Avoid: Nested flatMaps for validation
const validated = input
  .flatMap((i) => validator1(i).map(() => i))
  .flatMap((i) => validator2(i).map(() => i))
  .flatMap((i) => validator3(i).map(() => i));
```

---

## 🔗 Type System Integration

### Generic Constraints

```typescript
// Type-safe validator functions
interface Validator<T, E> {
  (value: T): Result<unknown, E>;
}

// Type-safe async operations
async function transformAsync<T, U>(
  result: Result<T, Error>,
  transformer: (value: T) => Promise<U>,
): Promise<Result<U, Error>> {
  return result.map(transformer).toPromise();
}
```

### Union Types

```typescript
type ApiResult<T> = Result<T, NetworkError | ValidationError | ServerError>;

function handleApiResult<T>(result: ApiResult<T>): void {
  result.match({
    ok: (data) => console.log("Success:", data),
    err: (error) => {
      if (error instanceof NetworkError) {
        console.log("Network issue:", error.message);
      } else if (error instanceof ValidationError) {
        console.log("Validation failed:", error.details);
      } else {
        console.log("Server error:", error.message);
      }
    },
  });
}
```

---

## 📚 Migration Guide

### From Try-Catch

```typescript
// Before: Traditional error handling
function divide(a: number, b: number): number {
  try {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  } catch (error) {
    console.error("Error:", error);
    return 0; // Fallback value
  }
}

// After: Result-based error handling
function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? Result.Err("Division by zero") : Result.Ok(a / b);
}
```

### From Optional Chaining

```typescript
// Before: Optional chaining with fallbacks
const username = user?.profile?.settings?.username ?? "anonymous";

// After: Result chaining
const username =
  Result.Ok(user)
    .map((u) => u.profile)
    .map((p) => p.settings)
    .map((s) => s.username)
    .mapErr(() => "User not found")
    .safeUnwrap() ?? "anonymous";
```

---

## 🧪 Testing Patterns

### Unit Testing Results

```typescript
import { test, expect } from "bun:test";

test("successful transformation", () => {
  const result = Result.Ok(42)
    .map((x) => x * 2)
    .map((x) => x + 10);

  expect(result.isOk()).toBe(true);
  expect(result.unwrap()).toBe(94);
});

test("error propagation", () => {
  const result = Result.Err("initial error")
    .map((x) => x * 2) // This won't execute
    .flatMap((x) => Result.Ok(x + 10));

  expect(result.isErr()).toBe(true);
  expect(result.unwrapErr()).toBe("initial error");
});

test("async operations", async () => {
  const result = Result.Ok(42)
    .map(async (x) => x * 2)
    .toPromise();

  const awaited = await result;
  expect(awaited.isOk()).toBe(true);
  expect(awaited.unwrap()).toBe(84);
});
```

---

## 🎉 Summary

The `Result<T, E>` type provides a robust foundation for error handling in TypeScript applications. By making success and failure cases explicit in the type system, it enables:

- **Safer code** with compile-time error checking
- **Cleaner code** with composable operations
- **More maintainable code** with explicit error handling
- **Better testing** with predictable behavior patterns

Whether you're building APIs, processing data, or handling complex business logic, `Result<T, E>` offers a type-safe alternative to exception-based error handling that scales well with application complexity.
