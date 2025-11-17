import { describe, it, expect, beforeEach } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";

describe("ExperimentalOption", () => {
  describe("constructor and static methods", () => {
    it("should create Some value with Some method", async () => {
      const opt = ExperimentalOption.Some(42);
      expect(opt.value.value).toBe(42);
    });

    it("should create None value with None property", async () => {
      const opt = ExperimentalOption.None;
      expect(opt.value.value).toBe(Symbol.for("OptSentinel"));
    });

    it("should have correct internal type for Some", () => {
      const opt = ExperimentalOption.Some(42);
      expect(opt.value.constructor.name).toBe("SyncOpt");
    });

    it("should have correct internal type for None", () => {
      const opt = ExperimentalOption.None;
      expect(opt.value.constructor.name).toBe("SyncOpt");
    });
  });

  describe("toPromise", () => {
    it("should convert SyncOpt Some to promise", async () => {
      const opt = ExperimentalOption.Some(42);
      const promised = await opt.toPromise();
      expect(promised.value.value).toBe(42);
    });

    it("should convert SyncOpt None to promise", async () => {
      const opt = ExperimentalOption.None;
      const promised = await opt.toPromise();
      expect(promised.value.value).toBe(Symbol.for("OptSentinel"));
    });

    it("should maintain type when converting to promise", async () => {
      const opt: ExperimentalOption<number> = ExperimentalOption.Some(42);
      const promised = await opt.toPromise();
      expect(promised.value.value).toBe(42);
    });
  });

  describe("unwrap", () => {
    it("should return value for SyncOpt Some", () => {
      const opt = ExperimentalOption.Some(42);
      expect(opt.unwrap()).toBe(42);
    });

    it("should throw error for SyncOpt None", () => {
      const opt = ExperimentalOption.None;
      expect(() => opt.unwrap()).toThrow("Called unwrap on a None value");
    });

    it("should return Promise for AsyncOpt operations", async () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => Promise.resolve(x * 2));
      const result = await mapped.unwrap();
      expect(result).toBe(84);
    });
  });

  describe("safeUnwrap", () => {
    it("should return success object for SyncOpt Some", () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt.safeUnwrap();
      expect(result).toEqual({ success: true, value: 42 });
    });

    it("should return failure object for SyncOpt None", () => {
      const opt = ExperimentalOption.None;
      const result = opt.safeUnwrap();
      expect(result).toEqual({ success: false });
    });

    it("should return Promise for AsyncOpt operations", async () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => Promise.resolve(x * 2));
      const result = await mapped.safeUnwrap();
      expect(result).toEqual({ success: true, value: 84 });
    });
  });

  describe("map - sync operations", () => {
    it("should map SyncOpt Some value with sync function", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => x * 2);
      expect(mapped.value.value).toBe(84);
      expect(mapped.value.constructor.name).toBe("SyncOpt");
    });

    it("should return SyncOpt None for SyncOpt None input", () => {
      const opt = ExperimentalOption.None;
      const mapped = opt.map((x) => x * 2);
      expect(mapped.value.value).toBe(Symbol.for("OptSentinel"));
      expect(mapped.value.constructor.name).toBe("SyncOpt");
    });

    it("should handle different return types", () => {
      const opt = ExperimentalOption.Some("hello");
      const mapped = opt.map((s) => s.length);
      expect(mapped.value.value).toBe(5);
    });

    it("should handle undefined return", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map(() => undefined);
      expect(mapped.value.value).toBe(undefined);
    });

    it("should handle null return", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map(() => null);
      expect(mapped.value.value).toBe(null);
    });
  });

  describe("map - async operations", () => {
    it("should map SyncOpt Some value with async function and return AsyncOpt", async () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 2;
      });
      expect(mapped.value.constructor.name).toBe("AsyncOpt");
      const result = await mapped.value.value;
      expect(result).toBe(84);
    });

    it("should map SyncOpt Some value with Promise-returning function", async () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => Promise.resolve(x * 2));
      expect(mapped.value.constructor.name).toBe("AsyncOpt");
      const result = await mapped.value.value;
      expect(result).toBe(84);
    });

    it("should handle complex async mapping", async () => {
      const opt = ExperimentalOption.Some("hello");
      const mapped = opt.map(async (s) => {
        const length = await Promise.resolve(s.length);
        return length * 2;
      });
      const result = await mapped.value.value;
      expect(result).toBe(10);
    });

    it("should return SyncOpt None for SyncOpt None input with async function", async () => {
      const opt = ExperimentalOption.None;
      const mapped = opt.map(async (x) => x * 2);
      // Even with async function, None input remains SyncOpt None
      expect(mapped.value.constructor.name).toBe("SyncOpt");
      const result = await mapped.value.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("type preservation and conversion", () => {
    it("should preserve SyncOpt type when mapping with sync function", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => x * 2);
      expect(mapped.value.constructor.name).toBe("SyncOpt");
    });

    it("should convert to AsyncOpt when mapping with async function", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map(async (x) => x * 2);
      expect(mapped.value.constructor.name).toBe("AsyncOpt");
    });

    it("should convert to AsyncOpt when mapping with Promise-returning function", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => Promise.resolve(x * 2));
      expect(mapped.value.constructor.name).toBe("AsyncOpt");
    });

    it("should maintain AsyncOpt type when mapping async results", () => {
      const opt = ExperimentalOption.Some(42);
      const firstMap = opt.map((x) => Promise.resolve(x * 2));
      const secondMap = firstMap.map((x) => x + 10);
      expect(firstMap.value.constructor.name).toBe("AsyncOpt");
      expect(secondMap.value.constructor.name).toBe("AsyncOpt");
    });
  });

  describe("chaining operations", () => {
    it("should handle mixed sync/async operations", async () => {
      const opt = ExperimentalOption.Some(42);

      // Sync operation
      const step1 = opt.map((x) => x.toString());
      expect(step1.value.constructor.name).toBe("SyncOpt");
      expect(step1.value.value).toBe("42");

      // Async operation that converts to AsyncOpt
      const step2 = step1.map(async (s) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return s.length;
      });
      expect(step2.value.constructor.name).toBe("AsyncOpt");

      // Another async operation on AsyncOpt
      const step3 = step2.map((len) => len * 2);
      expect(step3.value.constructor.name).toBe("AsyncOpt");

      const result = await step3.value.value;
      expect(result).toBe(4);
    });

    it("should handle long chains of sync operations", () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map((x) => x * 2)
        .map((x) => x + 10)
        .map((x) => x.toString())
        .map((s) => s.length)
        .map((len) => len * 3);

      // 42 * 2 = 84, 84 + 10 = 94, "94".length = 2, 2 * 3 = 6
      expect(result.value.value).toBe(6);
      expect(result.value.constructor.name).toBe("SyncOpt");
    });

    it("should handle long chains with async operations", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map((x) => x * 2) // sync
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async, converts to AsyncOpt
        .map((x) => x.toString()) // async
        .map((s) => s.length) // async
        .map(async (len) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return len * 3;
        }); // async

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      // 42 * 2 = 84, 84 + 10 = 94, "94".length = 2, 2 * 3 = 6
      expect(finalValue).toBe(6);
    });
  });

  describe("type inference and generic constraints", () => {
    it("should maintain type correctness through sync operations", () => {
      const opt: ExperimentalOption<number> = ExperimentalOption.Some(42);
      const mapped: ExperimentalOption<string> = opt.map((x) => x.toString());
      expect(mapped.value.value).toBe("42");
    });

    it("should maintain type correctness through async operations", async () => {
      const opt: ExperimentalOption<number> = ExperimentalOption.Some(42);
      const mapped: ExperimentalOption<string> = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x.toString();
      });
      const result = await mapped.value.value;
      expect(result).toBe("42");
    });

    it("should work with complex types", async () => {
      interface User {
        id: number;
        name: string;
      }

      const user: ExperimentalOption<User> = ExperimentalOption.Some({
        id: 1,
        name: "Alice"
      });

      const userName = user.map((u) => u.name);
      expect(userName.value.value).toBe("Alice");

      const userWithAge = user.map(async (u) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return { ...u, age: 30 };
      });

      const result = await userWithAge.value.value;
      expect(result).toEqual({ id: 1, name: "Alice", age: 30 });
    });

    it("should handle array types", async () => {
      const numbers = ExperimentalOption.Some([1, 2, 3]);
      const doubled = numbers.map((arr) => arr.map((x) => x * 2));
      expect(doubled.value.value).toEqual([2, 4, 6]);

      const summed = numbers.map(async (arr) => {
        const sum = await Promise.resolve(arr.reduce((a, b) => a + b, 0));
        return sum * 2;
      });

      const result = await summed.value.value;
      expect(result).toBe(12);
    });
  });

  describe("edge cases", () => {
    it("should handle zero values", () => {
      const opt = ExperimentalOption.Some(0);
      expect(opt.value.value).toBe(0);
      expect(opt.unwrap()).toBe(0);
      expect(opt.map((x) => x + 1).value.value).toBe(1);
    });

    it("should handle empty string", () => {
      const opt = ExperimentalOption.Some("");
      expect(opt.value.value).toBe("");
      expect(opt.unwrap()).toBe("");
      expect(opt.map((s) => s.length).value.value).toBe(0);
    });

    it("should handle false boolean", () => {
      const opt = ExperimentalOption.Some(false);
      expect(opt.value.value).toBe(false);
      expect(opt.unwrap()).toBe(false);
      expect(opt.map((b) => !b).value.value).toBe(true);
    });

    it("should handle NaN", () => {
      const opt = ExperimentalOption.Some(Number.NaN);
      expect(Number.isNaN(opt.value.value)).toBe(true);
      expect(Number.isNaN(opt.unwrap())).toBe(true);
    });

    it("should handle None propagation through async operations", async () => {
      const opt = ExperimentalOption.None;
      const mapped = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 2;
      });

      // None input remains SyncOpt even with async function
      expect(mapped.value.constructor.name).toBe("SyncOpt");
      const result = await mapped.value.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });

    it("should handle promise rejection in mapping function", async () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        throw new Error("mapping error");
      });

      await expect(mapped.value.value).rejects.toThrow("mapping error");
    });
  });

  describe("None behavior consistency", () => {
    it("should maintain same None reference", () => {
      const opt1 = ExperimentalOption.None;
      const opt2 = ExperimentalOption.None;
      expect(opt1).toBe(opt2);
    });

    it("should return None for None input operations", () => {
      const opt = ExperimentalOption.None;
      const mapped = opt.map((x) => x * 2);
      expect(mapped.value.value).toBe(Symbol.for("OptSentinel"));
      expect(mapped.value.constructor.name).toBe("SyncOpt");
    });

    it("should return None for async operations on None input", async () => {
      const opt = ExperimentalOption.None;
      const mapped = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 2;
      });

      expect(mapped).not.toBe(ExperimentalOption.None); // Different instance due to AsyncOpt
      const result = await mapped.value.value;
      expect(result).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("performance and behavior verification", () => {
    it("should not create unnecessary promise wrappers for sync operations", () => {
      const opt = ExperimentalOption.Some(42);
      const mapped = opt.map((x) => x * 2);

      // Should remain synchronous
      expect(mapped.value.constructor.name).toBe("SyncOpt");
      expect(typeof mapped.value.value).toBe("number");
    });

    it("should only create promise wrappers when needed", () => {
      const opt = ExperimentalOption.Some(42);

      // Sync operation - should remain SyncOpt
      const syncResult = opt.map((x) => x * 2);
      expect(syncResult.value.constructor.name).toBe("SyncOpt");

      // Async operation - should become AsyncOpt
      const asyncResult = opt.map(async (x) => x * 2);
      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });

    it("should handle promise detection correctly", () => {
      const opt = ExperimentalOption.Some(42);

      const syncMap = opt.map((x) => "hello");
      const asyncMap = opt.map((x) => Promise.resolve("hello"));

      expect(syncMap.value.constructor.name).toBe("SyncOpt");
      expect(asyncMap.value.constructor.name).toBe("AsyncOpt");
    });
  });
});