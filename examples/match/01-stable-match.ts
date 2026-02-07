/**
 * match() API examples for stable Option/Result.
 *
 * This file demonstrates:
 * - String-tag matching
 * - Pattern helpers (P.Some/P.Ok/etc)
 * - Guards and fallthrough
 * - Generic discriminated unions
 * - How to handle Option<Promise<T>> / Result<Promise<T>, E>
 */

import { match, P } from "../../dist/match.mjs"
import { Option } from "../../dist/option.mjs"
import { Result } from "../../dist/result.mjs"

console.log("=== Stable match() examples ===\n")

// -----------------------------------------------------------------------------
// 1) Basic Option/Result matching
// -----------------------------------------------------------------------------

const maybeScore = Option.Some(82)
const grade = match(maybeScore)
  .with("Some", (value) => (value >= 90 ? "A" : "B"))
  .with("None", () => "N/A")
  .exhaustive()
console.log("grade:", grade)

const apiResult = Result.Err("rate-limited") as Result<number, string>
const label = match(apiResult)
  .with("Ok", (value) => `value=${value}`)
  .with("Err", (error) => `error=${error}`)
  .exhaustive()
console.log("result label:", label)

// -----------------------------------------------------------------------------
// 2) P helpers + guards
// -----------------------------------------------------------------------------

const guarded = match(Option.Some(74))
  .with(
    P.Some((x: number) => x >= 90),
    () => "A",
  )
  .with(
    P.Some((x: number) => x >= 80),
    () => "B",
  )
  .with(
    P.Some((x: number) => x >= 70),
    () => "C",
  )
  .with(P.Some(), () => "D")
  .with(P.None(), () => "N/A")
  .exhaustive()
console.log("guarded grade:", guarded)

const retryPolicy = match(Result.Err("fatal") as Result<number, string>)
  .with(P.Ok(), () => "none")
  .with(P.Err(P.oneOf("timeout", "offline")), () => "retry")
  .with(P.Err(P.not(P.oneOf("timeout", "offline"))), () => "do-not-retry")
  .exhaustive()
console.log("retry policy:", retryPolicy)

const stateByPredicates = match(Result.Ok(1) as Result<number, string>)
  .when(P.IsErr, () => "err")
  .when(P.IsOk, () => "ok")
  .otherwise(() => "other")
console.log("state by predicates:", stateByPredicates)

const combinedPredicates = match(Result.Ok(42) as Result<number, string>)
  .with(P.Ok(P.all(P.not(P.eq(0)), P.any(P.eq(42), P.eq(43)))), () => "hit")
  .with(P.Ok(), () => "miss")
  .with(P.Err(), () => "err")
  .exhaustive()
console.log("combined predicates:", combinedPredicates)

const exactValueHandler = match(Result.Ok(42) as Result<number, string>)
  .with(P.Ok(P.eq(42)), (value) => `exact:${value}`)
  .with(P.Ok(), (value) => `other-ok:${value}`)
  .with(P.Err(), (error) => `err:${error}`)
  .exhaustive()
console.log("exact value handler:", exactValueHandler)

// -----------------------------------------------------------------------------
// 3) when() + otherwise() + wildcard
// -----------------------------------------------------------------------------

const status = match(Result.Ok({ attempts: 4, user: "alice" }))
  .when(
    (r) => r.isOk() && r.unwrap().attempts > 3,
    () => "needs-review",
  )
  .with(P._, () => "ok")
  .exhaustive()
console.log("status:", status)

const fallbackStatus = match(Result.Err("boom") as Result<number, string>)
  .with(P.Ok(P.not(P.eq(42))), () => "ok-not-42")
  .with(P.Ok(P.eq(42)), () => "ok-42")
  .otherwise(() => "fallback")
console.log("fallback status:", fallbackStatus)

// -----------------------------------------------------------------------------
// 4) Generic discriminated union support
// -----------------------------------------------------------------------------

type JobEvent =
  | { readonly _tag: "queued"; id: string }
  | { readonly _tag: "running"; id: string; progress: number }
  | { readonly _tag: "failed"; id: string; reason: string }

const asJobEvent = (value: JobEvent): JobEvent => value
const event = asJobEvent({ _tag: "running", id: "job-1", progress: 55 })
const eventText = match(event)
  .with("queued", (e) => `queued:${e.id}`)
  .with("running", (e) => `running:${e.id}:${e.progress}%`)
  .with("failed", (e) => `failed:${e.id}:${e.reason}`)
  .exhaustive()
console.log("event:", eventText)

// -----------------------------------------------------------------------------
// 5) Async-inner stable values: settle first, then match
// -----------------------------------------------------------------------------

async function runAsyncInnerExamples(): Promise<void> {
  // IMPORTANT:
  // match() intentionally rejects Result<Promise<T>, E> and Option<Promise<T>>.
  // For stable variants, convert them first with toPromise():
  //   Result<Promise<T>, E>  -> Promise<Result<T, E>>
  //   Option<Promise<T>>     -> Promise<Option<T>>

  const asyncStableResult = Result.Ok(Promise.resolve(21))
  const settledResult = await asyncStableResult.toPromise()

  const settledResultText = match(settledResult)
    .with("Ok", (value) => `settled-ok:${value * 2}`)
    .with("Err", (error) => `settled-err:${String(error)}`)
    .exhaustive()
  console.log("settled result:", settledResultText)

  const asyncStableOption = Option.Some(Promise.resolve("token-123"))
  const settledOption = await asyncStableOption.toPromise()

  const settledOptionText = match(settledOption)
    .with("Some", (value) => `settled-some:${value}`)
    .with("None", () => "settled-none")
    .exhaustive()
  console.log("settled option:", settledOptionText)
}

await runAsyncInnerExamples()

console.log("\n=== stable match() examples complete ===")
