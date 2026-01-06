/**
 * Performance Benchmark Tests
 *
 * Comprehensive performance testing for all Result classes.
 * Ensures the implementation meets performance requirements and doesn't regress.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  AsyncResult,
  BetterResult,
  SyncResult,
} from "@/internal/result.experimental";
import {
  asyncBuilder,
  BenchmarkScenarios,
  benchmark,
  betterBuilder,
  PerformanceAssertions,
  PerformanceMeasurement,
  PerformanceThresholds,
  syncBuilder,
  TestDataGenerators,
} from "../index";

describe("Performance Benchmarks", () => {
  beforeEach(() => {
    // Reset any global state before each test
    benchmark.clear();
  });

  describe("SyncResult Performance", () => {
    test("should handle simple operations within thresholds", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "sync_map",
        () => {
          return syncBuilder
            .ok()
            .map((x) => x * 2)
            .map((x) => x + 10)
            .map((x) => x.toString())
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.simple.map,
      );
    });

    test("should handle flatMap operations efficiently", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "sync_flatMap",
        () => {
          return syncBuilder
            .ok()
            .flatMap((x) => syncBuilder.okWith(x * 2))
            .flatMap((x) => syncBuilder.okWith(x + 5))
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.simple.flatMap,
      );
    });

    test("should scale linearly with operation count", async () => {
      const chainLengths = [10, 50, 100];
      const measurements = [];

      for (const length of chainLengths) {
        const { duration } = await PerformanceMeasurement.measureTime(
          `chain_${length}`,
          () => {
            let result = syncBuilder.ok();
            for (let i = 0; i < length; i++) {
              result = result.map((x) => x + 1);
            }
            return result.unwrap();
          },
        );

        measurements.push({ size: length, duration });
      }

      PerformanceAssertions.assertLinearScaling(measurements);
    });

    test("should handle large data processing efficiently", async () => {
      const largeArray = TestDataGenerators.arrays.large; // 10,000 elements

      const { duration, memoryDiff } = await PerformanceMeasurement.measureFull(
        "large_array_processing",
        () => {
          return largeArray
            .map((x) => syncBuilder.okWith(x))
            .map((result) => result.unwrap())
            .filter((x) => x % 2 === 0);
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.largeData.array10K,
      );
      PerformanceAssertions.assertMemoryConstraint(
        memoryDiff,
        PerformanceThresholds.memory.array10K,
      );
    });

    test("should handle error short-circuiting efficiently", async () => {
      const iterations = 1000;

      const { duration } = await PerformanceMeasurement.measureTime(
        "error_short_circuit",
        () => {
          for (let i = 0; i < iterations; i++) {
            syncBuilder
              .err()
              .map((x) => x * 2) // Won't execute
              .flatMap((x) => syncBuilder.okWith(x + 5)) // Won't execute
              .zip((x) => x.toString()); // Won't execute
          }
        },
      );

      // Should be extremely fast since operations don't execute
      PerformanceAssertions.assertTimingConstraint(duration, 1); // < 1ms for 1000 operations
    });
  });

  describe("AsyncResult Performance", () => {
    test("should handle simple async operations within thresholds", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "async_map",
        async () => {
          return await asyncBuilder
            .ok()
            .map((x) => x * 2)
            .map((x) => x + 10)
            .map((x) => x.toString())
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.async.simple,
      );
    });

    test("should handle async flatMap operations efficiently", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "async_flatMap",
        async () => {
          return await asyncBuilder
            .ok()
            .flatMap((x) => asyncBuilder.okWith(x * 2))
            .flatMap((x) => asyncBuilder.okWith(x + 5))
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.async.simple * 2,
      );
    });

    test("should handle concurrent async operations efficiently", async () => {
      const concurrency = 100;
      const operations = Array.from({ length: concurrency }, (_, i) =>
        asyncBuilder.okWith(i).map((x) => x * 2),
      );

      const { duration } = await PerformanceMeasurement.measureTime(
        "concurrent_async",
        async () => {
          return Promise.all(operations.map((op) => op.unwrap()));
        },
      );

      // Concurrent operations should be much faster than sequential
      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.async.concurrent,
      );
    });

    test("should handle async operation chains efficiently", async () => {
      const chainLengths = [5, 10, 20];
      const measurements = [];

      for (const length of chainLengths) {
        const { duration } = await PerformanceMeasurement.measureTime(
          `async_chain_${length}`,
          async () => {
            let result = asyncBuilder.ok();
            for (let i = 0; i < length; i++) {
              result = result.map((x) => x + 1);
            }
            return await result.unwrap();
          },
        );

        measurements.push({ size: length, duration });
      }

      PerformanceAssertions.assertLinearScaling(measurements, 3); // Allow more tolerance for async
    });

    test("should handle large async datasets efficiently", async () => {
      const largeArray = TestDataGenerators.arrays.medium; // 1,000 elements

      const { duration } = await PerformanceMeasurement.measureTime(
        "large_async_processing",
        async () => {
          const operations = largeArray.map((x) =>
            asyncBuilder.okWith(x).map((y) => y * 2),
          );
          return Promise.all(operations.map((op) => op.unwrap()));
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.largeData.array1K * 2,
      );
    });
  });

  describe("BetterResult Hybrid Performance", () => {
    test("should handle sync BetterResult operations efficiently", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "better_sync_operations",
        () => {
          return betterBuilder
            .ok()
            .map((x) => x * 2)
            .map((x) => x + 10)
            .zip((x) => x.toString())
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.simple.map,
      );
    });

    test("should handle async BetterResult operations efficiently", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "better_async_operations",
        async () => {
          return await betterBuilder
            .fromResolved(42)
            .map((x) => x * 2)
            .map((x) => x + 10)
            .zip((x) => x.toString())
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.async.simple,
      );
    });

    test("should handle hybrid transitions efficiently", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "hybrid_transitions",
        async () => {
          return await betterBuilder
            .ok()
            .map((x) => x * 2) // sync
            .flatMap((x) => betterBuilder.fromResolved(x + 5)) // becomes async
            .map((x) => x.toString()) // stays async
            .unwrap();
        },
      );

      PerformanceAssertions.assertTimingConstraint(
        duration,
        PerformanceThresholds.timing.async.simple * 1.5,
      );
    });

    test("should minimize overhead for state detection", async () => {
      const syncResult = betterBuilder.ok();
      const asyncResult = betterBuilder.fromResolved(42);

      const { duration: syncDuration } =
        await PerformanceMeasurement.measureTime("sync_state_detection", () => {
          for (let i = 0; i < 1000; i++) {
            syncResult.isAsync();
            syncResult.isOk();
            syncResult.isErr();
          }
        });

      const { duration: asyncDuration } =
        await PerformanceMeasurement.measureTime(
          "async_state_detection",
          async () => {
            for (let i = 0; i < 1000; i++) {
              asyncResult.isAsync();
              await asyncResult.isOk();
              await asyncResult.isErr();
            }
          },
        );

      // Sync state detection should be very fast
      PerformanceAssertions.assertTimingConstraint(syncDuration, 1);
      // Async state detection should be reasonable
      PerformanceAssertions.assertTimingConstraint(asyncDuration, 50);
    });

    test("should handle conditional returns efficiently", async () => {
      const syncResult = betterBuilder.ok();
      const asyncResult = betterBuilder.fromResolved(42);

      const iterations = 1000;

      const { duration: syncDuration } =
        await PerformanceMeasurement.measureTime(
          "sync_conditional_returns",
          () => {
            for (let i = 0; i < iterations; i++) {
              const isOk = syncResult.isOk(); // Should return boolean immediately
              const isErr = syncResult.isErr(); // Should return boolean immediately
              if (isOk) {
                syncResult.unwrap(); // Should return value immediately
              }
            }
          },
        );

      const { duration: asyncDuration } =
        await PerformanceMeasurement.measureTime(
          "async_conditional_returns",
          async () => {
            for (let i = 0; i < iterations; i++) {
              const isOk = asyncResult.isOk(); // Should return Promise
              const isErr = asyncResult.isErr(); // Should return Promise
              if (await isOk) {
                await asyncResult.unwrap(); // Should return Promise
              }
            }
          },
        );

      PerformanceAssertions.assertTimingConstraint(syncDuration, 1);
      PerformanceAssertions.assertTimingConstraint(asyncDuration, 100);
    });
  });

  describe("Memory Management Performance", () => {
    test("should not create memory leaks with SyncResult", async () => {
      const memorySnapshots = [];

      for (let iteration = 0; iteration < 10; iteration++) {
        const operations = [];

        // Create many SyncResult instances
        for (let i = 0; i < 10000; i++) {
          operations.push(syncBuilder.okWith(i).map((x) => x * 2));
        }

        // Execute operations
        operations.forEach((op) => op.unwrap());

        // Measure memory if available
        if (performance.memory) {
          memorySnapshots.push(performance.memory.usedJSHeapSize);
        }

        // Clear references
        operations.length = 0;

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      if (memorySnapshots.length > 0) {
        const memoryLeakDetected =
          PerformanceAnalysis.detectMemoryLeaks(memorySnapshots);
        expect(memoryLeakDetected).toBe(false);
      }
    });

    test("should not create memory leaks with AsyncResult", async () => {
      const memorySnapshots = [];

      for (let iteration = 0; iteration < 5; iteration++) {
        const operations = [];

        // Create many AsyncResult instances
        for (let i = 0; i < 1000; i++) {
          operations.push(asyncBuilder.okWith(i).map((x) => x * 2));
        }

        // Execute operations
        await Promise.all(operations.map((op) => op.unwrap()));

        // Measure memory if available
        if (performance.memory) {
          memorySnapshots.push(performance.memory.usedJSHeapSize);
        }

        // Clear references
        operations.length = 0;

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      if (memorySnapshots.length > 0) {
        const memoryLeakDetected =
          PerformanceAnalysis.detectMemoryLeaks(memorySnapshots);
        expect(memoryLeakDetected).toBe(false);
      }
    });

    test("should handle large object operations without excessive memory growth", async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Process large nested objects
      const largeObjects = TestDataGenerators.nested.medium; // 100 complex objects

      const results = largeObjects.map((obj) =>
        betterBuilder
          .okWith(obj)
          .map((x) => ({ ...x, processed: true }))
          .map((x) => Object.keys(x).length),
      );

      results.forEach((result) => result.unwrap());

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryDiff = finalMemory - initialMemory;

      // Memory growth should be reasonable
      PerformanceAssertions.assertMemoryConstraint(
        memoryDiff,
        PerformanceThresholds.memory.array1K * 5,
      );
    });
  });

  describe("Scalability Tests", () => {
    test("should handle increasing data volumes efficiently", async () => {
      const dataSizes = [100, 1000, 5000];
      const measurements = [];

      for (const size of dataSizes) {
        const data = Array.from({ length: size }, (_, i) => i);

        const { duration } = await PerformanceMeasurement.measureTime(
          `volume_${size}`,
          async () => {
            const results = data.map((x) =>
              betterBuilder.okWith(x).map((y) => y * 2),
            );
            return results.map((result) => result.unwrap());
          },
        );

        measurements.push({ size, duration });
      }

      PerformanceAssertions.assertLinearScaling(measurements, 3);
    });

    test("should handle increasing operation depth efficiently", async () => {
      const depths = [5, 10, 25];
      const measurements = [];

      for (const depth of depths) {
        const { duration } = await PerformanceMeasurement.measureTime(
          `depth_${depth}`,
          () => {
            let result = syncBuilder.ok();
            for (let i = 0; i < depth; i++) {
              result = result
                .map((x) => x + 1)
                .zip((x) => x * 2)
                .flatMap(([original, doubled]) =>
                  syncBuilder.okWith(original + doubled),
                );
            }
            return result.unwrap();
          },
        );

        measurements.push({ size: depth, duration });
      }

      PerformanceAssertions.assertLinearScaling(measurements, 2);
    });

    test("should handle concurrent load scaling", async () => {
      const concurrencyLevels = [10, 50, 100];
      const measurements = [];

      for (const concurrency of concurrencyLevels) {
        const { duration } = await PerformanceMeasurement.measureTime(
          `concurrency_${concurrency}`,
          async () => {
            const operations = Array.from({ length: concurrency }, (_, i) =>
              betterBuilder.fromResolved(i).map((x) => x * 2),
            );

            return Promise.all(operations.map((op) => op.unwrap()));
          },
        );

        measurements.push({ size: concurrency, duration });
      }

      // Concurrent operations should scale sublinearly
      PerformanceAssertions.assertLinearScaling(measurements, 1.5);
    });
  });

  describe("Benchmark Regression Tests", () => {
    test("should meet established performance baselines", async () => {
      for (const [scenario, config] of Object.entries(
        RegressionTests.baselines,
      )) {
        const { duration } = await PerformanceMeasurement.measureTime(
          scenario,
          async () => {
            switch (scenario) {
              case "syncResult_map":
                return syncBuilder
                  .ok()
                  .map((x) => x * 2)
                  .unwrap();
              case "syncResult_flatMap":
                return syncBuilder
                  .ok()
                  .flatMap((x) => syncBuilder.okWith(x * 2))
                  .unwrap();
              case "asyncResult_map":
                return await asyncBuilder
                  .ok()
                  .map((x) => x * 2)
                  .unwrap();
              case "betterResult_hybrid":
                return await betterBuilder
                  .ok()
                  .map((x) => x * 2)
                  .unwrap();
              default:
                throw new Error(`Unknown baseline scenario: ${scenario}`);
            }
          },
        );

        expect(duration).toBeLessThanOrEqual(
          config.baselineTimeMs * config.toleranceFactor,
        );
      }
    });

    test("should meet memory usage baselines", async () => {
      for (const [scenario, config] of Object.entries(
        RegressionTests.memoryBaselines,
      )) {
        const initialMemory = performance.memory?.usedJSHeapSize || 0;

        switch (scenario) {
          case "result_creation":
            for (let i = 0; i < config.count; i++) {
              betterBuilder.okWith(i);
            }
            break;
          case "chain_operations":
            for (let i = 0; i < config.iterations; i++) {
              let result = betterBuilder.ok();
              for (let j = 0; j < config.chainLength; j++) {
                result = result.map((x) => x + 1);
              }
              result.unwrap();
            }
            break;
        }

        const finalMemory = performance.memory?.usedJSHeapSize || 0;
        const memoryDiff = finalMemory - initialMemory;

        if (memoryDiff > 0) {
          expect(memoryDiff).toBeLessThanOrEqual(
            config.baselineMemoryBytes * config.toleranceFactor,
          );
        }
      }
    });
  });

  describe("Stress Testing", () => {
    test("should handle high-volume operations without degradation", async () => {
      const highVolumeCount = 100000;

      const { duration } = await PerformanceMeasurement.measureTime(
        "high_volume_sync",
        () => {
          const results = [];
          for (let i = 0; i < highVolumeCount; i++) {
            results.push(syncBuilder.okWith(i).map((x) => x * 2));
          }
          return results.map((r) => r.unwrap());
        },
      );

      // Should handle 100k operations efficiently
      expect(duration).toBeLessThan(500); // < 500ms for 100k operations
    });

    test("should handle deep nesting without stack overflow", () => {
      const nestingDepth = 10000;

      expect(() => {
        let result = syncBuilder.ok();
        for (let i = 0; i < nestingDepth; i++) {
          result = result.map((x) => x + 1);
        }
        return result.unwrap();
      }).not.toThrow();
    });

    test("should handle concurrent async operations under load", async () => {
      const concurrency = 1000;
      const operationsPerBatch = 100;

      const { duration } = await PerformanceMeasurement.measureTime(
        "async_load_test",
        async () => {
          const batches = [];

          for (
            let batch = 0;
            batch < concurrency / operationsPerBatch;
            batch++
          ) {
            const batchOperations = Array.from(
              { length: operationsPerBatch },
              (_, i) =>
                betterBuilder
                  .fromResolved(batch * operationsPerBatch + i)
                  .map((x) => x * 2),
            );
            batches.push(Promise.all(batchOperations.map((op) => op.unwrap())));
          }

          return Promise.all(batches);
        },
      );

      // Should handle high concurrency efficiently
      expect(duration).toBeLessThan(1000); // < 1 second for 1000 concurrent operations
    });
  });
});

/**
 * Performance analysis utility for detecting memory leaks and scaling patterns
 */
const PerformanceAnalysis = {
  detectMemoryLeaks: (memorySnapshots: number[]): boolean => {
    if (memorySnapshots.length < 3) return false;

    let increasingTrend = 0;
    for (let i = 1; i < memorySnapshots.length; i++) {
      if (memorySnapshots[i] > memorySnapshots[i - 1]) {
        increasingTrend++;
      }
    }

    const trendRatio = increasingTrend / (memorySnapshots.length - 1);
    return trendRatio > 0.8; // 80% of measurements show increase
  },
};
