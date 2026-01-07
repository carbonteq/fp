# Async Chain Short-Circuit Semantics

**Date:** January 7, 2026  
**Scope:** `Option<T>` and `Result<T, E>` async chains

## Summary

When a chain becomes async (e.g. `map/flatMap/zip/flatZip` with async functions or `Option<Promise<T>>` / `Result<Promise<T>, E>`), downstream operations are **scheduled** but must **not execute** if the upstream resolves to `None` / `Err`. The final state is only known once the async operation settles, so all downstream combinators must short-circuit at execution time, not enqueue time.

## Why this matters

```ts
Result.Ok(1)
  .flatMap(async () => Result.Err("boom"))
  .map((x) => x + 1);
```

At the time `.map(...)` is attached, the chain is still in the "Ok lane." Once the async `flatMap` resolves to `Err`, the `map` must **not run**.

The same applies to `Option`:

```ts
Option.Some(1)
  .flatMap(async () => Option.None)
  .zip((x) => x + 1);
```

`zip` must **not run** when the upstream resolves to `None`.

## Implementation guarantees

For async chains, each combinator:

- Checks upstream resolution sentinels (`ERR_VAL` / `NONE_VAL`) and async error context before invoking the user callback.
- Propagates the short-circuit state forward without executing downstream callbacks.
- Preserves the final `Err` / `None` state after the async step settles.

## Test coverage

Dedicated test files ensure the following for both `Option` and `Result`:

- `map` does not run after async `None`/`Err`.
- `zip` does not run after async `None`/`Err`.
- `flatZip` does not run after async `None`/`Err`.
