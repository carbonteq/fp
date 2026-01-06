import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";
import {
  AsyncTestHelpers,
  ErrorTestHelpers,
  PerformanceHelpers,
} from "./test-utils";

/**
 * Async Compliance Tests
 *
 * These tests verify the async/sync interoperability features defined in the Option specification.
 * They focus on:
 *
 * 1. Seamless async/sync operation mixing
 * 2. Promise handling and propagation
 * 3. Type preservation through async boundaries
 * 4. Lazy evaluation behavior
 * 5. Performance characteristics of async operations
 */

describe("ExperimentalOption - Async Compliance", () => {
  describe("Async Option Creation", () => {
    it("should create Options with Promise values", async () => {
      const asyncOpt = ExperimentalOption.Some(Promise.resolve(42));

      expect(asyncOpt.value.constructor.name).toBe("AsyncOpt");
      expect(await asyncOpt.unwrap()).toBe(42);
    });

    it("should handle rejected Promise values", async () => {
      const asyncOpt = ExperimentalOption.Some(
        Promise.reject(new Error("Promise rejected")),
      );

      expect(asyncOpt.value.constructor.name).toBe("AsyncOpt");
      await ErrorTestHelpers.expectThrows(
        () => asyncOpt.unwrap(),
        "Promise rejected",
      );
    });

    it("should handle async None values", async () => {
      const sentinel = Symbol.for("OptSentinel");
      const asyncNone = ExperimentalOption.Some(Promise.resolve(sentinel));

      expect(asyncNone.value.constructor.name).toBe("AsyncOpt");

      try {
        await asyncNone.unwrap();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("Called unwrap on a None value");
      }
    });
  });

  describe("Sync to Async Conversion", () => {
    it("should convert SyncOpt to AsyncOpt when mapping with async function", () => {
      const syncOpt = ExperimentalOption.Some(42);

      const asyncResult = syncOpt.map(async (x) => {
        await AsyncTestHelpers.delay(1);
        return x * 2;
      });

      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });

    it("should convert SyncOpt to AsyncOpt when flatMapping with async function", () => {
      const syncOpt = ExperimentalOption.Some(42);

      const asyncResult = syncOpt.flatMap(async (x) => {
        await AsyncTestHelpers.delay(1);
        return ExperimentalOption.Some(x * 2);
      });

      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });

    it("should convert SyncOpt to AsyncOpt when zipping with async function", () => {
      const syncOpt = ExperimentalOption.Some(42);

      const asyncResult = syncOpt.zip(async (x) => {
        await AsyncTestHelpers.delay(1);
        return x * 2;
      });

      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });

    it("should convert SyncOpt to AsyncOpt when flatZipping with async function", () => {
      const syncOpt = ExperimentalOption.Some(42);

      const asyncResult = syncOpt.flatZip(async (x) => {
        await AsyncTestHelpers.delay(1);
        return ExperimentalOption.Some(x * 2);
      });

      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });
  });

  describe("Async to Async Persistence", () => {
    it("should remain AsyncOpt when applying sync transformations to AsyncOpt", async () => {
      const asyncOpt = ExperimentalOption.Some(Promise.resolve(42));

      const result1 = asyncOpt.map((x) => x * 2);
      const result2 = result1.map((x) => x.toString());

      expect(result1.value.constructor.name).toBe("AsyncOpt");
      expect(result2.value.constructor.name).toBe("AsyncOpt");
      expect(await result2.unwrap()).toBe("84");
    });

    it("should remain AsyncOpt when chaining async transformations", async () => {
      const asyncOpt = ExperimentalOption.Some(Promise.resolve(42));

      const result = asyncOpt
        .map(async (x) => {
          await AsyncTestHelpers.delay(1);
          return x * 2;
        })
        .map(async (x) => {
          await AsyncTestHelpers.delay(1);
          return x.toString();
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      expect(await result.unwrap()).toBe("84");
    });

    it("should remain AsyncOpt when using async flatMap", async () => {
      const asyncOpt = ExperimentalOption.Some(Promise.resolve(42));

      const result = asyncOpt
        .flatMap(async (x) => {
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.Some(x * 2);
        })
        .flatMap(async (x) => {
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.Some(x.toString());
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      expect(await result.unwrap()).toBe("84");
    });
  });

  describe("Mixed Sync/Async Pipelines", () => {
    it("should handle complex sync/async chains correctly", async () => {
      const syncOpt = ExperimentalOption.Some(42);

      const result = syncOpt
        .map((x) => x * 2) // sync
        .map((x) => x + 1) // sync
        .map(async (x) => {
          // async
          await AsyncTestHelpers.delay(1);
          return x * 10;
        })
        .map((x) => x.toString()) // sync on async result
        .map(async (str) => {
          // async
          await AsyncTestHelpers.delay(1);
          return `result:${str}`;
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      expect(await result.unwrap()).toBe("result:430");
    });

    it("should handle mixed zip operations", async () => {
      const syncOpt = ExperimentalOption.Some(42);

      const result = syncOpt
        .zip((x) => x * 2) // sync zip
        .zip(async ([a, b]) => {
          // async zip
          await AsyncTestHelpers.delay(1);
          return a + b;
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      expect(await result.unwrap()).toEqual([[42, 84], 126]);
    });

    it("should handle mixed flatZip operations", async () => {
      const syncOpt = ExperimentalOption.Some("hello");

      const result = syncOpt
        .flatZip((s) =>
          s.length > 3
            ? ExperimentalOption.Some(s.toUpperCase())
            : ExperimentalOption.None,
        ) // sync
        .flatZip(async ([orig, upper]) => {
          // async
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.Some(`${orig}:${upper}`);
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      expect(await result.unwrap()).toEqual([
        ["hello", "HELLO"],
        "hello:HELLO",
      ]);
    });

    it("should handle None propagation in mixed pipelines", async () => {
      const syncOpt = ExperimentalOption.Some(42);

      const result = syncOpt
        .map((x) => x * 2)
        .flatMap((x) =>
          x > 100 ? ExperimentalOption.Some(x) : ExperimentalOption.None,
        ) // creates None
        .map(async (x) => {
          // async map on None
          await AsyncTestHelpers.delay(1);
          return x * 2;
        });

      expect(result.value.constructor.name).toBe("SyncOpt"); // None stays sync
      await ErrorTestHelpers.expectThrows(
        () => result.unwrap(),
        "Called unwrap on a None value",
      );
    });
  });

  describe("Promise Handling", () => {
    it("should handle Promise values directly in Some", async () => {
      const promise = Promise.resolve(42);
      const opt = ExperimentalOption.Some(promise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");
      expect(await opt.unwrap()).toBe(42);
    });

    it("should handle Promise.reject() gracefully", async () => {
      const rejectedPromise = Promise.reject(new Error("Test rejection"));
      const opt = ExperimentalOption.Some(rejectedPromise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");
      await ErrorTestHelpers.expectThrows(() => opt.unwrap(), "Test rejection");
    });

    it("should handle Promise that resolves to Option sentinel", async () => {
      const sentinel = Symbol.for("OptSentinel");
      const promise = Promise.resolve(sentinel);
      const opt = ExperimentalOption.Some(promise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");

      try {
        await opt.unwrap();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain("Called unwrap on a None value");
      }
    });

    it("should handle nested Promises", async () => {
      const nestedPromise = Promise.resolve(Promise.resolve(42));
      const opt = ExperimentalOption.Some(nestedPromise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");
      expect(await opt.unwrap()).toBe(42);
    });
  });

  describe("Lazy Evaluation", () => {
    it("should not execute async transformations immediately", async () => {
      let executionCount = 0;
      const asyncTransform = async (x: number) => {
        executionCount++;
        await AsyncTestHelpers.delay(1);
        return x * 2;
      };

      const opt = ExperimentalOption.Some(42);
      const result = opt.map(asyncTransform);

      // Transformation should not have executed yet
      expect(executionCount).toBe(0);

      // Now execute
      await result.unwrap();

      // Should have executed exactly once
      expect(executionCount).toBe(1);
    });

    it("should cache results for subsequent unwraps", async () => {
      let executionCount = 0;
      const asyncTransform = async (x: number) => {
        executionCount++;
        await AsyncTestHelpers.delay(1);
        return x * 2;
      };

      const opt = ExperimentalOption.Some(42);
      const result = opt.map(asyncTransform);

      // Multiple unwraps should only execute once
      await result.unwrap();
      await result.unwrap();
      await result.unwrap();

      expect(executionCount).toBe(1);
    });

    it("should delay execution until explicitly awaited", async () => {
      let startTime: number;
      let endTime: number;

      const opt = ExperimentalOption.Some(42);
      startTime = performance.now();

      const result = opt.map(async (x) => {
        await AsyncTestHelpers.delay(10);
        return x * 2;
      });

      endTime = performance.now();
      const mapTime = endTime - startTime;

      // Map should return immediately
      expect(mapTime).toBeLessThan(5);

      // Now actually execute
      startTime = performance.now();
      await result.unwrap();
      endTime = performance.now();

      const unwrapTime = endTime - startTime;

      // Unwrap should take at least the delay time
      expect(unwrapTime).toBeGreaterThan(8);
    });
  });

  describe("Type Preservation through Async Boundaries", () => {
    it("should preserve generic types in async transformations", async () => {
      const numberOpt: ExperimentalOption<number> = ExperimentalOption.Some(42);

      const stringResult = numberOpt.map(async (x) => x.toString());
      const booleanResult = numberOpt.map(async (x) => x > 40);

      // TypeScript should infer these correctly
      const str = await stringResult.unwrap();
      const bool = await booleanResult.unwrap();

      expect(str).toBe("42");
      expect(bool).toBe(true);
    });

    it("should handle complex generic types", async () => {
      type User = { id: number; name: string };
      const userOpt: ExperimentalOption<User> = ExperimentalOption.Some({
        id: 1,
        name: "Alice",
      });

      const result = userOpt.map(async (user) => ({
        ...user,
        displayName: user.name.toUpperCase(),
      }));

      const transformed = await result.unwrap();

      expect(transformed).toEqual({
        id: 1,
        name: "Alice",
        displayName: "ALICE",
      });
    });

    it("should maintain type safety in async pipelines", async () => {
      const numberOpt = ExperimentalOption.Some(42);

      // This should compile and work correctly
      const result = numberOpt
        .map((n) => n.toString()) // Returns ExperimentalOption<string>
        .map((str) => str.length) // Returns ExperimentalOption<number>
        .map((len) => len > 5); // Returns ExperimentalOption<boolean>

      expect(await result.unwrap()).toBe(false);
    });
  });

  describe("Error Handling in Async Operations", () => {
    it("should handle async function errors", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt.map(async (x) => {
        throw new Error("Async function error");
      });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      await ErrorTestHelpers.expectThrows(
        () => result.unwrap(),
        "Async function error",
      );
    });

    it("should handle Promise rejection in transformations", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt.map((x) =>
        Promise.reject(new Error("Promise rejection error")),
      );

      expect(result.value.constructor.name).toBe("AsyncOpt");
      await ErrorTestHelpers.expectThrows(
        () => result.unwrap(),
        "Promise rejection error",
      );
    });

    it("should handle errors in async flatMap", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt.flatMap(async (x) => {
        throw new Error("Async flatMap error");
      });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      await ErrorTestHelpers.expectThrows(
        () => result.unwrap(),
        "Async flatMap error",
      );
    });

    it("should handle errors in async zip operations", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt.zip(async (x) => {
        throw new Error("Async zip error");
      });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      await ErrorTestHelpers.expectThrows(
        () => result.unwrap(),
        "Async zip error",
      );
    });
  });

  describe("Performance Characteristics", () => {
    it("should measure async transformation overhead", async () => {
      const syncOpt = ExperimentalOption.Some(42);

      // Measure sync transformation
      const syncTime = await PerformanceHelpers.measureTime(() =>
        syncOpt.map((x) => x * 2),
      );

      // Measure async transformation creation
      const asyncTime = await PerformanceHelpers.measureTime(() =>
        syncOpt.map(async (x) => {
          await AsyncTestHelpers.delay(1);
          return x * 2;
        }),
      );

      // Async creation should not be significantly slower
      expect(asyncTime.timeMs).toBeLessThan(syncTime.timeMs * 10);
    });

    it("should benchmark async vs sync execution", async () => {
      const iterations = 100;
      const delay = 1;

      const syncBenchmark = await PerformanceHelpers.benchmark(async () => {
        const opt = ExperimentalOption.Some(42);
        return opt.map((x) => x * 2).unwrap();
      }, iterations);

      const asyncBenchmark = await PerformanceHelpers.benchmark(async () => {
        const opt = ExperimentalOption.Some(42);
        return opt
          .map(async (x) => {
            await AsyncTestHelpers.delay(delay);
            return x * 2;
          })
          .unwrap();
      }, iterations);

      // Async should be slower due to delays, but not excessively so
      expect(asyncBenchmark.averageTimeMs).toBeGreaterThan(
        syncBenchmark.averageTimeMs,
      );
      expect(asyncBenchmark.averageTimeMs).toBeLessThan(
        syncBenchmark.averageTimeMs * 100,
      );
    });
  });

  describe("Async Option Edge Cases", () => {
    it("should handle undefined Promises", async () => {
      // Create a Promise that resolves to undefined
      const undefinedPromise = Promise.resolve(undefined);
      const opt = ExperimentalOption.Some(undefinedPromise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");
      expect(await opt.unwrap()).toBeUndefined();
    });

    it("should handle null Promises", async () => {
      const nullPromise = Promise.resolve(null);
      const opt = ExperimentalOption.Some(nullPromise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");
      expect(await opt.unwrap()).toBeNull();
    });

    it("should handle very long async chains", async () => {
      let chain = ExperimentalOption.Some(1);

      // Create a long chain of async transformations
      for (let i = 0; i < 50; i++) {
        chain = chain.map(async (x) => {
          await AsyncTestHelpers.delay(0.1);
          return x + 1;
        });
      }

      expect(chain.value.constructor.name).toBe("AsyncOpt");
      expect(await chain.unwrap()).toBe(51);
    });

    it("should handle concurrent async operations", async () => {
      const baseOpt = ExperimentalOption.Some(42);

      // Create multiple async transformations from the same base
      const results = await Promise.all([
        baseOpt
          .map(async (x) => {
            await AsyncTestHelpers.delay(1);
            return x + 1;
          })
          .unwrap(),
        baseOpt
          .map(async (x) => {
            await AsyncTestHelpers.delay(1);
            return x * 2;
          })
          .unwrap(),
        baseOpt
          .map(async (x) => {
            await AsyncTestHelpers.delay(1);
            return x - 1;
          })
          .unwrap(),
      ]);

      expect(results).toEqual([43, 84, 41]);
    });
  });
});
