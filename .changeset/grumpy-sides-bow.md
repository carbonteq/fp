---
"@carbonteq/fp": minor
---

Major Result type rewrite with improved architecture:

- Add discriminant-based state tracking with `_tag` property for compile-time type narrowing
- Improve context isolation - async operations now create separate contexts to prevent cross-branch mutation
- Enhance error type unification through `Result.Err` union semantics
- Add new methods: `mapBoth`, `innerMap`, `zipErr`, `flatZip`, `tap`, `tapErr`
- Improve async overloads with precise type inference for sync/async chains
- Simplify constructor pattern with `Result.Ok()` and `Result.Err()` static methods
- Add `fromNullable()`, `fromPredicate()`, `tryCatch()`, `tryAsyncCatch()` constructors
- Update minimum Node version to 22
