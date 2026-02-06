/**
 * Flow - Unified Generator for Option and Result
 *
 * Flow allows you to yield both Option and Result types in the same generator.
 * It automatically handles short-circuiting:
 * - If Option.None is yielded -> returns Result.Err(UnwrappedNone)
 * - If Result.Err(e) is yielded -> returns Result.Err(e)
 *
 * Uses ExperimentalOption and ExperimentalResult.
 */

import { Flow, Option, Result } from "../../dist/index.mjs"

// ============================================================================
// Flow.gen - Direct usage (simpler, good for simple chains)
// ============================================================================

const basicGen = Flow.gen(function* () {
  console.log("Start Flow.gen")

  // 1. Yield Option -> Unwraps value or error
  const a = yield* Option.Some(10)

  // 2. Yield Result -> Unwraps value or error
  const b = yield* Result.Ok(20)

  // 3. Helper to convert nullable to Option -> Then yield
  const c = yield* Option.fromNullable(30)

  return a + b + c
})

console.log("Basic Gen:", basicGen.safeUnwrap()) // 60

// Error Handling: Option.None
const noneError = Flow.gen(function* () {
  const a = yield* Option.Some(1)
  yield* Option.None // Stops here

  return a + 10
})

console.log("None Error:", noneError.isErr()) // true
console.log("Error Type:", noneError.unwrapErr()) // UnwrappedNone

// Error Handling: Result.Err
const resultError = Flow.gen(function* () {
  const a = yield* Result.Ok(1)
  yield* Result.Err("Something went wrong") // Stops here
  return a + 10
})

console.log("Result Error:", resultError.unwrapErr()) // "Something went wrong"

// ============================================================================
// Flow.genAdapter - Adapter usage (better type inference)
// ============================================================================

// The `$` adapter function helps TypeScript infer types correctly,
// especially in more complex expressions or chains.

const adapterGen = Flow.genAdapter(function* ($) {
  const val1 = yield* $(Option.Some(100))
  const val2 = yield* $(Result.Ok(200))

  // You can wrap complex expressions
  const val3 = yield* $(
    Option.fromPredicate(val1 + val2, (v) => v > 100).map((v) => v / 10),
  )

  return val3
})

console.log("Adapter Gen:", adapterGen.unwrap()) // 30
