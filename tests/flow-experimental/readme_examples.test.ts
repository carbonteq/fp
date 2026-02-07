import { describe, expect, test } from "bun:test"
import { ExperimentalFlow as XFlow } from "@/flow-experimental.js"
import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "@/option-experimental.js"
import { ExperimentalResult as Result } from "@/result-experimental.js"

describe("XFlow README Examples", () => {
  test("Basic Mixed Usage", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(5) // Unwraps Option
      const b = yield* Result.Ok(10) // Unwraps Result
      const c = yield* Option.fromNullable(20)

      return a + b + c // 35
    })

    expect(result.unwrap()).toBe(35)
  })

  test("Error Handling - Option.None", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(5)
      yield* Option.None // Short-circuits here
      return a + 10
    })

    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone)
  })

  test("Error Handling - Result.Err", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Result.Ok(5)
      yield* Result.Err("error message") // Short-circuits here
      return a + 10
    })

    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr()).toBe("error message")
  })

  test("Adapter Usage", () => {
    const result = XFlow.genAdapter(function* ($) {
      const val1 = yield* $(Option.Some(10))
      const val2 = yield* $(Result.Ok(20))
      return val1 + val2
    })

    expect(result.unwrap()).toBe(30)
  })

  test("Async Usage", async () => {
    const asyncOp = async (val: number) => {
      await Promise.resolve()
      return Result.Ok(val * 2)
    }

    const result = await XFlow.asyncGen(async function* () {
      const val = yield* Option.Some(10)
      const asyncVal = yield* await asyncOp(val) // await Promise<Result>
      return asyncVal
    })

    expect(result.unwrap()).toBe(20)
  })
})
