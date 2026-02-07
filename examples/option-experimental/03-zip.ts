/**
 * Option.zip() - Pair original value with derived value
 *
 * zip() takes a function that receives the current value and returns a new value.
 * It returns an Option containing a tuple [original, derived].
 * Useful when you need both the original and transformed values.
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs"

console.log("=== Option.zip() Examples ===\n")

// Example 1: Basic zip - pair value with its double
const zipped = Option.Some(5).zip((x) => x * 2)
console.log("1. Zip 5 with double:", zipped.unwrap()) // [5, 10]

// Example 2: Zip on None - None propagates
const zippedNone = Option.None.zip((x: number) => x * 2)
console.log("2. Zip on None:", zippedNone._tag) // "None"

// Example 3: Zip with async function
const asyncZipped = await Option.Some(5).zipAsync(async (x) => {
  await new Promise((resolve) => setTimeout(resolve, 10))
  return x * 2
})
console.log("3. Async zip:", asyncZipped._tag) // "Some"

const value = asyncZipped.unwrap()
console.log("   Resolved:", value) // [5, 10]

// Example 4: Zip for validation with context
const parseAndValidate = (str: string) => {
  return Option.fromNullable(Number(str))
    .filter((n) => !Number.isNaN(n))
    .flatZip((num) => (num > 0 ? Option.Some(num) : Option.None))
    .map(([num, _validated]) => ({
      original: str,
      parsed: num,
      isValidated: true,
    }))
}

console.log("4. Parse with context:", parseAndValidate("42").unwrap()) // { original: "42", parsed: 42, isValidated: true }
console.log("    Negative number:", parseAndValidate("-5")._tag) // "None"

// Example 5: Multiple zips - accumulate related values
const userStats = Option.Some(100) // starting score
  .zip((score) => score * 2) // double
  .zip(([original, doubled]) => original + doubled) // sum

console.log("5. Multiple zips:", userStats.unwrap()) // [[100, 200], 300]

// Example 6: Zip for keeping audit trail
type Input = { value: number }
type Output = { result: number }
type WithAudit<T> = { input: Input; output: T }

const processWithAudit = (input: Input): Option<WithAudit<Output>> => {
  return Option.Some(input)
    .zip((input) => ({ result: input.value * 2 }))
    .map(([input, output]) => ({ input, output }))
}

console.log("6. Process with audit:", processWithAudit({ value: 5 }).unwrap()) // { input: { value: 5 }, output: { result: 10 } }

// Example 7: Zip for before/after comparison
const beforeAndAfter = Option.Some([1, 2, 3, 4, 5])
  .zip((arr) => arr.filter((x) => x % 2 === 0))
  .map(([original, filtered]) => ({
    original,
    filtered,
    count: { original: original.length, filtered: filtered.length },
  }))

console.log("7. Before/after:", beforeAndAfter.unwrap()) // { original: [1,2,3,4,5], filtered: [2,4], count: { original: 5, filtered: 2 } }

// Example 8: Zip for transformation history
type HistoryStep<T> = { step: number; value: T }

const withHistory: Option<HistoryStep<number>[]> = Option.Some(5)
  .zip((value) => value * 2)
  .zip(([_original, doubled]) => doubled + 10)
  .map(([[original, doubled], final]) => [
    { step: 1, value: original },
    { step: 2, value: doubled },
    { step: 3, value: final },
  ])

console.log("8. Transformation history:", withHistory.unwrap()) // [{ step: 1, value: 5 }, { step: 2, value: 10 }, { step: 3, value: 20 }]

// Example 9: Practical - Form field validation with original value
type Field = { name: string; value: string }
type ValidatedField = { name: string; value: string; isValid: boolean }

const validateField = (field: Field): Option<ValidatedField> => {
  return Option.Some(field)
    .flatZip((field) =>
      field.value.length > 0 ? Option.Some(field) : Option.None,
    )
    .map(([original, _]) => ({ ...original, isValid: true }))
}

console.log(
  "9. Valid field:",
  validateField({ name: "email", value: "test@example.com" }).unwrap(),
) // { name: "email", value: "test@example.com", isValid: true }
console.log(
  "    Invalid field:",
  validateField({ name: "email", value: "" })._tag,
) // "None"

// Example 10: Zip for accumulating calculations
const calculationSteps = Option.Some(10)
  .zip((n) => n + 5) // add
  .zip(([_start, sum]) => sum * 2) // multiply
  .zip(([[start, _sum], product]) => product - start) // subtract

console.log("10. Calculation steps:", calculationSteps.unwrap()) // [[[10, 15], 30], 20]

// Example 11: Async zip for API call patterns
const fetchUser = async (id: number) => {
  await new Promise((resolve) => setTimeout(resolve, 10))
  return { id, name: `User ${id}` }
}

const userWithTimestamp = await Option.Some(1)
  .zipAsync((id) => fetchUser(id))
  .then((o) => o.map(([id, user]) => ({ id, user, fetchedAt: Date.now() })))

const result2 = userWithTimestamp.unwrap()
console.log("11. Async fetch with timestamp:", result2) // { id: 1, user: { id: 1, name: "User 1" }, fetchedAt: ... }

// Example 12: Zip for pairing input with output
type ProcessResult<T, U> = { input: T; output: U }

const processWithPairing = <T, U>(
  input: T,
  processor: (value: T) => U,
): Option<ProcessResult<T, U>> => {
  return Option.Some(input)
    .zip(processor)
    .map(([input, output]) => ({ input, output }))
}

const result = processWithPairing(5, (x) => x * 2)
console.log("12. Paired processing:", result.unwrap()) // { input: 5, output: 10 }

// Example 13: Zip for value with its metadata
type Metadata<T> = {
  value: T
  length: number
  type: string
}

const withMetadata = (value: string): Option<Metadata<string>> => {
  return Option.Some(value)
    .zip((v) => ({
      length: v.length,
      type: typeof v,
    }))
    .map(([value, meta]) => ({ value, ...meta }))
}

console.log("13. With metadata:", withMetadata("hello").unwrap()) // { value: "hello", length: 5, type: "string" }

// Example 14: Zip for conditional transformation
const conditionalZip = Option.Some(5)
  .zip((x) => (x > 0 ? x * 2 : x))
  .map(([original, transformed]) => ({
    original,
    transformed,
    changed: original !== transformed,
  }))

console.log("14. Conditional zip:", conditionalZip.unwrap()) // { original: 5, transformed: 10, changed: true }

// Example 15: Zip for safe division with context
const safeDivideWithContext = (
  a: number,
  b: number,
): Option<{ dividend: number; divisor: number; quotient: number }> => {
  const opt = Option.Some({ dividend: a, divisor: b })
    .flatZip(({ divisor }) =>
      divisor !== 0 ? Option.Some(a / divisor) : Option.None,
    )
    .map(([context, quotient]) => ({ ...context, quotient }))

  return opt
}

console.log("15. Divide with context:", safeDivideWithContext(10, 2).unwrap()) // { dividend: 10, divisor: 2, quotient: 5 }
console.log("    Divide by zero:", safeDivideWithContext(10, 0)._tag) // "None"

console.log("\n=== All zip examples completed ===")

// Wait for async examples to complete
await new Promise((resolve) => setTimeout(resolve, 50))
