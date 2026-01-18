/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Result } from "@/result.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Result.asyncGenAdapter", () => {
  describe("basic functionality", () => {
    it("should unwrap Ok values", async () => {
      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(Result.Ok(2));
        return a + b;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should short-circuit on Err", async () => {
      let reached = false;

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(Result.Err("error" as const));
        reached = true;
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
      expect(reached).toBe(false);
    });

    it("should work with no yields", async () => {
      const result = await Result.asyncGenAdapter(async function* (_$) {
        return 42;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });
  });

  describe("mixed sync/async yields", () => {
    it("should handle Promise<Result<T, E>> yields", async () => {
      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Promise.resolve(Result.Ok(1)));
        const b = yield* $(Promise.resolve(Result.Ok(2)));
        return a + b;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should handle mixed Result and Promise<Result> yields", async () => {
      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(Promise.resolve(Result.Ok(2)));
        const c = yield* $(Result.Ok(3));
        return a + b + c;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should short-circuit on Promise<Err>", async () => {
      let reachedAfterErr = false;

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(
          Promise.resolve(Result.Err("error") as Result<number, string>),
        );
        reachedAfterErr = true;
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
      expect(reachedAfterErr).toBe(false);
    });
  });

  describe("actual async behavior", () => {
    it("should handle async operations with delays", async () => {
      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        await delay(10);
        const b = yield* $(Result.Ok(2));
        return a + b;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should handle delayed Promise<Result> yields", async () => {
      const fetchValue = async (n: number): Promise<Result<number, string>> => {
        await delay(10);
        return Result.Ok(n * 2);
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(fetchValue(5));
        const b = yield* $(fetchValue(3));
        return a + b;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(16);
    });
  });

  describe("type inference", () => {
    it("should infer return type correctly", async () => {
      const r = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(42));
        return a.toString();
      });
      expectTypeOf(r).toEqualTypeOf<Result<string, never>>();
    });

    it("should infer error union type", async () => {
      type E1 = "error1";
      type E2 = "error2";

      const r = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok<number, E1>(1));
        const b = yield* $(Result.Ok<string, E2>("x"));
        return a + b.length;
      });

      expectTypeOf(r).toEqualTypeOf<Result<number, E1 | E2>>();
    });

    it("should infer never for error when all Ok", async () => {
      const r = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(Result.Ok(2));
        return a + b;
      });

      expectTypeOf(r).toEqualTypeOf<Result<number, never>>();
    });

    it("should preserve value types through yields", async () => {
      const r = await Result.asyncGenAdapter(async function* ($) {
        const num = yield* $(Result.Ok(42));
        const str = yield* $(Result.Ok("hello"));
        const obj = yield* $(Result.Ok({ x: 1 }));

        // These should all have correct types
        expectTypeOf(num).toBeNumber();
        expectTypeOf(str).toBeString();
        expectTypeOf(obj).toEqualTypeOf<{ x: number }>();

        return { num, str, obj };
      });

      expect(r.unwrap()).toEqual({ num: 42, str: "hello", obj: { x: 1 } });
    });

    it("should infer complex object return type", async () => {
      type User = { name: string; age: number };

      const r = await Result.asyncGenAdapter(async function* ($) {
        const name = yield* $(Result.Ok("Alice"));
        const age = yield* $(Result.Ok(30));
        return { name, age } as User;
      });

      expectTypeOf(r).toEqualTypeOf<Result<User, never>>();
      expect(r.unwrap()).toEqual({ name: "Alice", age: 30 });
    });

    it("should infer array return type", async () => {
      const r = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(Result.Ok(2));
        return [a, b];
      });

      expectTypeOf(r).toEqualTypeOf<Result<number[], never>>();
      expect(r.unwrap()).toEqual([1, 2]);
    });
  });

  describe("sync Result with async map/flatMap", () => {
    it("should handle Result.Ok(x).map(asyncFunc).toPromise() via adapter", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const mapped = Result.Ok<number, string>(3)
          .map(asyncDouble)
          .toPromise();
        const value = yield* $(mapped);
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should handle Result.Ok(x).flatMap(asyncFunc).toPromise() via adapter", async () => {
      const asyncValidate = async (
        n: number,
      ): Promise<Result<number, string>> => {
        await delay(5);
        return n > 0 ? Result.Ok(n * 2) : Result.Err("not_positive");
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const mapped = Result.Ok<number, string>(5)
          .flatMap(asyncValidate)
          .toPromise();
        const value = yield* $(mapped);
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(10);
    });

    it("should short-circuit when async flatMap returns Err", async () => {
      const asyncValidate = async (
        n: number,
      ): Promise<Result<number, string>> => {
        await delay(5);
        return n > 0 ? Result.Ok(n * 2) : Result.Err("not_positive");
      };

      let reachedAfterErr = false;

      const result = await Result.asyncGenAdapter(async function* ($) {
        const mapped = Result.Ok<number, string>(-5)
          .flatMap(asyncValidate)
          .toPromise();
        const value = yield* $(mapped);
        reachedAfterErr = true;
        return value + 100;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("not_positive");
      expect(reachedAfterErr).toBe(false);
    });

    it("should chain multiple sync Results with async operations", async () => {
      const asyncTransform = async (s: string): Promise<string> => {
        await delay(5);
        return s.toUpperCase();
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const first = yield* $(Result.Ok<string, string>("hello"));
        const transformed = yield* $(
          Result.Ok<string, string>(first).map(asyncTransform).toPromise(),
        );
        const final = yield* $(Result.Ok(`${transformed}!`));
        return final;
      });

      expectTypeOf(result).toEqualTypeOf<Result<string, string>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("HELLO!");
    });
  });

  describe("Result<Promise<T>, E> automatic awaiting", () => {
    it("should automatically await inner promise and return T not Promise<T>", async () => {
      const promiseFunc = (n: number): Result<Promise<number>, string> => {
        return Result.Ok(Promise.resolve(n * 2));
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const value = yield* $(promiseFunc(21));

        // value should be number, not Promise<number>
        expectTypeOf(value).toEqualTypeOf<number>();
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should handle Result.map returning Promise", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      // Result.Ok(3).map(asyncDouble) returns Result<Promise<number>, never>
      const resultWithPromise = Result.Ok(3).map(asyncDouble);

      const result = await Result.asyncGenAdapter(async function* ($) {
        // Yielding Result<Promise<number>, never> should give us number
        const value = yield* $(resultWithPromise);

        expectTypeOf(value).toEqualTypeOf<number>();
        return value + 10;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(16); // 3 * 2 + 10
    });

    it("should handle mixed sync and async inner values", async () => {
      const syncResult = Result.Ok<number, "err1">(10);
      const asyncResult = Result.Ok<number, "err2">(5).map(async (n) => n * 3);

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(syncResult);
        const b = yield* $(asyncResult);

        expectTypeOf(a).toEqualTypeOf<number>();
        expectTypeOf(b).toEqualTypeOf<number>();

        return a + b;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, "err1" | "err2">>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(25); // 10 + 15
    });

    it("should short-circuit on Err and not yield subsequent values", async () => {
      const mockFn = mock((n: number) => Result.Ok(n).map(async (x) => x * 2));

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Err<"error", number>("error"));
        const b = yield* $(mockFn(5));
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
      // mockFn should not be called because we short-circuit on Err
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe("real-world scenarios", () => {
    it("should handle async validation flow", async () => {
      const validatePositive = async (
        n: number,
      ): Promise<Result<number, "not_positive">> => {
        await delay(5);
        return n > 0 ? Result.Ok(n) : Result.Err("not_positive");
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const input = yield* $(Result.Ok<number, "not_positive">(4));
        const positive = yield* $(validatePositive(input));
        return positive * 2;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should handle chained async validation", async () => {
      const validatePositive = async (
        n: number,
      ): Promise<Result<number, "not_positive">> => {
        await delay(5);
        return n > 0 ? Result.Ok(n) : Result.Err("not_positive");
      };

      const validateEven = async (
        n: number,
      ): Promise<Result<number, "not_even">> => {
        await delay(5);
        return n % 2 === 0 ? Result.Ok(n) : Result.Err("not_even");
      };

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok<number, "not_positive" | "not_even">(4));
        const positive = yield* $(validatePositive(a));
        const even = yield* $(validateEven(positive));
        return even * 2;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should not execute functions after Err", async () => {
      const mockFn = mock(async () => Result.Ok(10));

      const result = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Err("error") as Result<number, string>);
        const b = yield* $(mockFn());
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it("should handle user registration scenario", async () => {
      type User = { id: string; email: string };
      type ValidationError = "invalid_email" | "weak_password";
      type DbError = "duplicate_email" | "connection_failed";

      const validateEmail = async (
        e: string,
      ): Promise<Result<string, "invalid_email">> => {
        await delay(5);
        return e.includes("@") ? Result.Ok(e) : Result.Err("invalid_email");
      };

      const validatePassword = async (
        p: string,
      ): Promise<Result<string, "weak_password">> => {
        await delay(5);
        return p.length >= 8 ? Result.Ok(p) : Result.Err("weak_password");
      };

      const createUser = async (
        email: string,
        _password: string,
      ): Promise<Result<User, DbError>> => {
        await delay(5);
        return Result.Ok({ id: "123", email });
      };

      const register = async (
        email: string,
        password: string,
      ): Promise<Result<User, ValidationError | DbError>> =>
        Result.asyncGenAdapter(async function* ($) {
          const validEmail = yield* $(validateEmail(email));
          const validPassword = yield* $(validatePassword(password));
          const user = yield* $(createUser(validEmail, validPassword));
          return user;
        });

      const success = await register("test@example.com", "securepassword");
      expect(success.isOk()).toBe(true);
      expect(success.unwrap()).toEqual({
        id: "123",
        email: "test@example.com",
      });

      const failure = await register("invalid", "short");
      expect(failure.isErr()).toBe(true);
      expect(failure.unwrapErr()).toBe("invalid_email");
    });
  });

  describe("edge cases", () => {
    it("should handle many yields without stack overflow", async () => {
      const result = await Result.asyncGenAdapter(async function* ($) {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          const value = yield* $(Result.Ok(i));
          sum += value;
        }
        return sum;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(4950);
    });

    it("should propagate promise rejections", async () => {
      const failingFetch = async (): Promise<Result<number, string>> => {
        throw new Error("Network error");
      };

      await expect(
        Result.asyncGenAdapter(async function* ($) {
          const value = yield* $(failingFetch());
          return value;
        }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("comparison with asyncGen", () => {
    it("should produce same result as asyncGen", async () => {
      const genResult = await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(1));
        const b = yield* $(Result.Ok(2));
        return a + b;
      });

      const genSimpleResult = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        return a + b;
      });

      expect(genResult.isOk()).toBe(true);
      expect(genSimpleResult.isOk()).toBe(true);
      expect(genResult.unwrap()).toBe(genSimpleResult.unwrap());
    });
  });
});
