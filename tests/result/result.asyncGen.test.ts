/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Result } from "@/result.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Result.asyncGen", () => {
  describe("basic functionality", () => {
    it("should unwrap a single Ok value", async () => {
      const result = await Result.asyncGen(async function* () {
        const value = yield* Result.Ok(42);
        return value;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should unwrap multiple Ok values in sequence", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        const c = yield* Result.Ok(3);
        return a + b + c;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should work with no yields", async () => {
      const result = await Result.asyncGen(async function* () {
        return 42;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should short-circuit on first Err", async () => {
      let reachedAfterErr = false;

      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Err<string, number>("error");
        reachedAfterErr = true;
        const c = yield* Result.Ok(3);
        return a + b + c;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
      expect(reachedAfterErr).toBe(false);
    });

    it("should track intermediate variables", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(10);
        const b = yield* Result.Ok(5);
        return a + b + a;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(25);
    });
  });

  describe("async operations with await", () => {
    it("should handle awaited Promise<Result<T, E>> yields", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* await Promise.resolve(Result.Ok(1));
        const b = yield* await Promise.resolve(Result.Ok(2));
        return a + b;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should handle mixed sync Result and awaited Promise<Result>", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* await Promise.resolve(Result.Ok(2));
        const c = yield* Result.Ok(3);
        return a + b + c;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should short-circuit on awaited Promise<Err>", async () => {
      let reachedAfterErr = false;

      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* await Promise.resolve(
          Result.Err("error") as Result<number, string>,
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
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        await delay(10);
        const b = yield* Result.Ok(2);
        await delay(10);
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

      const result = await Result.asyncGen(async function* () {
        const a = yield* await fetchValue(5);
        const b = yield* await fetchValue(3);
        return a + b;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(16);
    });

    it("should short-circuit on delayed Err", async () => {
      const fetchErr = async (): Promise<Result<number, string>> => {
        await delay(10);
        return Result.Err("network_error");
      };

      let reachedAfterErr = false;

      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* await fetchErr();
        reachedAfterErr = true;
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("network_error");
      expect(reachedAfterErr).toBe(false);
    });
  });

  describe("type inference", () => {
    it("should infer return type correctly", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(42);
        return a.toString();
      });

      expectTypeOf(result).toEqualTypeOf<Result<string, never>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("42");
    });

    it("should infer number return type", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        return a + b;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
      expect(result.unwrap()).toBe(3);
    });

    it("should infer complex object return type", async () => {
      type User = { name: string; age: number };

      const result = await Result.asyncGen(async function* () {
        const name = yield* Result.Ok("Alice");
        const age = yield* Result.Ok(30);
        return { name, age } as User;
      });

      expectTypeOf(result).toEqualTypeOf<Result<User, never>>();
      expect(result.unwrap()).toEqual({ name: "Alice", age: 30 });
    });

    it("should infer array return type", async () => {
      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok(1);
        const b = yield* Result.Ok(2);
        return [a, b];
      });

      expectTypeOf(result).toEqualTypeOf<Result<number[], never>>();
      expect(result.unwrap()).toEqual([1, 2]);
    });
  });

  describe("sync Result with async map/flatMap", () => {
    it("should handle Result.Ok(x).map(asyncFunc)", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      const result = await Result.asyncGen(async function* () {
        const mapped = await Result.Ok(3).map(asyncDouble).toPromise();
        const value = yield* mapped;
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should handle Result.Ok(x).flatMap(asyncFunc)", async () => {
      const asyncValidate = async (
        n: number,
      ): Promise<Result<number, string>> => {
        await delay(5);
        return n > 0 ? Result.Ok(n * 2) : Result.Err("not_positive");
      };

      const result = await Result.asyncGen(async function* () {
        const mapped = await Result.Ok<number, string>(5)
          .flatMap(asyncValidate)
          .toPromise();
        const value = yield* mapped;
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

      const result = await Result.asyncGen(async function* () {
        const mapped = await Result.Ok<number, string>(-5)
          .flatMap(asyncValidate)
          .toPromise();
        const value = yield* mapped;
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

      const result = await Result.asyncGen(async function* () {
        const first = yield* Result.Ok<string, string>("hello");
        // first is just a string, so call async transform directly
        const transformed = await asyncTransform(first);
        const final = yield* Result.Ok(`${transformed}!`);
        return final;
      });

      expectTypeOf(result).toEqualTypeOf<Result<string, string>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("HELLO!");
    });
  });

  describe("Promise<Result<T, E>> with asyncGen", () => {
    it("should handle Promise<Result<T, E>> when explicitly awaited", async () => {
      const promiseFunc = (n: number): Promise<Result<number, string>> => {
        return Promise.resolve(Result.Ok(n * 2));
      };

      const result = await Result.asyncGen(async function* () {
        const value = yield* await promiseFunc(21);

        expectTypeOf(value).toEqualTypeOf<number>();
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should handle Promise<Result<T, E>> from map", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      const result = await Result.asyncGen(async function* () {
        // Use map which returns Promise<Result<number, never>>
        const value = yield* await Result.Ok(3).map(asyncDouble).toPromise();

        expectTypeOf(value).toEqualTypeOf<number>();
        return value + 10;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, never>>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(16); // 3 * 2 + 10
    });

    it("should handle mixed sync and async inner values", async () => {
      const syncResult = Result.Ok<number, "err1">(10);
      const asyncResult = await Result.Ok<number, "err2">(5)
        .map(async (n) => n * 3)
        .toPromise();

      const result = await Result.asyncGen(async function* () {
        const a = yield* syncResult;
        const b = yield* asyncResult;

        expectTypeOf(a).toEqualTypeOf<number>();
        expectTypeOf(b).toEqualTypeOf<number>();

        return a + b;
      });

      expectTypeOf(result).toEqualTypeOf<Result<number, "err1" | "err2">>();
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(25); // 10 + 15
    });

    it("should short-circuit on Err and not yield subsequent values", async () => {
      const mockFn = mock(async () => Result.Ok(10));

      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Err<"error", number>("error");
        const b = yield* await mockFn();

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
      ): Promise<Result<number, string>> => {
        await delay(5);
        return n > 0 ? Result.Ok(n) : Result.Err("not_positive");
      };

      const result = await Result.asyncGen(async function* () {
        const input = yield* Result.Ok<number, string>(4);
        const positive = yield* await validatePositive(input);
        return positive * 2;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should not execute functions after Err", async () => {
      const mockFn = mock(async () => Result.Ok(10));

      const result = await Result.asyncGen(async function* () {
        const a = yield* Result.Err("error") as Result<number, string>;
        const b = yield* await mockFn();
        return a + b;
      });

      expect(result.isErr()).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it("should handle user lookup scenario", async () => {
      type User = { id: string; name: string };
      type UserError = "not_found" | "permission_denied";

      const findUser = async (id: string): Promise<Result<User, UserError>> => {
        await delay(5);
        if (id === "123") {
          return Result.Ok({ id: "123", name: "Alice" });
        }
        return Result.Err("not_found");
      };

      const getPreference = async (
        user: User,
      ): Promise<Result<string, UserError>> => {
        await delay(5);
        return Result.Ok(`${user.name}'s preference`);
      };

      const result = await Result.asyncGen(async function* () {
        const user = yield* await findUser("123");
        const pref = yield* await getPreference(user);
        return pref;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("Alice's preference");
    });

    it("should handle user not found scenario", async () => {
      type User = { id: string; name: string };
      type UserError = "not_found" | "permission_denied";

      const findUser = async (id: string): Promise<Result<User, UserError>> => {
        await delay(5);
        if (id === "123") {
          return Result.Ok({ id: "123", name: "Alice" });
        }
        return Result.Err("not_found");
      };

      const getPreference = async (
        user: User,
      ): Promise<Result<string, UserError>> => {
        await delay(5);
        return Result.Ok(`${user.name}'s preference`);
      };

      const mockPref = mock(getPreference);

      const result = await Result.asyncGen(async function* () {
        const user = yield* await findUser("999");
        const pref = yield* await mockPref(user);
        return pref;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("not_found");
      expect(mockPref).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle many yields without stack overflow", async () => {
      const result = await Result.asyncGen(async function* () {
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

    it("should work with fromNullable returning Err", async () => {
      const result = await Result.asyncGen(async function* () {
        const value = yield* Result.fromNullable(null, "null_error");
        return value;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("null_error");
    });

    it("should work with fromNullable returning Ok", async () => {
      const result = await Result.asyncGen(async function* () {
        const value = yield* Result.fromNullable(42, "null_error");
        return value;
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should propagate promise rejections", async () => {
      const failingFetch = async (): Promise<Result<number, string>> => {
        throw new Error("Network error");
      };

      expect(
        Result.asyncGen(async function* () {
          const value = yield* await failingFetch();
          return value;
        }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("comparison with flatMap", () => {
    it("should be equivalent to async flatMap chain", async () => {
      const genResult = await Result.asyncGen(async function* () {
        const a = yield* Result.Ok<number, string>(1);
        const b = yield* await Promise.resolve(Result.Ok<number, string>(2));
        return a + b;
      });

      const flatMapResult = await Result.Ok<number, string>(1)
        .flatMap(async (a) => Result.Ok<number, string>(2).map((b) => a + b))
        .toPromise();

      expect(genResult.isOk()).toBe(true);
      expect(flatMapResult.isOk()).toBe(true);
      expect(genResult.unwrap()).toBe(flatMapResult.unwrap());
    });
  });
});
