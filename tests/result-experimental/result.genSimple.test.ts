/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { ExperimentalResult as Result } from "@/result-experimental.js";

describe("Result.gen", () => {
  describe("basic functionality", () => {
    it("should unwrap a single Ok value", () => {
      const result = Result.gen(function* () {
        const value = yield* Result.Ok(42);
        return value;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should unwrap multiple Ok values in sequence", () => {
      const result = Result.gen(function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        const c = yield* Result.Ok(3);
        return a + b + c;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should work with no yields", () => {
      const result = Result.gen(function* () {
        return 42;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should short-circuit on first Err", () => {
      let reachedAfterErr = false;

      const result = Result.gen(function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Err<string, "error">("error");
        reachedAfterErr = true;
        const c = yield* Result.Ok(3);
        return a + b + c;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
      expect(reachedAfterErr).toBe(false);
    });

    it("should track intermediate variables", () => {
      const result = Result.gen(function* () {
        const a = yield* Result.Ok(10);
        const b = yield* Result.Ok(5);
        return a + b + a;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(25);
    });
  });

  describe("type inference", () => {
    it("should infer return type correctly", () => {
      const result = Result.gen(function* () {
        const a = yield* Result.Ok(42);
        return a.toString();
      });

      expectTypeOf(result).toEqualTypeOf<Result<string, never>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("42");
    });

    it("should infer number return type", () => {
      const result = Result.gen(function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        return a + b;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
      expect(result.unwrap()).toBe(3);
    });

    it("should infer complex return types", () => {
      type User = { name: string; age: number };

      const result = Result.gen(function* () {
        const name = yield* Result.Ok("Alice");
        const age = yield* Result.Ok(30);
        return { name, age } as User;
      });

      expectTypeOf(result).toEqualTypeOf<Result<User, never>>();
      expect(result.unwrap()).toEqual({ name: "Alice", age: 30 });
    });
  });

  describe("real-world scenarios", () => {
    it("should handle validation flow", () => {
      const validatePositive = (n: number): Result<number, "not_positive"> =>
        n > 0 ? Result.Ok(n) : Result.Err("not_positive");

      const validateEven = (n: number): Result<number, "not_even"> =>
        n % 2 === 0 ? Result.Ok(n) : Result.Err("not_even");

      const result = Result.gen(function* () {
        const input = yield* Result.Ok(4);
        const positive = yield* validatePositive(input);
        const even = yield* validateEven(positive);
        return even * 2;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should fail validation on positive check", () => {
      const validatePositive = (n: number): Result<number, "not_positive"> =>
        n > 0 ? Result.Ok(n) : Result.Err("not_positive");

      const result = Result.gen(function* () {
        const input = yield* Result.Ok(-2);
        const positive = yield* validatePositive(input);
        return positive;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("not_positive");
    });

    it("should work with function calls in yield", () => {
      const fetchValue = (n: number): Result<number, "fetch_error"> =>
        Result.Ok(n * 2);

      const result = Result.gen(function* () {
        const a = yield* Result.Ok(5);
        const b = yield* fetchValue(a);
        const c = yield* fetchValue(b);
        return c;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(20);
    });

    it("should not execute functions after error", () => {
      const mockFn = mock(() => Result.Ok(10));

      const result = Result.gen(function* () {
        const a = yield* Result.Err<string, "error">("error");
        const b = yield* mockFn();
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle many yields without stack overflow", () => {
      const result = Result.gen(function* () {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          const value = yield* Result.Ok(i);
          sum += value;
        }
        return sum;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(4950);
    });

    it("should work with array operations", () => {
      const result = Result.gen(function* () {
        const nums = yield* Result.Ok([1, 2, 3]);
        const doubled = nums.map((n) => n * 2);
        return doubled;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([2, 4, 6]);
    });

    it("should handle zero Ok values", () => {
      const result = Result.gen(function* () {
        const value = yield* Result.Ok(0);
        return value;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(0);
    });
  });

  describe("comparison with flatMap", () => {
    it("should be equivalent to flatMap chain", () => {
      const genResult = Result.gen(function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        return a + b;
      });

      const flatMapResult = Result.Ok(1).flatMap((a) =>
        Result.Ok(2).map((b) => a + b),
      );

      expect(genResult.isOk()).toBe(true);
      expect(flatMapResult.isOk()).toBe(true);
      expect(genResult.unwrap()).toBe(flatMapResult.unwrap());
    });
  });
});
