/* oxlint-disable require-yield */
/* biome-ignore-all lint/correctness/useYield: testing it */
import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { ExperimentalOption as Option } from "@/option-experimental.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ExperimentalOption.asyncGen", () => {
  describe("basic functionality", () => {
    it("should unwrap a single Some value", async () => {
      const result = await Option.asyncGen(async function* () {
        const value = yield* Option.Some(42);
        return value;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should unwrap multiple Some values in sequence", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* Option.Some(2);
        const c = yield* Option.Some(3);
        return a + b + c;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should work with no yields", async () => {
      const result = await Option.asyncGen(async function* () {
        return 42;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should short-circuit on first None", async () => {
      let reachedAfterNone = false;

      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* Option.None;
        reachedAfterNone = true;
        const c = yield* Option.Some(3);
        return a + b + c;
      });

      expect(result.isNone()).toBe(true);
      expect(reachedAfterNone).toBe(false);
    });

    it("should return singleton None", async () => {
      const result1 = await Option.asyncGen(async function* () {
        yield* Option.None;
        return 1;
      });

      const result2 = await Option.asyncGen(async function* () {
        yield* Option.None;
        return 2;
      });

      expect(result1).toBe(Option.None);
      expect(result2).toBe(Option.None);
      expect(result1).toBe(result2);
    });

    it("should track intermediate variables", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(10);
        const b = yield* Option.Some(5);
        return a + b + a;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(25);
    });
  });

  describe("async operations with await", () => {
    it("should handle awaited Promise<Option<T>> yields", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* await Promise.resolve(Option.Some(1));
        const b = yield* await Promise.resolve(Option.Some(2));
        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(3);
    });

    it("should handle mixed sync Option and awaited Promise<Option>", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* await Promise.resolve(Option.Some(2));
        const c = yield* Option.Some(3);
        return a + b + c;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should short-circuit on awaited Promise<None>", async () => {
      let reachedAfterNone = false;

      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* await Promise.resolve(Option.None as Option<number>);
        reachedAfterNone = true;
        return a + b;
      });

      expect(result.isNone()).toBe(true);
      expect(reachedAfterNone).toBe(false);
    });
  });

  describe("actual async behavior", () => {
    it("should handle async operations with delays", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        await delay(10);
        const b = yield* Option.Some(2);
        await delay(10);
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

      const result = await Option.asyncGen(async function* () {
        const a = yield* await fetchValue(5);
        const b = yield* await fetchValue(3);
        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(16);
    });

    it("should short-circuit on delayed None", async () => {
      const fetchNone = async (): Promise<Option<number>> => {
        await delay(10);
        return Option.None;
      };

      let reachedAfterNone = false;

      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* await fetchNone();
        reachedAfterNone = true;
        return a + b;
      });

      expect(result.isNone()).toBe(true);
      expect(reachedAfterNone).toBe(false);
    });
  });

  describe("type inference", () => {
    it("should infer return type correctly", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(42);
        return a.toString();
      });

      expectTypeOf(result).toEqualTypeOf<Option<string>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe("42");
    });

    it("should infer number return type", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* Option.Some(2);
        return a + b;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.unwrap()).toBe(3);
    });

    it("should infer complex object return type", async () => {
      type User = { name: string; age: number };

      const result = await Option.asyncGen(async function* () {
        const name = yield* Option.Some("Alice");
        const age = yield* Option.Some(30);
        return { name, age } as User;
      });

      expectTypeOf(result).toEqualTypeOf<Option<User>>();
      expect(result.unwrap()).toEqual({ name: "Alice", age: 30 });
    });

    it("should infer array return type", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* Option.Some(2);
        return [a, b];
      });

      expectTypeOf(result).toEqualTypeOf<Option<number[]>>();
      expect(result.unwrap()).toEqual([1, 2]);
    });
  });

  describe("sync Option with async map/flatMap", () => {
    it("should handle async operations with explicit async methods", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      const result = await Option.asyncGen(async function* () {
        const value = yield* await Option.Some(3).mapAsync(asyncDouble);
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(6);
    });

    it("should handle async flatMap with explicit async methods", async () => {
      const asyncValidate = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n * 2) : Option.None;
      };

      const result = await Option.asyncGen(async function* () {
        const value = yield* await Option.Some(5).flatMapAsync(asyncValidate);
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

      const result = await Option.asyncGen(async function* () {
        const value = yield* await Option.Some(-5).flatMapAsync(asyncValidate);
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

      const result = await Option.asyncGen(async function* () {
        const first = yield* Option.Some("hello");
        const transformed =
          yield* await Option.Some(first).mapAsync(asyncTransform);
        const final = yield* Option.Some(`${transformed}!`);
        return final;
      });

      expectTypeOf(result).toEqualTypeOf<Option<string>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe("HELLO!");
    });

    it("should handle filter with async predicate", async () => {
      const asyncIsEven = async (n: number): Promise<boolean> => {
        await delay(5);
        return n % 2 === 0;
      };

      const result = await Option.asyncGen(async function* () {
        const value = yield* await Option.Some(4).filterAsync(asyncIsEven);
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

      const result = await Option.asyncGen(async function* () {
        const filtered = await Option.Some(3).filterAsync(asyncIsEven);
        const value = yield* filtered;
        return value * 2;
      });

      expect(result.isNone()).toBe(true);
    });
  });

  describe("real-world scenarios", () => {
    it("should handle async validation flow", async () => {
      const validatePositive = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n) : Option.None;
      };

      const result = await Option.asyncGen(async function* () {
        const input = yield* Option.Some(4);
        const positive = yield* await validatePositive(input);
        return positive * 2;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(8);
    });

    it("should not execute functions after None", async () => {
      const mockFn = mock(async () => Option.Some(10));

      const result = await Option.asyncGen(async function* () {
        const a = yield* Option.None as Option<number>;
        const b = yield* await mockFn();
        return a + b;
      });

      expect(result.isNone()).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it("should handle user lookup scenario", async () => {
      type User = { id: string; name: string };

      const findUser = async (id: string): Promise<Option<User>> => {
        await delay(5);
        if (id === "123") {
          return Option.Some({ id: "123", name: "Alice" });
        }
        return Option.None;
      };

      const getPreference = async (user: User): Promise<Option<string>> => {
        await delay(5);
        return Option.Some(`${user.name}'s preference`);
      };

      const result = await Option.asyncGen(async function* () {
        const user = yield* await findUser("123");
        const pref = yield* await getPreference(user);
        return pref;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe("Alice's preference");
    });
  });

  describe("edge cases", () => {
    it("should handle many yields without stack overflow", async () => {
      const result = await Option.asyncGen(async function* () {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          const value = yield* Option.Some(i);
          sum += value;
        }
        return sum;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(4950);
    });

    it("should work with fromNullable", async () => {
      const result = await Option.asyncGen(async function* () {
        const value = yield* Option.fromNullable(null);
        return value;
      });

      expect(result.isNone()).toBe(true);
    });

    it("should propagate promise rejections", async () => {
      const failingFetch = async (): Promise<Option<number>> => {
        throw new Error("Network error");
      };

      expect(
        await Option.asyncGen(async function* () {
          const value = yield* await failingFetch();
          return value;
        }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("comparison with asyncGenAdapter", () => {
    it("should produce same result as asyncGenAdapter", async () => {
      const genResult = await Option.asyncGen(async function* () {
        const a = yield* Option.Some(1);
        const b = yield* await Promise.resolve(Option.Some(2));
        return a + b;
      });

      const adapterResult = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Option.Some(1));
        const b = yield* $(await Promise.resolve(Option.Some(2)));
        return a + b;
      });

      expect(genResult.isSome()).toBe(true);
      expect(adapterResult.isSome()).toBe(true);
      expect(genResult.unwrap()).toBe(adapterResult.unwrap());
    });
  });

  describe("explicit async patterns", () => {
    it("should handle explicit Promise<Option<T>> yields", async () => {
      const fetchDoubled = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return Option.Some(n * 2);
      };

      const result = await Option.asyncGen(async function* () {
        const value = yield* await fetchDoubled(21);

        // value should be number, not Promise<number>
        expectTypeOf(value).toEqualTypeOf<number>();
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should handle mapAsync in asyncGen", async () => {
      const asyncDouble = async (n: number): Promise<number> => {
        await delay(5);
        return n * 2;
      };

      const result = await Option.asyncGen(async function* () {
        // mapAsync returns Promise<Option<number>>, which we await before yielding
        const value = yield* await Option.Some(3).mapAsync(asyncDouble);

        expectTypeOf(value).toEqualTypeOf<number>();
        return value + 10;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(16); // 3 * 2 + 10
    });

    it("should handle mixed sync and async operations", async () => {
      const syncOption = Option.Some<number>(10);

      const result = await Option.asyncGen(async function* () {
        const a = yield* syncOption;
        const b = yield* await Option.Some(5).mapAsync(async (n) => n * 3);

        expectTypeOf(a).toEqualTypeOf<number>();
        expectTypeOf(b).toEqualTypeOf<number>();

        return a + b;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(25); // 10 + 15
    });

    it("should work with flatMapAsync in asyncGen", async () => {
      const asyncFlatMap = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n * 2) : Option.None;
      };

      const result = await Option.asyncGen(async function* () {
        // flatMapAsync returns Promise<Option<number>>, which we await before yielding
        const value = yield* await Option.Some(5).flatMapAsync(asyncFlatMap);
        expectTypeOf(value).toEqualTypeOf<number>();
        return value;
      });

      expectTypeOf(result).toEqualTypeOf<Option<number>>();
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(10);
    });

    it("should short-circuit on None from async flatMap", async () => {
      const asyncFlatMap = async (n: number): Promise<Option<number>> => {
        await delay(5);
        return n > 0 ? Option.Some(n * 2) : Option.None;
      };

      let reachedAfterNone = false;

      const result = await Option.asyncGen(async function* () {
        const value = yield* await Option.Some(-5).flatMapAsync(asyncFlatMap);
        reachedAfterNone = true;
        return value + 100;
      });

      expect(result.isNone()).toBe(true);
      expect(reachedAfterNone).toBe(false);
    });

    it("should combine multiple async operations", async () => {
      const fetchOption = async (): Promise<Option<number>> => {
        await delay(5);
        return Option.Some(100);
      };

      const result = await Option.asyncGen(async function* () {
        // Both operations use explicit async methods
        const a = yield* await fetchOption();
        const b = yield* await Option.Some(5).mapAsync(async (n) => n * 2);

        expectTypeOf(a).toEqualTypeOf<number>();
        expectTypeOf(b).toEqualTypeOf<number>();

        return a + b;
      });

      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe(110); // 100 + 10
    });
  });
});
