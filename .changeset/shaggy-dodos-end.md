---
"@carbonteq/fp": minor
---

Major Option type rewrite and infrastructure improvements:

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
