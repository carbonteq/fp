/**
 * Async Flow - Unified Async Generator
 *
 * Handles Promise<Option>, Promise<Result>, and async operations.
 * Uses ExperimentalOption and ExperimentalResult.
 */

import {
  ExperimentalFlow as Flow,
  ExperimentalOption as Option,
  ExperimentalResult as Result,
} from "../../dist/index.mjs"

type User = { id: number; name: string }

// Mock async functions
const fetchUser = async (id: number): Promise<Result<User, string>> => {
  await new Promise((r) => setTimeout(r, 10))
  return id === 1
    ? Result.Ok({ id, name: "Alice" })
    : Result.Err("User not found")
}

const fetchSettings = async (_userId: number) => {
  await new Promise((r) => setTimeout(r, 10))
  return Option.Some({ theme: "dark" })
}

// ============================================================================
// Flow.asyncGen - Direct usage (requires explicit awaits)
// ============================================================================

const asyncDirect = await Flow.asyncGen(async function* () {
  // 1. Await async Result function, then yield*
  const user = yield* await fetchUser(1)

  // 2. Await async Option function, then yield*
  const settings = yield* await fetchSettings(user.id)

  // 3. Sync yield works too
  const bonus = yield* Option.Some(50)

  return `${user.name} prefers ${settings.theme} theme (Bonus: ${bonus})`
})

console.log("Async Direct:", asyncDirect.unwrap())

// ============================================================================
// Flow.asyncGenAdapter - Adapter usage (cleaner syntax)
// ============================================================================

const asyncAdapter = await Flow.asyncGenAdapter(async function* ($) {
  // 1. Wrap promise - adapter handles await automatically!
  const user = yield* $(fetchUser(1))

  // 2. Wrap another promise
  const settings = yield* $(fetchSettings(user.id))

  // 3. Wrap sync values
  const multiplier = yield* $(Result.Ok<number, Error>(2))

  return {
    user,
    settings,
    score: 100 * multiplier,
  }
})

console.log("Async Adapter:", asyncAdapter.safeUnwrap())

// Error propagation in Async
const asyncError = await Flow.asyncGenAdapter(async function* ($) {
  const user = yield* $(fetchUser(999)) // Returns Err
  return user // Not reached
})

console.log("Async Error:", asyncError.unwrapErr()) // "User not found"
