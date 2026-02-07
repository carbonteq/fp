/**
 * match() API examples for experimental Option/Result.
 *
 * This file demonstrates:
 * - Matching ExperimentalOption / ExperimentalResult
 * - Guards and wildcard patterns
 * - Discriminated-union matching
 * - How to handle async workflows before matching
 */

import { match, P } from "../../dist/match.mjs"
import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs"
import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs"

console.log("=== Experimental match() examples ===\n")

// -----------------------------------------------------------------------------
// 1) Basic matching
// -----------------------------------------------------------------------------

const maybeUserId = Option.Some(7)
const userBucket = match(maybeUserId)
  .with("Some", (id) => (id > 5 ? "active" : "new"))
  .with("None", () => "guest")
  .exhaustive()
console.log("user bucket:", userBucket)

const networkResult = Result.Ok({ retries: 1 })
const networkText = match(networkResult)
  .with("Ok", (value) => `ok:retries=${value.retries}`)
  .with("Err", (error) => `err:${String(error)}`)
  .exhaustive()
console.log("network:", networkText)

// -----------------------------------------------------------------------------
// 2) Guarded patterns
// -----------------------------------------------------------------------------

const severity = match(Result.Err({ code: 503, message: "unavailable" }))
  .with(P.Ok(), () => "ok")
  .with(
    P.Err((e: { code: number }) => e.code >= 500),
    () => "server",
  )
  .with(
    P.Err((e: { code: number }) => e.code >= 400),
    () => "client",
  )
  .with(P.Err(), () => "unknown")
  .exhaustive()
console.log("severity:", severity)

// -----------------------------------------------------------------------------
// 3) Generic discriminated unions
// -----------------------------------------------------------------------------

type PaymentState =
  | { readonly _tag: "started"; id: string }
  | { readonly _tag: "authorized"; id: string; amount: number }
  | { readonly _tag: "declined"; id: string; reason: string }

const asPaymentState = (value: PaymentState): PaymentState => value

const payment = asPaymentState({
  _tag: "authorized",
  id: "pay-22",
  amount: 199,
})

const paymentText = match(payment)
  .with("started", (p) => `started:${p.id}`)
  .with("authorized", (p) => `authorized:${p.id}:${p.amount}`)
  .with("declined", (p) => `declined:${p.id}:${p.reason}`)
  .exhaustive()
console.log("payment:", paymentText)

// -----------------------------------------------------------------------------
// 4) Async workflows with experimental types
// -----------------------------------------------------------------------------

async function loadQuota(id: number): Promise<Result<number, string>> {
  return id > 0 ? Result.Ok(100 + id) : Result.Err("invalid-id")
}

async function runAsyncExamples(): Promise<void> {
  // Preferred with experimental APIs:
  // run async operations first (mapAsync/flatMapAsync/own async function),
  // then match the settled ExperimentalResult/ExperimentalOption value.

  const settledResult = await loadQuota(3)
  const quotaText = match(settledResult)
    .with("Ok", (quota) => `quota:${quota}`)
    .with("Err", (error) => `quota-error:${error}`)
    .exhaustive()
  console.log("quota:", quotaText)

  const settledOption = await Option.Some("admin").mapAsync(async (role) =>
    role.toUpperCase(),
  )

  const roleText = match(settledOption)
    .with("Some", (role) => `role:${role}`)
    .with("None", () => "role:none")
    .exhaustive()
  console.log("role:", roleText)

  // You can still construct Result<Promise<T>, E> manually, but match() does not
  // accept async-inner values directly. Settle first, then wrap/match.
  const manualAsyncInner = Result.Ok(Promise.resolve(9))
  const settledValue = await manualAsyncInner.unwrap()
  const settledManual = Result.Ok(settledValue)

  const manualText = match(settledManual)
    .with("Ok", (value) => `manual:${value}`)
    .with("Err", () => "manual:err")
    .exhaustive()
  console.log("manual async-inner settled:", manualText)
}

await runAsyncExamples()

console.log("\n=== experimental match() examples complete ===")
