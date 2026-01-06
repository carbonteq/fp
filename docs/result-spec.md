# Result<T, E> Type Specification

## Overview

The `Result<T, E>` type provides a **type-safe, composable way to handle operations that can succeed or fail**. It represents either success (`Ok<T>`) containing a value of type `T`, or failure (`Err<E>`) containing an error of type `E`. This enables explicit error handling without exceptions and facilitates clean, functional programming patterns.

### Key Benefits

- **Type Safety**: Compile-time guarantees about success/failure states
- **Composability**: Chain operations without nested try-catch blocks
- **Async Support**: Seamless handling of both sync and async operations
- **Error Context**: Rich error information with type-safe propagation
- **Functional Style**: Pure functions with predictable behavior

---

## Design Principles

### 1. Explicit State Representation

States must be explicitly represented and checkable at both compile-time and runtime:

```typescript
type Result<T, E> = Ok<T, E> | Err<T, E>
```

### 2. Referential Transparency

All transformation methods must be pure - given the same input, they produce the same output with no side effects. The only exceptions are:

- `unwrap()` / `unwrapErr()` which throw on invalid state (documented, intentional)
- `tap()` / `tapErr()` which are explicitly for side effects

### 3. Short-Circuit Semantics

Operations on the error track propagate without executing transformation functions:

```typescript
Result.Err("fail").map(x => expensiveComputation(x))  // Never calls expensiveComputation
```

### 4. Type-Level Async Tracking

When operations involve Promises, the return type accurately reflects this:

```typescript
Result<T, E> + sync mapper  → Result<U, E>
Result<T, E> + async mapper → Result<Promise<U>, E>
Result<Promise<T>, E> + any mapper → Result<Promise<U>, E>
```

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
type Result<T, E> = Ok<T, E> | Err<T, E>

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
| `fromPromise` | `<T, E>(promise: Promise<Result<T, E>>): Result<Promise<T>, E>` | Wraps async Result |
| `tryCatch` | `<T, E>(fn: () => T, errorMapper?: (e: unknown) => E): Result<T, E>` | Catches sync exceptions |
| `tryAsyncCatch` | `<T, E>(fn: () => Promise<T>, errorMapper?: (e: unknown) => E): Result<Promise<T>, E>` | Catches async exceptions |

> **Note:** `tryCatch` and `tryAsyncCatch` are named this way because `try` is a reserved keyword in JavaScript/TypeScript and cannot be used as a method name directly.

**Special Values:**

```typescript
Result.UNIT_RESULT: Result<Unit, never>  // Singleton for void-success
```

### Constructor Examples

```typescript
// Direct construction
const ok = Result.Ok(42);                  // Ok(42)
const err = Result.Err("failed");          // Err("failed")

// From nullable values
Result.fromNullable(user, "User not found");  // Ok(user) or Err("User not found")
Result.fromNullable(null, "Not found");       // Err("Not found")

// From predicate
Result.fromPredicate(age, x => x >= 18, "Must be adult");  // Ok or Err

// From throwing function
Result.tryCatch(() => JSON.parse(data), e => new ParseError(e));

// From async throwing function
Result.tryAsyncCatch(
  () => fetch(url).then(r => r.json()),
  e => new NetworkError(e)
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
  console.log(result.value);  // 42
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
ok.unwrap();                               // 42
err.unwrap();                              // re-throws Error (preserves stack)

// unwrapOr - safe with default
ok.unwrapOr(0);                            // 42
err.unwrapOr(0);                           // 0

// unwrapOrElse - compute recovery from error
err.unwrapOrElse(e => computeFallback(e)); // calls with error

// unwrapErr - get error value
err.unwrapErr();                           // Error("failed")
ok.unwrapErr();                            // throws UnwrapError

// safeUnwrap - null for Err
ok.safeUnwrap();                           // 42
err.safeUnwrap();                          // null

// match - exhaustive pattern matching
const message = result.match({
  Ok: (value) => `Success: ${value}`,
  Err: (error) => `Failed: ${error.message}`
});
```

---

## Transformation Methods (Ok Track)

### `map<U>(fn): Result<U, E>`

Transforms the success value while preserving error state.

**Signatures:**

```typescript
map<U>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<U>): Result<Promise<U>, E>;
map<U>(this: Result<Promise<T>, E>, fn: (val: T) => U): Result<Promise<U>, E>;
map<U>(this: Result<T, E>, fn: (val: T) => Promise<U>): Result<Promise<U>, E>;
map<U>(this: Result<T, E>, fn: (val: T) => U): Result<U, E>;
```

**Behavior:**

- `Ok(x).map(f)` → `Ok(f(x))`
- `Err(e).map(f)` → `Err(e)` (f not called)

**Examples:**

```typescript
Ok(42).map(x => x * 2)                     // Ok(84)
Err("error").map(x => x * 2)               // Err("error")
Ok(42).map(async x => x + 10)              // Ok(Promise<52>)
Ok(Promise.resolve(42)).map(x => x * 2)    // Ok(Promise<84>)
```

### `flatMap<U, E2>(fn): Result<U, E | E2>`

Chains operations that return Results, flattening and unifying error types.

**Signatures:**

```typescript
flatMap<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Result<U, E2>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<T, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<T, E>, fn: (val: T) => Result<U, E2>): Result<U, E | E2>;
```

**Behavior:**

- `Ok(x).flatMap(f)` → `f(x)` (where f returns Result)
- `Err(e).flatMap(f)` → `Err(e)` (f not called)

**Examples:**

```typescript
// Success chain
Ok(42)
  .flatMap(x => Ok(x + 1))                 // Ok(43)
  .flatMap(x => Err("too big"));           // Err("too big")

// Error propagation
Err("initial").flatMap(x => Ok(x + 1));    // Err("initial")

// Async support
Ok(42).flatMap(async x => Ok(x * 3));      // Result<Promise<126>, string>

// Chaining fallible operations
parseUserId(input)
  .flatMap(id => fetchUser(id))
  .flatMap(user => validatePermissions(user))
  .map(user => user.email);
```

### `zip<U>(fn): Result<[T, U], E>`

Pairs the original value with a derived value.

**Signatures:**

```typescript
zip<U>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<U>): Result<Promise<[T, U]>, E>;
zip<U>(this: Result<Promise<T>, E>, fn: (val: T) => U): Result<Promise<[T, U]>, E>;
zip<U>(this: Result<T, E>, fn: (val: T) => Promise<U>): Result<Promise<[T, U]>, E>;
zip<U>(this: Result<T, E>, fn: (val: T) => U): Result<[T, U], E>;
```

**Examples:**

```typescript
Ok(42).zip(x => x * 10)                    // Ok([42, 420])
Err("error").zip(x => x * 10)              // Err("error")

// Keep original while computing derived
Ok(user).zip(u => u.permissions.length)    // Ok([user, 5])
```

### `flatZip<U, E2>(fn): Result<[T, U], E | E2>`

Pairs the original value with a value from another Result.

**Signatures:**

```typescript
flatZip<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Result<U, E2>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<T, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<T, E>, fn: (val: T) => Result<U, E2>): Result<[T, U], E | E2>;
```

**Examples:**

```typescript
Ok(42)
  .flatZip(x => Ok(x + 5))                 // Ok([42, 47])
  .flatZip(([a, b]) => Err("invalid"));    // Err("invalid")
```

---

## Transformation Methods (Err Track)

### `mapErr<E2>(fn): Result<T, E2>`

Transforms the error while preserving success value.

**Signatures:**

```typescript
mapErr<E2>(fn: (err: E) => E2): Result<T, E2>;
mapErr<E2>(fn: (err: E) => Promise<E2>): Result<T, Promise<E2>>;
```

**Behavior:**

- `Ok(x).mapErr(f)` → `Ok(x)` (f not called)
- `Err(e).mapErr(f)` → `Err(f(e))`

**Examples:**

```typescript
Err("network error").mapErr(e => `Network: ${e}`);  // Err("Network: network error")
Ok(42).mapErr(e => `Error: ${e}`);                   // Ok(42)

// Add context to errors
fetchData()
  .mapErr(e => new ContextualError("Failed to fetch data", e));
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
  val => `Success: ${val}`,
  err => `Failure: ${err}`
);  // Ok("Success: 42")

Err("timeout").mapBoth(
  val => `Success: ${val}`,
  err => `Failure: ${err}`
);  // Err("Failure: timeout")
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
  .orElse(e => fetchFromBackup())
  .orElse(e => Ok(defaultValue));

// Transform error type
Err("not found").orElse(e => Err(new NotFoundError(e)));
```

### `zipErr<E2>(fn): Result<T, E | E2>`

Combines errors (useful for validation accumulation patterns).

**Signature:**

```typescript
zipErr<E2>(fn: (val: T) => Result<unknown, E2>): Result<T, E | E2>;
```

**Examples:**

```typescript
Ok(42).zipErr(x => Err("validation"));     // Err("validation")
Err("initial").zipErr(x => Err("second")); // Err("initial") or implementation-specific
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

// Form validation
Ok(formData).validate([
  validateEmail,
  validatePassword,
  validateUsername,
]);
```

---

## Aggregation

### `Result.all(...results): Result<T[], E[]>`

Combines multiple Results into one.

**Behavior:**

- All Ok → `Ok([...values])` with preserved tuple types
- Any Err → `Err([...errors])` collecting ALL errors

```typescript
Result.all(Ok(1), Ok(2), Ok(3))            // Ok([1, 2, 3])
Result.all(Ok(1), Err("a"), Err("b"))      // Err(["a", "b"])
Result.all()                               // Ok([]) - vacuous truth

// Mixed sync/async
Result.all(
  Ok(1),
  Ok(Promise.resolve(2)),
  Err("error")
);  // Result<Promise<[1, 2]>, ["error"]>

// Parallel validation
Result.all(
  validateEmail(email),
  validatePassword(password),
  validateAge(age)
);
```

### `Result.any(...results): Result<T, E[]>`

Returns first Ok, or collects all errors.

```typescript
Result.any(Err("a"), Ok(2), Ok(3))         // Ok(2)
Result.any(Err("a"), Err("b"), Err("c"))   // Err(["a", "b", "c"])
Result.any()                               // Err([]) - no success possible

// Fallback chain
Result.any(
  fetchFromCache(key),
  fetchFromDb(key),
  fetchFromRemote(key)
);
```

---

## Utility Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `tap` | `(fn: (val: T) => void): Result<T, E>` | Side effect on Ok, returns self |
| `tapErr` | `(fn: (err: E) => void): Result<T, E>` | Side effect on Err, returns self |
| `flip` | `(): Result<E, T>` | Swaps Ok and Err |
| `toOption` | `(): Option<T>` | Discards error information |
| `toPromise` | `(): Promise<Result<Awaited<T>, E>>` | Resolve inner Promise |
| `innerMap` | `<U>(fn: (el: T[number]) => U): Result<U[], E>` | Map over array elements |
| `toString` | `(): string` | String representation |

### Utility Examples

```typescript
// tap - logging without breaking chain
Ok(user)
  .tap(u => console.log(`Processing ${u.name}`))
  .tapErr(e => console.error(`Failed: ${e}`))
  .map(u => u.email);

// flip - swap success and error
Ok(42).flip()                              // Err(42)
Err("x").flip()                            // Ok("x")

// toOption - discard error info
Ok(42).toOption()                          // Some(42)
Err("x").toOption()                        // None

// toPromise - resolve inner promise
const result: Result<Promise<number>, string> = Ok(Promise.resolve(42));
await result.toPromise();                  // Ok(42)

// innerMap - map over array contents
Ok([1, 2, 3]).innerMap(x => x * 2)         // Ok([2, 4, 6])
Err("x").innerMap(x => x * 2)              // Err("x")

// toString
Ok(42).toString()                          // "Ok(42)"
Err("fail").toString()                     // "Err(fail)"
```

---

## Async Handling Strategy

### The Inner-Promise Model

Result uses the **inner-promise model** where async operations result in `Result<Promise<T>, E>` rather than `Promise<Result<T, E>>`.

**Rationale:**

1. **Chain preservation**: Allows continued method chaining without await
2. **Lazy evaluation**: Async work deferred until explicitly awaited
3. **Type accuracy**: Return type precisely reflects when async occurs

### Promise Infection Rules

| Current State | Mapper Type | Result |
|--------------|-------------|--------|
| `Result<T, E>` | `(T) => U` | `Result<U, E>` |
| `Result<T, E>` | `(T) => Promise<U>` | `Result<Promise<U>, E>` |
| `Result<Promise<T>, E>` | `(T) => U` | `Result<Promise<U>, E>` |
| `Result<Promise<T>, E>` | `(T) => Promise<U>` | `Result<Promise<U>, E>` |

### Promise Resolution

Use `toPromise()` to resolve inner promises:

```typescript
const result: Result<Promise<number>, string> = Ok(5).map(async x => x * 2);
const resolved: Promise<Result<number, string>> = result.toPromise();
const final: Result<number, string> = await resolved;  // Ok(10)
```

### Err Short-Circuit with Async

When async is involved but state is Err, the promise should resolve immediately:

```typescript
const result: Result<Promise<number>, string> = Err("fail").map(async x => x * 2);
const resolved = await result.toPromise();  // Err("fail") (no async work done)
```

### Async/Sync Interleaved Chaining

A critical capability is **seamless interleaving of sync and async operations** in a single chain. Once a chain becomes async (via an async mapper or `Result<Promise<T>, E>`), subsequent sync operations are automatically lifted into the async context.

#### Type Progression Through Chains

```typescript
Ok(5)                                      // Result<number, never>
  .map(x => x * 2)                         // Result<number, never> - sync
  .map(async x => fetchData(x))            // Result<Promise<Data>, never> - becomes async
  .map(data => data.name)                  // Result<Promise<string>, never> - sync lifted
  .flatMap(name => validateName(name))     // Result<Promise<string>, ValidationError> - sync lifted
  .mapErr(e => new AppError(e))            // Result<Promise<string>, AppError> - error track
  .toPromise()                             // Promise<Result<string, AppError>>
```

#### Detailed Type Inference

| Step | Operation | Input Type | Mapper Type | Output Type |
|------|-----------|------------|-------------|-------------|
| 1 | `Ok(5)` | - | - | `Result<number, never>` |
| 2 | `.map(x => x * 2)` | `Result<number, E>` | `number => number` | `Result<number, E>` |
| 3 | `.map(async x => fetch(x))` | `Result<number, E>` | `number => Promise<Data>` | `Result<Promise<Data>, E>` |
| 4 | `.map(d => d.name)` | `Result<Promise<Data>, E>` | `Data => string` | `Result<Promise<string>, E>` |
| 5 | `.flatMap(n => validate(n))` | `Result<Promise<string>, E>` | `string => Result<string, VE>` | `Result<Promise<string>, E \| VE>` |
| 6 | `.mapErr(e => wrap(e))` | `Result<Promise<string>, E>` | `E => AppError` | `Result<Promise<string>, AppError>` |
| 7 | `.toPromise()` | `Result<Promise<string>, E>` | - | `Promise<Result<string, E>>` |

#### Key Semantics

1. **Async infection is permanent**: Once `T` becomes `Promise<U>`, all subsequent operations maintain the Promise wrapper until `toPromise()` is called.

2. **Sync mappers are lifted**: When applied to `Result<Promise<T>, E>`, a sync mapper `(T) => U` is automatically composed with the inner promise: `promise.then(mapper)`.

3. **Async mappers chain properly**: When applied to `Result<Promise<T>, E>`, an async mapper `(T) => Promise<U>` chains correctly: `promise.then(mapper)` (no double-wrapping).

4. **flatMap flattens correctly**: `Result<Promise<T>, E>.flatMap(f: T => Result<U, E2>)` produces `Result<Promise<U>, E | E2>`, not `Result<Promise<Result<U, E2>>, E>`.

5. **Error types accumulate**: Each `flatMap` unions the new error type with existing error types.

6. **Err short-circuits all operations**: If the Result is Err at any point, no Ok-track mappers execute regardless of sync/async nature.

7. **Error track stays sync**: `mapErr` operates on the error value directly; it doesn't interact with the Promise in the Ok track.

#### Implementation Contract

For `Result<Promise<T>, E>.map(f: T => U)`:

```typescript
// Conceptually:
Ok(promise).map(f) === Ok(promise.then(f))
Err(e).map(f) === Err(e)  // f never called, no promise created
```

For `Result<Promise<T>, E>.flatMap(f: T => Result<U, E2>)`:

```typescript
// Conceptually:
Ok(promise).flatMap(f) === Ok(promise.then(v => {
  const result = f(v);
  return result.isOk() ? result.unwrap() : PROPAGATE_ERR(result.unwrapErr());
}))
// Error from inner Result must be captured and propagated
```

#### Real-World Example

```typescript
// Mixed sync/async pipeline with error handling
function processOrder(orderId: string): Promise<Result<Receipt, OrderError>> {
  return Ok(orderId)
    .map(id => parseInt(id, 10))                    // sync: parse ID
    .flatMap(id => isNaN(id) 
      ? Err(new ValidationError("Invalid ID")) 
      : Ok(id))                                     // sync: validate
    .map(async id => await fetchOrder(id))          // async: fetch
    .map(order => order.items)                      // sync: extract (lifted)
    .flatMap(items => items.length > 0 
      ? Ok(items) 
      : Err(new ValidationError("Empty order")))   // sync: validate (lifted)
    .map(async items => await calculateTotal(items)) // async: calculate
    .flatMap(async total => await processPayment(total)) // async: payment
    .map(payment => ({ orderId, payment, timestamp: Date.now() })) // sync: receipt
    .mapErr(e => new OrderError("Order processing failed", e))     // wrap errors
    .toPromise();
}

// Usage
const result = await processOrder("123");
result.match({
  Ok: receipt => console.log("Success:", receipt),
  Err: error => console.error("Failed:", error.message)
});
```

#### Error Handling in Async Chains

When an async operation throws or rejects, the behavior depends on where it occurs:

```typescript
Ok(5)
  .map(async x => {
    if (x < 0) throw new Error("negative");  // This becomes a rejected promise
    return x * 2;
  })
  .toPromise()  // Promise rejects with Error("negative")
```

To capture async errors as `Err` values, use `Result.tryAsyncCatch` or handle at the boundary:

```typescript
// Option 1: Use tryAsyncCatch for individual operations
Ok(5)
  .flatMap(x => Result.tryAsyncCatch(
    async () => riskyOperation(x),
    e => new OperationError(e)
  ))
  .toPromise()

// Option 2: Catch at the boundary
Ok(5)
  .map(async x => riskyOperation(x))
  .toPromise()
  .catch(e => Err(new OperationError(e)))
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
| Rejected promise in map | `Ok(5).map(async () => { throw "x" })` | `Ok(Promise<rejected>)` | Rejection preserved |
| Err with async mapper | `Err("e").map(async x => x)` | `Err("e")` (sync) | No promise created |

### Async/Sync Chaining Edge Cases

| Case | Input | Expected Type | Notes |
|------|-------|---------------|-------|
| Sync after async | `Ok(5).map(async x => x).map(y => y + 1)` | `Result<Promise<number>, E>` | Sync lifted into async |
| Multiple async | `Ok(5).map(async x => x).map(async y => y)` | `Result<Promise<number>, E>` | No double Promise |
| flatMap after async map | `Ok(5).map(async x => x).flatMap(y => Ok(y))` | `Result<Promise<number>, E>` | flatMap lifted |
| flatMap returning async | `Ok(5).flatMap(async x => Ok(x))` | `Result<Promise<number>, E>` | Async flatMap |
| Err flatMap returns Ok | `Ok(5).flatMap(x => Err("e")).flatMap(y => Ok(y))` | `Result<number, string>` | Err propagates |
| zip after async | `Ok(5).map(async x => x).zip(y => y * 2)` | `Result<Promise<[number, number]>, E>` | Zip lifted |
| mapErr on async Ok | `Ok(5).map(async x => x).mapErr(e => e)` | `Result<Promise<number>, E>` | mapErr doesn't affect Ok |
| mapErr on Err (async chain) | `Err("e").map(async x => x).mapErr(e => e.toUpperCase())` | `Result<Promise<never>, string>` | Error transformed |
| toPromise on sync | `Ok(5).toPromise()` | `Promise<Result<number, E>>` | Wraps in resolved Promise |
| toPromise on Err | `Err("e").toPromise()` | `Promise<Result<never, string>>` | Resolves to Err |
| Chained toPromise | `Ok(5).map(async x => x).toPromise()` | `Promise<Result<number, E>>` | Unwraps inner Promise |
| Error type accumulation | `Ok(5).flatMap(x => Err("a" as const)).flatMap(x => Err(1 as const))` | `Result<never, "a" \| 1>` | Union of error types |

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

type UnwrapResult<R> = R extends Result<infer T, infer E> 
  ? { ok: T; err: E } 
  : never;

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

## Implementation Considerations

### Recommended Strategy

1. **Class-based with discriminated tag**: Single class with `_tag` discriminant
2. **Private sentinel values**: Use Symbols for internal state representation
3. **Context object for async tracking**: Track async state without wrapping in Promise
4. **Singleton UNIT_RESULT**: Single instance for void-success operations

### Performance Guidelines

1. **Avoid unnecessary allocations**: Share context objects across chains
2. **Lazy async**: Only create Promises when mappers are actually async
3. **Short-circuit early**: Check state before invoking mappers
4. **Re-throw Error instances**: Preserve stack traces when unwrapping Err(Error)

---

## Migration Guide

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
    e => new ParseError(e)
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
  if (!res.ok) return Err(new HttpError(res.status));
  return Ok(await res.json());
}
```

### From Optional Chaining

```typescript
// Before
const username = user?.profile?.settings?.username ?? "anonymous";

// After
const username = Result.Ok(user)
  .map(u => u.profile)
  .map(p => p.settings)
  .map(s => s.username)
  .unwrapOr("anonymous");
```

---

## Real-World Examples

### API Response Handling

```typescript
async function fetchUserData(userId: string): Promise<Result<User, ApiError>> {
  return Result.tryAsyncCatch(
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new HttpError(response.status);
      }
      return response.json();
    },
    e => e instanceof HttpError ? e : new ApiError(String(e))
  ).toPromise();
}

// Usage
const result = await fetchUserData("123");
const userName = result
  .map(user => user.name)
  .map(name => name.toUpperCase())
  .safeUnwrap();  // string | null
```

### Form Validation

```typescript
function validateUser(data: { email: string; age: number }): Result<ValidUser, string[]> {
  return Ok(data).validate([
    d => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) 
      ? Ok(true) 
      : Err("Invalid email format"),
    d => d.age >= 0 && d.age <= 150 
      ? Ok(true) 
      : Err("Age must be between 0 and 150"),
  ]);
}
```

### Async Operation Chaining

```typescript
async function processOrder(orderId: string): Promise<Result<Confirmation, OrderError>> {
  return fetchOrder(orderId)
    .flatMap(order => validateOrder(order))
    .flatMap(order => processPayment(order))
    .flatMap(payment => updateInventory(payment))
    .flatMap(result => sendConfirmation(result))
    .toPromise();
}
```

---

## Method Quick Reference

| Category | Methods |
|----------|---------|
| Constructors | `Ok`, `Err`, `fromNullable`, `fromPredicate`, `fromPromise`, `tryCatch`, `tryAsyncCatch`, `UNIT_RESULT` |
| State | `isOk`, `isErr`, `isUnit` |
| Extract | `unwrap`, `unwrapOr`, `unwrapOrElse`, `unwrapErr`, `safeUnwrap`, `match` |
| Transform Ok | `map`, `flatMap`, `zip`, `flatZip` |
| Transform Err | `mapErr`, `mapBoth`, `orElse`, `zipErr` |
| Validate | `validate` |
| Combine | `all`, `any` |
| Utility | `tap`, `tapErr`, `flip`, `toOption`, `toPromise`, `innerMap`, `toString` |
