/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Option } from "@/option.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Option.asyncGenAdapter", () => {
  describe("basic functionality", () => {
    it("should unwrap Some values", async () => {
      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Option.Some(2));
        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should short-circuit on None", async () => {
      let reached = false;

      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Option.None as Option<number>);
        reached = true;
        return a + b;
      });

      expect(result.isNone()).toBe(true);
      expect(reached).toBe(false);
    });

    it("should work with no yields", async () => {
      const result = await Option.asyncGenAdapter(async function* (_$) {
        return 42;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should return singleton None", async () => {
      const result1 = await Option.asyncGenAdapter(async function* ($) {
        yield* $(Option.None);
        return 1;
      });

      const result2 = await Option.asyncGenAdapter(async function* ($) {
        yield* $(Option.None);
        return 2;
      });

      expect(result1).toBe(Option.None);
      expect(result2).toBe(Option.None);
      expect(result1).toBe(result2);
    });
  });

  describe("mixed sync/async yields", () => {
    it("should handle Promise<Option<T>> yields", async () => {
      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Promise.resolve(Option.Some(1)));
        const b = yield* $(Promise.resolve(Option.Some(2)));
        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should handle mixed Option and Promise<Option> yields", async () => {
      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Promise.resolve(Option.Some(2)));
        const c = yield* $(Option.Some(3));
        return a + b + c;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should short-circuit on Promise<None>", async () => {
      let reachedAfterNone = false;

      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Promise.resolve(Option.None as Option<number>));
        reachedAfterNone = true;
        return a + b;
      });

      expect(result.isNone()).toBe(true);
      expect(reachedAfterNone).toBe(false);
    });
  });

  describe("actual async behavior", () => {
    it("should handle async operations with delays", async () => {
      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        await delay(10);
        const b = yield* $(Option.Some(2));
        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should handle delayed Promise<Option> yields", async () => {
      const fetchValue = async (n: number): Promise<Option<number>> => {
        await delay(10);
        return Option.Some(n * 2);
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(fetchValue(5));
        const b = yield* $(fetchValue(3));
        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(16);
    });
  });

  describe("type inference", () => {
    it("should infer return type correctly", async () => {
      const r = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(42));
        return a.toString();
      });
      expectTypeOf(r).toEqualTypeOf<Option<string>>();
    });

    it("should infer number return type", async () => {
      const r = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Option.Some(2));
        return a + b;
      });

      expectTypeOf(r).toEqualTypeOf<Option<number>>();
      expect(r.unwrap()).toBe(3);
    });

    it("should preserve value types through yields", async () => {
      const r = await Option.asyncGenAdapter(async function* ($) {
        const num = yield* $(Option.Some(42));
        const str = yield* $(Option.Some("hello"));
        const obj = yield* $(Option.Some({ x: 1 }));

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

      const r = await Option.asyncGenAdapter(async function* ($) {
        const name = yield* $(Option.Some("Alice"));
        const age = yield* $(Option.Some(30));
        return { name, age } as User;
      });

      expectTypeOf(r).toEqualTypeOf<Option<User>>();
      expect(r.unwrap()).toEqual({ name: "Alice", age: 30 });
    });

    it("should infer array return type", async () => {
      const r = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Option.Some(2));
        return [a, b];
      });

      expectTypeOf(r).toEqualTypeOf<Option<number[]>>();
      expect(r.unwrap()).toEqual([1, 2]);
    });
  });

  describe("sync Option with async map/flatMap", () => {
    it("should handle Option.Some(x).map(asyncFunc).toPromise() via adapter", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const mapped = Option.Some(3).map(asyncDouble).toPromise();
        const value = yield* $(mapped);
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should handle Option.Some(x).flatMap(asyncFunc).toPromise() via adapter", async () => {
      const asyncValidate = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n * 2) : Option.None;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const mapped = Option.Some(5).flatMap(asyncValidate).toPromise();
        const value = yield* $(mapped);
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(10);
    });

    it("should short-circuit when async flatMap returns None", async () => {
      const asyncValidate = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n * 2) : Option.None;
      };

      let reachedAfterNone = false;

      const result = await Option.asyncGenAdapter(async function* ($) {
        const mapped = Option.Some(-5).flatMap(asyncValidate).toPromise();
        const value = yield* $(mapped);
        reachedAfterNone = true;
        return value + 100;
      });

      expect(result.isNone()).toBe(true);
      expect(reachedAfterNone).toBe(false);
    });

    it("should chain multiple sync Options with async operations", async () => {
      const asyncTransform = async (s: string): Promise<string> => {
        await delay(5);
        return s.toUpperCase();
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const first = yield* $(Option.Some("hello"));
        const transformed = yield* $(
          Option.Some(first).map(asyncTransform).toPromise(),
        );
        const final = yield* $(Option.Some(`${transformed}!`));
        return final;
      });

      expectTypeOf(result).toEqualTypeOf<Option<string>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe("HELLO!");
    });

    it("should handle filter with async predicate via toPromise", async () => {
      const asyncIsEven = async (n: number): Promise<boolean> => {
        await delay(5);
        return n % 2 === 0;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const filtered = Option.Some(4).filter(asyncIsEven).toPromise();
        const value = yield* $(filtered);
        return value * 2;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should short-circuit when async filter returns false", async () => {
      const asyncIsEven = async (n: number): Promise<boolean> => {
        await delay(5);
        return n % 2 === 0;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const filtered = Option.Some(3).filter(asyncIsEven).toPromise();
        const value = yield* $(filtered);
        return value * 2;
      });

      expect(result.isNone()).toBe(true);
    });

    it("should handle zip with async function via toPromise", async () => {
      const asyncFetch = async (n: number): Promise<string> => {
        await delay(5);
        return `value-${n}`;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const zipped = Option.Some(42).zip(asyncFetch).toPromise();
        const [num, str] = yield* $(zipped);
        return { num, str };
      });

      expectTypeOf(result).toEqualTypeOf<
        Option<{ num: number; str: string }>
      >();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toEqual({ num: 42, str: "value-42" });
    });
  });

  describe("real-world scenarios", () => {
    it("should handle async validation flow", async () => {
      const validatePositive = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n) : Option.None;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const input = yield* $(Option.Some(4));
        const positive = yield* $(validatePositive(input));
        return positive * 2;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should handle chained async validation", async () => {
      const validatePositive = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n) : Option.None;
      };

      const validateEven = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n % 2 === 0 ? Option.Some(n) : Option.None;
      };

      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(4));
        const positive = yield* $(validatePositive(a));
        const even = yield* $(validateEven(positive));
        return even * 2;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should not execute functions after None", async () => {
      const mockFn = mock(async () => Option.Some(10));

      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.None as Option<number>);
        const b = yield* $(mockFn());
        return a + b;
      });

      expect(result.isNone()).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it("should handle user registration scenario", async () => {
      type User = { id: string; email: string };

      const validateEmail = async (e: string): Promise<Option<string>> => {
        await delay(5);
        return e.includes("@") ? Option.Some(e) : Option.None;
      };

      const validatePassword = async (p: string): Promise<Option<string>> => {
        await delay(5);
        return p.length >= 8 ? Option.Some(p) : Option.None;
      };

      const createUser = async (
        email: string,
        _password: string,
      ): Promise<Option<User>> => {
        await delay(5);
        return Option.Some({ id: "123", email });
      };

      const register = async (
        email: string,
        password: string,
      ): Promise<Option<User>> =>
        Option.asyncGenAdapter(async function* ($) {
          const validEmail = yield* $(validateEmail(email));
          const validPassword = yield* $(validatePassword(password));
          const user = yield* $(createUser(validEmail, validPassword));
          return user;
        });

      const success = await register("test@example.com", "securepassword");
      expect(success.isSome()).toBe(true);
      expect(success.unwrap()).toEqual({
        id: "123",
        email: "test@example.com",
      });

      const failure = await register("invalid", "short");
      expect(failure.isNone()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle many yields without stack overflow", async () => {
      const result = await Option.asyncGenAdapter(async function* ($) {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          const value = yield* $(Option.Some(i));
          sum += value;
        }
        return sum;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(4950);
    });

    it("should propagate promise rejections", async () => {
      const failingFetch = async (): Promise<Option<number>> => {
        throw new Error("Network error");
      };

      await expect(
        Option.asyncGenAdapter(async function* ($) {
          const value = yield* $(failingFetch());
          return value;
        }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("comparison with asyncGen", () => {
    it("should produce same result as asyncGen", async () => {
      const genResult = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(Option.Some(2));
        return a + b;
      });

      const genSimpleResult = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* Option.Some(2);
        return a + b;
      });

      expect(genResult.isSome()).toBe(true);
      expect(genSimpleResult.isSome()).toBe(true);
      expect(genResult.unwrap()).toBe(genSimpleResult.unwrap());
    });
  });
});
