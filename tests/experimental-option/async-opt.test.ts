import { describe, it, expect, beforeEach } from "bun:test";
import { AsyncOpt } from "@/internal/option.experimental";

describe("AsyncOpt", () => {
  describe("constructor and static methods", () => {
    it("should create Some value with Some method", async () => {
      const opt = AsyncOpt.Some(42);
      const value = await opt.value;
      expect(value).toBe(42);
    });

    it("should create None value with None property", async () => {
      const opt = AsyncOpt.None;
      const value = await opt.value;
      expect(value).toBe(Symbol.for("OptSentinel"));
    });

    it("should create Some value with constructor", async () => {
      const opt = new AsyncOpt(Promise.resolve(42));
      const value = await opt.value;
      expect(value).toBe(42);
    });

    it("should create None value with constructor", async () => {
      const opt = new AsyncOpt(Promise.resolve(Symbol.for("OptSentinel")));
      const value = await opt.value;
      expect(value).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("toPromise", () => {
    it("should resolve to itself for Some", async () => {
      const opt = AsyncOpt.Some(42);
      const promised = await opt.toPromise();
      const value = await promised.value;
      expect(value).toBe(42);
    });

    it("should resolve to itself for None", async () => {
      const opt = AsyncOpt.None;
      const promised = await opt.toPromise();
      const value = await promised.value;
      expect(value).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("unwrap", () => {
    it("should return value for Some", async () => {
      const opt = AsyncOpt.Some(42);
      const result = await opt.unwrap();
      expect(result).toBe(42);
    });

    it("should throw error for None", async () => {
      const opt = AsyncOpt.None;
      await expect(opt.unwrap()).rejects.toThrow("Called unwrap on a None value");
    });

    it("should handle rejected promises", async () => {
      const error = new Error("test error");
      const opt = new AsyncOpt(Promise.reject(error));
      await expect(opt.value).rejects.toThrow("test error");
    });
  });

  describe("safeUnwrap", () => {
    it("should return success object for Some", async () => {
      const opt = AsyncOpt.Some(42);
      const result = await opt.safeUnwrap();
      expect(result).toEqual({ success: true, value: 42 });
    });

    it("should return failure object for None", async () => {
      const opt = AsyncOpt.None;
      const result = await opt.safeUnwrap();
      expect(result).toEqual({ success: false });
    });
  });

  describe("map", () => {
    it("should map Some value with sync function", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.map((x) => x * 2);
      const result = await mapped.value;
      expect(result).toBe(84);
    });

    it("should map Some value with async function", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 2;
      });
      const result = await mapped.value;
      expect(result).toBe(84);
    });

    it("should return None for None input", async () => {
      const opt = AsyncOpt.None;
      const mapped = opt.map((x) => x * 2);
      const result = await mapped.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should handle different return types", async () => {
      const opt = AsyncOpt.Some("hello");
      const mapped = opt.map((s) => s.length);
      const result = await mapped.value;
      expect(result).toBe(5);
    });

    it("should handle functions returning promises", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.map((x) => Promise.resolve(x * 2));
      const result = await mapped.value;
      expect(result).toBe(84);
    });

    it("should handle undefined return", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.map(() => undefined);
      const result = await mapped.value;
      expect(result).toBe(undefined);
    });

    it("should handle null return", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.map(() => null);
      const result = await mapped.value;
      expect(result).toBe(null);
    });

    it("should handle nested async operations", async () => {
      const opt = AsyncOpt.Some("hello");
      const mapped = opt.map(async (s) => {
        const length = await Promise.resolve(s.length);
        return length * 2;
      });
      const result = await mapped.value;
      expect(result).toBe(10);
    });
  });

  describe("flatMap", () => {
    it("should flatMap Some value returning Some with sync function", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.flatMap((x) => AsyncOpt.Some(x * 2));
      const result = await mapped.value;
      expect(result).toBe(84);
    });

    it("should flatMap Some value returning Some with async function", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.flatMap(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return AsyncOpt.Some(x * 2);
      });
      const result = await mapped.value;
      expect(result).toBe(84);
    });

    it("should flatMap Some value returning None", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.flatMap(() => AsyncOpt.None);
      const result = await mapped.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should return None for None input", async () => {
      const opt = AsyncOpt.None;
      const mapped = opt.flatMap((x) => AsyncOpt.Some(x * 2));
      const result = await mapped.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should handle functions returning promises of AsyncOpt", async () => {
      const opt = AsyncOpt.Some(42);
      const mapped = opt.flatMap((x) => Promise.resolve(AsyncOpt.Some(x * 2)));
      const result = await mapped.value;
      expect(result).toBe(84);
    });

    it("should handle chaining of flatMaps", async () => {
      const opt = AsyncOpt.Some(42);
      const result = opt
        .flatMap((x) => AsyncOpt.Some(x.toString()))
        .flatMap((s) => AsyncOpt.Some(s.length))
        .flatMap((len) => AsyncOpt.Some(len * 2));
      const finalValue = await result.value;
      expect(finalValue).toBe(4);
    });

    it("should handle different types", async () => {
      const opt = AsyncOpt.Some("hello");
      const mapped = opt.flatMap((s) => AsyncOpt.Some(s.length));
      const result = await mapped.value;
      expect(result).toBe(5);
    });

    it("should handle complex async operations", async () => {
      const opt = AsyncOpt.Some("user123");
      const mapped = opt.flatMap(async (userId) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return AsyncOpt.Some(userId.length);
      });
      const result = await mapped.value;
      expect(result).toBe(7);
    });
  });

  describe("zip", () => {
    it("should zip Some value with computed sync value", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.zip((x) => x * 2);
      const result = await zipped.value;
      expect(result).toEqual([42, 84]);
    });

    it("should zip Some value with computed async value", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.zip(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 2;
      });
      const result = await zipped.value;
      expect(result).toEqual([42, 84]);
    });

    it("should return None for None input", async () => {
      const opt = AsyncOpt.None;
      const zipped = opt.zip((x) => x * 2);
      const result = await zipped.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should handle different return types", async () => {
      const opt = AsyncOpt.Some("hello");
      const zipped = opt.zip((s) => s.length);
      const result = await zipped.value;
      expect(result).toEqual(["hello", 5]);
    });

    it("should handle functions returning promises", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.zip((x) => Promise.resolve(x * 2));
      const result = await zipped.value;
      expect(result).toEqual([42, 84]);
    });

    it("should handle undefined return", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.zip(() => undefined);
      const result = await zipped.value;
      expect(result).toEqual([42, undefined]);
    });

    it("should handle null return", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.zip(() => null);
      const result = await zipped.value;
      expect(result).toEqual([42, null]);
    });

    it("should handle complex async zipping", async () => {
      const opt = AsyncOpt.Some("hello");
      const zipped = opt.zip(async (s) => {
        const length = await Promise.resolve(s.length);
        return length * 3;
      });
      const result = await zipped.value;
      expect(result).toEqual(["hello", 15]);
    });
  });

  describe("flatZip", () => {
    it("should flatZip Some value with Some computed value using sync function", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.flatZip((x) => AsyncOpt.Some(x * 2));
      const result = await zipped.value;
      expect(result).toEqual([42, 84]);
    });

    it("should flatZip Some value with Some computed value using async function", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.flatZip(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return AsyncOpt.Some(x * 2);
      });
      const result = await zipped.value;
      expect(result).toEqual([42, 84]);
    });

    it("should return None when flatZip Some with None computed value", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.flatZip(() => AsyncOpt.None);
      const result = await zipped.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should return None for None input", async () => {
      const opt = AsyncOpt.None;
      const zipped = opt.flatZip((x) => AsyncOpt.Some(x * 2));
      const result = await zipped.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should handle functions returning promises of AsyncOpt", async () => {
      const opt = AsyncOpt.Some(42);
      const zipped = opt.flatZip((x) => Promise.resolve(AsyncOpt.Some(x * 2)));
      const result = await zipped.value;
      expect(result).toEqual([42, 84]);
    });

    it("should handle chaining of flatZips", async () => {
      const opt = AsyncOpt.Some(42);
      const firstStep = opt.flatZip((x) => AsyncOpt.Some(x.toString()));
      const firstValue = await firstStep.value;
      expect(firstValue).toEqual([42, "42"]);

      const secondStep = firstStep.flatZip(([original, str]) => AsyncOpt.Some(str.length));
      const secondValue = await secondStep.value;
      expect(secondValue).toEqual([[42, "42"], 2]);
    });

    it("should handle different types", async () => {
      const opt = AsyncOpt.Some("hello");
      const zipped = opt.flatZip((s) => AsyncOpt.Some(s.length));
      const result = await zipped.value;
      expect(result).toEqual(["hello", 5]);
    });

    it("should handle complex async flatZipping", async () => {
      const opt = AsyncOpt.Some("user123");
      const zipped = opt.flatZip(async (userId) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return AsyncOpt.Some(userId.length);
      });
      const result = await zipped.value;
      expect(result).toEqual(["user123", 7]);
    });
  });

  describe("type inference and generic constraints", () => {
    it("should maintain type correctness through operations", async () => {
      const opt: AsyncOpt<number> = AsyncOpt.Some(42);
      const mapped: AsyncOpt<string> = opt.map((x) => x.toString());
      const flatMapped: AsyncOpt<number> = mapped.flatMap((s) => AsyncOpt.Some(s.length));
      const zipped: AsyncOpt<[string, number]> = flatMapped.zip((len) => len * 2);

      const result = await zipped.value;
      expect(result).toEqual([2, 4]);
    });

    it("should work with complex types", async () => {
      interface User {
        id: number;
        name: string;
      }

      const user: AsyncOpt<User> = AsyncOpt.Some({ id: 1, name: "Alice" });
      const userName = user.map((u) => u.name);
      const userWithAge = user.flatMap((u) => AsyncOpt.Some({ ...u, age: 30 }));

      const nameResult = await userName.value;
      const ageResult = await userWithAge.value;

      expect(nameResult).toBe("Alice");
      expect(ageResult).toEqual({ id: 1, name: "Alice", age: 30 });
    });

    it("should handle array types", async () => {
      const numbers = AsyncOpt.Some([1, 2, 3]);
      const doubled = numbers.map((arr) => arr.map((x) => x * 2));
      const sum = numbers.flatMap((arr) => AsyncOpt.Some(arr.reduce((a, b) => a + b, 0)));

      const doubledResult = await doubled.value;
      const sumResult = await sum.value;

      expect(doubledResult).toEqual([2, 4, 6]);
      expect(sumResult).toBe(6);
    });
  });

  describe("edge cases", () => {
    it("should handle zero values", async () => {
      const opt = AsyncOpt.Some(0);
      const value = await opt.value;
      expect(value).toBe(0);
      const unwrapped = await opt.unwrap();
      expect(unwrapped).toBe(0);
      const mapped = await opt.map((x) => x + 1).value;
      expect(mapped).toBe(1);
    });

    it("should handle empty string", async () => {
      const opt = AsyncOpt.Some("");
      const value = await opt.value;
      expect(value).toBe("");
      const unwrapped = await opt.unwrap();
      expect(unwrapped).toBe("");
      const mapped = await opt.map((s) => s.length).value;
      expect(mapped).toBe(0);
    });

    it("should handle false boolean", async () => {
      const opt = AsyncOpt.Some(false);
      const value = await opt.value;
      expect(value).toBe(false);
      const unwrapped = await opt.unwrap();
      expect(unwrapped).toBe(false);
      const mapped = await opt.map((b) => !b).value;
      expect(mapped).toBe(true);
    });

    it("should handle NaN", async () => {
      const opt = AsyncOpt.Some(Number.NaN);
      const value = await opt.value;
      expect(Number.isNaN(value)).toBe(true);
      const unwrapped = await opt.unwrap();
      expect(Number.isNaN(unwrapped)).toBe(true);
    });

    it("should handle already resolved promises", async () => {
      const resolvedPromise = Promise.resolve(42);
      const opt = new AsyncOpt(resolvedPromise);
      const result = await opt.value;
      expect(result).toBe(42);
    });

    it("should handle promises that resolve to undefined", async () => {
      const opt = new AsyncOpt(Promise.resolve(undefined));
      const result = await opt.value;
      expect(result).toBe(undefined);
    });

    it("should handle promises that resolve to null", async () => {
      const opt = new AsyncOpt(Promise.resolve(null));
      const result = await opt.value;
      expect(result).toBe(null);
    });
  });

  describe("concurrent operations", () => {
    it("should handle multiple concurrent maps", async () => {
      const opt = AsyncOpt.Some(42);

      const [result1, result2, result3] = await Promise.all([
        opt.map((x) => x * 2).value,
        opt.map((x) => x + 10).value,
        opt.map((x) => x.toString()).value
      ]);

      expect(result1).toBe(84);
      expect(result2).toBe(52);
      expect(result3).toBe("42");
    });

    it("should handle multiple concurrent flatMaps", async () => {
      const opt = AsyncOpt.Some(42);

      const [result1, result2, result3] = await Promise.all([
        opt.flatMap((x) => AsyncOpt.Some(x * 2)).value,
        opt.flatMap((x) => AsyncOpt.Some(x + 10)).value,
        opt.flatMap((x) => AsyncOpt.Some(x.toString())).value
      ]);

      expect(result1).toBe(84);
      expect(result2).toBe(52);
      expect(result3).toBe("42");
    });
  });
});