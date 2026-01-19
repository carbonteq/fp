# Option<T> Type Specification (Simplified)

## Overview

The `Option<T>` type provides a **type-safe way to encode the presence or absence of a value**. It represents either a value (`Some<T>`) or no value (`None`). This enables explicit handling of optional values without null/undefined ambiguity.

### Key Benefits

- **Type Safety**: Compile-time guarantees about presence/absence states
- **Composability**: Chain operations without nested null checks
- **Explicit Async Boundaries**: Async operations return `Promise<Option<T>>` - standard Promise semantics
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

### 4. Explicit Promise Returns

Async behavior is explicit via `*Async` variants. Sync methods never accept
Promise-returning mappers.

When using `*Async` variants, the return type is **always** `Promise<Option<T>>`:

```typescript
Option<T> + sync mapper  → Option<U>
Option<T> + async mapper → Promise<Option<U>> (via *Async)
```

This aligns with standard JavaScript/TypeScript async patterns.

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

Async variants are explicit (`*Async`). Sync methods accept only sync mappers.

### `map<U>(fn): Option<U>`

Transforms the contained value while preserving None state.

**Signature:**

```typescript
map<U>(fn: (val: T) => U): Option<U>;
```

**Behavior:**

- `Some(x).map(f)` → `Some(f(x))`
- `None.map(f)` → `None` (f not called)

**Examples:**

```typescript
Some(5).map(x => x * 2)                    // Some(10)
None.map(x => x * 2)                       // None
```

### `mapAsync<U>(fn): Promise<Option<U>>`

Transforms the contained value using an async mapper.

**Signature:**

```typescript
mapAsync<U>(fn: (val: T) => Promise<U>): Promise<Option<U>>;
```

**Examples:**

```typescript
Some(5).mapAsync(async x => x * 2)         // Promise<Some(10)>

// Async chaining with explicit promises
Some(5)
  .map(x => x * 2)                         // Some(10)
  .mapAsync(async x => await fetchData(x)) // Promise<Some<Data>>
  .then(o => o.map(d => d.name))           // Promise<Some<string>>
```

### `flatMap<U>(fn): Option<U>`

Chains operations that return Options, flattening the result.

**Signature:**

```typescript
flatMap<U>(fn: (val: T) => Option<U>): Option<U>;
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

// Async flatMap via flatMapAsync
Some(userId).flatMapAsync(async id => await findUser(id));  // Promise<Option<User>>
```

### `flatMapAsync<U>(fn): Promise<Option<U>>`

Chains operations that return async Options.

**Signature:**

```typescript
flatMapAsync<U>(fn: (val: T) => Promise<Option<U>>): Promise<Option<U>>;
```

### `zip<U>(fn): Option<[T, U]>`

Pairs the original value with a derived value.

**Signature:**

```typescript
zip<U>(fn: (val: T) => U): Option<[T, U]>;
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

// Async version
Some(user).zipAsync(async u => await fetchCount(u))  // Promise<Some<[user, number]>>
```

### `zipAsync<U>(fn): Promise<Option<[T, U]>>`

Pairs the original value with a derived async value.

**Signature:**

```typescript
zipAsync<U>(fn: (val: T) => Promise<U>): Promise<Option<[T, U]>>;
```

### `flatZip<U>(fn): Option<[T, U]>`

Pairs the original value with a value from another Option.

**Signature:**

```typescript
flatZip<U>(fn: (val: T) => Option<U>): Option<[T, U]>;
```

**Behavior:**

- `Some(x).flatZip(f)` where `f(x) = Some(y)` → `Some([x, y])`
- `Some(x).flatZip(f)` where `f(x) = None` → `None`
- `None.flatZip(f)` → `None` (f not called)

**Examples:**

```typescript
Some(userId).flatZip(id => findUser(id))   // Some([userId, user]) or None

// Async flatZip
Some(userId).flatZipAsync(async id => await fetchUser(id));  // Promise<Option<[userId, User]>>
```

### `flatZipAsync<U>(fn): Promise<Option<[T, U]>>`

Pairs the original value with a value from another async Option.

**Signature:**

```typescript
flatZipAsync<U>(fn: (val: T) => Promise<Option<U>>): Promise<Option<[T, U]>>;
```

### `filter(pred): Option<T>`

Converts Some to None if predicate fails.

**Signature:**

```typescript
filter(pred: (val: T) => boolean): Option<T>;
```

**Behavior:**

- `Some(x).filter(p)` → `Some(x)` if `p(x)` is true, else `None`
- `None.filter(p)` → `None` (p not called)

**Examples:**

```typescript
Some(5).filter(x => x > 3)                 // Some(5)
Some(5).filter(x => x > 10)                // None
None.filter(x => x > 3)                    // None

// Async filter
Some(age).filterAsync(async x => await isAdult(x));  // Promise<Option<number>>
```

### `filterAsync(pred): Promise<Option<T>>`

Filters with an async predicate.

**Signature:**

```typescript
filterAsync(pred: (val: T) => Promise<boolean>): Promise<Option<T>>;
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

// Async version
Some(5).mapOrAsync(0, async x => await fetch(x));  // Promise<number>
```

### `mapOrAsync<U>(defaultValue, fn): Promise<U>`

Maps the value using an async mapper or returns a default.

**Signature:**

```typescript
mapOrAsync<U>(defaultValue: U, fn: (val: T) => Promise<U>): Promise<U>;
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

## Generator-Based Combinators

### `Option.gen(genFn): Option<T>`

Generator-based syntax for chaining Option operations (simplified, no adapter).

Provides imperative-style code while maintaining functional optionality handling.

**Short-circuits on first None**, returning singleton None. Uses iteration instead of recursion to avoid stack overflow on deep chains.

**Signature:**

```typescript
gen<T>(
  genFn: () => Generator<Option<unknown>, T, unknown>
): Option<T>;
```

**Examples:**

```typescript
// Simple sync chain
const result = Option.gen(function* () {
  const a = yield* Option.Some(1);
  const b = yield* Option.Some(2);
  return a + b;
});
// Option<number> -> Some(3)

// None short-circuit
const result = Option.gen(function* () {
  const a = yield* Option.Some(1);
  const b = yield* Option.None;            // Short-circuits here
  const c = yield* Option.Some(3);         // Never executes
  return a + b + c;
});
// Option<number> -> None

// Chaining optional operations
const email = Option.gen(function* () {
  const user = yield* findUser(userId);
  const profile = yield* Option.fromNullable(user.profile);
  const settings = yield* Option.fromNullable(profile.settings);
  return settings.email;
});

// Nested optional access
const city = Option.gen(function* () {
  const user = yield* Option.fromNullable(getUser());
  const address = yield* Option.fromNullable(user?.address);
  const city = yield* Option.fromNullable(address?.city);
  return city;
});
```

**Key Characteristics:**

- `yield*` with `Option<T>` unwraps the value or short-circuits on None
- The return value is automatically wrapped in `Some`
- Type inference flows through the chain
- Stack-safe (uses iteration, not recursion)

### `Option.genAdapter(genFn): Option<T>`

Generator-based syntax with adapter function for improved type inference.

**Signature:**

```typescript
genAdapter<T>(
  genFn: (
    $: <A>(option: Option<A>) => OptionYieldWrap<A>
  ) => Generator<OptionYieldWrap<unknown>, T, unknown>
): Option<T>;
```

**Examples:**

```typescript
// Better type inference for complex chains
const result = Option.genAdapter(function* ($) {
  // $() wraps Options and enables better IDE/type inference
  const a = yield* $(Option.Some(1));
  const b = yield* $(Option.Some(2));
  return a + b;
});

// Deep nested access with better type safety
const email = Option.genAdapter(function* ($) {
  const user = yield* $(Option.fromNullable(apiResponse?.user));
  const profile = yield* $(Option.fromNullable(user?.profile));
  const contact = yield* $(Option.fromNullable(profile?.contact));
  return contact?.email;
});

// Complex validation chain
const validConfig = Option.genAdapter(function* ($) {
  const raw = yield* $(loadConfig());
  const parsed = yield* $(parseConfig(raw));
  const validated = yield* $(validateConfig(parsed));
  return validated;
});
```

**When to use `genAdapter` vs `gen`:**

- Use `gen` for simple chains
- Use `genAdapter` for better IDE support and type inference in complex chains

### `Option.asyncGen(genFn): Promise<Option<T>>`

Async generator-based syntax for chaining Option operations (simplified, no adapter).

Use `yield*` with `Option<T>` values directly. For `Promise<Option<T>>`, await first then yield*.

**Short-circuits on first None**, returning singleton None. Uses async iteration instead of recursion to avoid stack overflow on deep chains.

**Signature:**

```typescript
asyncGen<T>(
  genFn: () => AsyncGenerator<Option<unknown>, T, unknown>
): Promise<Option<T>>;
```

**Examples:**

```typescript
// Simple async chain
const result = await Option.asyncGen(async function* () {
  const a = yield* Option.Some(1);
  const b = yield* await asyncOperation(a);    // await Promise<Option> first
  const c = yield* Option.Some(3);
  return a + b + c;
});
// Promise<Option<number>> -> Some(result)

// None short-circuit in async
const result = await Option.asyncGen(async function* () {
  const data = yield* await fetchOptionalData();
  const parsed = yield* parse(data);           // Short-circuits on None
  const validated = yield* validate(parsed);   // Never executes
  return validated;
});
// Promise<Option<Validated>> -> None

// Mixed sync/async workflow
const result = await Option.asyncGen(async function* () {
  const id = yield* Option.Some(parseInt(input));  // sync
  const user = yield* await fetchUser(id);         // async
  const profile = yield* Option.fromNullable(user?.profile); // sync
  const enriched = yield* await enrichProfile(profile); // async
  return enriched;
});

// Complex pipeline with multiple optional steps
async function processLead(email: string): Promise<Option<Lead>> {
  return await Option.asyncGen(async function* () {
    const normalized = yield* Some(normalizeEmail(email));
    const existing = yield* await findExistingLead(normalized);
    const enriched = yield* await enrichLeadData(existing);
    const validated = yield* validateLead(enriched);
    return validated;
  });
}
```

**Key Characteristics:**

- `yield*` with `Option<T>` directly unwraps or short-circuits
- `await Promise<Option<T>>` then `yield*` the resolved option
- The return value is automatically wrapped in `Some` and returned as a Promise
- Type inference flows through async chain
- Stack-safe (uses async iteration, not recursion)

### `Option.asyncGenAdapter(genFn): Promise<Option<T>>`

Async generator-based syntax with adapter function for improved type inference.

Supports both `Option<T>` and `Promise<Option<T>>` for flexibility.

**Signature:**

```typescript
asyncGenAdapter<T>(
  genFn: (
    $: <A>(option: Option<A> | Promise<Option<A>>) => AsyncOptionYieldWrap<A>
  ) => AsyncGenerator<AsyncOptionYieldWrap<unknown>, T, unknown>
): Promise<Option<T>>;
```

**Examples:**

```typescript
// No need to manually await - adapter handles it
const result = await Option.asyncGenAdapter(async function* ($) {
  const a = yield* $(Option.Some(1));              // sync Option
  const b = yield* $(asyncOperation(a));            // Promise<Option> - auto-awaited
  const c = yield* $(Option.Some(3));
  return a + b + c;
});

// Complex workflow with database and API calls
const userData = await Option.asyncGenAdapter(async function* ($) {
  const session = yield* $(getSession());                  // Promise<Option<Session>>
  const userId = yield* $(Option.fromNullable(session?.userId));
  const profile = yield* $(await fetchProfile(userId));    // Promise<Option<Profile>>
  const preferences = yield* $(Option.fromNullable(profile?.preferences));
  const enriched = yield* $(await enrichPreferences(preferences)); // Promise<Option<Preferences>>
  return enriched;
});

// Real-world: Optional data enrichment
async function getProductDetails(productId: string): Promise<Option<ProductDetails>> {
  return await Option.asyncGenAdapter(async function* ($) {
    const product = yield* $(await fetchProduct(productId));
    const pricing = yield* $(await fetchPricing(product.sku));
    const inventory = yield* $(await checkInventory(product.id));
    const reviews = yield* $(await fetchReviews(product.id));
    const related = yield* $(await fetchRelatedProducts(product.category));

    return {
      product,
      pricing,
      inventory,
      reviews,
      related,
    };
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
| Complex sync chains (5+ operations, nested access) | `Option.gen` or `Option.genAdapter` |
| Simple async chains | Method chaining with `.then()` |
| Complex async chains with interleaved sync/async | `Option.asyncGen` or `Option.asyncGenAdapter` |
| Deep nested optional property access | `genAdapter` / `asyncGenAdapter` (much cleaner) |

---

## Utility Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `tap` | `(fn: (val: T) => void): Option<T>` | Side effect on Some, returns self |
| `toResult` | `<E>(error: E): Result<T, E>` | Convert to Result |
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

// innerMap - map over array contents
Some([1, 2, 3]).innerMap(x => x * 2)       // Some([2, 4, 6])
None.innerMap(x => x * 2)                  // None

// toString
Some(42).toString()                        // "Some(42)"
None.toString()                            // "None"
```

---

## Async/Sync Interleaved Patterns

### Method Chaining with .then()

```typescript
// Once you hit an async operation, use standard Promise chaining
Some(5)
  .map(x => x * 2)                         // Option<number>
  .mapAsync(async x => await fetchData(x)) // Promise<Option<Data>>
  .then(o => o.map(d => d.name))           // Promise<Option<string>>
  .then(o => {
    if (o.isSome()) {
      console.log(o.unwrap());
    }
    return o;
  });
```

### Generators for Complex Workflows

```typescript
// Generators shine for complex async workflows with many optional steps
async function enrichUserProfile(userId: string): Promise<Option<EnrichedProfile>> {
  return await Option.asyncGenAdapter(async function* ($) {
    const user = yield* $(await fetchUser(userId));
    const profile = yield* $(Option.fromNullable(user?.profile));
    const avatar = yield* $(await fetchAvatar(profile.avatarId));
    const stats = yield* $(await calculateUserStats(user));
    const preferences = yield* $(Option.fromNullable(profile?.preferences));
    const recommendations = yield* $(await generateRecommendations(stats));

    return {
      user,
      profile,
      avatar,
      stats,
      preferences,
      recommendations,
    };
  });
}
```

### Mixed: Methods for simple, generators for complex

```typescript
// Use method chaining for simple transformations
const parsed = input
  .map(i => i.trim())
  .flatMap(s => parseInteger(s));

// Switch to generator for complex optional workflow
const result = await Option.asyncGenAdapter(async function* ($) {
  const num = yield* $(parsed);
  const data = yield* $(await fetchDataForNumber(num));
  const validated = yield* $(validate(data));
  return validated;
});
```

### Nested Optional Access (The Killer Feature)

**Before (nested flatMaps):**

```typescript
const email = user
  .flatMap(u => Option.fromNullable(u.profile))
  .flatMap(p => Option.fromNullable(p.settings))
  .flatMap(s => Option.fromNullable(s.notifications))
  .flatMap(n => Option.fromNullable(n.email));
```

**After (with gen):**

```typescript
const email = Option.gen(function* () {
  const u = yield* Option.fromNullable(user);
  const p = yield* Option.fromNullable(u.profile);
  const s = yield* Option.fromNullable(p.settings);
  const n = yield* Option.fromNullable(s.notifications);
  return n.email;
});
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

## Migration from null/undefined

```typescript
// Before
function findUser(id: string): User | null { ... }
const name = findUser("123")?.profile?.name ?? "anonymous";

// After: method chaining
function findUser(id: string): Option<User> { ... }
const name = findUser("123")
  .flatMap(u => Option.fromNullable(u.profile))
  .map(p => p.name)
  .unwrapOr("anonymous");

// After: with gen (cleaner for deep nesting)
const name = Option.gen(function* () {
  const user = yield* findUser("123");
  const profile = yield* Option.fromNullable(user?.profile);
  return profile.name;
}).unwrapOr("anonymous");
```

---

## Real-World Examples

### Nested Optional Configuration

```typescript
interface Config {
  database?: {
    connection?: {
      host?: string;
      port?: number;
    };
  };
}

// Method chaining (verbose)
const host = Option.fromNullable(config.database)
  .flatMap(db => Option.fromNullable(db.connection))
  .map(conn => conn.host)
  .unwrapOr("localhost");

// With gen (cleaner)
const host = Option.gen(function* () {
  const db = yield* Option.fromNullable(config.database);
  const conn = yield* Option.fromNullable(db.connection);
  return conn.host ?? "localhost";
});

// Async version
const connectionString = await Option.asyncGen(async function* () {
  const db = yield* $(Option.fromNullable(config.database));
  const conn = yield* $(Option.fromNullable(db.connection));
  const host = yield* $(Option.fromNullable(conn.host));
  const port = yield* $(Option.fromNullable(conn.port));
  const resolved = yield* $(await resolveDns(host));
  return `postgresql://${resolved}:${port}`;
});
```

### API Response with Optional Data

```typescript
interface ApiResponse {
  user?: {
    profile?: {
      avatar?: string;
      settings?: {
        theme?: 'light' | 'dark';
      };
    };
  };
}

async function getUserTheme(userId: string): Promise<'light' | 'dark'> {
  return await Option.asyncGenAdapter(async function* ($) {
    const response = yield* $(await fetchUser(userId));
    const profile = yield* $(Option.fromNullable(response.user?.profile));
    const settings = yield* $(Option.fromNullable(profile.settings));
    return settings.theme ?? 'light';
  }).unwrapOr('light');
}
```

### Form Field Processing

```typescript
async function processForm(formData: FormData): Promise<Option<ProcessedData>> {
  return await Option.asyncGenAdapter(async function* ($) {
    const email = yield* $(validateEmail(formData.get('email')));
    const age = yield* $(validateAge(formData.get('age')));
    const country = yield* $(validateCountry(formData.get('country')));

    const verified = yield* $(await verifyEmail(email));
    const enriched = yield* $(await enrichWithCountryData(verified, country));

    return {
      email: verified,
      age,
      country,
      region: enriched.region,
    };
  });
}
```

### Multi-Step Data Pipeline with Optional Steps

```typescript
async function generateReport(userId: string): Promise<Option<Report>> {
  return await Option.asyncGenAdapter(async function* ($) {
    // Required steps
    const user = yield* $(await fetchUser(userId));
    const activity = yield* $(await fetchUserActivity(user.id));

    // Optional enrichment
    const socialData = yield* $(
      Option.gen(function* () {
        const s = yield* $(await fetchSocialData(user.id));
        return s;
      })
    ).orElse(() => Option.Some(null));

    const predictions = yield* $(
      Option.gen(function* () {
        const p = yield* $(await generatePredictions(activity));
        return p;
      })
    ).orElse(() => Option.Some(null));

    return buildReport({ user, activity, socialData, predictions });
  });
}
```

### Cache Layer Pattern

```typescript
async function getDataWithCache(key: string): Promise<Option<Data>> {
  return await Option.asyncGenAdapter(async function* ($) {
    // Try memory cache first
    const memCached = yield* $(Option.fromNullable(memoryCache.get(key)));
    return memCached;
  }).orElse(async () =>
    Option.asyncGenAdapter(async function* ($) {
      // Try Redis cache
      const redisCached = yield* $(await redisGet(key));
      memoryCache.set(key, redisCached);
      return redisCached;
    })
  ).orElse(async () =>
    Option.asyncGenAdapter(async function* ($) {
      // Fetch from database
      const dbData = yield* $(await dbFetch(key));
      await redisSet(key, dbData);
      memoryCache.set(key, dbData);
      return dbData;
    })
  );
}
```

---

## Method Quick Reference

| Category | Methods |
|----------|---------|
| Constructors | `Some`, `None`, `fromNullable`, `fromFalsy`, `fromPredicate` |
| State | `isSome`, `isNone`, `isUnit` |
| Extract | `unwrap`, `unwrapOr`, `unwrapOrElse`, `safeUnwrap`, `match` |
| Transform | `map`, `flatMap`, `zip`, `flatZip`, `filter`, `mapOr`, `mapAsync`, `flatMapAsync`, `zipAsync`, `flatZipAsync`, `filterAsync`, `mapOrAsync` |
| Combine | `all`, `any` |
| Generators | `gen`, `genAdapter`, `asyncGen`, `asyncGenAdapter` |
| Utility | `tap`, `toResult`, `innerMap`, `toString` |
