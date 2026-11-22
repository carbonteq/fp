import { describe, expect, it, mock } from "bun:test"
import { Result } from "@/result.js"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("Result async chain short-circuiting", () => {
  it("should not call map after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => n + 1)
    const result = Result.Ok(1)
      .flatMap(async () => {
        await delay(10)
        return Result.Err<string, number>("boom")
      })
      .map(sideEffect)

    const resolved = await result.toPromise()

    expect(sideEffect).not.toHaveBeenCalled()
    expect(result.isErr()).toBeTrue()
    expect(resolved.isErr()).toBeTrue()
  })

  it("should not call zip after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => n + 1)
    const result = Result.Ok(1)
      .flatMap(async () => {
        await delay(10)
        return Result.Err<string, number>("boom")
      })
      .zip(sideEffect)

    const resolved = await result.toPromise()

    expect(sideEffect).not.toHaveBeenCalled()
    expect(result.isErr()).toBeTrue()
    expect(resolved.isErr()).toBeTrue()
  })

  it("should not call flatZip after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => Result.Ok(n + 1))
    const result = Result.Ok(1)
      .flatMap(async () => {
        await delay(10)
        return Result.Err<string, number>("boom")
      })
      .flatZip(sideEffect)

    const resolved = await result.toPromise()

    expect(sideEffect).not.toHaveBeenCalled()
    expect(result.isErr()).toBeTrue()
    expect(resolved.isErr()).toBeTrue()
  })
})

describe("Result.fromPromise nested async Results", () => {
  it("normalizes a still-pending nested failure", async () => {
    const { promise: pending, resolve } =
      Promise.withResolvers<Result<number, object>>()
    const error = { reason: "pending failure" }
    const inner = Result.Ok(1).flatMap(() => pending)
    const wrapped = Result.fromPromise(Promise.resolve(inner))
    const settled = wrapped.toPromise()

    expect(wrapped.isOk()).toBeTrue()
    resolve(Result.Err(error))

    expect((await settled).unwrapErr()).toBe(error)
    expect(wrapped.isErr()).toBeTrue()
    expect(await wrapped.unwrapErr()).toBe(error)
  })

  it("normalizes an already-settled nested failure", async () => {
    const error = { reason: "settled failure" }
    const inner = Result.Ok(1).flatMap(async () =>
      Result.Err<object, number>(error),
    )
    await inner.toPromise()
    const wrapped = Result.fromPromise(Promise.resolve(inner))

    expect((await wrapped.toPromise()).unwrapErr()).toBe(error)
    expect(await wrapped.unwrapErr()).toBe(error)
  })

  it("preserves nested success", async () => {
    const inner = Result.Ok(Promise.resolve(2)).flatMap(async (n) =>
      Result.Ok(n + 1),
    )
    const wrapped = Result.fromPromise(Promise.resolve(inner))

    expect((await wrapped.toPromise()).unwrap()).toBe(3)
    expect(await wrapped.unwrap()).toBe(3)
  })

  it("preserves a nested multi-flatMap failure and skips later mappers", async () => {
    const error = { reason: "chain failure" }
    const skipped = mock((n: number) => Result.Ok(n + 1))
    const inner = Result.Ok(Promise.resolve(1))
      .flatMap(async (n) => Result.Ok(n + 1))
      .flatMap(async () => Result.Err<object, number>(error))
      .flatMap(skipped)
    const wrapped = Result.fromPromise(Promise.resolve(inner))

    expect((await wrapped.toPromise()).unwrapErr()).toBe(error)
    expect(skipped).not.toHaveBeenCalled()
    expect(await wrapped.unwrapErr()).toBe(error)
  })

  for (const source of ["input", "inner"] as const) {
    it(`preserves raw ${source} rejection identity`, async () => {
      const reason = { reason: `${source} rejection` }
      const { promise: pending, reject } =
        Promise.withResolvers<Result<number, never>>()
      const wrapped =
        source === "input"
          ? Result.fromPromise(pending)
          : Result.fromPromise(
              Promise.resolve(Result.Ok(1).flatMap(() => pending)),
            )
      const observed = wrapped.toPromise().then(
        () => ({ rejected: false, reason: undefined }),
        (reason: unknown) => ({ rejected: true, reason }),
      )
      reject(reason)

      expect(await observed).toEqual({ rejected: true, reason })
      expect((await observed).reason).toBe(reason)
    })
  }

  it("preserves an actual undefined nested error", async () => {
    const inner = Result.Ok(1).flatMap(async () =>
      Result.Err<undefined, number>(undefined),
    )
    const wrapped = Result.fromPromise(Promise.resolve(inner))
    const settled = await wrapped.toPromise()

    expect(settled.isErr()).toBeTrue()
    expect(settled.unwrapErr()).toBeUndefined()
    expect(wrapped.isErr()).toBeTrue()
    expect(await wrapped.unwrapErr()).toBeUndefined()
  })
})
