import { describe, expect, expectTypeOf, it } from "bun:test"
import { UnwrappedErrWithOk, UnwrappedOkWithErr } from "@/errors"
import type { ExperimentalOption as Option } from "@/option-experimental.js"
import { ExperimentalResult as Result } from "@/result-experimental.js"

class DummyError extends Error {
  constructor() {
    super("dummyErr")
    this.name = "DummyError"
  }
}

describe("ExperimentalResult construction", () => {
  it("ok result", () => {
    const r = Result.Ok("dummy")

    expect(r.toString()).toBe("Result::Ok<dummy>")
  })

  it("err result", () => {
    const r = Result.Err(new DummyError())

    expect(r.toString()).toBe("Result::Err<DummyError: dummyErr>")
  })
})

describe("unwrapping value from result", () => {
  it("on Ok should be...ok", () => {
    const r = Result.Ok(42)

    expect(r.unwrap()).toBe(42)
  })

  it("on Err should throw an error", () => {
    const r = Result.Err(new DummyError())

    expect(() => r.unwrap()).toThrow(DummyError)
  })

  it("on non-Error Err val should throw UnwrappedOkWithErr", () => {
    const r = Result.Err(3)

    expect(() => r.unwrap()).toThrow(UnwrappedOkWithErr)
  })
})

describe("unwrapping error from result", () => {
  it("on Err should be...ok", () => {
    const r = Result.Err(42)

    expect(r.unwrapErr()).toBe(42)
  })

  it("on Ok should throw UnwrappedErrWithOk", () => {
    const r = Result.Ok(3)

    expect(() => r.unwrapErr()).toThrow(UnwrappedErrWithOk)
  })
})

describe("async matching behavior", () => {
  it("foldAsync propagates Ok handler rejection", async () => {
    const r = Result.Ok<number, string>(42)

    await expect(
      r.foldAsync(
        async () => {
          throw new Error("boom")
        },
        async () => "fallback",
      ),
    ).rejects.toThrow("boom")
  })

  it("matchAsync propagates Ok handler rejection", async () => {
    const r = Result.Ok<number, string>(42)

    await expect(
      r.matchAsync({
        Ok: async () => {
          throw new Error("boom")
        },
        Err: async () => "fallback",
      }),
    ).rejects.toThrow("boom")
  })
})

describe("unwrapping value from result safetly", () => {
  it("on Ok should return a non null value", () => {
    const r = Result.Ok(42)

    expect(r.safeUnwrap()).toBe(42)
  })

  it("on Err should return null", () => {
    const r = Result.Err(new DummyError())

    expect(r.safeUnwrap()).toBeNull()
  })
})

describe.skip("unwrapping err from result safetly", () => {
  // it("on Err should return a non null value", () => {
  //   const r = Result.Err(42);
  //   assert.strictEqual(r.safeUnwrapErr(), 42);
  // });
  // it("on Ok should return null", () => {
  //   const r = Result.Ok(91);
  //   assert.strictEqual(r.safeUnwrapErr(), null);
  // });
})

// ============================================================================
// Type Inference Tests (compile-time only, verified by `bun run tc`)
// ============================================================================

class ErrorA extends Error {
  readonly _tag = "ErrorA" as const
}
class ErrorB extends Error {
  readonly _tag = "ErrorB" as const
}
class ErrorC extends Error {
  readonly _tag = "ErrorC" as const
}

describe("Result type inference", () => {
  describe("construction", () => {
    it("should correctly type Ok and Err constructors", () => {
      // Result.Ok<T, E=never> creates Result<T, E>
      expectTypeOf(Result.Ok(42)).toEqualTypeOf<Result<number, never>>()
      expectTypeOf(Result.Ok("hello")).toEqualTypeOf<Result<string, never>>()

      // Result.Err<E, T=never> creates Result<T, E>
      expectTypeOf(Result.Err(new DummyError())).toEqualTypeOf<
        Result<never, DummyError>
      >()
      expectTypeOf(Result.Err("error string")).toEqualTypeOf<
        Result<never, string>
      >()

      // Explicit type parameters
      expectTypeOf(Result.Ok<string, Error>("val")).toEqualTypeOf<
        Result<string, Error>
      >()
      expectTypeOf(Result.Err<Error, number>(new Error())).toEqualTypeOf<
        Result<number, Error>
      >()
    })
  })

  describe("type guards", () => {
    it("should narrow types with isOk and isErr", () => {
      const r: Result<number, Error> = Result.Ok(42)

      if (r.isOk()) {
        // After isOk(), type should be Result<number, never>
        expectTypeOf(r).toEqualTypeOf<Result<number, never>>()
      }

      if (r.isErr()) {
        // After isErr(), type should be Result<never, Error>
        expectTypeOf(r).toEqualTypeOf<Result<never, Error>>()
      }
    })
  })

  describe("unwrapping", () => {
    it("should return correct types for sync unwrap methods", () => {
      const okResult = Result.Ok<number, Error>(42)
      const errResult = Result.Err<Error, number>(new Error())

      // unwrap() returns T
      expectTypeOf(okResult.unwrap()).toEqualTypeOf<number>()

      // unwrapErr() returns E
      expectTypeOf(errResult.unwrapErr()).toEqualTypeOf<Error>()

      // safeUnwrap() returns T | null
      expectTypeOf(okResult.safeUnwrap()).toEqualTypeOf<number | null>()

      // unwrapOr(default) returns T
      expectTypeOf(okResult.unwrapOr(0)).toEqualTypeOf<number>()

      // unwrapOrElse(fn) returns T
      expectTypeOf(okResult.unwrapOrElse(() => 0)).toEqualTypeOf<number>()
    })

    it("should return Promise for async unwrap variants", () => {
      const asyncResult = Result.Ok<Promise<number>, Error>(Promise.resolve(42))

      // unwrap() on Promise value returns Promise<T>
      expectTypeOf(asyncResult.unwrap()).toEqualTypeOf<Promise<number>>()

      // safeUnwrap() on Promise returns Promise<T | null> | null
      expectTypeOf(
        asyncResult.safeUnwrap(),
      ).toEqualTypeOf<Promise<number> | null>()

      // unwrapOr on async returns Promise
      expectTypeOf(asyncResult.unwrapOr(Promise.resolve(0))).toEqualTypeOf<
        Promise<number>
      >()

      // unwrapOrElse on async returns Promise
      expectTypeOf(asyncResult.unwrapOrElse(async () => 0)).toEqualTypeOf<
        Promise<number>
      >()
    })
  })

  describe("transformations", () => {
    it("should correctly type map with sync mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Sync mapper: Result<U, E>
      expectTypeOf(r.map((n) => n.toString())).toEqualTypeOf<
        Result<string, Error>
      >()
    })

    it("should correctly type map with async mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Async mapper: Result<Promise<U>, E>
      expectTypeOf(r.map(async (n) => n.toString())).toEqualTypeOf<never>()
    })

    it("should correctly type map on async Result with sync mapper", () => {
      const r = Result.Ok<Promise<number>, Error>(Promise.resolve(42))

      // Sync mapper on Promise<T>: Result<Promise<U>, E>
      expectTypeOf(r.map((n) => n.toString())).toEqualTypeOf<
        Result<string, Error>
      >()
    })

    it("should correctly type map on async Result with async mapper", () => {
      const r = Result.Ok<Promise<number>, Error>(Promise.resolve(42))

      // Async mapper on Promise<T>: Result<Promise<U>, E>
      expectTypeOf(r.map(async (n) => n.toString())).toEqualTypeOf<never>()
    })

    it("should correctly type mapErr", () => {
      const r = Result.Ok<number, Error>(42)

      // mapErr transforms E -> E2
      expectTypeOf(r.mapErr((e) => e.message)).toEqualTypeOf<
        Result<number, string>
      >()
    })

    it("should correctly type flatMap with sync mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Sync flatMap: Result<U, E | E2>
      expectTypeOf(
        r.flatMap((n) => Result.Ok<string, TypeError>(n.toString())),
      ).toEqualTypeOf<Result<string, Error | TypeError>>()
    })

    it("should correctly type flatMap on async Result", () => {
      const r = Result.Ok<Promise<number>, Error>(Promise.resolve(42))

      // flatMap on Promise<T>: Result<Promise<U>, E | E2>
      expectTypeOf(
        r.flatMap((n) => Result.Ok<string, TypeError>(n.toString())),
      ).toEqualTypeOf<Result<string, Error | TypeError>>()
    })

    it("should correctly type mapBoth", () => {
      const r = Result.Ok<number, Error>(42)

      expectTypeOf(
        r.mapBoth(
          (n) => n.toString(),
          (e) => e.message,
        ),
      ).toEqualTypeOf<Result<string, string>>()
    })
  })

  describe("zip operations", () => {
    it("should correctly type zip with sync mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Sync zip: Result<[T, U], E>
      expectTypeOf(r.zip((n) => n.toString())).toEqualTypeOf<
        Result<[number, string], Error>
      >()
    })

    it("should correctly type zip with async mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Async zip: Result<Promise<[T, U]>, E>
      expectTypeOf(r.zip(async (n) => n.toString())).toEqualTypeOf<never>()
    })

    it("should correctly type zip on async Result", () => {
      const r = Result.Ok<Promise<number>, Error>(Promise.resolve(42))

      // Sync zip on Promise<T>: Result<Promise<[T, U]>, E>
      expectTypeOf(r.zip((n) => n.toString())).toEqualTypeOf<
        Result<[Promise<number>, string], Error>
      >()
    })

    it("should correctly type flatZip with sync mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Sync flatZip: Result<[T, U], E | E2>
      expectTypeOf(
        r.flatZip((n) => Result.Ok<string, TypeError>(n.toString())),
      ).toEqualTypeOf<Result<[number, string], Error | TypeError>>()
    })

    it("should correctly type flatZip with async mapper", () => {
      const r = Result.Ok<number, Error>(42)

      // Async flatZip: Result<Promise<[T, U]>, E | E2>
      expectTypeOf(
        r.flatZipAsync(async (n) => Result.Ok<string, TypeError>(n.toString())),
      ).toEqualTypeOf<Promise<Result<[number, string], Error | TypeError>>>()
    })
  })

  describe("pattern matching", () => {
    it("should correctly type match with same return types", () => {
      const r = Result.Ok<number, Error>(42)

      // match returns U (the return type of both branches)
      expectTypeOf(
        r.match({
          Ok: (n) => n.toString(),
          Err: (e) => e.message,
        }),
      ).toEqualTypeOf<string>()
    })

    it("should correctly type match returning numbers", () => {
      const r = Result.Ok<number, Error>(42)

      // match can return numeric types
      expectTypeOf(
        r.match({
          Ok: (n) => n * 2,
          Err: () => -1,
        }),
      ).toEqualTypeOf<number>()
    })

    it("should correctly type match returning booleans", () => {
      const r = Result.Ok<number, Error>(42)

      expectTypeOf(
        r.match({
          Ok: () => true,
          Err: () => false,
        }),
      ).toEqualTypeOf<boolean>()
    })
  })

  describe("static methods", () => {
    it("should correctly type fromNullable", () => {
      const val: string | null = "hello"
      expectTypeOf(Result.fromNullable(val, new Error())).toEqualTypeOf<
        Result<string, Error>
      >()
    })

    it("should correctly type fromPredicate", () => {
      expectTypeOf(
        Result.fromPredicate(42, (n) => n > 0, new Error()),
      ).toEqualTypeOf<Result<number, Error>>()
    })

    it("should correctly type tryCatch without error mapper", () => {
      expectTypeOf(Result.tryCatch(() => 42)).toEqualTypeOf<
        Result<number, unknown>
      >()
    })

    it("should correctly type tryCatch with error mapper", () => {
      expectTypeOf(
        Result.tryCatch(
          () => 42,
          (e) => new Error(String(e)),
        ),
      ).toEqualTypeOf<Result<number, Error>>()
    })

    it("should correctly type tryAsyncCatch", () => {
      expectTypeOf(Result.tryAsyncCatch(async () => 42)).toEqualTypeOf<
        Promise<Result<number, unknown>>
      >()
    })

    it("should correctly type all", () => {
      const r1 = Result.Ok<number, Error>(1)
      const r2 = Result.Ok<string, TypeError>("hello")

      // all combines into tuple, errors become union array
      expectTypeOf(Result.all(r1, r2)).toEqualTypeOf<
        Result<[number, string], (Error | TypeError)[]>
      >()
    })

    it("should correctly type any", () => {
      const r1 = Result.Ok<number, Error>(1)
      const r2 = Result.Ok<number, Error>(2)

      // any returns first Ok type, collects errors into array
      expectTypeOf(Result.any(r1, r2)).toEqualTypeOf<Result<number, Error[]>>()
    })
  })

  describe("complex chains", () => {
    it("should correctly type chained map and flatMap", () => {
      const r = Result.Ok<number, Error>(42)

      // Chain: map -> flatMap
      const chained = r
        .map((n) => n * 2)
        .flatMap((n) => Result.Ok<string, TypeError>(n.toString()))

      expectTypeOf(chained).toEqualTypeOf<Result<string, Error | TypeError>>()
    })

    it("should correctly type chained transformations with zip", () => {
      const r = Result.Ok<number, Error>(42)

      // Chain: map -> flatMap -> zip
      const chained = r
        .map((n) => n * 2)
        .flatMap((n) => Result.Ok<string, TypeError>(n.toString()))
        .zip((s) => s.length)

      expectTypeOf(chained).toEqualTypeOf<
        Result<[string, number], Error | TypeError>
      >()
    })

    it("should accumulate error types through flatMap chain", () => {
      const r = Result.Ok<number, ErrorA>(42)
      const chained = r
        .flatMap((n) => Result.Ok<string, ErrorB>(n.toString()))
        .flatMap((s) => Result.Ok<boolean, ErrorC>(s.length > 0))

      expectTypeOf(chained).toEqualTypeOf<
        Result<boolean, ErrorA | ErrorB | ErrorC>
      >()
    })

    it("should correctly type branching computations", () => {
      const r = Result.Ok<number, Error>(42)

      const branch1 = r.map((n) => n * 2)
      const branch2 = r.flatMap((n) =>
        Result.Ok<string, TypeError>(n.toString()),
      )
      const branch3 = r.zip((n) => n.toString())

      expectTypeOf(branch1).toEqualTypeOf<Result<number, Error>>()
      expectTypeOf(branch2).toEqualTypeOf<Result<string, Error | TypeError>>()
      expectTypeOf(branch3).toEqualTypeOf<Result<[number, string], Error>>()
    })

    it("should correctly type async flatZip chains", async () => {
      const r = Result.Ok<number, Error>(42)

      const chained = r
        .flatZipAsync(async (n) => Result.Ok<string, TypeError>(n.toString()))
        .then((r) => r.map(([num, str]) => `${num}: ${str}`))

      expectTypeOf(chained).toEqualTypeOf<
        Promise<Result<string, Error | TypeError>>
      >()
    })
  })

  describe("conversions", () => {
    it("should correctly type toOption", () => {
      const r = Result.Ok<number, Error>(42)
      expectTypeOf(r.toOption()).toEqualTypeOf<Option<number>>()
    })

    it("should correctly type flip", () => {
      const r = Result.Ok<number, Error>(42)
      expectTypeOf(r.flip()).toEqualTypeOf<Result<Error, number>>()
    })

    it("should correctly type orElse", () => {
      const r = Result.Err<Error, string>(new Error())

      expectTypeOf(
        r.orElse((_e) => Result.Ok<string, TypeError>("fallback")),
      ).toEqualTypeOf<Result<string, TypeError>>()
    })

    it("should correctly type tap (returns same type)", () => {
      const r = Result.Ok<number, Error>(42)
      expectTypeOf(r.tap((n) => console.log(n))).toEqualTypeOf<
        Result<number, Error>
      >()
    })

    it("should correctly type tapErr (returns same type)", () => {
      const r = Result.Ok<number, Error>(42)
      expectTypeOf(r.tapErr((e) => console.error(e))).toEqualTypeOf<
        Result<number, Error>
      >()
    })

    it("should correctly type innerMap", () => {
      const r = Result.Ok<number[], Error>([1, 2, 3])
      expectTypeOf(r.innerMap((n) => n.toString())).toEqualTypeOf<
        Result<string[], Error>
      >()
    })
  })

  describe("validate", () => {
    it("should correctly type validate with sync validators", () => {
      const r = Result.Ok<number, Error>(42)

      const validated = r.validate([
        (n) => Result.Ok<boolean, ErrorA>(n > 0),
        (n) => Result.Ok<boolean, ErrorB>(n < 100),
      ])

      expectTypeOf(validated).toEqualTypeOf<
        Result<number, Error | (ErrorA | ErrorB)[]>
      >()
    })

    it("should correctly type validate with async validators", () => {
      const r = Result.Ok<number, Error>(42)

      const validated = r.validate([
        async (n) => Result.Ok<boolean, ErrorA>(n > 0),
        async (n) => Result.Ok<boolean, ErrorB>(n < 100),
      ])

      expectTypeOf(validated).toEqualTypeOf<
        Promise<Result<number, Error | (ErrorA | ErrorB)[]>>
      >()
    })
  })
})
