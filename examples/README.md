# Examples

This directory contains runnable examples split between stable and experimental APIs.

`examples/flow/` is stable, while `examples/flow-experimental/` is experimental.

## Stable APIs (Result / Option / Flow)

Runnable stable examples live here:

- `examples/result/` uses `Result`.
- `examples/option/` uses `Option`.
- `examples/flow/` uses stable `Flow` with stable `Result` and `Option`.

## Experimental APIs (ExperimentalResult / ExperimentalOption / Flow)

These examples use experimental types and may change between releases.

- `examples/result-experimental/` uses `ExperimentalResult`.
- `examples/option-experimental/` uses `ExperimentalOption`.
- `examples/flow-experimental/` uses `ExperimentalFlow` with `ExperimentalResult` and `ExperimentalOption`.

Run individual examples with Bun, for example:

```sh
bun run examples/result-experimental/01-map.ts
bun run examples/option-experimental/01-map.ts
bun run examples/flow-experimental/01-basics.ts
bun run examples/flow/01-basics.ts
bun run examples/result/01-basics.ts
bun run examples/option/01-basics.ts
```

For a full list of Result/Option examples, see:

- `examples/result/index.ts`
- `examples/option/index.ts`

- `examples/result-experimental/index.ts`
- `examples/option-experimental/index.ts`
