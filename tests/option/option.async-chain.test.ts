import { describe, expect, it, mock } from "bun:test"
import { Option } from "@/option.js"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("Option async chain short-circuiting", () => {
  it("should not call map after async flatMap resolves to None", async () => {
    const sideEffect = mock((n: number) => n + 1)
    const opt = Option.Some(1)
      .flatMap(async () => {
        await delay(10)
        return Option.None
      })
      .map(sideEffect)

    const resolved = await opt.toPromise()

    expect(sideEffect).not.toHaveBeenCalled()
    expect(opt.isNone()).toBeTrue()
    expect(resolved.isNone()).toBeTrue()
  })

  it("should not call zip after async flatMap resolves to None", async () => {
    const sideEffect = mock((n: number) => n + 1)
    const opt = Option.Some(1)
      .flatMap(async () => {
        await delay(10)
        return Option.None
      })
      .zip(sideEffect)

    const resolved = await opt.toPromise()

    expect(sideEffect).not.toHaveBeenCalled()
    expect(opt.isNone()).toBeTrue()
    expect(resolved.isNone()).toBeTrue()
  })

  it("should not call flatZip after async flatMap resolves to None", async () => {
    const sideEffect = mock((n: number) => Option.Some(n + 1))
    const opt = Option.Some(1)
      .flatMap(async () => {
        await delay(500)
        return Option.None
      })
      .flatZip(sideEffect)

    const resolved = await opt.toPromise()

    expect(sideEffect).not.toHaveBeenCalled()
    expect(opt.isNone()).toBeTrue()
    expect(resolved.isNone()).toBeTrue()
  })
})
