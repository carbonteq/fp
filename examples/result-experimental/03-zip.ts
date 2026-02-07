/**
 * Result.zip() - Pair original value with derived value
 *
 * zip() takes a function that receives the current value and returns a new value.
 * It returns a Result containing a tuple [original, derived].
 * Useful when you need both the original and transformed values.
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs"

// ============================================================================
// BASIC ZIP EXAMPLES
// ============================================================================

console.log("=== Result.zip() Examples ===\n")

// Example 1: Basic zip - pair value with its double
const zipped = Result.Ok(5).zip((x) => x * 2)
console.log("1. Zip 5 with double:", zipped.unwrap()) // [5, 10]

// Example 2: Zip on Err - error propagates
const zippedErr = Result.Err<string, number>("error").zip((x) => x * 2)
console.log("2. Zip on Err:", zippedErr.unwrapErr()) // "error"

// Example 3: Zip is synchronous - for async operations, use gen.async* methods
// See 07-asyncGen.ts and 08-asyncGenAdapter.ts for async patterns

// Example 4: Zip for validation with context
const parseAndValidate = (str: string) => {
  return Result.tryCatch(
    () => parseInt(str, 10),
    () => ({ error: "parse_failed" }),
  )
    .zip((num) => (num > 0 ? num : Result.Err("not_positive")))
    .map(([original, _validated]) => ({
      original: str,
      parsed: original,
      isValidated: true,
    }))
}

console.log("4. Parse with context:", parseAndValidate("42").unwrap()) // { original: "42", parsed: 42, isValidated: true }

// Example 5: Multiple zips - accumulate related values
const userStats = Result.Ok(100) // starting score
  .zip((score) => score * 2) // double
  .zip(([original, doubled]) => original + doubled) // sum

console.log("5. Multiple zips:", userStats.unwrap()) // [[100, 200], 300]

// Example 6: Zip for keeping audit trail
type Input = { value: number }
type Output = { result: number }
type WithAudit<T> = { input: Input; output: T }

const processWithAudit = (input: Input): Result<WithAudit<Output>, never> => {
  return Result.Ok(input)
    .zip((input) => ({ result: input.value * 2 }))
    .map(([input, output]) => ({ input, output }))
}

console.log("6. Process with audit:", processWithAudit({ value: 5 }).unwrap()) // { input: { value: 5 }, output: { result: 10 } }

// Example 7: Zip for before/after comparison
const beforeAndAfter = Result.Ok([1, 2, 3, 4, 5])
  .zip((arr) => arr.filter((x) => x % 2 === 0))
  .map(([original, filtered]) => ({
    original,
    filtered,
    count: { original: original.length, filtered: filtered.length },
  }))

console.log("7. Before/after:", beforeAndAfter.unwrap()) // { original: [1,2,3,4,5], filtered: [2,4], count: { original: 5, filtered: 2 } }

// Example 8: Zip for error context (preserve original on error)
// Note: zip doesn't do this directly, but shows the pattern
type ValidationError = { value: number; reason: string }

const safeDivide = (a: number, b: number): Result<number, ValidationError> => {
  return b !== 0
    ? Result.Ok(a / b)
    : Result.Err({ value: b, reason: "Division by zero" })
}

const divideWithContext = (
  a: number,
  b: number,
): Result<
  { dividend: number; divisor: number; quotient: number },
  ValidationError
> => {
  return Result.Ok({ dividend: a, divisor: b })
    .flatZip(({ divisor }) => safeDivide(a, divisor))
    .map(([context, quotient]) => ({ ...context, quotient }))
}

console.log("8. Divide with context:", divideWithContext(10, 2).unwrap()) // { dividend: 10, divisor: 2, quotient: 5 }
console.log("   Divide by zero:", divideWithContext(10, 0).unwrapErr()) // { value: 0, reason: "Division by zero" }

// Example 9: Zip for transformation history
type HistoryStep<T> = { step: number; value: T }

const withHistory = Result.Ok(5)
  .zip((value) => value * 2)
  .zip(([_original, doubled]) => doubled + 10)
  .map(([[original, doubled], final]): HistoryStep<number>[] => [
    { step: 1, value: original },
    { step: 2, value: doubled },
    { step: 3, value: final },
  ])

console.log("9. Transformation history:", withHistory.unwrap()) // [{ step: 1, value: 5 }, { step: 2, value: 10 }, { step: 3, value: 20 }]

// Example 10: Practical - Form field validation with original value
type Field = { name: string; value: string }
type ValidatedField = { name: string; value: string; isValid: boolean }

const validateField = (field: Field): Result<ValidatedField, string> => {
  return Result.Ok(field)
    .flatZip((field) =>
      field.value.length > 0
        ? Result.Ok(field)
        : Result.Err(`${field.name} is empty`),
    )
    .map(([original, _]) => ({ ...original, isValid: true }))
}

console.log(
  "10. Valid field:",
  validateField({ name: "email", value: "test@example.com" }).unwrap(),
) // { name: "email", value: "test@example.com", isValid: true }
console.log(
  "    Invalid field:",
  validateField({ name: "email", value: "" }).unwrapErr(),
) // "email is empty"

// Example 11: Zip for accumulating calculations
const calculationSteps = Result.Ok(10)
  .zip((n) => n + 5) // add
  .zip(([_start, sum]) => sum * 2) // multiply
  .zip(([[start, _sum], product]) => product - start) // subtract

console.log("11. Calculation steps:", calculationSteps.unwrap()) // [[[10, 15], 30], 20]

console.log("\n=== All zip examples completed ===")
