# Flow Namespace Specification

## Overview

The `Flow` namespace provides a **unified generator interface** for composable control flow using both `Option` and `Result` types within the same context. It standardizes the generator-based syntax found in `Option.gen` and `Result.gen` into a single, cohesive API that can handle both success/failure tracks and presence/absence states seamlessly.

### Key Benefits

- **Unified Syntax**: Yield both `Option` and `Result` in the same generator.
- **Improved Type Inference**: The `*Adapter` methods use a helper function (`$`) to drastically improve TypeScript's ability to infer types.
- **Short-Circuiting**: Operates on a "fail-fast" or "short-circuit" mechanism. Use `yield*` to unwrap values; if a failure (`Result.Err`) or absence (`Option.None`) is encountered, execution stops immediately.
- **Stack Safety**: Uses iterative execution under the hood instead of recursion, preventing stack overflows in deep chains.
- **Direct Error Yielding**: `FlowError` subclasses can be yielded directly in `gen`/`asyncGen`, and `$.fail()` enables the same in adapter variants.

---

## Design Principles

### 1. Unified Error Handling

The `Flow` module normalizes "failure" states:

- `Result.Err(e)` propagates the error `e` immediately.
- `Option.None` is treated as a specific error type: `UnwrappedNone`.
- `FlowError` subclasses can be yielded directly for cleaner error handling.

This means a `Flow` generator always returns a `Result`:

```typescript
type FlowReturn<T, E> = Result<T, E | UnwrappedNone>;
```

### 2. Generator as "Do Notation"

`Flow` generators emulate Haskell's `do` notation or Scala's `for-comprehensions`, allowing imperative-style code that is actually functional composition.

```typescript
const result = Flow.gen(function* () {
  const x = yield* Result.Ok(10); // unwrap Result
  const y = yield* Option.Some(20); // unwrap Option
  return x + y;
});
// Result.Ok(30)
```

### 3. Explicit Adapter for Inference

While `yield*` works directly, TypeScript sometimes struggles to infer the yield type correctly in complex chains. The `adapter` pattern solves this by wrapping values:

```typescript
Flow.genAdapter(function* ($) {
  const val = yield* $(someComplexExpression);
  // ...
});
```

---

## FlowError - Direct Error Yielding

`FlowError` is a base class that enables direct error yielding in `Flow.gen` and `Flow.asyncGen` generators. Instead of wrapping errors in `Result.Err()`, you can yield them directly.

### Usage

```typescript
import { Flow, FlowError } from "ct-fp";

// Create custom error classes by extending FlowError
class ValidationError extends FlowError {
  readonly _tag = "ValidationError";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends FlowError {
  readonly _tag = "NotFoundError";
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// Use in Flow.gen or Flow.asyncGen
const result = Flow.gen(function* () {
  if (value < 0) {
    yield* new ValidationError("Value must be positive");
  }

  const item = yield* findItem(id);
  if (!item.isActive) {
    yield* new NotFoundError("Item is inactive");
  }

  return item;
});
```

### Comparison: Before and After

**Before (with Result.Err wrapper):**

```typescript
const result = Flow.asyncGen(async function* () {
  if (userId <= 0) {
    yield* Result.Err(new ValidationError("UserID must be positive"));
  }
  // ...
});
```

**After (direct FlowError yielding):**

```typescript
const result = Flow.asyncGen(async function* () {
  if (userId <= 0) {
    yield* new ValidationError("UserID must be positive");
  }
  // ...
});
```

### Type Safety

Error types are correctly inferred in the result union:

```typescript
const getValue = (input: number) =>
  Flow.gen(function* () {
    if (input < 0) {
      yield* new ValidationError("negative");
    }
    if (input === 0) {
      yield* new NotFoundError("zero");
    }
    return input * 2;
  });

// Result type: Result<number, ValidationError | NotFoundError>
```

---

## $.fail() - Error Helper for Adapter Variants

For `genAdapter` and `asyncGenAdapter`, the adapter (`$`) includes a `fail()` method that enables direct error yielding without needing `FlowError` subclasses.

### Usage

```typescript
// genAdapter
const result = Flow.genAdapter(function* ($) {
  const value = yield* $(Option.Some(10));

  if (value < 20) {
    yield* $.fail(new ValidationError("Value too small"));
  }

  return value * 2;
});

// asyncGenAdapter
const result = await Flow.asyncGenAdapter(async function* ($) {
  const user = yield* $(fetchUser(id));

  if (!user.isActive) {
    yield* $.fail(new ValidationError("User inactive"));
  }

  return user;
});
```

### Benefits

- Works with **any Error subclass** - no need to extend `FlowError`
- Consistent with the adapter pattern (`yield* $(...)`)
- Type-safe error union inference

---

## API Reference

### `Flow.gen`

Standard synchronous generator for mixing `Option`, `Result`, and `FlowError`.

**Signature:**

```typescript
gen<T, E>(genFn: () => Generator<Option<any> | Result<any, E> | FlowError, T, any>): Result<T, E | UnwrappedNone>
```

**Behavior:**

- Yielding `Result.Ok(v)` -> returns `v`
- Yielding `Option.Some(v)` -> returns `v`
- Yielding `Result.Err(e)` -> halts, returns `Result.Err(e)`
- Yielding `Option.None` -> halts, returns `Result.Err(new UnwrappedNone())`
- Yielding `FlowError` subclass -> halts, returns `Result.Err(error)`

**Example:**

```typescript
const res = Flow.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* Result.Ok(10);

  if (a + b < 20) {
    yield* new ValidationError("Sum too small");
  }

  return a + b;
});
```

### `Flow.genAdapter`

Generator with inference helper and `$.fail()` support.

**Signature:**

```typescript
genAdapter<T, E>(
  genFn: ($: Adapter & { fail: <E extends Error>(error: E) => FlowYieldWrap<never, E> }) => Generator<YieldWrap<any>, T, any>
): Result<T, E | UnwrappedNone>
```

**Example:**

```typescript
const res = Flow.genAdapter(function* ($) {
  const user = yield* $(findUser(id));

  if (!user.settings) {
    yield* $.fail(new NotFoundError("Settings not found"));
  }

  const settings = yield* $(Option.fromNullable(user.settings));
  return settings.theme;
});
```

### `Flow.asyncGen`

Asynchronous generator supporting `Option`, `Result`, and `FlowError`.

**Signature:**

```typescript
asyncGen<T, E>(
  genFn: () => AsyncGenerator<Option<any> | Result<any, E> | FlowError, T, any>
): Promise<Result<T, E | UnwrappedNone>>
```

**Behavior:**

- Similar to `gen`, but returns a `Promise<Result>`.
- You must `await` any Promise before yielding it: `yield* await myPromise`.
- FlowError subclasses can be yielded directly.

**Example:**

```typescript
const res = await Flow.asyncGen(async function* () {
  const user = yield* await fetchUser(id);

  if (!user.isActive) {
    yield* new ValidationError("User account inactive");
  }

  const config = yield* Option.fromNullable(configCache);
  return { user, config };
});
```

### `Flow.asyncGenAdapter`

Asynchronous generator with adapter and `$.fail()` support.

**Signature:**

```typescript
asyncGenAdapter<T, E>(
  genFn: ($: AsyncAdapter & { fail: <E extends Error>(error: E) => AsyncFlowYieldWrap<never, E> }) => AsyncGenerator<AsyncYieldWrap<any>, T, any>
): Promise<Result<T, E | UnwrappedNone>>
```

**Capabilities:**

- `$(val)` -> Wraps synchronous `Option` or `Result`
- `$(promise)` -> Wraps `Promise<Option>` or `Promise<Result>`, handles await automatically.
- `$.fail(error)` -> Wraps any Error for direct yielding

**Example:**

```typescript
const res = await Flow.asyncGenAdapter(async function* ($) {
  const user = yield* $(fetchUser(1));

  if (!user.isVerified) {
    yield* $.fail(new ValidationError("User not verified"));
  }

  const data = yield* $(Option.Some(5));
  return user.age + data;
});
```

---

## Error Recovery Patterns

Generators imply strict linear control flow. `try/catch` cannot catch yielded Errors because the generator yields *values*, not strict exceptions (though the effect is similar).

To handle errors within a generator:

### 1. `orElse` / `orElseAsync` (Inline Recovery)

Recover *before* yielding.

```typescript
const val = yield * $(mayFail().orElse(() => Result.Ok(fallback)));
```

### 2. Manual Branching

Do not yield immediately. Check the result state first.

```typescript
const result = mayFail();
if (result.isErr()) {
  // handle error, maybe yield something else
  yield * $(otherStrategy());
} else {
  // use value
  const val = result.unwrap();
}
```

---

## Feature Comparison

| Feature | `gen` | `genAdapter` | `asyncGen` | `asyncGenAdapter` |
|:---|:---:|:---:|:---:|:---:|
| **Sync/Async** | Sync | Sync | Async | Async |
| **Type Inference** | Good | **Excellent** | Good | **Excellent** |
| **Syntax** | `yield*` | `yield* $(...)` | `yield* await` | `yield* $(...)` |
| **Auto-Await** | N/A | N/A | No (Manual) | **Yes** |
| **Direct FlowError** | **Yes** | No | **Yes** | No |
| **$.fail() Helper** | No | **Yes** | No | **Yes** |

## Best Practices

1. Use **Adapter variants** (`genAdapter`, `asyncGenAdapter`) by default for better TypeScript experience.
2. Use **`asyncGen`** only if you need very specific control over `await` timing or if dealing with non-standard Thenables.
3. Remember that `Option.None` becomes `Result.Err(UnwrappedNone)`.
4. For direct error yielding:
   - In `gen`/`asyncGen`: extend `FlowError` for your custom errors
   - In `genAdapter`/`asyncGenAdapter`: use `$.fail(error)` with any Error subclass
5. Use discriminated unions (`_tag` property) in your custom errors for easy pattern matching.
