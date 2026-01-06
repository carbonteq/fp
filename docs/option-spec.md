# Option<T> Type Specification

## Overview

The `Option<T>` type provides a **type-safe way to encode the presence or absence of a value**. It represents either a value (`Some<T>`) or no value (`None`). This enables explicit handling of optional values without null/undefined ambiguity.

### Key Benefits

- **Type Safety**: Compile-time guarantees about presence/absence states
- **Composability**: Chain operations without nested null checks
- **Async Support**: Seamless handling of both sync and async operations
- **Explicit Optionality**: No more `null` vs `undefined` confusion

---

## Design Principles

### 1. Explicit State Representation

States must be explicitly represented and checkable at both compile-time and runtime:

```typescript
type Option<T> = Some<T> | None
```

### 2. Referential Transparency

All transformation methods must be pure - given the same input, they produce the same output with no side effects. The only exceptions are:

- `unwrap()` which throws on None state (documented, intentional)
- `tap()` which is explicitly for side effects

### 3. Short-Circuit Semantics

Operations on `None` propagate without executing transformation functions:

```typescript
Option.None.map(x => expensiveComputation(x))  // Never calls expensiveComputation
```

### 4. Type-Level Async Tracking

When operations involve Promises, the return type accurately reflects this:

```typescript
Option<T> + sync mapper  → Option<U>
Option<T> + async mapper → Option<Promise<U>>
Option<Promise<T>> + any mapper → Option<Promise<U>>
```

### 5. Covariance Preservation

Option should be covariant in `T` to support subtyping.

---

## Core Definition

```typescript
type Option<T> = Some<T> | None

interface Some<T> {
  readonly _tag: "Some";
  readonly value: T;
}

interface None {
  readonly _tag: "None";
}
```

---

## Constructors

| Constructor | Signature | Description |
|------------|-----------|-------------|
| `Some` | `<T>(value: T): Option<T>` | Creates a Some containing `value` |
| `None` | `Option<never>` | Singleton representing absence |
| `fromNullable` | `<T>(value: T \| null \| undefined): Option<NonNullable<T>>` | Some if non-nullish, else None |
| `fromFalsy` | `<T>(value: T \| Falsy): Option<T>` | Some if truthy, else None |
| `fromPredicate` | `<T>(value: T, pred: (v: T) => boolean): Option<T>` | Some if predicate passes |
| `fromPromise` | `<T>(promise: Promise<Option<T>>): Option<Promise<T>>` | Wraps async Option |

### Constructor Examples

```typescript
// Direct construction
const some = Option.Some(42);           // Some(42)
const none = Option.None;               // None

// From nullable values
Option.fromNullable(user.name);         // Some("John") or None
Option.fromNullable(null);              // None
Option.fromNullable(undefined);         // None
Option.fromNullable(0);                 // Some(0) - 0 is not nullish
Option.fromNullable("");                // Some("") - "" is not nullish

// From falsy values
Option.fromFalsy(0);                    // None
Option.fromFalsy("");                   // None
Option.fromFalsy(false);                // None
Option.fromFalsy(42);                   // Some(42)

// From predicate
Option.fromPredicate(age, x => x >= 18);  // Some(age) if >= 18, else None

// From async
Option.fromPromise(fetchOptionalData()); // Option<Promise<Data>>
```

---

## State Inspection

| Method | Signature | Description |
|--------|-----------|-------------|
| `isSome` | `(): this is Some<T>` | Type guard for Some state |
| `isNone` | `(): this is None` | Type guard for None state |
| `isUnit` | `(): this is Option<Unit>` | Type guard for Unit value |

### State Inspection Examples

```typescript
const opt = Option.Some(42);

if (opt.isSome()) {
  // TypeScript knows opt.value is accessible here
  console.log(opt.value);  // 42
}

if (opt.isNone()) {
  // TypeScript knows this is None
  console.log("No value");
}
```

---

## Value Extraction

| Method | Signature | Description |
|--------|-----------|-------------|
| `unwrap` | `(): T` | Returns value or **throws `UnwrapError`** |
| `unwrapOr` | `(defaultValue: T): T` | Returns value or default |
| `unwrapOrElse` | `(fn: () => T): T` | Returns value or calls factory |
| `safeUnwrap` | `(): T \| null` | Returns value or `null` |
| `match` | `<U>(cases: { Some: (v: T) => U, None: () => U }): U` | Pattern match both states |

### Value Extraction Examples

```typescript
const some = Option.Some(42);
const none = Option.None;

// unwrap - throws on None
some.unwrap();                          // 42
none.unwrap();                          // throws UnwrapError

// unwrapOr - safe with default
some.unwrapOr(0);                       // 42
none.unwrapOr(0);                       // 0

// unwrapOrElse - lazy default
none.unwrapOrElse(() => computeDefault()); // calls computeDefault()

// safeUnwrap - returns null for None
some.safeUnwrap();                      // 42
none.safeUnwrap();                      // null

// match - exhaustive pattern matching
const result = opt.match({
  Some: (value) => `Got ${value}`,
  None: () => "Nothing"
});
```

---

## Transformation Methods

All transformation methods support both sync and async mappers. Return types reflect async presence.

### `map<U>(fn): Option<U>`

Transforms the contained value while preserving None state.

**Signatures:**

```typescript
map<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<U>): Option<Promise<U>>;
map<U>(this: Option<Promise<T>>, fn: (val: T) => U): Option<Promise<U>>;
map<U>(this: Option<T>, fn: (val: T) => Promise<U>): Option<Promise<U>>;
map<U>(this: Option<T>, fn: (val: T) => U): Option<U>;
```

**Behavior:**

- `Some(x).map(f)` → `Some(f(x))`
- `None.map(f)` → `None` (f not called)

**Examples:**

```typescript
Some(5).map(x => x * 2)                    // Some(10)
None.map(x => x * 2)                       // None
Some(5).map(async x => x * 2)              // Some(Promise<10>)
Some(Promise.resolve(5)).map(x => x * 2)   // Some(Promise<10>)
```

### `flatMap<U>(fn): Option<U>`

Chains operations that return Options, flattening the result.

**Signatures:**

```typescript
flatMap<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<Option<U>>): Option<Promise<U>>;
flatMap<U>(this: Option<Promise<T>>, fn: (val: T) => Option<U>): Option<Promise<U>>;
flatMap<U>(this: Option<T>, fn: (val: T) => Promise<Option<U>>): Option<Promise<U>>;
flatMap<U>(this: Option<T>, fn: (val: T) => Option<U>): Option<U>;
```

**Behavior:**

- `Some(x).flatMap(f)` → `f(x)` (where f returns Option)
- `None.flatMap(f)` → `None` (f not called)

**Examples:**

```typescript
Some(5).flatMap(x => Some(x + 1))          // Some(6)
Some(5).flatMap(x => None)                 // None
None.flatMap(x => Some(x + 1))             // None

// Chaining optional operations
findUser(id)
  .flatMap(user => Option.fromNullable(user.profile))
  .flatMap(profile => Option.fromNullable(profile.avatar))
  .map(avatar => avatar.url);
```

### `zip<U>(fn): Option<[T, U]>`

Pairs the original value with a derived value.

**Signatures:**

```typescript
zip<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<U>): Option<Promise<[T, U]>>;
zip<U>(this: Option<Promise<T>>, fn: (val: T) => U): Option<Promise<[T, U]>>;
zip<U>(this: Option<T>, fn: (val: T) => Promise<U>): Option<Promise<[T, U]>>;
zip<U>(this: Option<T>, fn: (val: T) => U): Option<[T, U]>;
```

**Behavior:**

- `Some(x).zip(f)` → `Some([x, f(x)])`
- `None.zip(f)` → `None` (f not called)

**Examples:**

```typescript
Some(5).zip(x => x * 2)                    // Some([5, 10])
None.zip(x => x * 2)                       // None

// Keep original while computing derived value
Some(user).zip(u => u.permissions.length)  // Some([user, 5])
```

### `flatZip<U>(fn): Option<[T, U]>`

Pairs the original value with a value from another Option.

**Signatures:**

```typescript
flatZip<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<Option<U>>): Option<Promise<[T, U]>>;
flatZip<U>(this: Option<Promise<T>>, fn: (val: T) => Option<U>): Option<Promise<[T, U]>>;
flatZip<U>(this: Option<T>, fn: (val: T) => Promise<Option<U>>): Option<Promise<[T, U]>>;
flatZip<U>(this: Option<T>, fn: (val: T) => Option<U>): Option<[T, U]>;
```

**Behavior:**

- `Some(x).flatZip(f)` where `f(x) = Some(y)` → `Some([x, y])`
- `Some(x).flatZip(f)` where `f(x) = None` → `None`
- `None.flatZip(f)` → `None` (f not called)

**Examples:**

```typescript
Some(userId).flatZip(id => findUser(id))   // Some([userId, user]) or None
```

### `filter(pred): Option<T>`

Converts Some to None if predicate fails.

**Signature:**

```typescript
filter(pred: (val: T) => boolean): Option<T>;
filter(pred: (val: T) => Promise<boolean>): Option<Promise<T>>;
```

**Behavior:**

- `Some(x).filter(p)` → `Some(x)` if `p(x)` is true, else `None`
- `None.filter(p)` → `None` (p not called)

**Examples:**

```typescript
Some(5).filter(x => x > 3)                 // Some(5)
Some(5).filter(x => x > 10)                // None
None.filter(x => x > 3)                    // None
```

### `mapOr<U>(defaultValue, fn): U`

Maps the value or returns a default. Returns unwrapped value, not Option.

**Signature:**

```typescript
mapOr<U>(defaultValue: U, fn: (val: T) => U): U;
```

**Behavior:**

- `Some(x).mapOr(d, f)` → `f(x)`
- `None.mapOr(d, f)` → `d`

**Examples:**

```typescript
Some(5).mapOr(0, x => x * 2)               // 10
None.mapOr(0, x => x * 2)                  // 0
```

---

## Combining Options

### `Option.all(...options): Option<T[]>`

Combines multiple Options into a single Option of array.

**Behavior:**

- All Some → `Some([...values])`
- Any None → `None`

```typescript
Option.all(Some(1), Some(2), Some(3))      // Some([1, 2, 3])
Option.all(Some(1), None, Some(3))         // None
Option.all()                               // Some([]) - vacuous truth
```

### `Option.any(...options): Option<T>`

Returns the first Some, or None if all are None.

```typescript
Option.any(None, Some(2), Some(3))         // Some(2)
Option.any(None, None, None)               // None
Option.any()                               // None
```

---

## Utility Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `tap` | `(fn: (val: T) => void): Option<T>` | Side effect on Some, returns self |
| `toResult` | `<E>(error: E): Result<T, E>` | Convert to Result |
| `toPromise` | `(): Promise<Option<Awaited<T>>>` | Resolve inner Promise |
| `innerMap` | `<U>(fn: (el: T[number]) => U): Option<U[]>` | Map over array elements |
| `toString` | `(): string` | String representation |

### Utility Examples

```typescript
// tap - side effects without breaking chain
Some(user)
  .tap(u => console.log(`Processing ${u.name}`))
  .map(u => u.email);

// toResult - convert to Result
Some(42).toResult("was none")              // Ok(42)
None.toResult("was none")                  // Err("was none")

// toPromise - resolve inner promise
const opt: Option<Promise<number>> = Some(Promise.resolve(42));
const resolved = await opt.toPromise();    // Some(42)

// innerMap - map over array contents
Some([1, 2, 3]).innerMap(x => x * 2)       // Some([2, 4, 6])
None.innerMap(x => x * 2)                  // None

// toString
Some(42).toString()                        // "Some(42)"
None.toString()                            // "None"
```

---

## Async Handling Strategy

### The Inner-Promise Model

Option uses the **inner-promise model** where async operations result in `Option<Promise<T>>` rather than `Promise<Option<T>>`.

**Rationale:**

1. **Chain preservation**: Allows continued method chaining without await
2. **Lazy evaluation**: Async work deferred until explicitly awaited
3. **Type accuracy**: Return type precisely reflects when async occurs

### Promise Infection Rules

| Current State | Mapper Type | Result |
|--------------|-------------|--------|
| `Option<T>` | `(T) => U` | `Option<U>` |
| `Option<T>` | `(T) => Promise<U>` | `Option<Promise<U>>` |
| `Option<Promise<T>>` | `(T) => U` | `Option<Promise<U>>` |
| `Option<Promise<T>>` | `(T) => Promise<U>` | `Option<Promise<U>>` |

### Promise Resolution

Use `toPromise()` to resolve inner promises:

```typescript
const opt: Option<Promise<number>> = Some(5).map(async x => x * 2);
const resolved: Promise<Option<number>> = opt.toPromise();
const final: Option<number> = await resolved;  // Some(10)
```

### None Short-Circuit with Async

When async is involved but state is None, the promise should resolve immediately:

```typescript
const opt: Option<Promise<number>> = None.map(async x => x * 2);
const resolved = await opt.toPromise();  // None (no actual async work done)
```

### Async/Sync Interleaved Chaining

A critical capability is **seamless interleaving of sync and async operations** in a single chain. Once a chain becomes async (via an async mapper or `Option<Promise<T>>`), subsequent sync operations are automatically lifted into the async context.

#### Type Progression Through Chains

```typescript
Some(5)                                    // Option<number>
  .map(x => x * 2)                         // Option<number> - sync
  .map(async x => fetchData(x))            // Option<Promise<Data>> - becomes async
  .map(data => data.name)                  // Option<Promise<string>> - sync lifted to async
  .map(async name => validate(name))       // Option<Promise<boolean>> - stays async
  .flatMap(valid => valid ? Some("ok") : None)  // Option<Promise<string>> - sync lifted
  .toPromise()                             // Promise<Option<string>>
```

#### Detailed Type Inference

| Step | Operation | Input Type | Mapper Type | Output Type |
|------|-----------|------------|-------------|-------------|
| 1 | `Some(5)` | - | - | `Option<number>` |
| 2 | `.map(x => x * 2)` | `Option<number>` | `number => number` | `Option<number>` |
| 3 | `.map(async x => fetch(x))` | `Option<number>` | `number => Promise<Data>` | `Option<Promise<Data>>` |
| 4 | `.map(d => d.name)` | `Option<Promise<Data>>` | `Data => string` | `Option<Promise<string>>` |
| 5 | `.map(async n => validate(n))` | `Option<Promise<string>>` | `string => Promise<bool>` | `Option<Promise<boolean>>` |
| 6 | `.flatMap(v => ...)` | `Option<Promise<boolean>>` | `boolean => Option<string>` | `Option<Promise<string>>` |
| 7 | `.toPromise()` | `Option<Promise<string>>` | - | `Promise<Option<string>>` |

#### Key Semantics

1. **Async infection is permanent**: Once `T` becomes `Promise<U>`, all subsequent operations maintain the Promise wrapper until `toPromise()` is called.

2. **Sync mappers are lifted**: When applied to `Option<Promise<T>>`, a sync mapper `(T) => U` is automatically composed with the inner promise: `promise.then(mapper)`.

3. **Async mappers chain properly**: When applied to `Option<Promise<T>>`, an async mapper `(T) => Promise<U>` chains correctly: `promise.then(mapper)` (no double-wrapping).

4. **flatMap flattens correctly**: `Option<Promise<T>>.flatMap(f: T => Option<U>)` produces `Option<Promise<U>>`, not `Option<Promise<Option<U>>>`.

5. **None short-circuits all operations**: If the Option is None at any point, no mappers execute regardless of sync/async nature.

#### Implementation Contract

For `Option<Promise<T>>.map(f: T => U)`:

```typescript
// Conceptually:
Some(promise).map(f) === Some(promise.then(f))
None.map(f) === None  // f never called, no promise created
```

For `Option<Promise<T>>.flatMap(f: T => Option<U>)`:

```typescript
// Conceptually:
Some(promise).flatMap(f) === Some(promise.then(v => {
  const result = f(v);
  return result.isSome() ? result.unwrap() : PROPAGATE_NONE;
}))
```

#### Real-World Example

```typescript
// Mixed sync/async pipeline
function processUser(userId: string): Promise<Option<ProcessedData>> {
  return Some(userId)
    .map(id => parseInt(id, 10))                    // sync: parse ID
    .filter(id => !isNaN(id))                       // sync: validate
    .map(async id => await fetchUser(id))           // async: fetch
    .map(user => user.profile)                      // sync: extract (lifted)
    .flatMap(profile => Option.fromNullable(profile.settings))  // sync: optional field
    .map(async settings => await enrichSettings(settings))      // async: enrich
    .map(settings => ({ ...settings, processed: true }))        // sync: transform
    .toPromise();
}

// Usage
const result = await processUser("123");
if (result.isSome()) {
  console.log(result.unwrap());  // ProcessedData
}
```

---

## Edge Cases & Invariants

### Monad Laws (Invariants)

1. **Identity preservation**: `opt.map(x => x)` ≡ `opt`
2. **Composition**: `opt.map(f).map(g)` ≡ `opt.map(x => g(f(x)))`
3. **flatMap left identity**: `Some(x).flatMap(f)` ≡ `f(x)`
4. **flatMap right identity**: `opt.flatMap(Some)` ≡ `opt`
5. **flatMap associativity**: `opt.flatMap(f).flatMap(g)` ≡ `opt.flatMap(x => f(x).flatMap(g))`

### Edge Cases Table

| Case | Input | Expected Output | Notes |
|------|-------|-----------------|-------|
| None singleton | `Option.None === Option.None` | `true` | Single instance |
| null in Some | `Some(null)` | Valid `Some(null)` | Allowed; use fromNullable if unwanted |
| undefined in Some | `Some(undefined)` | Valid `Some(undefined)` | Allowed; use fromNullable if unwanted |
| Nested Option | `Some(Some(5))` | `Some(Some(5))` | No auto-flatten; use flatMap |
| Empty array in Some | `Some([])` | Valid `Some([])` | Truthy value |
| NaN in Some | `Some(NaN)` | Valid `Some(NaN)` | Number type |
| fromNullable(null) | `Option.fromNullable(null)` | `None` | - |
| fromNullable(undefined) | `Option.fromNullable(undefined)` | `None` | - |
| fromNullable(0) | `Option.fromNullable(0)` | `Some(0)` | 0 is not nullish |
| fromNullable("") | `Option.fromNullable("")` | `Some("")` | "" is not nullish |
| unwrap on None | `None.unwrap()` | Throws `UnwrapError` | - |
| innerMap on non-array | `Some(5).innerMap(f)` | Throws `TypeError` | Runtime check |
| all with empty array | `Option.all()` | `Some([])` | Vacuous truth |
| Rejected promise in map | `Some(5).map(async () => { throw "x" })` | `Some(Promise<rejected>)` | Promise rejection preserved |
| None with async mapper | `None.map(async x => x)` | `None` (sync) | No promise created |

### Async/Sync Chaining Edge Cases

| Case | Input | Expected Type | Notes |
|------|-------|---------------|-------|
| Sync after async | `Some(5).map(async x => x).map(y => y + 1)` | `Option<Promise<number>>` | Sync lifted into async |
| Multiple async | `Some(5).map(async x => x).map(async y => y)` | `Option<Promise<number>>` | No double Promise |
| flatMap after async map | `Some(5).map(async x => x).flatMap(y => Some(y))` | `Option<Promise<number>>` | flatMap lifted |
| flatMap returning async | `Some(5).flatMap(async x => Some(x))` | `Option<Promise<number>>` | Async flatMap |
| zip after async | `Some(5).map(async x => x).zip(y => y * 2)` | `Option<Promise<[number, number]>>` | Zip lifted |
| filter after async | `Some(5).map(async x => x).filter(y => y > 0)` | `Option<Promise<number>>` | Filter lifted |
| toPromise on sync | `Some(5).toPromise()` | `Promise<Option<number>>` | Wraps in resolved Promise |
| toPromise on None | `None.toPromise()` | `Promise<Option<never>>` | Resolves to None |
| Chained toPromise | `Some(5).map(async x => x).toPromise()` | `Promise<Option<number>>` | Unwraps inner Promise |

### Type Narrowing

| Case | Behavior |
|------|----------|
| After `isSome()` | `T` accessible via `value` property |
| After `isNone()` | Only None methods available |
| match exhaustiveness | Compiler enforces both branches |

---

## Type Definitions

### Core Types

```typescript
declare const UNIT: unique symbol;
type Unit = typeof UNIT;

type Option<T> = Some<T> | None;

interface Some<T> {
  readonly _tag: "Some";
  readonly value: T;
}

interface None {
  readonly _tag: "None";
}
```

### Utility Types

```typescript
type UnitOption = Option<Unit>;
type UnwrapOption<O> = O extends Option<infer T> ? T : never;
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
2. **Private sentinel value**: Use Symbol for internal None representation
3. **Context object for async tracking**: Track async state without wrapping in Promise
4. **Singleton None**: Single instance for memory efficiency and reference equality

### Performance Guidelines

1. **Reuse None singleton**: All None values should be the same instance
2. **Lazy async**: Only create Promises when mappers are actually async
3. **Short-circuit early**: Check state before invoking mappers
4. **Inline hot paths**: Avoid function call overhead for simple operations

---

## Migration from null/undefined

```typescript
// Before
function findUser(id: string): User | null { ... }
const name = findUser("123")?.profile?.name ?? "anonymous";

// After
function findUser(id: string): Option<User> { ... }
const name = findUser("123")
  .flatMap(u => Option.fromNullable(u.profile))
  .map(p => p.name)
  .unwrapOr("anonymous");
```

---

## Method Quick Reference

| Category | Methods |
|----------|---------|
| Constructors | `Some`, `None`, `fromNullable`, `fromFalsy`, `fromPredicate`, `fromPromise` |
| State | `isSome`, `isNone`, `isUnit` |
| Extract | `unwrap`, `unwrapOr`, `unwrapOrElse`, `safeUnwrap`, `match` |
| Transform | `map`, `flatMap`, `zip`, `flatZip`, `filter`, `mapOr` |
| Combine | `all`, `any` |
| Utility | `tap`, `toResult`, `toPromise`, `innerMap`, `toString` |
