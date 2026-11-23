# @carbonteq/fp

## Unreleased

- Wait for pending absence in stable Option fallbacks, preserve promise-backed return shapes, and type widened None fallbacks honestly.
- Normalize promise-backed inner failures in `Result.fromPromise`, preserving error values and raw rejection identity.
- Select stable `Option.any` and `Result.any` successes in input order without waiting for irrelevant suffixes, and preserve Result error order.
- Fix promise-backed Option and Result `flatMap` chains hanging when a mapper throws, preserving rejection identity and pending mapped absence. Option's promise-input return types now reflect promise flattening.
- Preserve pending absence and failure in stable `Option.toResult` and `Result.toOption` conversions without exposing internal sentinels as successes.
- Settle promise-backed Options and Results before async generator short-circuit checks, preserving pending failures and raw rejections.
- Run and drain generator `finally` cleanup across stable and experimental Option, Result, and Flow, awaiting async cleanup while preserving the primary failure.
- Source-breaking: `ExperimentalResult.validate` now accepts only synchronous validators. Replace `await result.validate([asyncValidator])` with `await result.validateAsync([asyncValidator])`; stable `Result.validate` is unchanged.
- Source-breaking: `ExperimentalResult.mapAsync`, `ExperimentalResult.flatMapAsync`, and stable and experimental `Flow.asyncGenAdapter` now expose caught rejection errors as `unknown`, preserving arbitrary rejection values and requiring callers to narrow them.
- Correct awaited delegation types for stable and experimental Result async iterators and Result and Flow async generator adapters, while preserving synchronous promise payloads.
- Check guarded match predicates against the actual handler input, preserving custom Some, Ok, and Err tagged objects.
- Return false instead of throwing when `isTuple` receives null or undefined.

## 0.11.1

### Patch Changes

- 5161c28: Fix the npm release workflow to publish packages with Changesets v3 and trusted publishing.

## 0.11.0

### Minor Changes

- c80f878: Make ExperimentalResult.validate() synchronous-only. Migrate asynchronous validators to validateAsync(), which always returns a promise.
- 8062204: Expose caught promise rejections as unknown errors from ExperimentalResult.mapAsync/flatMapAsync and Flow.asyncGenAdapter. Narrow errors before accessing their properties.

### Patch Changes

- ce23cc4: Select any() successes in input order without waiting for irrelevant later promises, preserving Result error order.
- 618fc28: Settle async-inner Option and Result values before selecting async generator success or failure branches.
- ec9b875: Preserve pending absence and errors when converting between Option and Result, without exposing internal sentinels.
- 68dcf4c: Normalize nested async Result failures in fromPromise() while preserving original errors and raw rejections.
- 8262110: Return false instead of throwing when isTuple() receives null or undefined.
- 8befc6c: Update the development toolchain to Node 22, current Bun and TypeScript tooling, and typed Oxlint/Oxfmt configuration.
- 68d45b8: Use Awaited<T> for async Result delegation and Flow adapter iterators so inferred payload types match runtime values.
- b42d7fa: Reject mapper exceptions in promise-backed Option.flatMap and Result.flatMap instead of leaving chains pending.
- e22b604: Run finally cleanup when generator workflows short-circuit, await async cleanup, and preserve runner-observed failures.
- 6782486: Constrain guarded match predicates and handlers to actual payload or custom variant types, preserving unknown payload safety.
- e2e2d2c: Apply Option unwrapOr/unwrapOrElse fallbacks after pending absence settles and preserve promise-aware types through isNone().

## 0.10.0

### Minor Changes

- 5ac069f: Remove async chaining support

  With the introduction of the generator methods (`gen`, `asyncGen` etc), there is no reason to support the internal async chaining methods, as using generator syntax would be much more appropriate and readable in those situations.

  Removing this internal tracking would simplify the Result and option internals, allowing better maintenance and extension support.

- 127e830: Ship the post-`v0.9.1` feature set across stable and experimental APIs.

  - Add stable generator-based composition (`gen`, `genAdapter`, `asyncGen`, `asyncGenAdapter`) and stable `Flow` support.
  - Improve and harden pattern matching with fluent `match(...)`, wildcard/predicate handling, and stronger stable/experimental interoperability.
  - Add new matcher predicate utilities (`P.eq`, `P.oneOf`, `P.not`, `P.and`/`P.or` and `P.all`/`P.any` aliases, plus `P.IsSome`/`P.IsNone`/`P.IsOk`/`P.IsErr`).
  - Expand runnable examples for stable + experimental `Result`/`Option`/`Flow`/`match` APIs.
  - Refresh source and README documentation to clarify stable async semantics and matcher behavior.
  - Improve packaging/release metadata (`deno.jsonc` license include fix, changesets access alignment, npm package file list updates).

- d0fa59f: Experimental Result, Option, Flow and pattern matching

## 0.9.1

### Patch Changes

- a6fc559: Update deployment pipeline

## 0.9.0

### Minor Changes

- 3868f2a: Major Result type rewrite with improved architecture:

  - Add discriminant-based state tracking with `_tag` property for compile-time type narrowing
  - Improve context isolation - async operations now create separate contexts to prevent cross-branch mutation
  - Enhance error type unification through `Result.Err` union semantics
  - Add new methods: `mapBoth`, `innerMap`, `zipErr`, `flatZip`, `tap`, `tapErr`
  - Improve async overloads with precise type inference for sync/async chains
  - Simplify constructor pattern with `Result.Ok()` and `Result.Err()` static methods
  - Add `fromNullable()`, `fromPredicate()`, `tryCatch()`, `tryAsyncCatch()` constructors
  - Update minimum Node version to 22

- 98e1ff0: Major Option type rewrite and infrastructure improvements:

  - Add discriminant tags (`"Some"` | `"None"`) for better type narrowing
  - Add new constructors: `fromFalsy()`, `fromPredicate()`, `fromPromise()`
  - Add new methods: `filter()`, `match()`, `all()`, `any()`, `innerMap()`
  - Implement context isolation fixes for async chaining
  - Replace `node:util/types` dependency with custom `isPromiseLike()` for cross-platform compatibility
  - Reorganize test suite into `tests/result/` and `tests/option/` subdirectories
  - Add comprehensive spec documentation in `docs/result-spec.md` and `docs/option-spec.md`
  - Migrate test runner to Bun for consistency
  - Update toolchain: tsdown (bundling), oxlint/oxfmt (linting/formatting), treefmt
  - Update CI workflows to use Bun and target Node 22/24

## 0.8.2

### Patch Changes

- ef4476f: Remove node specific export to fix bun types

## 0.8.1

### Patch Changes

- 0ef93f7: Update exports for better bun compatibility and tree-shaking

## 0.8.0

### Minor Changes

- 13979ad: Rewrite Option and most of Result to be async chainable

### Patch Changes

- 03a96f6: Test publish

## 0.8.0-alpha.0

### Minor Changes

- 13979ad: Rewrite Option and most of Result to be async chainable

### Patch Changes

- 03a96f6: Test publish

## 0.7.0

### Minor Changes

- d304e29: Update tooling

## 0.6.0

### Minor Changes

- c2f13ea: Update external API (and consequently internals)

  - Rename `bind` to `flatMap`. `bind` still available for backwards compatibility
  - Rename `combine` to `zip` and `zip` to `flatZip` to maintain symmetry with `map` and `flatMap`
  - Rename `bindErr` to `zipErr` to better indicate the intended functionality
  - Rename `do` and `doAsync` to `tap` and `tapAsync` respectively
  - Add `innerMap` for reducing nesting for `Result<Array<T>, E>` map calls
  - Add experimental `pipe` method. Currently, it's only useful to replace multiple `map` calls

## 0.5.4

### Patch Changes

- e82ec24: Add innerMap for Option and Result

## 0.5.3

### Patch Changes

- 6d3876a: Extensions to Option monad

## 0.5.2

### Patch Changes

- 98350ae: Fix function overloading

## 0.5.1

### Patch Changes

- 7db4034: Add async map

## 0.5.0

### Minor Changes

- d6e3780: Add combine and bindErr utils. Remove zipAsync. Simplify zip and bind internally

## 0.4.0

### Minor Changes

- 91bf286: - Add more composition methods to Option
  - Fix a bug in Result (Result.Ok(null) will behave as expected)
  - Update Result internals
  - Add method docs and examples
  - Update toolchain
  - Update to Typescript 5

## 0.3.2

### Patch Changes

- 53b1e45: Fix type inference for Result methods

## 0.3.1

### Patch Changes

- 09f28ed: fix exports

## 0.3.0

### Minor Changes

- 993650d: Add Unit type

## 0.2.0

### Minor Changes

- 0999ed1: Add the monads
