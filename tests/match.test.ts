import { describe, expect, it, mock } from "bun:test"
import {
  match,
  matchOpt,
  matchOption,
  matchRes,
  matchResult,
  ExperimentalOption as Option,
  P,
  ExperimentalResult as Result,
  UnmatchedCaseError,
} from "@/index.js"

describe("match Result (legacy)", () => {
  it("should run Ok handler on Ok values", () => {
    const spyFn = mock((val: number) => val)
    const r = Result.Ok(33)

    const matched = matchRes(r, {
      Ok: spyFn,
      Err: (_v) => 13,
    })

    expect(matched).toBe(33)
    expect(spyFn).toHaveBeenCalledTimes(1)
    expect(spyFn).toHaveBeenCalledWith(33)
  })

  it("should run Err handler on Err values", () => {
    const spyFn = mock((val: number) => val)
    const r = Result.Err(42)

    const matched = matchRes(r, {
      Err: spyFn,
      Ok: (_v) => 13,
    })

    expect(matched).toBe(42)
    expect(spyFn).toHaveBeenCalledTimes(1)
    expect(spyFn).toHaveBeenCalledWith(42)
  })

  it("should have matchResult alias", () => {
    const r = Result.Ok(42)
    expect(matchResult(r, { Ok: (v) => v * 2, Err: () => 0 })).toBe(84)
  })
})

describe("match Option (legacy)", () => {
  it("should run Some handler on filled Option", () => {
    const spyFn = mock((val: number) => val)
    const opt = Option.Some(33)

    const matched = matchOpt(opt, {
      Some: spyFn,
      None: () => 13,
    })

    expect(matched).toBe(33)
    expect(spyFn).toHaveBeenCalledTimes(1)
    expect(spyFn).toHaveBeenCalledWith(33)
  })

  it("should run None handler on empty Option", () => {
    const spyFn = mock(() => 42)
    const opt = Option.None

    const matched = matchOpt(opt, {
      None: spyFn,
      Some: () => 13,
    })

    expect(matched).toBe(42)
    expect(spyFn).toHaveBeenCalledTimes(1)
  })

  it("should have matchOption alias", () => {
    const opt = Option.Some(21)
    expect(matchOption(opt, { Some: (v) => v * 2, None: () => 0 })).toBe(42)
  })
})

describe("Option.fold()", () => {
  it("should call onSome for Some values", () => {
    const result = Option.Some(42).fold(
      (v) => v * 2,
      () => 0,
    )
    expect(result).toBe(84)
  })

  it("should call onNone for None values", () => {
    const result = Option.None.fold(
      (v: number) => v * 2,
      () => 0,
    )
    expect(result).toBe(0)
  })

  it("should be equivalent to match with positional args", () => {
    const opt = Option.Some("hello")
    const matchResult = opt.match({
      Some: (v) => v.toUpperCase(),
      None: () => "EMPTY",
    })
    const foldResult = opt.fold(
      (v) => v.toUpperCase(),
      () => "EMPTY",
    )
    expect(foldResult).toBe(matchResult)
  })
})

describe("Option.foldAsync()", () => {
  it("should call async onSome for Some values", async () => {
    const result = await Option.Some(42).foldAsync(
      async (v) => v * 2,
      async () => 0,
    )
    expect(result).toBe(84)
  })

  it("should call async onNone for None values", async () => {
    const result = await Option.None.foldAsync(
      async (v: number) => v * 2,
      async () => 0,
    )
    expect(result).toBe(0)
  })
})

describe("Option.matchAsync()", () => {
  it("should call async Some handler", async () => {
    const result = await Option.Some(21).matchAsync({
      Some: async (v) => v * 2,
      None: async () => 0,
    })
    expect(result).toBe(42)
  })

  it("should call async None handler", async () => {
    const result = await Option.None.matchAsync({
      Some: async (v: number) => v * 2,
      None: async () => 100,
    })
    expect(result).toBe(100)
  })
})

describe("Option.matchPartial()", () => {
  it("should handle Some when only Some is provided", () => {
    const result = Option.Some(42).matchPartial({ Some: (v) => v * 2 }, () => 0)
    expect(result).toBe(84)
  })

  it("should use default for None when only Some is provided", () => {
    const result = Option.None.matchPartial(
      { Some: (v: number) => v * 2 },
      () => 0,
    )
    expect(result).toBe(0)
  })

  it("should handle None when only None is provided", () => {
    const result = Option.None.matchPartial({ None: () => -1 }, () => 100)
    expect(result).toBe(-1)
  })

  it("should use default for Some when only None is provided", () => {
    const result = Option.Some(42).matchPartial({ None: () => -1 }, () => 100)
    expect(result).toBe(100)
  })

  it("should support lazy default with function", () => {
    const spy = mock(() => 999)
    const result = Option.None.matchPartial({ Some: (v: number) => v }, spy)
    expect(result).toBe(999)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("should not call lazy default when case matches", () => {
    const spy = mock(() => 999)
    const result = Option.Some(42).matchPartial({ Some: (v) => v * 2 }, spy)
    expect(result).toBe(84)
    expect(spy).not.toHaveBeenCalled()
  })
})

// =============================================================================
// Result.fold() tests
// =============================================================================

describe("Result.fold()", () => {
  it("should call onOk for Ok values", () => {
    const result = Result.Ok(42).fold(
      (v) => v * 2,
      () => 0,
    )
    expect(result).toBe(84)
  })

  it("should call onErr for Err values", () => {
    const result = (Result.Err("error") as Result<number, string>).fold(
      () => 0,
      (e) => e.length,
    )
    expect(result).toBe(5) // "error".length
  })

  it("should be equivalent to match with positional args", () => {
    const res = Result.Ok("hello")
    const matchResult = res.match({
      Ok: (v) => v.toUpperCase(),
      Err: () => "ERROR",
    })
    const foldResult = res.fold(
      (v) => v.toUpperCase(),
      () => "ERROR",
    )
    expect(foldResult).toBe(matchResult)
  })
})

// =============================================================================
// Result.foldAsync() tests
// =============================================================================

describe("Result.foldAsync()", () => {
  it("should call async onOk for Ok values", async () => {
    const result = await Result.Ok(42).foldAsync(
      async (v) => v * 2,
      async () => 0,
    )
    expect(result).toBe(84)
  })

  it("should call async onErr for Err values", async () => {
    const result = await (
      Result.Err("error") as Result<number, string>
    ).foldAsync(
      async () => 0,
      async (e) => e.length,
    )
    expect(result).toBe(5) // "error".length
  })
})

// =============================================================================
// Result.matchAsync() tests
// =============================================================================

describe("Result.matchAsync()", () => {
  it("should call async Ok handler", async () => {
    const result = await Result.Ok(21).matchAsync({
      Ok: async (v) => v * 2,
      Err: async () => 0,
    })
    expect(result).toBe(42)
  })

  it("should call async Err handler", async () => {
    const result = await (
      Result.Err("fail") as Result<number, string>
    ).matchAsync({
      Ok: async () => 0,
      Err: async (e) => e.length,
    })
    expect(result).toBe(4) // "fail".length
  })
})

// =============================================================================
// Result.matchPartial() tests
// =============================================================================

describe("Result.matchPartial()", () => {
  it("should handle Ok when only Ok is provided", () => {
    const result = Result.Ok(42).matchPartial({ Ok: (v) => v * 2 }, () => 0)
    expect(result).toBe(84)
  })

  it("should use default for Err when only Ok is provided", () => {
    const result = Result.Err("error").matchPartial(
      { Ok: (v: number) => v * 2 },
      () => 0,
    )
    expect(result).toBe(0)
  })

  it("should handle Err when only Err is provided", () => {
    const result = Result.Err("error").matchPartial(
      { Err: (e) => `got: ${e}` },
      () => "default",
    )
    expect(result).toBe("got: error")
  })

  it("should use default for Ok when only Err is provided", () => {
    const result = Result.Ok(42).matchPartial(
      { Err: (e: string) => `got: ${e}` },
      () => "default",
    )
    expect(result).toBe("default")
  })

  it("should support lazy default with function", () => {
    const spy = mock(() => "computed")
    const result = Result.Err("error").matchPartial(
      { Ok: (v: number) => `${v}` },
      spy,
    )
    expect(result).toBe("computed")
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// =============================================================================
// Fluent match() builder tests - Basic
// =============================================================================

describe("match() builder - basic", () => {
  it("should match Option.Some with string tag", () => {
    const result = match(Option.Some(21))
      .with("Some", (v) => v * 2)
      .with("None", () => 0)
      .exhaustive()
    expect(result).toBe(42)
  })

  it("should match Option.None with string tag", () => {
    const result = match(Option.None as Option<number>)
      .with("Some", (v) => v * 2)
      .with("None", () => 0)
      .exhaustive()
    expect(result).toBe(0)
  })

  it("should match Result.Ok with string tag", () => {
    const result = match(Result.Ok(21))
      .with("Ok", (v) => v * 2)
      .with("Err", () => 0)
      .exhaustive()
    expect(result).toBe(42)
  })

  it("should match Result.Err with string tag", () => {
    const result = match(Result.Err("error") as Result<number, string>)
      .with("Ok", (v) => v * 2)
      .with("Err", (e) => `got: ${e}`)
      .exhaustive()
    expect(result).toBe("got: error")
  })
})

// =============================================================================
// Fluent match() builder tests - with P patterns
// =============================================================================

describe("match() builder - with P patterns", () => {
  it("should match with P.Some()", () => {
    const result = match(Option.Some(42))
      .with(P.Some(), (v) => v * 2)
      .with(P.None(), () => 0)
      .exhaustive()
    expect(result).toBe(84)
  })

  it("should match with P.None()", () => {
    const result = match(Option.None as Option<number>)
      .with(P.Some(), (v) => v * 2)
      .with(P.None(), () => 99)
      .exhaustive()
    expect(result).toBe(99)
  })

  it("should match with P.Ok()", () => {
    const result = match(Result.Ok("success"))
      .with(P.Ok(), (v) => `got: ${v}`)
      .with(P.Err(), () => "error")
      .exhaustive()
    expect(result).toBe("got: success")
  })

  it("should match with P.Err()", () => {
    const result = match(Result.Err("fail") as Result<string, string>)
      .with(P.Ok(), (v) => `got: ${v}`)
      .with(P.Err(), (e) => `error: ${e}`)
      .exhaustive()
    expect(result).toBe("error: fail")
  })

  it("should support typed wildcard P._", () => {
    const result = match(Option.Some(42) as Option<number>)
      .with(P._, (opt) => (opt.isSome() ? opt.unwrap() * 2 : 0))
      .exhaustive()

    expect(result).toBe(84)
  })

  it("should use wildcard as final catch-all", () => {
    const result = match(Result.Err("boom") as Result<number, string>)
      .with("Ok", () => 1)
      .with(P._, (value) => (value._tag === "Err" ? 2 : 0))
      .exhaustive()

    expect(result).toBe(2)
  })
})

// =============================================================================
// Fluent match() builder tests - predicate guards
// =============================================================================

describe("match() builder - predicate guards", () => {
  it("should support P.eq helper in guarded patterns", () => {
    const result = match(Result.Ok(42) as Result<number, string>)
      .with(P.Ok(P.eq(42)), () => "exact")
      .with(P.Ok(), () => "other")
      .with(P.Err(), () => "err")
      .exhaustive()
    expect(result).toBe("exact")
  })

  it("should support P.oneOf helper in guarded patterns", () => {
    const result = match(Result.Err("timeout") as Result<number, string>)
      .with(P.Ok(), () => "ok")
      .with(P.Err(P.oneOf("timeout", "offline")), () => "retry")
      .with(P.Err(), () => "fail")
      .exhaustive()
    expect(result).toBe("retry")
  })

  it("should support P.not helper with P.eq", () => {
    const result = match(Result.Ok(41) as Result<number, string>)
      .with(P.Ok(P.not(P.eq(42))), (value: number) => `not-42:${value}`)
      .with(P.Ok(), () => "is-42")
      .with(P.Err(), () => "err")
      .exhaustive()
    expect(result).toBe("not-42:41")
  })

  it("should support P.not helper with P.oneOf", () => {
    const result = match(Result.Err("fatal") as Result<number, string>)
      .with(P.Ok(), () => "ok")
      .with(P.Err(P.not(P.oneOf("timeout", "offline"))), () => "non-retryable")
      .with(P.Err(), () => "retryable")
      .exhaustive()
    expect(result).toBe("non-retryable")
  })

  it("should support nested predicate helpers in Option matching", () => {
    const result = match(Option.Some(13) as Option<number>)
      .with(P.Some(P.not(P.oneOf(10, 11, 12))), (value: number) => value * 2)
      .with(P.Some(), () => 0)
      .with(P.None(), () => -1)
      .exhaustive()
    expect(result).toBe(26)
  })

  it("should support P.all and P.any aliases in guarded patterns", () => {
    const result = match(Result.Ok(42) as Result<number, string>)
      .with(P.Ok(P.all(P.not(P.eq(0)), P.any(P.eq(42), P.eq(43)))), () => "hit")
      .with(P.Ok(), () => "miss")
      .with(P.Err(), () => "err")
      .exhaustive()
    expect(result).toBe("hit")
  })

  it("should match with predicate guard on Some", () => {
    const result = match(Option.Some(100))
      .with(
        P.Some((x: number) => x > 50),
        () => "big",
      )
      .with(P.Some(), () => "small")
      .with(P.None(), () => "none")
      .exhaustive()
    expect(result).toBe("big")
  })

  it("should fall through when predicate fails", () => {
    const result = match(Option.Some(30))
      .with(
        P.Some((x: number) => x > 50),
        () => "big",
      )
      .with(P.Some(), () => "small")
      .with(P.None(), () => "none")
      .exhaustive()
    expect(result).toBe("small")
  })

  it("should match with predicate guard on Ok", () => {
    const result = match(Result.Ok(200))
      .with(
        P.Ok((x: number) => x >= 200),
        () => "success",
      )
      .with(P.Ok(), () => "partial")
      .with(P.Err(), () => "error")
      .exhaustive()
    expect(result).toBe("success")
  })

  it("should match with predicate guard on Err", () => {
    const result = match(
      Result.Err({ code: 404 }) as Result<number, { code: number }>,
    )
      .with(P.Ok(), () => "ok")
      .with(
        P.Err((e: { code: number }) => e.code === 404),
        () => "not found",
      )
      .with(P.Err(), () => "other error")
      .exhaustive()
    expect(result).toBe("not found")
  })
})

// =============================================================================
// Fluent match() builder tests - otherwise()
// =============================================================================

describe("match() builder - otherwise()", () => {
  it("should use otherwise as fallback", () => {
    const result = match(Option.None as Option<number>)
      .with("Some", (v) => v * 2)
      .otherwise(() => 0)
    expect(result).toBe(0)
  })

  it("should not call otherwise when case matches", () => {
    const spy = mock(() => 0)
    const result = match(Option.Some(42))
      .with("Some", (v) => v * 2)
      .otherwise(spy)
    expect(result).toBe(84)
    expect(spy).not.toHaveBeenCalled()
  })

  it("should work with Result", () => {
    const result = match(Result.Err("error") as Result<number, string>)
      .with("Ok", (v) => v)
      .otherwise(() => -1)
    expect(result).toBe(-1)
  })
})

// =============================================================================
// Fluent match() builder tests - when()
// =============================================================================

describe("match() builder - when()", () => {
  it("should support P.IsSome/P.IsNone helpers", () => {
    const result = match(Option.Some(5) as Option<number>)
      .when(P.IsSome, () => "some")
      .when(P.IsNone, () => "none")
      .otherwise(() => "other")
    expect(result).toBe("some")
  })

  it("should support P.IsOk/P.IsErr helpers", () => {
    const result = match(Result.Err("boom") as Result<number, string>)
      .when(P.IsOk, () => "ok")
      .when(P.IsErr, () => "err")
      .otherwise(() => "other")
    expect(result).toBe("err")
  })

  it("should match with when predicate", () => {
    const opt = Option.Some(100)
    const result = match(opt)
      .when(
        (o) => o.isSome() && o.unwrap() > 50,
        () => "big",
      )
      .otherwise(() => "small")
    expect(result).toBe("big")
  })

  it("should try when before with cases", () => {
    const opt = Option.Some(100)
    const result = match(opt)
      .when(
        (o) => o.isSome() && o.unwrap() > 50,
        () => "when matched",
      )
      .with("Some", () => "with matched")
      .with("None", () => "none")
      .exhaustive()
    expect(result).toBe("when matched")
  })
})

// =============================================================================
// Fluent match() builder tests - discriminated unions
// =============================================================================

describe("match() builder - discriminated unions", () => {
  type Shape =
    | { readonly _tag: "circle"; radius: number }
    | { readonly _tag: "rect"; width: number; height: number }
    | { readonly _tag: "point" }

  // Helper to ensure proper union type inference
  const asShape = (s: Shape): Shape => s

  it("should match discriminated union variants", () => {
    const circle = asShape({ _tag: "circle", radius: 5 })
    const result = match(circle)
      .with("circle", (s) => Math.PI * s.radius ** 2)
      .with("rect", (s) => s.width * s.height)
      .with("point", () => 0)
      .exhaustive()
    expect(result).toBeCloseTo(Math.PI * 25)
  })

  it("should match rect variant", () => {
    const rect = asShape({ _tag: "rect", width: 4, height: 5 })
    const result = match(rect)
      .with("circle", (s) => Math.PI * s.radius ** 2)
      .with("rect", (s) => s.width * s.height)
      .with("point", () => 0)
      .exhaustive()
    expect(result).toBe(20)
  })

  it("should match point variant", () => {
    const point = asShape({ _tag: "point" })
    const result = match(point)
      .with("circle", (s) => Math.PI * s.radius ** 2)
      .with("rect", (s) => s.width * s.height)
      .with("point", () => 0)
      .exhaustive()
    expect(result).toBe(0)
  })

  it("should keep custom Some/None union handlers typed to variants", () => {
    type CustomMaybe =
      | { readonly _tag: "Some"; value: number }
      | { readonly _tag: "None"; reason: string }

    const asCustomMaybe = (value: CustomMaybe): CustomMaybe => value

    const some = asCustomMaybe({ _tag: "Some", value: 12 })
    const none = asCustomMaybe({ _tag: "None", reason: "missing" })

    const someResult = match<CustomMaybe>(some)
      .with("Some", (v) => v.value)
      .with("None", (v) => v.reason.length)
      .exhaustive()

    const noneResult = match<CustomMaybe>(none)
      .with("Some", (v) => v.value)
      .with("None", (v) => v.reason.length)
      .exhaustive()

    expect(someResult).toBe(12)
    expect(noneResult).toBe(7)
  })

  it("should keep custom Ok/Err union handlers typed to variants", () => {
    type CustomResult =
      | { readonly _tag: "Ok"; data: number }
      | { readonly _tag: "Err"; code: number }

    const asCustomResult = (value: CustomResult): CustomResult => value

    const ok = asCustomResult({ _tag: "Ok", data: 5 })
    const err = asCustomResult({ _tag: "Err", code: 404 })

    const okResult = match<CustomResult>(ok)
      .with("Ok", (v) => v.data * 2)
      .with("Err", (v) => v.code)
      .exhaustive()

    const errResult = match<CustomResult>(err)
      .with("Ok", (v) => v.data * 2)
      .with("Err", (v) => v.code)
      .exhaustive()

    expect(okResult).toBe(10)
    expect(errResult).toBe(404)
  })
})

// =============================================================================
// UnmatchedCaseError tests
// =============================================================================

describe("UnmatchedCaseError", () => {
  it("should have correct name", () => {
    const err = new UnmatchedCaseError("Test")
    expect(err.name).toBe("UnmatchedCaseError")
  })

  it("should have correct message", () => {
    const err = new UnmatchedCaseError("MyTag")
    expect(err.message).toBe("Unmatched case: MyTag")
  })
})

// =============================================================================
// P namespace tests
// =============================================================================

describe("P namespace", () => {
  it("should create IsSome/IsNone predicate helpers", () => {
    expect(P.IsSome(Option.Some(1))).toBe(true)
    expect(P.IsSome(Option.None as Option<number>)).toBe(false)
    expect(P.IsNone(Option.None as Option<number>)).toBe(true)
    expect(P.IsNone(Option.Some(1))).toBe(false)
  })

  it("should create IsOk/IsErr predicate helpers", () => {
    expect(P.IsOk(Result.Ok(1))).toBe(true)
    expect(P.IsOk(Result.Err("x") as Result<number, string>)).toBe(false)
    expect(P.IsErr(Result.Err("x") as Result<number, string>)).toBe(true)
    expect(P.IsErr(Result.Ok(1))).toBe(false)
  })

  it("should create eq predicate helper", () => {
    const is42 = P.eq(42)
    expect(is42(42)).toBe(true)
    expect(is42(41)).toBe(false)
  })

  it("should create oneOf predicate helper", () => {
    const isHttpErr = P.oneOf(400, 401, 404)
    expect(isHttpErr(400)).toBe(true)
    expect(isHttpErr(404)).toBe(true)
    expect(isHttpErr(500)).toBe(false)
  })

  it("should create not predicate helper", () => {
    const isNot42 = P.not(P.eq(42))
    expect(isNot42(42)).toBe(false)
    expect(isNot42(43)).toBe(true)
  })

  it("should create and/all predicate helpers", () => {
    const isPositiveEven = P.and(
      (x: number) => x > 0,
      (x: number) => x % 2 === 0,
    )
    const isPositiveEvenAlias = P.all(
      (x: number) => x > 0,
      (x: number) => x % 2 === 0,
    )

    expect(isPositiveEven(4)).toBe(true)
    expect(isPositiveEven(3)).toBe(false)
    expect(isPositiveEvenAlias(6)).toBe(true)
    expect(isPositiveEvenAlias(-2)).toBe(false)
  })

  it("should create or/any predicate helpers", () => {
    const isSmallOrLarge = P.or(
      (x: number) => x < 10,
      (x: number) => x > 100,
    )
    const isSmallOrLargeAlias = P.any(
      (x: number) => x < 10,
      (x: number) => x > 100,
    )

    expect(isSmallOrLarge(5)).toBe(true)
    expect(isSmallOrLarge(50)).toBe(false)
    expect(isSmallOrLargeAlias(150)).toBe(true)
    expect(isSmallOrLargeAlias(42)).toBe(false)
  })

  it("should create Some pattern without predicate", () => {
    const pattern = P.Some()
    expect(pattern._patternTag).toBe("Some")
    expect(pattern.predicate).toBeUndefined()
  })

  it("should create Some pattern with predicate", () => {
    const pred = (x: number) => x > 10
    const pattern = P.Some(pred)
    expect(pattern._patternTag).toBe("Some")
    expect(pattern.predicate).toBe(pred)
  })

  it("should create None pattern", () => {
    const pattern = P.None()
    expect(pattern._patternTag).toBe("None")
  })

  it("should create Ok pattern without predicate", () => {
    const pattern = P.Ok()
    expect(pattern._patternTag).toBe("Ok")
    expect(pattern.predicate).toBeUndefined()
  })

  it("should create Ok pattern with predicate", () => {
    const pred = (x: number) => x > 10
    const pattern = P.Ok(pred)
    expect(pattern._patternTag).toBe("Ok")
    expect(pattern.predicate).toBe(pred)
  })

  it("should create Err pattern without predicate", () => {
    const pattern = P.Err()
    expect(pattern._patternTag).toBe("Err")
    expect(pattern.predicate).toBeUndefined()
  })

  it("should create Err pattern with predicate", () => {
    const pred = (e: string) => e.includes("error")
    const pattern = P.Err(pred)
    expect(pattern._patternTag).toBe("Err")
    expect(pattern.predicate).toBe(pred)
  })

  it("should have wildcard pattern", () => {
    expect(P._._patternTag).toBe("_")
  })
})
