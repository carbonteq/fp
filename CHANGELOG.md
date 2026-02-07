# @carbonteq/fp

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
