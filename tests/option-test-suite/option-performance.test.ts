import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";
import { AsyncTestHelpers, PerformanceHelpers } from "./test-utils";

/**
 * Performance Benchmark Tests
 *
 * These tests measure the performance characteristics of the Option implementation
 * to ensure it meets practical usage requirements. They include:
 *
 * 1. Creation overhead measurements
 * 2. Transformation chain performance
 * 3. Memory usage patterns
 * 4. Async vs sync performance comparison
 * 5. Large dataset handling
 */

describe("ExperimentalOption - Performance Benchmarks", () => {
  const ITERATIONS = {
    SMALL: 100,
    MEDIUM: 1000,
    LARGE: 10000,
  };

  describe("Option Creation Performance", () => {
    it("should benchmark Some() creation speed", async () => {
      const benchmark = await PerformanceHelpers.benchmark(
        () => ExperimentalOption.Some(42),
        ITERATIONS.MEDIUM,
      );

      console.log(
        `📊 Some() creation: ${benchmark.averageTimeMs.toFixed(4)}ms average (${ITERATIONS.MEDIUM} iterations)`,
      );
      console.log(`   Total time: ${benchmark.totalTimeMs.toFixed(2)}ms`);

      // Should be very fast - less than 0.01ms per creation
      expect(benchmark.averageTimeMs).toBeLessThan(0.01);
    });

    it("should benchmark None access speed", async () => {
      const benchmark = await PerformanceHelpers.benchmark(
        () => ExperimentalOption.None,
        ITERATIONS.MEDIUM,
      );

      console.log(
        `📊 None access: ${benchmark.averageTimeMs.toFixed(4)}ms average (${ITERATIONS.MEDIUM} iterations)`,
      );
      console.log(`   Total time: ${benchmark.totalTimeMs.toFixed(2)}ms`);

      // None should be even faster (singleton)
      expect(benchmark.averageTimeMs).toBeLessThan(0.005);
    });

    it("should compare Option creation vs raw value usage", async () => {
      const optionBenchmark = await PerformanceHelpers.benchmark(() => {
        const opt = ExperimentalOption.Some(42);
        return opt.unwrap();
      }, ITERATIONS.MEDIUM);

      const rawBenchmark = await PerformanceHelpers.benchmark(() => {
        const value = 42;
        return value;
      }, ITERATIONS.MEDIUM);

      console.log(
        `📊 Option round-trip: ${optionBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Raw value usage: ${rawBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Overhead ratio: ${(optionBenchmark.averageTimeMs / rawBenchmark.averageTimeMs).toFixed(2)}x`,
      );

      // Option overhead should be reasonable (< 100x raw value)
      expect(
        optionBenchmark.averageTimeMs / rawBenchmark.averageTimeMs,
      ).toBeLessThan(100);
    });
  });

  describe("Transformation Performance", () => {
    it("should benchmark map() transformation speed", async () => {
      const chainLength = 10;
      const opt = ExperimentalOption.Some(42);

      const benchmark = await PerformanceHelpers.benchmark(() => {
        let result = opt;
        for (let i = 0; i < chainLength; i++) {
          result = result.map((x) => x + 1);
        }
        return result.unwrap();
      }, ITERATIONS.SMALL);

      console.log(
        `📊 ${chainLength}-step map() chain: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `   Per transformation: ${(benchmark.averageTimeMs / chainLength).toFixed(4)}ms`,
      );

      // Should be efficient - less than 1ms per transformation
      expect(benchmark.averageTimeMs / chainLength).toBeLessThan(1);
    });

    it("should benchmark flatMap() transformation speed", async () => {
      const chainLength = 10;
      const opt = ExperimentalOption.Some(42);

      const benchmark = await PerformanceHelpers.benchmark(() => {
        let result = opt;
        for (let i = 0; i < chainLength; i++) {
          result = result.flatMap((x) => ExperimentalOption.Some(x + 1));
        }
        return result.unwrap();
      }, ITERATIONS.SMALL);

      console.log(
        `📊 ${chainLength}-step flatMap() chain: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `   Per transformation: ${(benchmark.averageTimeMs / chainLength).toFixed(4)}ms`,
      );

      // flatMap should be slightly slower than map but still efficient
      expect(benchmark.averageTimeMs / chainLength).toBeLessThan(2);
    });

    it("should benchmark complex transformation pipelines", async () => {
      const pipelineLength = 20;
      const opt = ExperimentalOption.Some("  hello world  ");

      const benchmark = await PerformanceHelpers.benchmark(() => {
        let result = opt;
        for (let i = 0; i < pipelineLength; i++) {
          result = result
            .flatMap((s) =>
              s.trim()
                ? ExperimentalOption.Some(s.trim())
                : ExperimentalOption.None,
            )
            .map((s) => s.toUpperCase())
            .map((s) => s.toLowerCase());
        }
        return result.unwrap();
      }, ITERATIONS.SMALL);

      console.log(
        `📊 ${pipelineLength}-step complex pipeline: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );

      // Complex pipelines should still be reasonably fast
      expect(benchmark.averageTimeMs).toBeLessThan(10);
    });
  });

  describe("Async Performance", () => {
    it("should benchmark async transformation creation overhead", async () => {
      const opt = ExperimentalOption.Some(42);

      const syncBenchmark = await PerformanceHelpers.benchmark(
        () => opt.map((x) => x * 2),
        ITERATIONS.SMALL,
      );

      const asyncCreationBenchmark = await PerformanceHelpers.benchmark(
        () =>
          opt.map(async (x) => {
            await AsyncTestHelpers.delay(1);
            return x * 2;
          }),
        ITERATIONS.SMALL,
      );

      console.log(
        `📊 Sync map() creation: ${syncBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Async map() creation: ${asyncCreationBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Creation overhead: ${(asyncCreationBenchmark.averageTimeMs / syncBenchmark.averageTimeMs).toFixed(2)}x`,
      );

      // Async creation should not be significantly slower than sync creation
      expect(
        asyncCreationBenchmark.averageTimeMs / syncBenchmark.averageTimeMs,
      ).toBeLessThan(10);
    });

    it("should benchmark async transformation execution", async () => {
      const opt = ExperimentalOption.Some(42);
      const delayMs = 5;

      const asyncBenchmark = await PerformanceHelpers.benchmark(async () => {
        const result = opt.map(async (x) => {
          await AsyncTestHelpers.delay(delayMs);
          return x * 2;
        });
        return await result.unwrap();
      }, ITERATIONS.SMALL);

      console.log(
        `📊 Async transformation execution: ${asyncBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(`   Expected minimum: ${delayMs}ms`);

      // Should take at least the delay time
      expect(asyncBenchmark.averageTimeMs).toBeGreaterThan(delayMs - 1);
      // But not excessively more
      expect(asyncBenchmark.averageTimeMs).toBeLessThan(delayMs * 3);
    });

    it("should compare sync vs async pipeline performance", async () => {
      const pipelineLength = 5;
      const opt = ExperimentalOption.Some(42);

      const syncPipelineBenchmark = await PerformanceHelpers.benchmark(() => {
        let result = opt;
        for (let i = 0; i < pipelineLength; i++) {
          result = result.map((x) => x * 2);
        }
        return result.unwrap();
      }, ITERATIONS.SMALL);

      const asyncPipelineBenchmark = await PerformanceHelpers.benchmark(
        async () => {
          let result = opt;
          for (let i = 0; i < pipelineLength; i++) {
            result = result.map(async (x) => {
              await AsyncTestHelpers.delay(1);
              return x * 2;
            });
          }
          return await result.unwrap();
        },
        ITERATIONS.SMALL,
      );

      console.log(
        `📊 Sync ${pipelineLength}-step pipeline: ${syncPipelineBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Async ${pipelineLength}-step pipeline: ${asyncPipelineBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Async overhead: ${(asyncPipelineBenchmark.averageTimeMs / syncPipelineBenchmark.averageTimeMs).toFixed(2)}x`,
      );

      // Async should be slower due to delays, but within reasonable bounds
      expect(
        asyncPipelineBenchmark.averageTimeMs /
          syncPipelineBenchmark.averageTimeMs,
      ).toBeLessThan(50);
    });
  });

  describe("Memory Usage Patterns", () => {
    it("should benchmark object creation patterns", async () => {
      const iterations = ITERATIONS.SMALL;

      // Test Option creation
      const optionCreationBenchmark = await PerformanceHelpers.benchmark(() => {
        const opts = [];
        for (let i = 0; i < 100; i++) {
          opts.push(ExperimentalOption.Some(i));
        }
        return opts;
      }, 10);

      // Test transformation chaining
      const chainingBenchmark = await PerformanceHelpers.benchmark(() => {
        let opt = ExperimentalOption.Some(1);
        for (let i = 0; i < 50; i++) {
          opt = opt.map((x) => x + 1);
        }
        return opt;
      }, 10);

      console.log(
        `📊 Option creation batch: ${optionCreationBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Long chaining: ${chainingBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );

      // Should not create excessive memory pressure
      expect(optionCreationBenchmark.averageTimeMs).toBeLessThan(50);
      expect(chainingBenchmark.averageTimeMs).toBeLessThan(10);
    });

    it("should test memory efficiency with None propagation", async () => {
      const iterations = ITERATIONS.SMALL;

      const someBenchmark = await PerformanceHelpers.benchmark(() => {
        const opt = ExperimentalOption.Some(42);
        let result = opt;
        for (let i = 0; i < 20; i++) {
          result = result.map((x) => x * 2);
        }
        return result.unwrap();
      }, iterations);

      const noneBenchmark = await PerformanceHelpers.benchmark(() => {
        const opt = ExperimentalOption.None;
        let result = opt;
        for (let i = 0; i < 20; i++) {
          result = result.map((x) => x * 2);
        }
        try {
          return result.unwrap();
        } catch {
          return null; // Expected to throw
        }
      }, iterations);

      console.log(
        `📊 Some propagation: ${someBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 None propagation: ${noneBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 None efficiency: ${(someBenchmark.averageTimeMs / noneBenchmark.averageTimeMs).toFixed(2)}x faster`,
      );

      // None propagation should be faster (short-circuiting)
      expect(noneBenchmark.averageTimeMs).toBeLessThan(
        someBenchmark.averageTimeMs,
      );
    });
  });

  describe("Large Dataset Performance", () => {
    it("should handle large numbers of Options efficiently", async () => {
      const datasetSize = ITERATIONS.MEDIUM;

      const creationBenchmark = await PerformanceHelpers.benchmark(() => {
        const options = [];
        for (let i = 0; i < datasetSize; i++) {
          options.push(ExperimentalOption.Some(i));
        }
        return options;
      }, 5);

      const processingBenchmark = await PerformanceHelpers.benchmark(
        async () => {
          const promises = [];
          for (let i = 0; i < datasetSize; i++) {
            const opt = ExperimentalOption.Some(i);
            promises.push(opt.map((x) => x * 2).unwrap());
          }
          return Promise.all(promises);
        },
        5,
      );

      console.log(
        `📊 Creating ${datasetSize} Options: ${creationBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Processing ${datasetSize} Options: ${processingBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );

      // Should handle large datasets efficiently
      expect(creationBenchmark.averageTimeMs).toBeLessThan(100);
      expect(processingBenchmark.averageTimeMs).toBeLessThan(1000);
    });

    it("should test performance with complex data structures", async () => {
      const complexData = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        profile: {
          age: 30,
          preferences: {
            theme: "dark",
            notifications: true,
            privacy: {
              visible: true,
              searchable: false,
            },
          },
        },
        tags: ["developer", "javascript", "typescript"],
        metadata: new Map([
          ["created", new Date()],
          ["updated", new Date()],
          ["version", 1.0],
        ]),
      };

      const benchmark = await PerformanceHelpers.benchmark(() => {
        const opt = ExperimentalOption.Some(complexData);
        return opt
          .map((user) => user.profile)
          .map((profile) => profile.preferences)
          .map((prefs) => prefs.privacy)
          .unwrap();
      }, ITERATIONS.SMALL);

      console.log(
        `📊 Complex object transformations: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );

      // Should handle complex objects efficiently
      expect(benchmark.averageTimeMs).toBeLessThan(1);
    });
  });

  describe("Comparison with Raw JavaScript", () => {
    it("should compare Option chaining vs raw conditional chaining", async () => {
      const iterations = ITERATIONS.MEDIUM;

      // Option-based approach
      const optionBenchmark = await PerformanceHelpers.benchmark(() => {
        const opt = ExperimentalOption.Some(Math.random() * 100);
        return opt
          .map((n) => Math.floor(n))
          .map((n) => (n % 2 === 0 ? n : n + 1))
          .map((n) => n.toString())
          .map((str) => str.length)
          .unwrap();
      }, iterations);

      // Raw conditional approach
      const rawBenchmark = await PerformanceHelpers.benchmark(() => {
        const value = Math.random() * 100;
        if (value !== null && value !== undefined) {
          const floored = Math.floor(value);
          const even = floored % 2 === 0 ? floored : floored + 1;
          const str = even.toString();
          return str.length;
        }
        return 0;
      }, iterations);

      console.log(
        `📊 Option chaining: ${optionBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Raw conditionals: ${rawBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Performance ratio: ${(optionBenchmark.averageTimeMs / rawBenchmark.averageTimeMs).toFixed(2)}x`,
      );

      // Option should have reasonable overhead (< 20x)
      expect(
        optionBenchmark.averageTimeMs / rawBenchmark.averageTimeMs,
      ).toBeLessThan(20);
    });

    it("should compare error handling approaches", async () => {
      const iterations = ITERATIONS.MEDIUM;

      // Option-based error handling
      const optionErrorBenchmark = await PerformanceHelpers.benchmark(() => {
        const opt =
          Math.random() > 0.1
            ? ExperimentalOption.Some(42)
            : ExperimentalOption.None;
        return opt.map((x) => x * 2).unwrapOr(0);
      }, iterations);

      // Try-catch error handling
      const tryCatchBenchmark = await PerformanceHelpers.benchmark(() => {
        try {
          const value = Math.random() > 0.1 ? 42 : null;
          if (value === null) throw new Error("No value");
          return value * 2;
        } catch {
          return 0;
        }
      }, iterations);

      console.log(
        `📊 Option error handling: ${optionErrorBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Try-catch handling: ${tryCatchBenchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `📊 Error handling ratio: ${(optionErrorBenchmark.averageTimeMs / tryCatchBenchmark.averageTimeMs).toFixed(2)}x`,
      );

      // Option error handling should be competitive
      expect(
        optionErrorBenchmark.averageTimeMs / tryCatchBenchmark.averageTimeMs,
      ).toBeLessThan(10);
    });
  });

  describe("Stress Tests", () => {
    it("should handle very long transformation chains", async () => {
      const chainLength = 1000;

      const benchmark = await PerformanceHelpers.benchmark(
        () => {
          let opt = ExperimentalOption.Some(1);
          for (let i = 0; i < chainLength; i++) {
            opt = opt.map((x) => x + 1);
          }
          return opt.unwrap();
        },
        10, // Fewer iterations for long chains
      );

      console.log(
        `📊 ${chainLength}-step transformation chain: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(
        `   Per step: ${(benchmark.averageTimeMs / chainLength).toFixed(6)}ms average`,
      );

      // Should still handle long chains reasonably
      expect(benchmark.averageTimeMs).toBeLessThan(100);
      expect(benchmark.averageTimeMs / chainLength).toBeLessThan(0.1);
    });

    it("should handle deep async nesting", async () => {
      const nestingDepth = 50;

      const benchmark = await PerformanceHelpers.benchmark(
        async () => {
          let opt = ExperimentalOption.Some(1);
          for (let i = 0; i < nestingDepth; i++) {
            opt = opt.map(async (x) => {
              await AsyncTestHelpers.delay(0.1);
              return x + 1;
            });
          }
          return await opt.unwrap();
        },
        5, // Fewer iterations for deep nesting
      );

      console.log(
        `📊 ${nestingDepth}-level async nesting: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );
      console.log(`   Expected minimum: ${(nestingDepth * 0.1).toFixed(2)}ms`);

      // Should take at least the sum of all delays
      expect(benchmark.averageTimeMs).toBeGreaterThan(nestingDepth * 0.1 * 0.8);
      // But not excessively more
      expect(benchmark.averageTimeMs).toBeLessThan(nestingDepth * 0.1 * 2);
    });

    it("should test memory usage with many concurrent Options", async () => {
      const concurrentOptions = ITERATIONS.MEDIUM;

      const benchmark = await PerformanceHelpers.benchmark(async () => {
        const promises = [];
        for (let i = 0; i < concurrentOptions; i++) {
          const opt = ExperimentalOption.Some(i);
          promises.push(
            opt
              .map((x) => x * 2)
              .map((x) => x.toString())
              .map((str) => parseInt(str, 10))
              .unwrap(),
          );
        }
        return Promise.all(promises);
      }, 5);

      console.log(
        `📊 ${concurrentOptions} concurrent Options: ${benchmark.averageTimeMs.toFixed(4)}ms average`,
      );

      // Should handle concurrency well
      expect(benchmark.averageTimeMs).toBeLessThan(500);
    });
  });

  describe("Performance Summary", () => {
    it("should provide a comprehensive performance overview", async () => {
      console.log("\n🏁 Performance Summary:");
      console.log(
        "   Run 'bun test tests/spec-compliance/option-performance.test.ts' for detailed metrics",
      );
      console.log("   All tests should pass within reasonable time limits");
      console.log("   Monitor for regressions in future implementations");

      // This test always passes - it's for summary reporting
      expect(true).toBe(true);
    });
  });
});
