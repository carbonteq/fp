# Release Notes 0.10.0

## Overview

`0.10.0` is a major functional release built on top of `0.9.1`, focused on:

- Generator-first composition for stable APIs
- Stable `Flow` support
- Stronger, more expressive pattern matching
- Reliability and async correctness hardening across stable + experimental APIs
- Large documentation and examples expansion

This release contains ~80 commits and a broad refresh across code, tests, docs, and packaging.

## Highlights

### 1) Generator-based composition added to stable APIs

Stable `Result` and `Option` now support generator workflows:

- `gen`
- `genAdapter`
- `asyncGen`
- `asyncGenAdapter`

Related commits:

- `2741c74` add gen/genAdapter and async variants to stable result
- `5c1e04f` add gen and variants to Option (stable)
- `fbb5024`, `12caa31`, `6caf501` generator API evolution and naming finalization

### 2) Stable Flow support introduced

`Flow` is now available on stable `Result`/`Option`, with dedicated examples and tests.

Related commits:

- `9a29fe9` add flow support to stable Result and Option
- `da8c539`, `f1c7658`, `e417633` flow utility and typing/error improvements
- `256a7f5` flow examples

### 3) Match API and predicates significantly improved

Pattern matching got both ergonomic and type-safety upgrades:

- Better stable/experimental interoperability
- Typed wildcard support (`P._`) in builder API
- Predicate combinators and aliases (`P.eq`, `P.oneOf`, `P.not`, `P.and`/`P.or`, `P.all`/`P.any`)
- Value-state predicates (`P.IsSome`, `P.IsNone`, `P.IsOk`, `P.IsErr`)

Related commits:

- `2d71985` add improved pattern matching
- `12ec859`, `a7ab327`, `21c082a`, `bc29023` match API and examples expansion
- `87a4508`, `cc4eac4`, `1430dd3` correctness and typing fixes in match handlers

### 4) Docs and runnable examples expanded heavily

This release introduces extensive examples for both stable and experimental APIs:

- `examples/result*`, `examples/option*`, `examples/flow*`, `examples/match*`
- README and source-level docs aligned to current async semantics and matching behavior

Related commits:

- `135763e` improve API documentation across stable and experimental modules
- `8e6ce77`, `f294a5d`, `b2f4cdf`, `f1a9ec6`, `cf09b20` docs consistency and behavior clarifications
- `ee661c5`, `6002fe7`, `eb60d26` examples and README refresh

## Behavioral changes and migration notes

### Removed async chaining support (intentional)

Async chaining internals were removed in favor of generator workflows (`gen*` / `asyncGen*`), improving clarity and maintainability.

Related commit:

- `5ac069f` remove async chaining support

### API shape updates around stable/experimental split

During the release cycle, internals were reorganized to clarify stable vs experimental behavior and naming.

Related commits:

- `d7f3698` refactor new result to reflect experimental status
- `2351066` remove result namespacing
- `d0fa59f` re-add old implementation from `v0.9.1` baseline as stable foundation

## Reliability fixes

Multiple fixes landed after feature introduction to improve correctness and edge-case behavior.

### Async correctness and race-condition fixes

- `d52ca0e` fix async race in `Option.any`
- `3539da5` fix async race in `Result.any`
- `3ceaf51` fix `Option.fromPromise` async-none sentinel leakage
- `dd86894`, `9e24b07`, `57905aa`, `8984b2f` robust error handling for flow adapter/yield paths
- `2594009` finalize generators on short-circuit

### Type-system and overload correctness

- `4309692`, `51d167d` `mapBoth` overload and async receiver typing fixes
- `b1f877a` `Option.flatZip` tuple overload fix
- `75a0a21`, `650c7d8` preserve async error context in `zipErr`/`flatMap`
- `cc55d20` add async mapper overload for `Option.mapOr`
- `d8bc6f0` treat thenables as async in experimental `validate`

### Match and interoperability fixes

- `87a4508` support typed wildcard `P._`
- `cc4eac4` fallback special-tag handlers to custom union variants
- `1430dd3` align with-handler input typing with runtime dispatch
- `9f6e076` harden cross-realm `Option`/`Result` guards

## Testing and quality improvements

- Added broad, focused test coverage for stable + experimental generator and flow behavior.
- Added regressions for `mapBoth`, `flatZip`, and `match.with` behavior.
- Updated tests to remove side effects and improve assertion quality.

Related commits:

- `2b32b50`, `0e71333`, `a8fce00`, `473f0b2`, `c533a84`

## Packaging and release pipeline

Publishing metadata and release automation were improved for cleaner npm release behavior.

Related commits:

- `127e830` release packaging metadata and publish context improvements
- `4a32b55` trusted publisher flow preparation
- `679c2b6` changeset release

## Stats (v0.9.1..v0.10.0)

- Commits: ~80
- Files changed: 176
- Insertions: 44,327
- Deletions: 6,386
