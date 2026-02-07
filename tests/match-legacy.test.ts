import { describe, expect, it, mock } from "bun:test"
import { match, matchOpt, matchOption, matchRes, matchResult } from "@/index.js"
import { Option as OldOption } from "@/option.js"
import { Result as OldResult } from "@/result.js"

describe("match legacy wrappers (old Option/Result)", () => {
  it("matchRes handles OldResult.Ok", () => {
    const spy = mock((v: number) => v)
    const r = OldResult.Ok(10)
    const out = matchRes(r, { Ok: spy, Err: () => 0 })
    expect(out).toBe(10)
    expect(spy).toHaveBeenCalledWith(10)
  })

  it("matchRes handles OldResult.Err", () => {
    const spy = mock((e: string) => e)
    const r = OldResult.Err("fail")
    const out = matchRes(r, { Ok: () => "ok", Err: spy })
    expect(out).toBe("fail")
    expect(spy).toHaveBeenCalledWith("fail")
  })

  it("matchResult alias works with OldResult", () => {
    const r = OldResult.Ok(21)
    expect(matchResult(r, { Ok: (v) => v * 2, Err: () => 0 })).toBe(42)
  })

  it("matchOpt handles OldOption.Some", () => {
    const spy = mock((v: number) => v)
    const o = OldOption.Some(5)
    const out = matchOpt(o, { Some: spy, None: () => 0 })
    expect(out).toBe(5)
    expect(spy).toHaveBeenCalledWith(5)
  })

  it("matchOpt handles OldOption.None", () => {
    const spy = mock(() => 7)
    const o = OldOption.None as OldOption<number>
    const out = matchOpt(o, { Some: () => 0, None: spy })
    expect(out).toBe(7)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("matchOption alias works with OldOption", () => {
    const o = OldOption.Some(3)
    expect(matchOption(o, { Some: (v) => v + 1, None: () => 0 })).toBe(4)
  })

  it("match() rejects Promise-like inner values at runtime", () => {
    const asyncSome = OldOption.Some(Promise.resolve(1)) as unknown as {
      readonly _tag: string
    }

    expect(() => match(asyncSome)).toThrow(
      "match() does not support Promise-like inner values",
    )
  })
})
