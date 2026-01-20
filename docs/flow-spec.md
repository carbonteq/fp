# Flow Namespace Specification

## Overview

The `Flow` namespace provides a **unified generator interface** for composable control flow using both `Option` and `Result` types within the same context. It standardizes the generator-based syntax found in `Option.gen` and `Result.gen` into a single, cohesive API that can handle both success/failure tracks and presence/absence states seamlessly.

### Key Benefits

- **Unified Syntax**: Yield both `Option` and `Result` in the same generator.
- **Improved Type Inference**: The `*Adapter` methods use a helper function (`$`) to drastically improve TypeScript's ability to infer types.
- **Short-Circuiting**: Operates on a "fail-fast" or "short-circuit" mechanism. Use `yield*` to unwrap values; if a failure (`Result.Err`) or absence (`Option.None`) is encountered, execution stops immediately.
- **Stack Safety**: Uses iterative execution under the hood instead of recursion, preventing stack overflows in deep chains.

---

## Design Principles

### 1. Unified Error Handling

The `Flow` module normalizes "failure" states:

- `Result.Err(e)` propagates the error `e` immediately.
- `Option.None` is treated as a specific error type: `UnwrappedNone`.

This means a `Flow` generator always returns a `Result`:

```typescript
type FlowReturn<T, E> = Result<T, E | UnwrappedNone>
```

### 2. Generator as "Do Notation"

`Flow` generators emulate Haskell's `do` notation or Scala's `for-comprehensions`, allowing imperative-style code that is actually functional composition.

```typescript
const result = Flow.gen(function* () {
  const x = yield* Result.Ok(10);        // unwrap Result
  const y = yield* Option.Some(20);      // unwrap Option
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

## API Reference

### `Flow.gen`

Standard synchronous generator for mixing `Option` and `Result`.

**Signature:**

```typescript
gen<T, E>(genFn: () => Generator<Option<any> | Result<any, E>, T, any>): Result<T, E | UnwrappedNone>
```

**Behavior:**

- Yielding `Result.Ok(v)` -> returns `v`
- Yielding `Option.Some(v)` -> returns `v`
- Yielding `Result.Err(e)` -> halts, returns `Result.Err(e)`
- Yielding `Option.None` -> halts, returns `Result.Err(new UnwrappedNone())`

**Example:**

```typescript
const res = Flow.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* Result.Ok(10);
  return a + b;
});
```

### `Flow.genAdapter`

Generator with inference helper. This is the **recommended** method for most synchronous workflows.

**Signature:**

```typescript
genAdapter<T, E>(
  genFn: ($: Adapter) => Generator<YieldWrap<any>, T, any>
): Result<T, E | UnwrappedNone>
```

**Example:**

```typescript
const res = Flow.genAdapter(function* ($) {
  const user = yield* $(findUser(id));
  const settings = yield* $(Option.fromNullable(user.settings));
  return settings.theme;
});
```

### `Flow.asyncGen`

Asynchronous generator. Supports `await`ing promises before yielding.

**Signature:**

```typescript
asyncGen<T, E>(
  genFn: () => AsyncGenerator<Option<any> | Result<any, E>, T, any>
): Promise<Result<T, E | UnwrappedNone>>
```

**Behavior:**

- Similar to `gen`, but returns a `Promise<Result>`.
- You must `await` any Promise before yielding it: `yield* await myPromise`.

**Example:**

```typescript
const res = await Flow.asyncGen(async function* () {
  const user = yield* await fetchUser(id); // Returns Result
  const config = yield* Option.fromNullable(configCache);
  return { user, config };
});
```

### `Flow.asyncGenAdapter`

Asynchronous generator with adapter. The adapter handles both values and Promises automatically.

**Signature:**

```typescript
asyncGenAdapter<T, E>(
  genFn: ($: AsyncAdapter) => AsyncGenerator<AsyncYieldWrap<any>, T, any>
): Promise<Result<T, E | UnwrappedNone>>
```

**Capabilities:**

- `$(val)` -> Wraps synchronous `Option` or `Result`
- `$(promise)` -> Wraps `Promise<Option>` or `Promise<Result>`, handles await automatically.

**Example:**

```typescript
const res = await Flow.asyncGenAdapter(async function* ($) {
  const user = yield* $(fetchUser(1)); // Promise<Result> auto-awaited
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
const val = yield* $(
  mayFail().orElse(() => Result.Ok(fallback))
);
```

### 2. Manual Branching

Do not yield immediately. Check the result state first.

```typescript
const result = mayFail();
if (result.isErr()) {
  // handle error, maybe yield something else
  yield* $(otherStrategy());
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

## Best Practices

1. Use **Adapter variants** (`genAdapter`, `asyncGenAdapter`) by default for better TypeScript experience.
2. Use **`asyncGen`** only if you need very specific control over `await` timing or if dealing with non-standard Thenables.
3. Remember that `Option.None` becomes `Result.Err(UnwrappedNone)`.
