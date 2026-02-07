import { describe, expect, it, mock } from "bun:test"
import { ExperimentalResult as Result } from "@/result-experimental.js"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("ExperimentalResult async chain short-circuiting", () => {
  it("should not call map after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => n + 1)
    const result = await Result.Ok(1)
      .flatMapAsync(async () => {
        await delay(10)
        return Result.Err<string, number>("boom")
      })
      .then((r) => r.map(sideEffect))

    expect(sideEffect).not.toHaveBeenCalled()
    expect(result.isErr()).toBeTrue()
  })

  it("should not call zip after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => n + 1)
    const result = await Result.Ok(1)
      .flatMapAsync(async () => {
        await delay(10)
        return Result.Err<string, number>("boom")
      })
      .then((r) => r.zip(sideEffect))

    expect(sideEffect).not.toHaveBeenCalled()
    expect(result.isErr()).toBeTrue()
  })

  it("should not call flatZip after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => Result.Ok(n + 1))
    const result = await Result.Ok(1)
      .flatMapAsync(async () => {
        await delay(10)
        return Result.Err<string, number>("boom")
      })
      .then((r) => r.flatZip(sideEffect))

    expect(sideEffect).not.toHaveBeenCalled()
    expect(result.isErr()).toBeTrue()
  })
})
