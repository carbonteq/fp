import { describe, expect, it, mock } from "bun:test";
import { Result } from "@/result.js";
import { UNIT } from "@/unit.js";

/**
 * Comprehensive Result<T, E> Test Suite
 *
 * Based on docs/result-spec.md specification.
 * Tests are organized by spec section for exhaustive coverage.
 */

// ============================================================================
// SECTION 1: CONSTRUCTORS
// ============================================================================

describe("Constructors", () => {
  describe("Result.Ok()", () => {
    it("should create Ok containing the value", () => {
      const result = Result.Ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should work with various data types", () => {
      expect(Result.Ok("hello").unwrap()).toBe("hello");
      expect(Result.Ok(true).unwrap()).toBe(true);
      expect(Result.Ok([1, 2, 3]).unwrap()).toEqual([1, 2, 3]);
      expect(Result.Ok({ a: 1 }).unwrap()).toEqual({ a: 1 });
    });

    it("should allow Error as value in Ok (error as data)", () => {
      const err = new Error("test");
      const result = Result.Ok(err);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(err);
    });
  });

  describe("Result.Err()", () => {
    it("should create Err containing the error", () => {
      const result = Result.Err("error message");
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error message");
    });

    it("should work with Error objects", () => {
      const err = new Error("something went wrong");
      const result = Result.Err(err);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(err);
    });

    it("should allow null as error value", () => {
      const result = Result.Err(null);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(null);
    });
  });

  describe("Result.fromNullable()", () => {
    it("should return Ok for non-nullish values", () => {
      expect(Result.fromNullable("value", "error").isOk()).toBe(true);
      expect(Result.fromNullable(0, "error").isOk()).toBe(true);
      expect(Result.fromNullable("", "error").isOk()).toBe(true);
      expect(Result.fromNullable(false, "error").isOk()).toBe(true);
    });

    it("should return Err for null", () => {
      const result = Result.fromNullable(null, "not found");
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("not found");
    });

    it("should return Err for undefined", () => {
      const result = Result.fromNullable(undefined, "not found");
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("not found");
    });
  });

  describe("Result.fromPredicate()", () => {
    it("should return Ok if predicate passes", () => {
      const result = Result.fromPredicate(21, (x) => x >= 18, "must be adult");
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(21);
    });

    it("should return Err if predicate fails", () => {
      const result = Result.fromPredicate(15, (x) => x >= 18, "must be adult");
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("must be adult");
    });
  });

  describe("Result.fromPromise()", () => {
    it("should wrap Promise<Result<T, E>> as Result<Promise<T>, E>", async () => {
      const asyncResult = Result.fromPromise(Promise.resolve(Result.Ok(42)));
      expect(asyncResult.isOk()).toBe(true);

      const resolved = await asyncResult.toPromise();
      expect(resolved.unwrap()).toBe(42);
    });

    it("should properly handle Promise<Err>", async () => {
      const asyncResult = Result.fromPromise(
        Promise.resolve(Result.Err("failed")),
      );
      const resolved = await asyncResult.toPromise();
      expect(resolved.isErr()).toBe(true);
      expect(resolved.unwrapErr()).toBe("failed");
    });
  });

  describe("Result.tryCatch()", () => {
    it("should return Ok when function succeeds", () => {
      const result = Result.tryCatch(() => JSON.parse('{"a": 1}'));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ a: 1 });
    });

    it("should return Err when function throws", () => {
      const result = Result.tryCatch(
        () => JSON.parse("invalid json"),
        (e: unknown) => `Parse error: ${e}`,
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toMatch(/Parse error/);
    });

    it("should use default error mapper if not provided", () => {
      const result = Result.tryCatch(() => {
        throw new Error("test error");
      });
      expect(result.isErr()).toBe(true);
    });
  });

  describe("Result.tryAsyncCatch()", () => {
    it("should return Ok when async function succeeds", async () => {
      const result = Result.tryAsyncCatch(async () => 42);
      const resolved = await result.toPromise();
      expect(resolved.isOk()).toBe(true);
      expect(resolved.unwrap()).toBe(42);
    });

    it("should return Err when async function rejects", async () => {
      const result = Result.tryAsyncCatch(
        async () => {
          throw new Error("async error");
        },
        (e: unknown) => `Caught: ${e}`,
      );
      const resolved = await result.toPromise();
      expect(resolved.isErr()).toBe(true);
      expect(resolved.unwrapErr()).toMatch(/Caught/);
    });
  });

  describe("Result.UNIT_RESULT", () => {
    it("should be a singleton", () => {
      expect(Result.UNIT_RESULT).toBe(Result.UNIT_RESULT);
    });

    it("should be an Ok with UNIT value", () => {
      expect(Result.UNIT_RESULT.isOk()).toBe(true);
      expect(Result.UNIT_RESULT.unwrap()).toBe(UNIT);
    });
  });
});

// ============================================================================
// SECTION 2: STATE INSPECTION
// ============================================================================

describe("State Inspection", () => {
  describe("isOk()", () => {
    it("should return true for Ok", () => {
      expect(Result.Ok(42).isOk()).toBe(true);
    });

    it("should return false for Err", () => {
      expect(Result.Err("error").isOk()).toBe(false);
    });

    it("should act as type guard", () => {
      const result: Result<number, string> = Result.Ok(42);
      if (result.isOk()) {
        expect(result.unwrap()).toBe(42);
      }
    });
  });

  describe("isErr()", () => {
    it("should return false for Ok", () => {
      expect(Result.Ok(42).isErr()).toBe(false);
    });

    it("should return true for Err", () => {
      expect(Result.Err("error").isErr()).toBe(true);
    });
  });

  describe("isUnit()", () => {
    it("should return true for UNIT_RESULT", () => {
      expect(Result.UNIT_RESULT.isUnit()).toBe(true);
    });

    it("should return false for other values", () => {
      expect(Result.Ok(42).isUnit()).toBe(false);
      expect(Result.Err("error").isUnit()).toBe(false);
    });
  });
});

// ============================================================================
// SECTION 3: VALUE EXTRACTION
// ============================================================================

describe("Value Extraction", () => {
  describe("unwrap()", () => {
    it("should return value for Ok", () => {
      expect(Result.Ok(42).unwrap()).toBe(42);
    });

    it("should throw for Err", () => {
      expect(() => Result.Err("error").unwrap()).toThrow();
    });

    it("should re-throw Error instances from Err", () => {
      const err = new Error("original error");
      expect(() => Result.Err(err).unwrap()).toThrow(err);
    });
  });

  describe("unwrapOr()", () => {
    it("should return value for Ok", () => {
      expect(Result.Ok(42).unwrapOr(0)).toBe(42);
    });

    it("should return default for Err", () => {
      const result: Result<number, string> = Result.Err("error");
      expect(result.unwrapOr(0)).toBe(0);
    });
  });

  describe("unwrapOrElse()", () => {
    it("should return value for Ok (factory not called)", () => {
      const factory = mock((_e: string) => 999);
      const result: Result<number, string> = Result.Ok(42);
      expect(result.unwrapOrElse(factory)).toBe(42);
      expect(factory).not.toHaveBeenCalled();
    });

    it("should call factory with error and return result for Err", () => {
      const factory = mock((e: string) => e.length);
      const result: Result<number, string> = Result.Err("error");
      expect(result.unwrapOrElse(factory)).toBe(5);
      expect(factory).toHaveBeenCalledWith("error");
    });
  });

  describe("unwrapErr()", () => {
    it("should return error for Err", () => {
      expect(Result.Err("error").unwrapErr()).toBe("error");
    });

    it("should throw for Ok", () => {
      expect(() => Result.Ok(42).unwrapErr()).toThrow();
    });
  });

  describe("safeUnwrap()", () => {
    it("should return value for Ok", () => {
      expect(Result.Ok(42).safeUnwrap()).toBe(42);
    });

    it("should return null for Err", () => {
      expect(Result.Err("error").safeUnwrap()).toBe(null);
    });
  });

  describe("match()", () => {
    it("should call Ok handler for Ok", () => {
      const result = Result.Ok(42).match({
        Ok: (v) => `Value: ${v}`,
        Err: (e) => `Error: ${e}`,
      });
      expect(result).toBe("Value: 42");
    });

    it("should call Err handler for Err", () => {
      const result: Result<number, string> = Result.Err("failed");
      const matched = result.match({
        Ok: (v) => `Value: ${v}`,
        Err: (e) => `Error: ${e}`,
      });
      expect(matched).toBe("Error: failed");
    });
  });
});

// ============================================================================
// SECTION 4: TRANSFORMATION METHODS (OK TRACK)
// ============================================================================

describe("Transformation Methods (Ok Track)", () => {
  describe("map()", () => {
    it("should transform value for Ok", () => {
      const result = Result.Ok(5).map((x) => x * 2);
      expect(result.unwrap()).toBe(10);
    });

    it("should return Err for Err (mapper not called)", () => {
      const mapper = mock((x: number) => x * 2);
      const result: Result<number, string> = Result.Err("error");
      const mapped = result.map(mapper);
      expect(mapped.isErr()).toBe(true);
      expect(mapper).not.toHaveBeenCalled();
    });

    it("should handle async mapper", async () => {
      const result = Result.Ok(5).map(async (x) => x * 2);
      const resolved = await result.toPromise();
      expect(resolved.unwrap()).toBe(10);
    });
  });

  describe("flatMap()", () => {
    it("should chain Result-returning functions", () => {
      const result = Result.Ok(5).flatMap((x) => Result.Ok(x + 1));
      expect(result.unwrap()).toBe(6);
    });

    it("should return Err if mapper returns Err", () => {
      const result = Result.Ok(5).flatMap(() => Result.Err("failed"));
      expect(result.isErr()).toBe(true);
    });

    it("should not call mapper for Err", () => {
      const mapper = mock((x: number) => Result.Ok(x));
      const result: Result<number, string> = Result.Err("error");
      result.flatMap(mapper);
      expect(mapper).not.toHaveBeenCalled();
    });

    it("should unify error types", () => {
      type E1 = { type: "e1" };
      type E2 = { type: "e2" };
      const r1: Result<number, E1> = Result.Ok(5);
      const r2 = r1.flatMap((x) => Result.Ok(x) as Result<number, E2>);
      // Type should be Result<number, E1 | E2>
      expect(r2.isOk()).toBe(true);
    });
  });

  describe("zip()", () => {
    it("should pair original with derived value", () => {
      const result = Result.Ok(5).zip((x) => x * 2);
      expect(result.unwrap()).toEqual([5, 10]);
    });

    it("should return Err for Err", () => {
      const result: Result<number, string> = Result.Err("error");
      expect(result.zip((x) => x * 2).isErr()).toBe(true);
    });
  });

  describe("flatZip()", () => {
    it("should pair original with value from another Result", () => {
      const result = Result.Ok(5).flatZip((x) => Result.Ok(x * 2));
      expect(result.unwrap()).toEqual([5, 10]);
    });

    it("should return Err if mapper returns Err", () => {
      const result = Result.Ok(5).flatZip(() => Result.Err("fail"));
      expect(result.isErr()).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 5: TRANSFORMATION METHODS (ERR TRACK)
// ============================================================================

describe("Transformation Methods (Err Track)", () => {
  describe("mapErr()", () => {
    it("should transform error for Err", () => {
      const result: Result<number, string> = Result.Err("error");
      const mapped = result.mapErr((e) => e.toUpperCase());
      expect(mapped.unwrapErr()).toBe("ERROR");
    });

    it("should not call mapper for Ok", () => {
      const mapper = mock((e: string) => e.toUpperCase());
      Result.Ok(42).mapErr(mapper);
      expect(mapper).not.toHaveBeenCalled();
    });
  });

  describe("mapBoth()", () => {
    it("should apply Ok mapper for Ok", () => {
      const result = Result.Ok(42).mapBoth(
        (v) => `Value: ${v}`,
        (e) => `Error: ${e}`,
      );
      expect(result.unwrap()).toBe("Value: 42");
    });

    it("should apply Err mapper for Err", () => {
      const result: Result<number, string> = Result.Err("error");
      const mapped = result.mapBoth(
        (v) => `Value: ${v}`,
        (e) => `Error: ${e}`,
      );
      expect(mapped.unwrapErr()).toBe("Error: error");
    });
  });

  describe("orElse()", () => {
    it("should not call recovery for Ok", () => {
      const recovery = mock(() => Result.Ok(999));
      const result: Result<number, string> = Result.Ok(42);
      const recovered = result.orElse(recovery);
      expect(recovered.unwrap()).toBe(42);
      expect(recovery).not.toHaveBeenCalled();
    });

    it("should call recovery for Err", () => {
      const result: Result<number, string> = Result.Err("error");
      const recovered = result.orElse((e) => Result.Ok(e.length));
      expect(recovered.unwrap()).toBe(5);
    });

    it("should allow recovery to return different error type", () => {
      const result: Result<number, string> = Result.Err("error");
      const recovered = result.orElse(() =>
        Result.Err({ code: 500 } as { code: number }),
      );
      expect(recovered.isErr()).toBe(true);
    });
  });

  describe("zipErr()", () => {
    it("should combine errors", () => {
      const result = Result.Ok(42).zipErr(() => Result.Err("validation error"));
      expect(result.isErr()).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 6: VALIDATION
// ============================================================================

describe("Validation", () => {
  describe("validate()", () => {
    it("should return Ok if all validators pass", () => {
      const validators = [
        (x: number) =>
          x > 0 ? Result.Ok(true) : Result.Err("must be positive"),
        (x: number) =>
          x < 100 ? Result.Ok(true) : Result.Err("must be less than 100"),
      ];
      const result = Result.Ok(42).validate(validators);
      expect(result.isOk()).toBe(true);
    });

    it("should collect all errors", () => {
      const validators = [
        (x: number) =>
          x > 0 ? Result.Ok(true) : Result.Err("must be positive"),
        (x: number) =>
          x % 2 === 0 ? Result.Ok(true) : Result.Err("must be even"),
      ];
      const result = Result.Ok(-5).validate(validators);
      expect(result.isErr()).toBe(true);
      // Should have multiple errors
    });

    it("should not call validators on Err", () => {
      const validator = mock((_x: number) => Result.Ok(true));
      const result: Result<number, string> = Result.Err("initial error");
      result.validate([validator]);
      expect(validator).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// SECTION 7: AGGREGATION
// ============================================================================

describe("Aggregation", () => {
  describe("Result.all()", () => {
    it("should combine all Ok into Ok array", () => {
      const result = Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([1, 2, 3]);
    });

    it("should collect all Err errors", () => {
      const result = Result.all(Result.Ok(1), Result.Err("a"), Result.Err("b"));
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toEqual(["a", "b"]);
    });

    it("should return Ok([]) for empty (vacuous truth)", () => {
      const result = Result.all();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
    });
  });

  describe("Result.any()", () => {
    it("should return first Ok", () => {
      const result = Result.any(Result.Err("a"), Result.Ok(2), Result.Ok(3));
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(2);
    });

    it("should collect all errors if no Ok", () => {
      const result = Result.any(
        Result.Err("a"),
        Result.Err("b"),
        Result.Err("c"),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toEqual(["a", "b", "c"]);
    });

    it("should return Err([]) for empty", () => {
      const result = Result.any();
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toEqual([]);
    });
  });
});

// ============================================================================
// SECTION 8: UTILITY METHODS
// ============================================================================

describe("Utility Methods", () => {
  describe("tap()", () => {
    it("should execute side effect for Ok and return self", () => {
      const sideEffect = mock((x: number) => console.log(x));
      const result = Result.Ok(42);
      const tapped = result.tap(sideEffect);
      expect(sideEffect).toHaveBeenCalledWith(42);
      expect(tapped).toBe(result);
    });

    it("should not execute side effect for Err", () => {
      const sideEffect = mock((x: number) => console.log(x));
      const result: Result<number, string> = Result.Err("error");
      result.tap(sideEffect);
      expect(sideEffect).not.toHaveBeenCalled();
    });
  });

  describe("tapErr()", () => {
    it("should execute side effect for Err and return self", () => {
      const sideEffect = mock((e: string) => console.error(e));
      const result: Result<number, string> = Result.Err("error");
      const tapped = result.tapErr(sideEffect);
      expect(sideEffect).toHaveBeenCalledWith("error");
      expect(tapped).toBe(result);
    });

    it("should not execute side effect for Ok", () => {
      const sideEffect = mock((e: string) => console.error(e));
      Result.Ok(42).tapErr(sideEffect);
      expect(sideEffect).not.toHaveBeenCalled();
    });
  });

  describe("flip()", () => {
    it("should convert Ok to Err", () => {
      const result = Result.Ok(42).flip();
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(42);
    });

    it("should convert Err to Ok", () => {
      const result = Result.Err("error").flip();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("error");
    });
  });

  describe("toOption()", () => {
    it("should convert Ok to Some", () => {
      const opt = Result.Ok(42).toOption();
      expect(opt.isSome()).toBe(true);
      expect(opt.unwrap()).toBe(42);
    });

    it("should convert Err to None", () => {
      const result: Result<number, string> = Result.Err("error");
      const opt = result.toOption();
      expect(opt.isNone()).toBe(true);
    });
  });

  describe("toPromise()", () => {
    it("should resolve inner Promise for Ok", async () => {
      const result = Result.Ok(Promise.resolve(42));
      const resolved = await result.toPromise();
      expect(resolved.isOk()).toBe(true);
      expect(resolved.unwrap()).toBe(42);
    });

    it("should wrap sync Result in resolved Promise", async () => {
      const resolved = await Result.Ok(42).toPromise();
      expect(resolved.unwrap()).toBe(42);
    });
  });

  describe("innerMap()", () => {
    it("should map over array elements for Ok", () => {
      const result = Result.Ok([1, 2, 3]).innerMap((x) => x * 2);
      expect(result.unwrap()).toEqual([2, 4, 6]);
    });

    it("should return Err for Err", () => {
      const result: Result<number[], string> = Result.Err("error");
      expect(result.innerMap((x) => x * 2).isErr()).toBe(true);
    });
  });

  describe("toString()", () => {
    it('should return "Ok(value)" for Ok', () => {
      expect(Result.Ok(42).toString()).toMatch(/Ok.*42/);
    });

    it('should return "Err(error)" for Err', () => {
      expect(Result.Err("error").toString()).toMatch(/Err.*error/);
    });
  });
});

// ============================================================================
// SECTION 9: ASYNC HANDLING
// ============================================================================

describe("Async Handling", () => {
  describe("Promise Infection Rules", () => {
    it("Result<T, E> + sync mapper → Result<U, E>", () => {
      const result = Result.Ok(5).map((x) => x * 2);
      expect(result.unwrap()).toBe(10);
    });

    it("Result<T, E> + async mapper → Result<Promise<U>, E>", async () => {
      const result = Result.Ok(5).map(async (x) => x * 2);
      const resolved = await result.toPromise();
      expect(resolved.unwrap()).toBe(10);
    });

    it("Result<Promise<T>, E> + sync mapper → Result<Promise<U>, E>", async () => {
      const result = Result.Ok(Promise.resolve(5)).map((x) => x * 2);
      const resolved = await result.toPromise();
      expect(resolved.unwrap()).toBe(10);
    });
  });

  describe("Err Short-Circuit with Async", () => {
    it("Err with async mapper should not create async work", () => {
      const mapper = mock(async (x: number) => x * 2);
      const result: Result<number, string> = Result.Err("error");
      result.map(mapper);
      expect(mapper).not.toHaveBeenCalled();
    });
  });

  describe("Interleaved Sync/Async Chains", () => {
    it("should handle mixed sync/async chain", async () => {
      const result = await Result.Ok(5)
        .map((x) => x * 2)
        .map(async (x) => x.toString())
        .map((s) => s.toUpperCase())
        .toPromise();

      expect(result.unwrap()).toBe("10");
    });

    it("should propagate Err through mixed chain", async () => {
      const result = await (Result.Err("error") as Result<number, string>)
        .map((x) => x * 2)
        .map(async (x) => x.toString())
        .toPromise();

      expect(result.isErr()).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 10: EDGE CASES & INVARIANTS
// ============================================================================

describe("Edge Cases & Invariants", () => {
  describe("Monad Laws", () => {
    it("Identity preservation: result.map(x => x) ≡ result", () => {
      const result = Result.Ok(42);
      const mapped = result.map((x) => x);
      expect(mapped.unwrap()).toBe(result.unwrap());
    });

    it("Composition: result.map(f).map(g) ≡ result.map(x => g(f(x)))", () => {
      const f = (x: number) => x * 2;
      const g = (x: number) => x + 1;
      const result = Result.Ok(5);

      const chained = result.map(f).map(g).unwrap();
      const composed = result.map((x) => g(f(x))).unwrap();

      expect(chained).toBe(composed);
    });

    it("flatMap left identity: Ok(x).flatMap(f) ≡ f(x)", () => {
      const f = (x: number) => Result.Ok(x * 2);
      const x = 5;

      expect(Result.Ok(x).flatMap(f).unwrap()).toBe(f(x).unwrap());
    });

    it("flatMap right identity: result.flatMap(Ok) ≡ result", () => {
      const result = Result.Ok(42);
      expect(result.flatMap(Result.Ok).unwrap()).toBe(result.unwrap());
    });
  });

  describe("Edge Cases from Spec Table", () => {
    it("Error in Ok is valid", () => {
      const err = new Error("test");
      const result = Result.Ok(err);
      expect(result.isOk()).toBe(true);
    });

    it("null in Err is valid", () => {
      const result = Result.Err(null);
      expect(result.isErr()).toBe(true);
    });

    it("Nested Result is not auto-flattened", () => {
      const inner = Result.Ok(5);
      const outer = Result.Ok(inner);
      expect(outer.unwrap()).toBe(inner);
    });
  });
});

// ============================================================================
// SECTION 11: FLUENT API - COMPLEX MIXED OPERATION CHAINS
// ============================================================================

describe("Fluent API - Complex Mixed Operation Chains", () => {
  describe("map → flatMap → zip chains", () => {
    it("sync map → sync flatMap → sync zip", () => {
      const result = Result.Ok(5)
        .map((x) => x * 2)
        .flatMap((x) => Result.Ok(x + 1))
        .zip((x) => x * 2);

      expect(result.unwrap()).toEqual([11, 22]);
    });

    it("async map → sync flatMap → async zip", async () => {
      const result = await Result.Ok(5)
        .map(async (x) => x * 2)
        .flatMap((x) => Result.Ok(x + 1))
        .zip(async (x) => x * 2)
        .toPromise();

      expect(result.unwrap()).toEqual([11, 22]);
    });
  });

  describe("Error recovery patterns", () => {
    it("orElse chain for fallback", () => {
      const result = (Result.Err("first") as Result<number, string>)
        .orElse(() => Result.Err("second") as Result<number, string>)
        .orElse(() => Result.Ok(42));

      expect(result.unwrap()).toBe(42);
    });
  });

  describe("Err propagation in chains", () => {
    it("Err should propagate through map chain", async () => {
      const okMapper = mock((x: number) => x * 2);
      const errMapper = mock((e: string) => e.toUpperCase());

      const result = await (Result.Err("error") as Result<number, string>)
        .map(okMapper)
        .map(async (x) => x + 1)
        .mapErr(errMapper)
        .toPromise();

      expect(result.isErr()).toBe(true);
      expect(okMapper).not.toHaveBeenCalled();
      expect(errMapper).toHaveBeenCalledWith("error");
    });
  });

  describe("Real-world pipeline scenarios", () => {
    interface User {
      id: number;
      name: string;
    }

    const fetchUser = async (id: number): Promise<User | null> => {
      if (id === 1) return { id: 1, name: "Alice" };
      return null;
    };

    it("should handle user fetch pipeline", async () => {
      const result = await Result.Ok(1)
        .map(async (id) => fetchUser(id))
        .flatMap((user) => Result.fromNullable(user, "User not found"))
        .map((user) => user.name)
        .toPromise();

      expect(result.unwrap()).toBe("Alice");
    });

    it("should handle missing user", async () => {
      const result = await Result.Ok(999)
        .map(async (id) => fetchUser(id))
        .flatMap((user) => Result.fromNullable(user, "User not found"))
        .map((user) => user.name)
        .toPromise();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("User not found");
    });
  });
});

// ============================================================================
// SECTION 12: BRANCHING (IMMUTABILITY)
// ============================================================================

describe("Branching and Immutability", () => {
  it("multiple branches from same Result should be independent", () => {
    const original = Result.Ok(2);
    const branch1 = original.map((x) => x * 2);
    const branch2 = original.map((x) => x * 3);
    const branch3 = original.flatMap(() => Result.Err("err"));

    expect(original.unwrap()).toBe(2);
    expect(branch1.unwrap()).toBe(4);
    expect(branch2.unwrap()).toBe(6);
    expect(branch3.isErr()).toBe(true);
  });

  it("async branches should be independent", async () => {
    const original = Result.Ok(2);
    const branch1 = await original.map(async (x) => x * 2).toPromise();
    const branch2 = await original.map(async (x) => x * 3).toPromise();

    expect(original.unwrap()).toBe(2);
    expect(branch1.unwrap()).toBe(4);
    expect(branch2.unwrap()).toBe(6);
  });
});

// ============================================================================
// SECTION 12: _TAG DISCRIMINANT (Spec Compliance)
// ============================================================================

describe("_tag Discriminant", () => {
  it("should have _tag 'Ok' for Ok result", () => {
    const result = Result.Ok(42);
    expect(result._tag).toBe("Ok");
  });

  it("should have _tag 'Err' for Err result", () => {
    const result = Result.Err("error");
    expect(result._tag).toBe("Err");
  });

  it("should enable pattern matching via _tag", () => {
    const result: Result<number, string> = Result.Ok(42);

    // TypeScript should narrow based on _tag
    if (result._tag === "Ok") {
      expect(result.unwrap()).toBe(42);
    } else {
      // Should not reach here
      expect(true).toBe(false);
    }
  });

  it("_tag should be 'Ok' even for falsy values", () => {
    expect(Result.Ok(0)._tag).toBe("Ok");
    expect(Result.Ok("")._tag).toBe("Ok");
    expect(Result.Ok(false)._tag).toBe("Ok");
    expect(Result.Ok(null)._tag).toBe("Ok");
  });
});

// ============================================================================
// SECTION 13: ASYNC-AWARE EXTRACTION METHODS
// ============================================================================

describe("Async-Aware Extraction Methods", () => {
  describe("unwrapOr with async Result", () => {
    it("should return Promise resolving to value for Ok", async () => {
      const result = Result.Ok(Promise.resolve(42));
      const value = await result.unwrapOr(0);
      expect(value).toBe(42);
    });

    it("should return Promise resolving to default for Err that became async", async () => {
      const result = Result.Ok(5)
        .map(async (x) => x * 2)
        .flatMap(() => Result.Err("failed") as Result<number, string>);

      const resolved = await result.toPromise();
      const value = resolved.unwrapOr(999);
      expect(value).toBe(999);
    });
  });

  describe("unwrapOrElse with async Result", () => {
    it("should return Promise resolving to value for Ok", async () => {
      const result = Result.Ok(Promise.resolve(42));
      const value = await result.unwrapOrElse(() => 0);
      expect(value).toBe(42);
    });

    it("should call factory with error for Err", async () => {
      const result = Result.Ok(5)
        .map(async (x) => x * 2)
        .flatMap(() => Result.Err("oops") as Result<number, string>);

      const resolved = await result.toPromise();
      const factory = mock((_e: string) => 999);
      const value = resolved.unwrapOrElse(factory);
      expect(value).toBe(999);
      expect(factory).toHaveBeenCalledWith("oops");
    });
  });

  describe("safeUnwrap with async Result", () => {
    it("should return Promise resolving to value for Ok", async () => {
      const result = Result.Ok(Promise.resolve(42));
      const value = await result.safeUnwrap();
      expect(value).toBe(42);
    });

    it("should return Promise resolving to null for Err", async () => {
      const result: Result<Promise<number>, string> = Result.Err("error");
      const value = await result.safeUnwrap();
      expect(value).toBe(null);
    });
  });

  describe("tap with async Result", () => {
    it("should receive resolved value", async () => {
      const sideEffect = mock((_x: number) => {});
      const result = await Result.Ok(Promise.resolve(42))
        .tap(sideEffect)
        .toPromise();

      expect(sideEffect).toHaveBeenCalledWith(42);
      expect(result.unwrap()).toBe(42);
    });

    it("should not call tap for Err", async () => {
      const sideEffect = mock((_x: number) => {});
      const result: Result<Promise<number>, string> = Result.Err("error");

      result.tap(sideEffect);
      expect(sideEffect).not.toHaveBeenCalled();
    });

    it("tap should work in fluent chain with async", async () => {
      const taps: number[] = [];

      const result = await Result.Ok(5)
        .map(async (x) => x * 2)
        .tap((x) => taps.push(x))
        .map((x) => x + 1)
        .tap((x) => taps.push(x))
        .toPromise();

      expect(result.unwrap()).toBe(11);
      expect(taps).toEqual([10, 11]);
    });
  });
});
