---
"@carbonteq/fp": minor
---

Ship the post-`v0.9.1` feature set across stable and experimental APIs.

- Add stable generator-based composition (`gen`, `genAdapter`, `asyncGen`, `asyncGenAdapter`) and stable `Flow` support.
- Improve and harden pattern matching with fluent `match(...)`, wildcard/predicate handling, and stronger stable/experimental interoperability.
- Add new matcher predicate utilities (`P.eq`, `P.oneOf`, `P.not`, `P.and`/`P.or` and `P.all`/`P.any` aliases, plus `P.IsSome`/`P.IsNone`/`P.IsOk`/`P.IsErr`).
- Expand runnable examples for stable + experimental `Result`/`Option`/`Flow`/`match` APIs.
- Refresh source and README documentation to clarify stable async semantics and matcher behavior.
- Improve packaging/release metadata (`deno.jsonc` license include fix, changesets access alignment, npm package file list updates).
