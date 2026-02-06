/**
 * Flow - Error Recovery Patterns
 *
 * Examples of how to handle errors and perform recovery (orElse) within Flow generators.
 * Uses ExperimentalResult.
 */

import {
  ExperimentalFlow as Flow,
  ExperimentalResult as Result,
} from "../../dist/index.mjs"

// Mock operations
const mayFail = (id: number): Result<number, string> =>
  id > 0 ? Result.Ok(id) : Result.Err("Invalid ID")

const recover = (_err: string): Result<number, string> => Result.Ok(0) // Default to 0

const complexRecovery = async (
  _err: string,
): Promise<Result<number, string>> => {
  await new Promise((r) => setTimeout(r, 10))
  return Result.Ok(100)
}

// ============================================================================
// Pattern 1: Simple recovery using .orElse()
// Best when the recovery logic is simple and synchronous/atomic.
// ============================================================================

const simpleRecovery = Flow.gen(function* () {
  // Try to clean 5, if fail, recover is not called
  const a = yield* mayFail(5).orElse(recover)

  // Try to clean -1, fails -> recovers (returns Ok(0))
  // The 'yield*' sees the *recovered* Ok value.
  const b = yield* mayFail(-1).orElse(recover)

  return a + b // 5 + 0 = 5
})

console.log("Simple Recovery:", simpleRecovery.unwrap())

// ============================================================================
// Pattern 2: Manual branching for complex flows
// Necessary when recovery involves multiple yield steps or generators.
// ============================================================================

const manualRecovery = Flow.gen(function* () {
  // const result = mayFail(-1); // Don't yield yet!
  //
  // let val: number;
  // if (result.isOk()) {
  //   val = result.unwrap();
  // } else {
  //   // Perform complex recovery logic here
  //   const fallback = yield* Option.Some(99);
  //   val = fallback + 1; // 100
  // }

  const val = yield* mayFail(-1).orElse(() => {
    console.log("Failed, recovering...")

    return Result.Ok(100)
  })

  return val
})

console.log("Manual Recovery:", manualRecovery.unwrap())

// ============================================================================
// Pattern 3: Async recovery using .orElseAsync() (if available on Result)
// or manual branching for async logic.
// ============================================================================

const asyncRecovery = await Flow.asyncGen(async function* () {
  // const res = mayFail(-5);
  //
  // let val: number;
  // if (res.isOk()) {
  //   val = res.unwrap();
  // } else {
  //   // You can yield async recovery operations here
  //   val = yield* await complexRecovery(res.unwrapErr());
  // }

  const val = yield* await mayFail(-5).orElseAsync(complexRecovery)

  return val
})

console.log("Async Recovery:", asyncRecovery.unwrap()) // 100
