# Result<T, E> Type Specification (Simplified)

## Overview

The `Result<T, E>` type provides a **type-safe, composable way to handle operations that can succeed or fail**. It represents either success (`Ok<T>`) containing a value of type `T`, or failure (`Err<E>`) containing an error of type `E`. This enables explicit error handling without exceptions and facilitates clean, functional programming patterns.

### Key Benefits

- **Type Safety**: Compile-time guarantees about success/failure states
- **Composability**: Chain operations without nested try-catch blocks
- **Explicit Async Boundaries**: Async operations return `Promise<Result<T, E>>` - standard Promise semantics
- **Error Context**: Rich error information with type-safe propagation
- **Functional Style**: Pure functions with predictable behavior

---

## Design Principles

### 1. Explicit State Representation

States must be explicitly represented and checkable at both compile-time and runtime:

```typescript
type Result<T, E> = Ok<T, E> | Err<T, E>;
```

### 2. Referential Transparency

All transformation methods must be pure - given the same input, they produce the same output with no side effects. The only exceptions are:

- `unwrap()` / `unwrapErr()` which throw on invalid state (documented, intentional)
- `tap()` / `tapErr()` which are explicitly for side effects

### 3. Short-Circuit Semantics

Operations on the error track propagate without executing transformation functions:

```typescript
Result.Err("fail").map((x) => expensiveComputation(x)); // Never calls expensiveComputation
```

### 4. Explicit Promise Returns

Async behavior is explicit via `*Async` variants. Sync methods never accept
Promise-returning mappers.

When using `*Async` variants, the return type is **always** `Promise<Result<T, E>>`:

```typescript
Result<T, E> + sync mapper      → Result<U, E>
Result<T, E> + async mapper     → Promise<Result<U, E>> (via *Async)
```

This aligns with standard JavaScript/TypeScript async patterns.

### 5. Error Type Unification

When chaining operations that can fail with different error types, the error types are unified via union:

```typescript
Result<T, E1>.flatMap(f: T => Result<U, E2>) → Result<U, E1 | E2>
```

### 6. Covariance Preservation

Result should be covariant in `T` and `E` to support subtyping.

---

## Core Definition

```typescript
type Result<T, E> = Ok<T, E> | Err<T, E>;

interface Ok<T, E> {
  readonly _tag: "Ok";
  readonly value: T;
}

interface Err<T, E> {
  readonly _tag: "Err";
  readonly error: E;
}
```

---

## Constructors

| Constructor | Signature | Description |
|------------|-----------|-------------|
| `Ok` | `<T, E = never>(value: T): Result<T, E>` | Creates Ok containing `value` |
| `Err` | `<E, T = never>(error: E): Result<T, E>` | Creates Err containing `error` |
| `fromNullable` | `<T, E>(value: T \| null \| undefined, error: E): Result<NonNullable<T>, E>` | Ok if non-nullish |
| `fromPredicate` | `<T, E>(value: T, pred: (v: T) => boolean, error: E): Result<T, E>` | Ok if predicate passes |
| `tryCatch` | `<T, E = unknown>(fn: () => T, errorMapper?: (e: unknown) => E): Result<T, E>` | Catches sync exceptions |
| `tryAsyncCatch` | `<T, E = unknown>(fn: () => Promise<T>, errorMapper?: (e: unknown) => E): Promise<Result<T, E>>` | Catches async exceptions |

> **Note:** `tryCatch` and `tryAsyncCatch` are named this way because `try` is a reserved keyword in JavaScript/TypeScript and cannot be used as a method name directly.

**Special Values:**

```typescript
Result.UNIT_RESULT: Result<Unit, never>  // Singleton for void-success
```

### Constructor Examples

```typescript
// Direct construction
const ok = Result.Ok(42); // Ok(42)
const err = Result.Err("failed"); // Err("failed")

// From nullable values
Result.fromNullable(user, "User not found"); // Ok(user) or Err("User not found")
Result.fromNullable(null, "Not found"); // Err("Not found")

// From predicate
Result.fromPredicate(age, (x) => x >= 18, "Must be adult"); // Ok or Err

// From throwing function
Result.tryCatch(
  () => JSON.parse(data),
  (e) => new ParseError(e),
);

// From async throwing function
await Result.tryAsyncCatch(
  () => fetch(url).then((r) => r.json()),
  (e) => new NetworkError(e),
);

// Unit result for void operations
function saveToDb(): Result<Unit, DbError> {
  // ... save logic
  return Result.UNIT_RESULT;
}
```

---

## State Inspection

| Method | Signature | Description |
|--------|-----------|-------------|
| `isOk` | `(): this is Ok<T, never>` | Type guard for Ok state |
| `isErr` | `(): this is Err<never, E>` | Type guard for Err state |
| `isUnit` | `(): this is Result<Unit, never>` | Type guard for Unit value |

### State Inspection Examples

```typescript
const result = Result.Ok(42);

if (result.isOk()) {
  // TypeScript knows result.value is accessible
  console.log(result.value); // 42
}

if (result.isErr()) {
  // TypeScript knows result.error is accessible
  console.log(result.error);
}
```

---

## Value Extraction

| Method | Signature | Description |
|--------|-----------|-------------|
| `unwrap` | `(): T` | Returns value or **throws** (re-throws if E extends Error) |
| `unwrapOr` | `(defaultValue: T): T` | Returns value or default |
| `unwrapOrElse` | `(fn: (err: E) => T): T` | Returns value or calls factory with error |
| `unwrapErr` | `(): E` | Returns error or **throws** |
| `safeUnwrap` | `(): T \| null` | Returns value or `null` |
| `match` | `<U>(cases: { Ok: (v: T) => U, Err: (e: E) => U }): U` | Pattern match both states |

### Value Extraction Examples

```typescript
const ok = Result.Ok(42);
const err = Result.Err(new Error("failed"));

// unwrap - throws on Err
ok.unwrap(); // 42
err.unwrap(); // re-throws Error (preserves stack)

// unwrapOr - safe with default
ok.unwrapOr(0); // 42
err.unwrapOr(0); // 0

// unwrapOrElse - compute recovery from error
err.unwrapOrElse((e) => computeFallback(e)); // calls with error

// unwrapErr - get error value
err.unwrapErr(); // Error("failed")
ok.unwrapErr(); // throws UnwrapError

// safeUnwrap - null for Err
ok.safeUnwrap(); // 42
err.safeUnwrap(); // null

// match - exhaustive pattern matching
const message = result.match({
  Ok: (value) => `Success: ${value}`,
  Err: (error) => `Failed: ${error.message}`,
});
```

---

## Transformation Methods (Ok Track)

### `map<U>(fn): Result<U, E>`

Transforms the success value while preserving error state.

**Signature:**

```typescript
map<U>(fn: (val: T) => U): Result<U, E>;
```

**Behavior:**

- `Ok(x).map(f)` → `Ok(f(x))`
- `Err(e).map(f)` → `Err(e)` (f not called)

**Examples:**

```typescript
Ok(42).map((x) => x * 2); // Ok(84)
Err("error").map((x) => x * 2); // Err("error")
```

### `mapAsync<U>(fn): Promise<Result<U, E>>`

Transforms the success value using an async mapper.

**Signature:**

```typescript
mapAsync<U>(fn: (val: T) => Promise<U>): Promise<Result<U, E>>;
```

**Examples:**

```typescript
Ok(42).mapAsync(async (x) => x + 10); // Promise<Ok(52)>
```

### `flatMap<U, E2>(fn): Result<U, E | E2>`

Chains operations that return Results, flattening and unifying error types.

**Signature:**

```typescript
flatMap<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E | E2>;
```

**Behavior:**

- `Ok(x).flatMap(f)` → `f(x)` (where f returns Result)
- `Err(e).flatMap(f)` → `Err(e)` (f not called)

**Examples:**

```typescript
// Success chain
Ok(42)
  .flatMap((x) => Ok(x + 1)) // Ok(43)
  .flatMap((x) => Err("too big")); // Err("too big")

// Error propagation
Err("initial").flatMap((x) => Ok(x + 1)); // Err("initial")

// Async support via flatMapAsync
Ok(42).flatMapAsync(async (x) => Ok(x * 3)); // Promise<Ok(126)>
```

### `flatMapAsync<U, E2>(fn): Promise<Result<U, E | E2>>`

Chains operations that return `Promise<Result<...>>`.

**Signature:**

```typescript
flatMapAsync<U, E2>(fn: (val: T) => Promise<Result<U, E2>>): Promise<Result<U, E | E2>>;
```

**Examples:**

```typescript
// Chaining fallible operations
parseUserId(input)
  .flatMap((id) => fetchUser(id)) // Promise<Result<User, string>>
  .then((r) => r.flatMap((user) => validatePermissions(user)))
  .then((r) => r.map((user) => user.email));
```

### `zip<U>(fn): Result<[T, U], E>`

Pairs the original value with a derived value.

**Signature:**

```typescript
zip<U>(fn: (val: T) => U): Result<[T, U], E>;
```

**Examples:**

```typescript
Ok(42).zip((x) => x * 10); // Ok([42, 420])
Err("error").zip((x) => x * 10); // Err("error")

// Keep original while computing derived
Ok(user).zip((u) => u.permissions.length); // Ok([user, 5])

// Async version
Ok(user).zipAsync(async (u) => await fetchCount(u)); // Promise<Ok<[user, number]>>
```

### `zipAsync<U>(fn): Promise<Result<[T, U], E>>`

Pairs the original value with a derived async value.

**Signature:**

```typescript
zipAsync<U>(fn: (val: T) => Promise<U>): Promise<Result<[T, U], E>>;
```

### `flatZip<U, E2>(fn): Result<[T, U], E | E2>`

Pairs the original value with a value from another Result.

**Signature:**

```typescript
flatZip<U, E2>(fn: (val: T) => Result<U, E2>): Result<[T, U], E | E2>;
```

**Examples:**

```typescript
Ok(42)
  .flatZip((x) => Ok(x + 5)) // Ok([42, 47])
  .flatZip(([a, b]) => Err("invalid")); // Err("invalid")
```

### `flatZipAsync<U, E2>(fn): Promise<Result<[T, U], E | E2>>`

Pairs the original value with a value from another async Result.

**Signature:**

```typescript
flatZipAsync<U, E2>(
  fn: (val: T) => Promise<Result<U, E2>>
): Promise<Result<[T, U], E | E2>>;
```

---

## Transformation Methods (Err Track)

### `mapErr<E2>(fn): Result<T, E2>`

Transforms the error while preserving success value.

**Signature:**

```typescript
mapErr<E2>(fn: (err: E) => E2): Result<T, E2>;
```

**Behavior:**

- `Ok(x).mapErr(f)` → `Ok(x)` (f not called)
- `Err(e).mapErr(f)` → `Err(f(e))`

**Examples:**

```typescript
Err("network error").mapErr((e) => `Network: ${e}`); // Err("Network: network error")
Ok(42).mapErr((e) => `Error: ${e}`); // Ok(42)

// Async error transformation
Err("timeout").mapErrAsync(async (e) => await formatError(e)); // Promise<Err(...)>>

// Add context to errors
fetchData().then((r) =>
  r.mapErr((e) => new ContextualError("Failed to fetch data", e)),
);
```

### `mapErrAsync<E2>(fn): Promise<Result<T, E2>>`

Transforms the error using an async mapper.

**Signature:**

```typescript
mapErrAsync<E2>(fn: (err: E) => Promise<E2>): Promise<Result<T, E2>>;
```

### `mapBoth<T2, E2>(fnOk, fnErr): Result<T2, E2>`

Transforms both tracks simultaneously.

**Signature:**

```typescript
mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (err: E) => E2): Result<T2, E2>;
```

**Examples:**

```typescript
Ok(42).mapBoth(
  (val) => `Success: ${val}`,
  (err) => `Failure: ${err}`,
); // Ok("Success: 42")

Err("timeout").mapBoth(
  (val) => `Success: ${val}`,
  (err) => `Failure: ${err}`,
); // Err("Failure: timeout")
```

### `mapBothAsync<T2, E2>(fnOk, fnErr): Promise<Result<T2, E2>>`

Transforms both tracks using async mappers.

**Signature:**

```typescript
mapBothAsync<T2, E2>(
  fnOk: (val: T) => Promise<T2>,
  fnErr: (err: E) => Promise<E2>
): Promise<Result<T2, E2>>;
```

### `orElse<T2, E2>(fn): Result<T | T2, E2>`

Recovers from error by providing fallback Result.

**Signature:**

```typescript
orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T | T2, E2>;
```

**Behavior:**

- `Ok(x).orElse(f)` → `Ok(x)` (f not called)
- `Err(e).orElse(f)` → `f(e)`

**Examples:**

```typescript
// Recovery with fallback
fetchFromPrimary()
  .flatMap((e) => fetchFromBackup())
  .flatMap((e) => Ok(defaultValue));

// Transform error type
Err("not found").orElse((e) => Err(new NotFoundError(e)));

// Async recovery
await fetchData().then((r) =>
  r.orElseAsync(async (e) => {
    return await fetchBackupData();
  }),
);
```

### `orElseAsync<T2, E2>(fn): Promise<Result<T | T2, E2>>`

Recovers from error by providing a fallback async Result.

**Signature:**

```typescript
orElseAsync<T2, E2>(
  fn: (err: E) => Promise<Result<T2, E2>>
): Promise<Result<T | T2, E2>>;
```

### `zipErr<E2>(fn): Result<T, E | E2>`

Allows a validation/binding step on the Ok track that can introduce a new error
while preserving the original Ok value.

**Signature:**

```typescript
zipErr<E2>(fn: (val: T) => Result<unknown, E2>): Result<T, E | E2>;
```

**Examples:**

```typescript
Ok(42).zipErr((x) => Ok(x * 10)); // Ok(42)
Ok(42).zipErr((x) => Err("validation")); // Err("validation")
Err("initial").zipErr((x) => Err("second")); // Err("initial")
```

### `zipErrAsync<E2>(fn): Promise<Result<T, E | E2>>`

Allows a validation/binding step on the Ok track that can introduce a new error
while preserving the original Ok value, using an async Result.

**Signature:**

```typescript
zipErrAsync<E2>(
  fn: (val: T) => Promise<Result<unknown, E2>>
): Promise<Result<T, E | E2>>;
```

---

## Validation

### `validate<VE>(validators): Result<T, E | VE[]>`

Runs multiple validators, collecting ALL errors (not fail-fast).

**Signature:**

```typescript
validate<VE>(validators: Array<(val: T) => Result<unknown, VE>>): Result<T, E | VE[]>;
```

**Behavior:**

- `Err(e).validate(vs)` → `Err(e)` (validators not called)
- `Ok(x).validate(vs)` → `Ok(x)` if all pass, `Err([...errors])` collecting all failures

**Examples:**

```typescript
const validators = [
  (x: number) => x > 0 ? Ok(true) : Err("must be positive"),
  (x: number) => x < 100 ? Ok(true) : Err("must be < 100"),
  (x: number) => x % 2 === 0 ? Ok(true) : Err("must be even"),
];

Ok(42).validate(validators)                // Ok(42)
Ok(101).validate(validators)               // Err(["must be < 100"])
Ok(-5).validate(validators)                // Err(["must be positive", "must be even"])

// Async validators
Ok(data).validateAsync([
  async d => await validateEmail(d),
  async d => await validatePhone(d),
]);

### `validateAsync<VE>(validators): Promise<Result<T, E | VE[]>>`

Runs async validators, collecting ALL errors (not fail-fast).

**Signature:**
```

```typescript
validateAsync<VE>(
  validators: Array<(val: T) => Promise<Result<unknown, VE>>>
): Promise<Result<T, E | VE[]>>;
```

// Form validation
Ok(formData).validate([
  validateEmail,
  validatePassword,
  validateUsername,
]);

```text

---

## Aggregation

### `Result.all(...results): Result<T[], E[]> | Promise<Result<T[], E[]>>`

Combines multiple Results into one.

**Behavior:**

- All Ok → `Ok([...values])` with preserved tuple types
- Any Err → `Err([...errors])` collecting ALL errors

```

```typescript
Result.all(Ok(1), Ok(2), Ok(3)); // Ok([1, 2, 3])
Result.all(Ok(1), Err("a"), Err("b")); // Err(["a", "b"])
Result.all(); // Ok([]) - vacuous truth

// Async Results
await Result.all(
  Ok(1),
  await asyncValidate(2), // Promise<Result<number, string>>
  Ok(3),
); // Result<[number, number, number], string[]>

// Parallel async validation
await Promise.all([
  validateEmail(email),
  validatePassword(password),
  validateAge(age),
]).then((results) => Result.all(...results));
```

### `Result.any(...results): Result<T, E[]>`

Returns first Ok, or collects all errors.

```typescript
Result.any(Err("a"), Ok(2), Ok(3)); // Ok(2)
Result.any(Err("a"), Err("b"), Err("c")); // Err(["a", "b", "c"])
Result.any(); // Err([]) - no success possible

// Fallback chain
Result.any(fetchFromCache(key), fetchFromDb(key), fetchFromRemote(key));
```

---

## Generator-Based Combinators

### `Result.gen(genFn): Result<T, E>`

Generator-based syntax for chaining Result operations (simplified, no adapter).

Provides imperative-style code while maintaining functional error handling.

**Short-circuits on first Err**, returning that error. Uses iteration instead of recursion to avoid stack overflow on deep chains.

**Signature:**

```typescript
gen<T, E>(
  genFn: () => Generator<Result<unknown, E>, T, unknown>
): Result<T, E>;
```

**Examples:**

```typescript
// Simple sync chain
const result = Result.gen(function* () {
  const a = yield* Result.Ok(1);
  const b = yield* Result.Ok(2);
  return a + b;
});
// Result<number, never> -> Ok(3)

// Error short-circuit
const result = Result.gen(function* () {
  const a = yield* Result.Ok(1);
  const b = yield* Result.Err("fail"); // Short-circuits here
  const c = yield* Result.Ok(3); // Never executes
  return a + b + c;
});
// Result<number, string> -> Err("fail")

// Multi-step validation
const validated = Result.gen(function* () {
  const rawData = yield* parseInput(input);
  const validated = yield* validateSchema(rawData);
  const sanitized = yield* sanitize(validated);
  return sanitized;
});

// Chaining fallible operations
const user = Result.gen(function* () {
  const id = yield* parseUserId(input);
  const user = yield* fetchUser(id);
  const profile = yield* user.profile;
  return profile;
});
```

**Key Characteristics:**

- `yield*` with `Result<T, E>` unwraps the value or short-circuits on Err
- The return value is automatically wrapped in `Ok`
- Type inference tracks error types through the chain
- Stack-safe (uses iteration, not recursion)

### `Result.genAdapter(genFn): Result<T, E>`

Generator-based syntax with adapter function for improved type inference.

**Signature:**

```typescript
genAdapter<T, E>(
  genFn: (
    $: <A, E2>(result: Result<A, E2>) => ResultYieldWrap<A, E2>
  ) => Generator<ResultYieldWrap<unknown, E>, T, unknown>
): Result<T, E>;
```

**Examples:**

```typescript
// Better type inference for complex chains
const result = Result.genAdapter(function* ($) {
  // $() wraps Results and enables better IDE/type inference
  const a = yield* $(Result.Ok(1));
  const b = yield* $(Result.Ok(2));
  return a + b;
});

// Error handling with different error types
type ParseError = { type: "parse" };
type ValidationError = { type: "validation" };

const result = Result.genAdapter(function* ($) {
  const id = yield* $(parseId(input)); // Result<number, ParseError>
  const user = yield* $(fetchUser(id)); // Result<User, string>
  const valid = yield* $(validate(user)); // Result<User, ValidationError>
  return valid;
});
// Result<User, ParseError | string | ValidationError>
```

**When to use `genAdapter` vs `gen`:**

- Use `gen` for simple chains with consistent error types
- Use `genAdapter` for better IDE support and type inference in complex chains

### `Result.asyncGen(genFn): Promise<Result<T, E>>`

Async generator-based syntax for chaining Result operations (simplified, no adapter).

Use `yield*` with `Result<T, E>` values directly. For `Promise<Result<T, E>>`, await first then yield*.

**Short-circuits on first Err**, returning that error. Uses async iteration instead of recursion to avoid stack overflow on deep chains.

**Signature:**

```typescript
asyncGen<T, E>(
  genFn: () => AsyncGenerator<Result<unknown, E>, T, unknown>
): Promise<Result<T, E>>;
```

**Examples:**

```typescript
// Simple async chain
const result = await Result.asyncGen(async function* () {
  const a = yield* Result.Ok(1);
  const b = yield* await asyncOperation(a); // await Promise<Result> first
  const c = yield* Result.Ok(3);
  return a + b + c;
});
// Promise<Result<number, never>> -> Ok(result)

// Error short-circuit in async
const result = await Result.asyncGen(async function* () {
  const data = yield* await fetchData();
  const parsed = yield* parse(data); // Short-circuits on Err
  const validated = yield* validate(parsed); // Never executes
  return validated;
});
// Promise<Result<Validated, ParseError>> -> Err(...)

// Mixed sync/async workflow
const result = await Result.asyncGen(async function* () {
  const id = yield* parseInt(input); // sync
  const user = yield* await fetchUser(id); // async
  const permissions = yield* user.permissions; // sync
  const hasAccess = yield* await checkAccess(permissions); // async
  return hasAccess;
});

// Complex pipeline with error handling
async function processOrder(
  orderId: string,
): Promise<Result<Receipt, OrderError>> {
  return await Result.asyncGen(async function* () {
    const order = yield* await fetchOrder(orderId);
    const validated = yield* validateOrder(order);
    const payment = yield* await processPayment(validated);
    const shipment = yield* await arrangeShipment(payment);
    return createReceipt(shipment);
  });
}
```

**Key Characteristics:**

- `yield*` with `Result<T, E>` directly unwraps or short-circuits
- `await Promise<Result<T, E>>` then `yield*` the resolved result
- The return value is automatically wrapped in `Ok` and returned as a Promise
- Type inference tracks error types through async chain
- Stack-safe (uses async iteration, not recursion)

### `Result.asyncGenAdapter(genFn): Promise<Result<T, E>>`

Async generator-based syntax with adapter function for improved type inference.

Supports both `Result<T, E>` and `Promise<Result<T, E>>` for flexibility.

**Signature:**

```typescript
asyncGenAdapter<T, E>(
  genFn: (
    $: <A, E2>(result: Result<A, E2> | Promise<Result<A, E2>>) => AsyncResultYieldWrap<A, E2>
  ) => AsyncGenerator<AsyncResultYieldWrap<unknown, E>, T, unknown>
): Promise<Result<T, E>>;
```

**Examples:**

```typescript
// No need to manually await - adapter handles it
const result = await Result.asyncGenAdapter(async function* ($) {
  const a = yield* $(Result.Ok(1)); // sync Result
  const b = yield* $(asyncOperation(a)); // Promise<Result> - auto-awaited
  const c = yield* $(Result.Ok(3));
  return a + b + c;
});

// Complex workflow with mixed errors
type DbError = { type: "db" };
type ApiError = { type: "api" };
type ValidationError = { type: "validation" };

const result = await Result.asyncGenAdapter(async function* ($) {
  const config = yield* $(loadConfig()); // Result<Config, DbError>
  const userData = yield* $(fetchUser(config.userId)); // Promise<Result<User, ApiError>>
  const validated = yield* $(validate(userData)); // Result<User, ValidationError>
  const enriched = yield* $(enrichUserData(validated)); // Promise<Result<Enriched, ApiError>>
  return enriched;
});
// Promise<Result<Enriched, DbError | ApiError | ValidationError>>

// Real-world API pipeline
async function processPayment(
  cartId: string,
): Promise<Result<Receipt, PaymentError>> {
  return await Result.asyncGenAdapter(async function* ($) {
    const cart = yield* $(getCart(cartId));
    const items = yield* $(validateInventory(cart.items));
    const total = yield* $(calculateTotal(items));
    const payment = yield* $(chargePayment(total));
    const receipt = yield* $(generateReceipt(payment));
    return receipt;
  });
}
```

**When to use `asyncGenAdapter` vs `asyncGen`:**

- Use `asyncGen` when you want explicit `await` for async operations
- Use `asyncGenAdapter` for cleaner syntax with mixed sync/async and better type inference

### Generator Recommendations

| Use Case | Recommended Method |
|----------|-------------------|
| Simple sync chains (1-5 operations) | Method chaining (`map`, `flatMap`) |
| Complex sync chains (5+ operations, multiple yields) | `Result.gen` or `Result.genAdapter` |
| Simple async chains | Method chaining with `.then()` |
| Complex async chains with interleaved sync/async | `Result.asyncGen` or `Result.asyncGenAdapter` |
| Best type inference with mixed errors | `genAdapter` / `asyncGenAdapter` |

---

## Utility Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `tap` | `(fn: (val: T) => void): Result<T, E>` | Side effect on Ok, returns self |
| `tapErr` | `(fn: (err: E) => void): Result<T, E>` | Side effect on Err, returns self |
| `flip` | `(): Result<E, T>` | Swaps Ok and Err |
| `toOption` | `(): Option<T>` | Discards error information |
| `innerMap` | `<U>(fn: (el: T[number]) => U): Result<U[], E>` | Map over array elements |
| `toString` | `(): string` | String representation |

### Utility Examples

```typescript
// tap - logging without breaking chain
Ok(user)
  .tap((u) => console.log(`Processing ${u.name}`))
  .tapErr((e) => console.error(`Failed: ${e}`))
  .map((u) => u.email);

// flip - swap success and error
Ok(42).flip(); // Err(42)
Err("x").flip(); // Ok("x")

// toOption - discard error info
Ok(42).toOption(); // Some(42)
Err("x").toOption(); // None

// innerMap - map over array contents
Ok([1, 2, 3]).innerMap((x) => x * 2); // Ok([2, 4, 6])
Err("x").innerMap((x) => x * 2); // Err("x")

// toString
Ok(42).toString(); // "Ok(42)"
Err("fail").toString(); // "Err(fail)"
```

---

## Async/Sync Interleaved Patterns

### Method Chaining with .then()

```typescript
// Once you hit an async operation, use *Async variants
Ok(5)
  .map((x) => x * 2) // Result<number, never>
  .mapAsync(async (x) => await fetchData(x)) // Promise<Result<Data, never>>
  .then((r) => r.map((d) => d.name)) // Promise<Result<string, never>>
  .then((r) => r.mapErr((e) => new AppError(e))) // Promise<Result<string, AppError>>
  .then((r) => {
    if (r.isOk()) {
      console.log(r.unwrap());
    }
    return r;
  });
```

### Generators for Complex Workflows

```typescript
// Generators shine for complex async workflows
async function processWorkflow(input: string): Promise<Result<Output, Error>> {
  return await Result.asyncGenAdapter(async function* ($) {
    const parsed = yield* $(parseInput(input));
    const fetched = yield* $(await fetchData(parsed));
    const validated = yield* $(validate(fetched));
    const transformed = yield* $(transform(validated));
    const saved = yield* $(await saveToDb(transformed));
    return saved;
  });
}
```

### Mixed: Methods for simple, generators for complex

```typescript
// Use method chaining for simple transformations
const parsed = parseInput(input).flatMap((p) => validate(p));

// Switch to generator for complex async workflow
const result = await Result.asyncGenAdapter(async function* ($) {
  const data = yield* $(parsed);
  const enriched = yield* $(await enrich(data));
  const validated = yield* $(validate(enriched));
  const saved = yield* $(await save(validated));
  return saved;
});
```

---

## Edge Cases & Invariants

### Monad Laws (Invariants)

1. **Identity preservation**: `result.map(x => x)` ≡ `result`
2. **Composition**: `result.map(f).map(g)` ≡ `result.map(x => g(f(x)))`
3. **flatMap left identity**: `Ok(x).flatMap(f)` ≡ `f(x)`
4. **flatMap right identity**: `result.flatMap(Ok)` ≡ `result`
5. **flatMap associativity**: `result.flatMap(f).flatMap(g)` ≡ `result.flatMap(x => f(x).flatMap(g))`

### Edge Cases Table

| Case | Input | Expected Output | Notes |
|------|-------|-----------------|-------|
| Error type in Ok | `Ok(new Error("msg"))` | Valid `Ok(Error)` | Allowed; error as value |
| null in Err | `Err(null)` | Valid `Err(null)` | Allowed; any E type |
| Nested Result | `Ok(Ok(5))` | `Ok(Ok(5))` | No auto-flatten; use flatMap |
| unwrap on Err(Error) | `Err(new Error("x")).unwrap()` | Re-throws original Error | Preserves stack trace |
| unwrap on Err(string) | `Err("x").unwrap()` | Throws `UnwrapError` with message | - |
| unwrapErr on Ok | `Ok(5).unwrapErr()` | Throws `UnwrapError` | - |
| validate on Err | `Err("e").validate([...])` | `Err("e")` | Validators not called |
| validate with no validators | `Ok(5).validate([])` | `Ok(5)` | Vacuous pass |
| all with empty array | `Result.all()` | `Ok([])` | Vacuous truth |
| all with all Err | `Result.all(Err("a"), Err("b"))` | `Err(["a", "b"])` | Collects all |
| innerMap on non-array | `Ok(5).innerMap(f)` | Throws `TypeError` | Runtime check |
| flip on Ok | `Ok(5).flip()` | `Err(5)` | - |
| flip on Err | `Err("x").flip()` | `Ok("x")` | - |

### Type Narrowing

| Case | Behavior |
|------|----------|
| After `isOk()` | `T` accessible, `E` narrowed to `never` |
| After `isErr()` | `E` accessible, `T` narrowed to `never` |
| match exhaustiveness | Compiler enforces both branches |

---

## Type Definitions

### Core Types

```typescript
declare const UNIT: unique symbol;
type Unit = typeof UNIT;

type Result<T, E> = Ok<T, E> | Err<T, E>;

interface Ok<T, E> {
  readonly _tag: "Ok";
  readonly value: T;
}

interface Err<T, E> {
  readonly _tag: "Err";
  readonly error: E;
}
```

### Utility Types

```typescript
type UnitResult<E = never> = Result<Unit, E>;

type UnwrapResult<R> =
  R extends Result<infer T, infer E> ? { ok: T; err: E } : never;

type UnwrapResultOk<R> = R extends Result<infer T, unknown> ? T : never;
type UnwrapResultErr<R> = R extends Result<unknown, infer E> ? E : never;

// For Result.all type inference
type CombineResults<Rs extends Result<unknown, unknown>[]> = Result<
  { [K in keyof Rs]: UnwrapResultOk<Rs[K]> },
  UnwrapResultErr<Rs[number]>[]
>;
```

### Error Types

```typescript
class UnwrapError extends Error {
  readonly name = "UnwrapError";
  constructor(message: string) {
    super(message);
  }
}
```

---

## Migration Guide

### From Inner-Promise Model

If migrating from the old `Result<Promise<T>, E>` model:

**Before:**

```typescript
Ok(5)
  .map((x) => x * 2)
  .mapAsync(async (x) => await fetchData(x))
  .map((data) => data.name)
  .toPromise();
```

**After:**

```typescript
// Option 1: Explicit Promise chaining
Ok(5)
  .map((x) => x * 2)
  .mapAsync(async (x) => await fetchData(x))
  .then((r) => r.map((data) => data.name));

// Option 2: Use asyncGenAdapter (recommended for complex flows)
await Result.asyncGenAdapter(async function* ($) {
  const x = yield* $(Ok(5).map((v) => v * 2));
  const data = yield* $(await fetchData(x));
  return data.name;
});
```

### From try/catch

```typescript
// Before
function parseJson(s: string): Data {
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new ParseError(e);
  }
}

// After
function parseJson(s: string): Result<Data, ParseError> {
  return Result.tryCatch(
    () => JSON.parse(s),
    (e) => new ParseError(e),
  );
}
```

### From Promise rejection

```typescript
// Before
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/users/${id}`);
  if (!res.ok) throw new HttpError(res.status);
  return res.json();
}

// After
async function fetchUser(id: string): Promise<Result<User, HttpError>> {
  const res = await fetch(`/users/${id}`);
  if (!res.ok) return Result.Err(new HttpError(res.status));
  return Result.Ok(await res.json());
}
```

### From Optional Chaining

```typescript
// Before
const username = user?.profile?.settings?.username ?? "anonymous";

// After
const username = Result.Ok(user)
  .map((u) => u.profile)
  .map((p) => p.settings)
  .map((s) => s.username)
  .unwrapOr("anonymous");

// Or use gen for better readability
const username = Result.gen(function* () {
  const u = yield* Result.fromNullable(user);
  const p = yield* Result.fromNullable(u.profile);
  const s = yield* Result.fromNullable(p.settings);
  return s.username;
}).unwrapOr("anonymous");
```

---

## Real-World Examples

### API Response Handling

```typescript
async function fetchUserData(userId: string): Promise<Result<User, ApiError>> {
  return await Result.tryAsyncCatch(
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new HttpError(response.status);
      }
      return response.json();
    },
    (e) => (e instanceof HttpError ? e : new ApiError(String(e))),
  );
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
function validateUser(data: {
  email: string;
  age: number;
}): Result<ValidUser, string[]> {
  return Ok(data).validate([
    (d) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)
        ? Ok(true)
        : Err("Invalid email format"),
    (d) =>
      d.age >= 0 && d.age <= 150
        ? Ok(true)
        : Err("Age must be between 0 and 150"),
  ]);
}
```

### Complex Async Operation Chaining

```typescript
async function processOrder(
  orderId: string,
): Promise<Result<Confirmation, OrderError>> {
  return await Result.asyncGenAdapter(async function* ($) {
    const order = yield* $(fetchOrder(orderId));
    const validated = yield* $(validateOrder(order));
    const payment = yield* $(await processPayment(validated));
    const inventory = yield* $(await updateInventory(payment));
    const confirmation = yield* $(await sendConfirmation(inventory));
    return confirmation;
  });
}
```

### Multi-Error Validation with Generators

```typescript
async function validateUserData(
  data: UserData,
): Promise<Result<Validated, ValidationError[]>> {
  return await Result.asyncGenAdapter(async function* ($) {
    const basic = yield* $(validateBasicInfo(data));
    const email = yield* $(await validateEmailAsync(data.email));
    const phone = yield* $(await validatePhoneAsync(data.phone));

    // Collect all validation errors
    return yield* $(Ok(basic).validate([() => email, () => phone]));
  });
}
```

---

## Method Quick Reference

| Category | Methods |
|----------|---------|
| Constructors | `Ok`, `Err`, `fromNullable`, `fromPredicate`, `tryCatch`, `tryAsyncCatch`, `UNIT_RESULT` |
| State | `isOk`, `isErr`, `isUnit` |
| Extract | `unwrap`, `unwrapOr`, `unwrapOrElse`, `unwrapErr`, `safeUnwrap`, `match` |
| Transform Ok | `map`, `flatMap`, `zip`, `flatZip`, `mapAsync`, `flatMapAsync`, `zipAsync`, `flatZipAsync` |
| Transform Err | `mapErr`, `mapBoth`, `orElse`, `zipErr`, `mapErrAsync`, `mapBothAsync`, `orElseAsync`, `zipErrAsync` |
| Validate | `validate`, `validateAsync` |
| Combine | `all`, `any` |
| Generators | `gen`, `genAdapter`, `asyncGen`, `asyncGenAdapter` |
| Utility | `tap`, `tapErr`, `flip`, `toOption`, `innerMap`, `toString` |
