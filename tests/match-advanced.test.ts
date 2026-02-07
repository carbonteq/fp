import { describe, expect, it, mock } from "bun:test"
import {
  match,
  ExperimentalOption as Option,
  P,
  ExperimentalResult as Result,
} from "@/index.js"

// =============================================================================
// Type Definitions
// =============================================================================

type ApiError = { code: number; message: string }

// =============================================================================
// Option.fold() - Advanced tests
// =============================================================================

describe("Option.fold() - advanced", () => {
  it("should handle complex nested transformations", () => {
    const result = Option.Some({ id: 1, name: "test" }).fold(
      (obj) => ({ ...obj, processed: true }),
      () => ({ processed: false }),
    )
    expect(result).toEqual({ id: 1, name: "test", processed: true } as {
      id: number
      name: string
      processed: boolean
    })
  })

  it("should handle array values", () => {
    const result = Option.Some([1, 2, 3]).fold(
      (arr) => arr.map((x) => x * 2),
      () => [],
    )
    expect(result).toEqual([2, 4, 6])
  })

  it("should handle union types", () => {
    const result = Option.Some<string | number>("hello").fold(
      (val) => (typeof val === "string" ? val.toUpperCase() : val.toString()),
      () => "default",
    )
    expect(result).toBe("HELLO")
  })

  it("should handle undefined in union", () => {
    const result = Option.Some<number | undefined>(42).fold(
      (val) => (val || 0) * 2,
      () => 0,
    )
    expect(result).toBe(84)
  })
})

// =============================================================================
// Option.foldAsync() - Advanced tests
// =============================================================================

describe("Option.foldAsync() - advanced", () => {
  it("should handle async transformations with delays", async () => {
    const spyFn = mock((val: number) => Promise.resolve(val * 2))
    const result = await Option.Some(42).foldAsync(spyFn, async () => 0)
    expect(result).toBe(84)
    expect(spyFn).toHaveBeenCalledWith(42)
  })

  it("should propagate async errors in onSome", async () => {
    await Option.Some(42)
      .foldAsync(
        async (_val) => {
          throw new Error("Async error")
        },
        async () => {
          return 0
        },
      )
      .then(
        () => {
          throw new Error("Expected foldAsync to reject")
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain("Async error")
        },
      )
  })

  it("should preserve return types from async branches", async () => {
    const result = await Option.Some("test").foldAsync(
      async (s) => s.toUpperCase(),
      async () => "EMPTY",
    )
    expect(result).toBe("TEST")
  })
})

// =============================================================================
// Option.matchAsync() - Advanced tests
// =============================================================================

describe("Option.matchAsync() - advanced", () => {
  it("should handle complex async Some handlers", async () => {
    const result = await Option.Some({ id: 1, data: "test" }).matchAsync({
      Some: async (val) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return { ...val, processed: true }
      },
      None: async () => ({ id: 0, data: "", processed: false }),
    })
    expect(result).toEqual({ id: 1, data: "test", processed: true })
  })

  it("should handle async None handler with side effects", async () => {
    const sideEffect = mock(() => {})
    const result = await Option.None.matchAsync({
      Some: async (val: number) => val * 2,
      None: async () => {
        sideEffect()
        return 0
      },
    })
    expect(result).toBe(0)
    expect(sideEffect).toHaveBeenCalledTimes(1)
  })

  it("should propagate async errors in Some handler", async () => {
    await Option.Some(42)
      .matchAsync({
        Some: async (_val) => {
          throw new Error("Handler error")
        },
        None: async () => {
          return "fallback"
        },
      })
      .then(
        () => {
          throw new Error("Expected matchAsync to reject")
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain("Handler error")
        },
      )
  })

  it("should work with async database operations", async () => {
    const mockFetch = mock((id: number) =>
      Promise.resolve(Option.Some({ id, name: `User ${id}` })),
    )

    const result = await Option.Some(1).matchAsync({
      Some: async (id) => mockFetch(id),
      None: async () => Promise.resolve(Option.None),
    })

    expect(result).toEqual(Option.Some({ id: 1, name: "User 1" }))
  })
})

// =============================================================================
// Option.matchPartial() - Advanced tests
// =============================================================================

describe("Option.matchPartial() - advanced", () => {
  it("should handle Some with no cases specified", () => {
    // When Some case is not in cases, use default value
    expect(Option.Some(42).matchPartial({}, () => 0)).toBe(0)
    expect(Option.None.matchPartial({}, () => 0)).toBe(0)
  })

  it("should handle lazy default called only when needed", () => {
    const lazyDefault = mock(() => 999)
    // lazyDefault only called for None, not for Some
    expect(
      Option.Some(42).matchPartial({ Some: (val) => val }, lazyDefault),
    ).toBe(42)
    expect(Option.None.matchPartial({}, lazyDefault)).toBe(999)
    expect(lazyDefault).toHaveBeenCalledTimes(1)
  })

  it("should handle complex return types", () => {
    type Complex = { value: number; source: "some" | "default" }

    const result1: Complex = Option.Some(42).matchPartial<Complex>(
      { Some: (v) => ({ value: v * 2, source: "some" }) },
      () => ({ value: 0, source: "default" }),
    )
    expect(result1).toEqual({ value: 84, source: "some" })

    const result2: Complex = Option.None.matchPartial<Complex>(
      { Some: (v) => ({ value: v * 2, source: "some" }) },
      () => ({ value: 0, source: "default" }),
    )
    expect(result2).toEqual({ value: 0, source: "default" })
  })

  it("should handle None case only", () => {
    const result = Option.Some(100).matchPartial({ None: () => -1 }, () => 100)
    expect(result).toBe(100)

    const result2 = Option.None.matchPartial({ None: () => -1 }, () => 100)
    expect(result2).toBe(-1)
  })

  it("should handle Some case only with lazy default", () => {
    let computeCount = 0
    const lazyDefault = () => {
      computeCount++
      return 999
    }

    // lazyDefault only called for None, not for Some
    const result = Option.Some(42).matchPartial(
      { Some: (v) => v * 2 },
      lazyDefault,
    )
    expect(result).toBe(84)
    expect(computeCount).toBe(0)

    const result2 = Option.None.matchPartial(
      { Some: (v) => v * 2 },
      lazyDefault,
    )
    expect(result2).toBe(999)
    expect(computeCount).toBe(1)
  })
})

// =============================================================================
// Result.fold() - Advanced tests
// =============================================================================

describe("Result.fold() - advanced", () => {
  it("should handle complex nested data structures", () => {
    type ResultType = {
      user?: { id: number; name: string }
      metadata?: { timestamp: number }
      error?: unknown
      folded: boolean
    }
    const result = Result.Ok({
      user: { id: 1, name: "test" },
      metadata: { timestamp: 123456 },
    }).fold<ResultType>(
      (val) => ({ ...val, folded: true }),
      (err) => ({ error: err, folded: false }),
    )
    expect(result).toEqual({
      user: { id: 1, name: "test" },
      metadata: { timestamp: 123456 },
      folded: true,
    })
  })

  it("should handle array transformations", () => {
    const result = Result.Ok([1, 2, 3]).fold(
      (arr) => arr.map((x) => x * 2),
      () => [],
    )
    expect(result).toEqual([2, 4, 6])
  })

  it("should handle union types", () => {
    const result = Result.Ok<string | number, never>("hello").fold(
      (val) => (typeof val === "string" ? val.toUpperCase() : val.toString()),
      (_err) => "error",
    )
    expect(result).toBe("HELLO")
  })

  it("should handle error side effects", () => {
    const errorLog = mock((_err: string) => {})
    const result = Result.Err("test error").fold(
      (val) => val,
      (err) => {
        errorLog(err)
        return `logged: ${err}`
      },
    )
    expect(result).toBe("logged: test error")
    expect(errorLog).toHaveBeenCalledWith("test error")
  })
})

// =============================================================================
// Result.foldAsync() - Advanced tests
// =============================================================================

describe("Result.foldAsync() - advanced", () => {
  it("should handle async transformations with delays", async () => {
    const spyOk = mock((val: number) => Promise.resolve(val * 2))
    const spyErr = mock((_err: string) => Promise.resolve(0))

    const result = await Result.Ok(42).foldAsync(spyOk, spyErr)
    expect(result).toBe(84)
    expect(spyOk).toHaveBeenCalledWith(42)
    expect(spyErr).not.toHaveBeenCalled()
  })

  it("should handle async error transformations", async () => {
    const spyErr = mock((_err: string) => Promise.resolve(0))

    const result = await Result.Err("fail").foldAsync(
      async (val) => val * 2,
      spyErr,
    )
    expect(result).toBe(0)
    expect(spyErr).toHaveBeenCalledWith("fail")
  })

  it("should propagate async errors in onOk", async () => {
    await Result.Ok(42)
      .foldAsync(
        async (_val) => {
          throw new Error("Handler failed")
        },
        async (_err) => {
          return 0
        },
      )
      .then(
        () => {
          throw new Error("Expected foldAsync to reject")
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain("Handler failed")
        },
      )
  })

  it("should handle complex async workflows", async () => {
    const mockProcess = mock(
      <T extends Record<string, unknown>>(data: T): Promise<T> =>
        Promise.resolve({ processed: true, ...data }),
    )
    const mockLog = mock(<Err>(err: Err) => Promise.resolve(err))

    const result = await Result.Ok<{ id: number; name: string }, string>({
      id: 1,
      name: "test",
    }).foldAsync(async (val) => mockProcess(val), mockLog)

    expect(result).toEqual({ id: 1, name: "test", processed: true })
    expect(mockProcess).toHaveBeenCalledWith({ id: 1, name: "test" })
  })
})

// =============================================================================
// Result.matchAsync() - Advanced tests
// =============================================================================

describe("Result.matchAsync() - advanced", () => {
  it("should handle complex async Ok handlers", async () => {
    const result = await Result.Ok({ id: 1, data: "test" }).matchAsync({
      Ok: async (val) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return { ...val, processed: true }
      },
      Err: async (err) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        return { id: 0, data: "", error: err, processed: false }
      },
    })
    expect(result).toEqual({ id: 1, data: "test", processed: true })
  })

  it("should handle async Err handler with side effects", async () => {
    const sideEffect = mock(() => {})
    const result = await Result.Err("test error").matchAsync({
      Ok: async (val: number) => val * 2,
      Err: async (_err) => {
        sideEffect()
        return 0
      },
    })
    expect(result).toBe(0)
    expect(sideEffect).toHaveBeenCalledTimes(1)
  })

  it("should propagate async errors in Ok handler", async () => {
    await Result.Ok(42)
      .matchAsync({
        Ok: async (_val) => {
          throw new Error("Handler error")
        },
        Err: async () => {
          return "fallback"
        },
      })
      .then(
        () => {
          throw new Error("Expected matchAsync to reject")
        },
        (error: unknown) => {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toContain("Handler error")
        },
      )
  })

  it("should work with async database operations", async () => {
    const mockFetch = mock((id: number) =>
      Promise.resolve(Result.Ok({ id, name: `User ${id}` })),
    )

    const result = await Result.Ok(1).matchAsync({
      Ok: async (id) => mockFetch(id),
      Err: async (err) => Promise.resolve(Result.Err(err)),
    })

    expect(result).toEqual(Result.Ok({ id: 1, name: "User 1" }))
  })
})

// =============================================================================
// Result.matchPartial() - Advanced tests
// =============================================================================

describe("Result.matchPartial() - advanced", () => {
  it("should handle Ok with no cases specified", () => {
    // When Ok case is not in cases, use default value
    expect(Result.Ok(42).matchPartial({}, () => 0)).toBe(0)
    expect(Result.Err("fail").matchPartial({}, () => 0)).toBe(0)
  })

  it("should handle lazy default called only when needed", () => {
    const lazyDefault: () => number = mock(() => 999)
    // lazyDefault only called for Err, not for Ok
    expect(Result.Ok(42).matchPartial({ Ok: (val) => val }, lazyDefault)).toBe(
      42,
    )
    expect(Result.Err("fail").matchPartial({}, lazyDefault)).toBe(999)
    expect(Result.Err("fail2").matchPartial({}, lazyDefault)).toBe(999)
    expect(lazyDefault).toHaveBeenCalledTimes(2)
  })

  it("should handle complex return types", () => {
    type Complex = {
      value: number
      source: "ok" | "error" | "default"
    }

    const result1: Complex = Result.Ok(42).matchPartial<Complex>(
      {
        Ok: (v) => ({ value: v * 2, source: "ok" }),
      },
      () => ({ value: 0, source: "default" }),
    )
    expect(result1).toEqual({ value: 84, source: "ok" })

    const result2: Complex = Result.Err<string, number>(
      "fail",
    ).matchPartial<Complex>(
      {
        Ok: (v) => ({ value: v * 2, source: "ok" }),
      },
      () => ({ value: 0, source: "default" }),
    )
    expect(result2).toEqual({ value: 0, source: "default" })
  })

  it("should handle Err case only", () => {
    const result = Result.Ok(100).matchPartial({ Err: (_e) => -1 }, () => 100)
    expect(result).toBe(100)

    const result2 = Result.Err("fail").matchPartial(
      { Err: (_e) => -1 },
      () => 100,
    )
    expect(result2).toBe(-1)
  })

  it("should handle Ok case only with lazy default", () => {
    let computeCount = 0
    const lazyDefault = () => {
      computeCount++
      return 999
    }

    // lazyDefault only called for Err, not for Ok
    const result = Result.Ok(42).matchPartial({ Ok: (v) => v * 2 }, lazyDefault)
    expect(result).toBe(84)
    expect(computeCount).toBe(0)

    const result2 = Result.Err("fail").matchPartial(
      { Ok: (v) => v * 2 },
      lazyDefault,
    )
    expect(result2).toBe(999)
    expect(computeCount).toBe(1)
  })
})

// =============================================================================
// match() builder - Advanced tests
// =============================================================================

describe("match() builder - advanced", () => {
  it("should handle complex nested patterns", () => {
    type Tree =
      | { _tag: "leaf"; value: number }
      | { _tag: "node"; left: Tree; right: Tree }

    const leaf = { _tag: "leaf" as const, value: 42 }
    const result = match(leaf as Tree)
      .with("leaf", (l) => l.value * 2)
      .with("node", (_n) => 0)
      .exhaustive()
    expect(result).toBe(84)
  })

  it("should handle multiple discriminated unions", () => {
    type Event =
      | { _tag: "click"; x: number; y: number }
      | { _tag: "key"; key: string }
      | { _tag: "scroll"; deltaY: number }

    const click = { _tag: "click" as const, x: 10, y: 20 }
    const result = match(click as Event)
      .with("click", (e) => `Clicked at (${e.x}, ${e.y})`)
      .with("key", (e) => `Key: ${e.key}`)
      .with("scroll", (e) => `Scrolled ${e.deltaY}`)
      .exhaustive()
    expect(result).toBe("Clicked at (10, 20)")
  })

  it("should handle mixed P patterns", () => {
    const result = match(Option.Some<number>(75))
      .with(
        P.Some((x: number) => x >= 90),
        () => "A",
      )
      .with(
        P.Some((x: number) => x >= 80),
        () => "B",
      )
      .with(
        P.Some((x: number) => x >= 70),
        () => "C",
      )
      .with(
        P.Some((x: number) => x >= 60),
        () => "D",
      )
      .with(P.Some(), () => "F")
      .with(P.None(), () => "N/A")
      .exhaustive()
    expect(result).toBe("C")
  })

  it("regression: string tag handlers receive inner values", () => {
    const someResult = match(Option.Some<number>(75))
      .with("Some", (value: number) => value + 5)
      .with("None", () => 0)
      .exhaustive()

    const errResult = match(Result.Err<string, number>("boom"))
      .with("Ok", () => 0)
      .with("Err", (error: string) => error.length)
      .exhaustive()

    expect(someResult).toBe(80)
    expect(errResult).toBe(4)
  })

  it("regression: no-predicate P handlers receive inner values", () => {
    const result = match(Result.Ok<number, string>(10))
      .with(P.Ok(), (value: number) => value * 2)
      .with(P.Err(), (error: string) => error.length)
      .exhaustive()

    expect(result).toBe(20)
  })

  it("should handle mixed P patterns for Result", () => {
    const result = match(Result.Ok<number, never>(75))
      .with(
        P.Ok((x: number) => x >= 90),
        () => "A",
      )
      .with(
        P.Ok((x: number) => x >= 80),
        () => "B",
      )
      .with(
        P.Ok((x: number) => x >= 70),
        () => "C",
      )
      .with(P.Ok(), () => "F")
      .with(P.Err(), () => "E")
      .exhaustive()
    expect(result).toBe("C")
  })

  it("should combine when and with", () => {
    const opt = Option.Some<number>(75)
    const result = match(opt)
      .when(
        (o) => o.isSome() && o.unwrap() > 90,
        () => "very big",
      )
      .with(
        P.Some((x: number) => x >= 70),
        () => "big",
      )
      .with(P.Some(), () => "small")
      .with(P.None(), () => "none")
      .exhaustive()
    expect(result).toBe("big")
  })

  it("should handle complex when predicates", () => {
    type User = {
      _tag: "user"
      id: number
      name: string
      role: "admin" | "user"
    }

    const user: User = { _tag: "user", id: 1, name: "test", role: "admin" }
    const result = match(user)
      .when(
        (u) => u.role === "admin" && u.id === 1,
        () => "Super admin",
      )
      .when(
        (u) => u.role === "admin",
        () => "Admin user",
      )
      .otherwise(() => "Regular user")
    expect(result).toBe("Super admin")
  })

  it("should handle string tag matching with complex types", () => {
    type Shape3D =
      | { _tag: "sphere"; radius: number }
      | { _tag: "cube"; side: number }
      | { _tag: "cylinder"; radius: number; height: number }

    const cube: Shape3D = { _tag: "cube", side: 5 }
    const result = match<Shape3D>(cube)
      .with("sphere", (s) => Math.PI * s.radius ** 3)
      .with("cube", (c) => c.side ** 3)
      .with("cylinder", (c) => Math.PI * c.radius ** 2 * c.height)
      .exhaustive()
    expect(result).toBe(125)
  })

  it("should handle Result error with predicate", () => {
    const result = match(
      Result.Err<ApiError, never>({ code: 404, message: "Not found" }),
    )
      .with(
        P.Err((e: ApiError) => e.code >= 500),
        () => "Server error",
      )
      .with(
        P.Err((e: ApiError) => e.code === 404),
        () => "Not found",
      )
      .with(
        P.Err((e: ApiError) => e.code >= 400 && e.code < 500),
        () => "Client error",
      )
      .with(P.Err(), () => "Other error")
      .with(P.Ok(), () => "Should not happen") // For exhaustiveness
      .exhaustive()
    expect(result).toBe("Not found")
  })

  it("should handle exhaustive() with all P patterns", () => {
    const result = match(Option.Some<number>(75))
      .with(
        P.Some((x: number) => x >= 90),
        () => "A",
      )
      .with(
        P.Some((x: number) => x >= 80),
        () => "B",
      )
      .with(
        P.Some((x: number) => x >= 70),
        () => "C",
      )
      .with(
        P.Some((x: number) => x >= 60),
        () => "D",
      )
      .with(
        P.Some((x: number) => x >= 50),
        () => "E",
      )
      .with(P.Some(), () => "fail")
      .with(P.None(), () => "none")
      .exhaustive()
    expect(result).toBe("C")
  })

  it("should handle otherwise with P patterns", () => {
    type Color =
      | { _tag: "red"; shade: "light" | "dark" }
      | { _tag: "blue"; shade: "light" | "dark" }
      | { _tag: "green"; shade: "light" | "dark" }

    const red: Color = { _tag: "red", shade: "dark" }
    const result = match(red)
      .when(
        (c) => c._tag === "red" && c.shade === "dark",
        () => "Dark red",
      )
      .otherwise(() => "Light red")
    expect(result).toBe("Dark red")
  })

  it("should chain multiple .when() calls", () => {
    const opt = Option.Some(42)
    const result = match(opt)
      .when(
        (o) => o.isSome() && o.unwrap() > 100,
        () => "very large",
      )
      .when(
        (o) => o.isSome() && o.unwrap() > 50,
        () => "large",
      )
      .when(
        (o) => o.isSome() && o.unwrap() > 0,
        () => "positive",
      )
      .when(
        (o) => o.isNone(),
        () => "none",
      )
      .otherwise(() => "zero or negative")
    expect(result).toBe("positive")
  })
})

// =============================================================================
// Edge cases and error handling
// =============================================================================

describe("Edge cases and error handling", () => {
  it("should handle undefined in Option.fold()", () => {
    const result = Option.Some<number | undefined>(undefined).fold(
      (val) => val ?? 0,
      () => -1,
    )
    expect(result).toBe(0)
  })

  it("should handle null in Option.fold()", () => {
    const result = Option.Some<number | null>(null).fold(
      (val) => val ?? 0,
      () => -1,
    )
    expect(result).toBe(0)
  })
})
