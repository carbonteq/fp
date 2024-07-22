---
"@carbonteq/fp": minor
---

Update external API (and consequently internals)

- Rename `bind` to `flatMap`. `bind` still available for backwards compatibility
- Rename `combine` to `zip` and `zip` to `flatZip` to maintain symmetry with `map` and `flatMap`
- Rename `bindErr` to `zipErr` to better indicate the intended functionality
- Rename `do` and `doAsync` to `tap` and `tapAsync` respectively
- Add `innerMap` for reducing nesting for `Result<Array<T>, E>` map calls
- Add experimental `pipe` method. Currently, it's only useful to replace multiple `map` calls
