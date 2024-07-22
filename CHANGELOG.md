# @carbonteq/fp

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
