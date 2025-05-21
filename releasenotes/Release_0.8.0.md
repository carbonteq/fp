# Release Notes 0.8.0

## Major Changes

In order to handle async computations in a more ergonomic way, the library has received significant changes that affect both API and usage patterns.

### Removed Methods

The following methods have been removed to minimize the library surface area and improve semantics:

1. `unwrapOrElse`
2. `safeUnwrapErr`
3. `mapOr`
4. `mapOrAsync`
5. `tap`
6. `tapAsync`
7. `any`
8. `and` & `sequence` removed in favor of new `all`
9. `lift` removed in favor of `toPromise`
10. `pipe`
11. `bind` alias for `flatMap` has been removed

### Additions to the API

1. `validate` - A new utility method that applies an array of validator functions to a `Result` object
2. `all` - Repurposed to be an enhanced `sequence` that collects all errors instead of just the first one
3. `toPromise` - Converts a `Result<Promise<T>, E>` to a `Promise<Result<T, E>>`, essentially replacing the prior usage of `lift`

## Migrating from 0.7.0 to 0.8.0

### 1. Asynchronous Computation Changes

The most significant change is how asynchronous operations are handled. Methods now return `Result<Promise>` instead of `Promise<Result>`, allowing for more natural chaining of async computations.

**Before (0.7.0):**

```ts
const asyncFun = async () => 1
const anotherAsyncFun = async () => 2

const r1 = OldResult.Ok(1)
// Notice the awkward double await and nesting
const res1 = await(await r1.map(asyncFun)).map(anotherAsyncFun)
```

**After (0.8.0):**

```ts
const asyncFun = async () => 1
const anotherAsyncFun = async () => 2

const r2 = Result.Ok(1)
// We can chain async computations normally without nesting
// Just append .toPromise() at the end of your chain
const res2 = await r2.map(asyncFun).map(anotherAsyncFun).toPromise()
```

> [!IMPORTANT]
> When working with async computations, always remember to append `.toPromise()` at the end of your chain to resolve the wrapped promise. It's easy to accidentally leave a `Result<Promise<T>>` unresolved.

### 2. Replacing `all` Functionality

The previous functionality of `all` (checking if all Results are in an Ok state) has been removed. Here's how to achieve the same result:

**Before (0.7.0):**

```ts
const res1 = OldResult.all("ok", [
  OldResult.Ok(1),
  OldResult.Err(2),
  OldResult.Ok(3),
]) // false
```

**After (0.8.0):**

```ts
const res2 = [Result.Ok(1), Result.Err(2), Result.Ok(3)].every((r) => r.isOk()) // false
```

### 3. Replacing `sequence` with the New `all`

After handling prior usages of `all`, you can safely replace `sequence` with the new version of `all`. Note that the new `all` collects all errors instead of just returning the first one:

**Before (0.7.0):**

```ts
const res1 = OldResult.sequence(
  OldResult.Ok(1),
  OldResult.Err(2),
  OldResult.Ok(3),
  OldResult.Err("4"),
)
// res1: OldResult<[number, never, number, never], string | number>
res1.unwrapErr() // 2 (only the first error)
```

**After (0.8.0):**

```ts
const res2 = Result.all(
  Result.Ok(1),
  Result.Err(2),
  Result.Ok(3),
  Result.Err("4"),
)
// res2: Result<[number, never, number, never], (string | number)[]>
res2.unwrapErr() // [2, "4"] (all errors are returned)
```

### 4. Migration Guide for Removed Methods

Here are alternatives for the removed methods:

| Removed Method          | Alternative                                |
| ----------------------- | ------------------------------------------ |
| `unwrapOrElse(fn)`      | `isOk() ? unwrap() : fn()`                 |
| `safeUnwrapErr()`       | `isErr() ? unwrapErr() : null`             |
| `mapOr(defaultVal, fn)` | `isOk() ? map(fn) : map(() => defaultVal)` |
| `tap(fn)`               | `map(x => { fn(x); return x; })`           |
| `lift`                  | Use `toPromise()`                          |
| `pipe(fn)`              | Simply chain methods directly              |
