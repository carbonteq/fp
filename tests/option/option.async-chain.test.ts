import { describe, expect, it, mock } from "bun:test"
import { Option } from "@/option.js"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("Option async chain short-circuiting", () => {
  it("rejects when a promise-input mapper throws", async () => {
    const error = new Error("mapper failed")
    const opt = Option.Some(Promise.resolve(1)).flatMap(() => {
      throw error
    })

    await expect(opt.toPromise()).rejects.toBe(error)
  }, 1000)

  it("preserves input and async mapper rejection identity", async () => {
    const error = new Error("rejected")
    const mapper = mock(() => Option.Some(2))
    const rejectedInput = Option.Some(Promise.reject<number>(error)).flatMap(mapper)
    await expect(rejectedInput.toPromise()).rejects.toBe(error)
    expect(mapper).not.toHaveBeenCalled()

    const rejectedMapper = Option.Some(Promise.resolve(1)).flatMap(async () => {
      throw error
    })
    await expect(rejectedMapper.toPromise()).rejects.toBe(error)
  })

  it("propagates pending mapped absence without affecting sibling branches", async () => {
    const { promise, resolve } = Promise.withResolvers<Option<number>>()
    const entered = Promise.withResolvers<void>()
    const pending = Option.fromPromise(promise)
    const parent = Option.Some(Promise.resolve(1))
    const sideEffect = mock((n: number) => n + 1)
    const absent = parent.flatMap(() => {
      entered.resolve()
      return pending
    }).map(sideEffect)
    const present = parent.flatMap((n) => Option.Some(n + 1))
    const asyncPresent = parent.flatMap(async (n) => Option.Some(n + 2))
    await entered.promise
    resolve(Option.None)

    expect((await absent.toPromise()).isNone()).toBeTrue()
    expect(absent.isNone()).toBeTrue()
    expect(sideEffect).not.toHaveBeenCalled()
    expect((await present.toPromise()).unwrap()).toBe(2)
    expect((await asyncPresent.toPromise()).unwrap()).toBe(3)
    expect((await parent.toPromise()).unwrap()).toBe(1)
  })

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
