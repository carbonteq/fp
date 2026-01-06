/**
 * Performance Test Data and Benchmarks
 *
 * Provides performance-specific test data and expected performance characteristics.
 */

/**
 * Performance expectations and thresholds
 */
export const PerformanceThresholds = {
  /** Operation time thresholds (in milliseconds) */
  timing: {
    simple: {
      map: 0.1, // 0.1ms for simple map operation
      flatMap: 0.2, // 0.2ms for simple flatMap
      zip: 0.15, // 0.15ms for simple zip
    },
    complex: {
      chain10: 1.0, // 1ms for 10 operations chain
      chain100: 10.0, // 10ms for 100 operations chain
      deepNesting50: 5.0, // 5ms for 50 levels of nesting
    },
    largeData: {
      array1K: 1.0, // 1ms for 1,000 elements
      array10K: 10.0, // 10ms for 10,000 elements
      array100K: 100.0, // 100ms for 100,000 elements
    },
    async: {
      simple: 5.0, // 5ms overhead for simple async
      chain10: 50.0, // 50ms for 10 async operations
      concurrent: 100.0, // 100ms for concurrent operations
    },
  },

  /** Memory usage thresholds (in bytes) */
  memory: {
    result: 100, // 100 bytes per Result instance
    array1K: 8000, // 8KB for 1,000 element array
    array10K: 80000, // 80KB for 10,000 element array
    leakTolerance: 1.5, // 50% memory growth tolerance
  },

  /** Scaling expectations */
  scaling: {
    linear: 2.0, // Allow 2x linear scaling tolerance
    logarithmic: 1.2, // Allow 1.2x logarithmic scaling tolerance
    quadratic: 10.0, // Allow 10x quadratic scaling tolerance
  },
} as const;

/**
 * Performance test data generators
 */
export const PerformanceData = {
  /** Generate arrays of various sizes for testing */
  arrays: {
    tiny: Array.from({ length: 10 }, (_, i) => i),
    small: Array.from({ length: 100 }, (_, i) => i),
    medium: Array.from({ length: 1000 }, (_, i) => i),
    large: Array.from({ length: 10000 }, (_, i) => i),
    huge: Array.from({ length: 100000 }, (_, i) => i),
  },

  /** Generate operation chains of various lengths */
  chains: {
    short: Array.from({ length: 5 }, (_, i) => (x: number) => x + i + 1),
    medium: Array.from({ length: 20 }, (_, i) => (x: number) => x + i + 1),
    long: Array.from({ length: 100 }, (_, i) => (x: number) => x + i + 1),
    veryLong: Array.from({ length: 1000 }, (_, i) => (x: number) => x + i + 1),
  },

  /** Generate complex nested structures */
  nested: {
    shallow: Array.from({ length: 10 }, (_, i) => ({
      id: i,
      value: Math.random(),
      nested: { a: i, b: i * 2 },
    })),
    medium: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: Math.random(),
      nested: {
        a: i,
        b: i * 2,
        deep: { c: i * 3, d: i * 4 },
      },
    })),
    deep: Array.from({ length: 50 }, (_, i) => ({
      id: i,
      value: Math.random(),
      nested: {
        level1: { level2: { level3: { level4: { level5: i } } } },
      },
    })),
  },

  /** Generate strings of various lengths */
  strings: {
    short: "hello world",
    medium: "a".repeat(100),
    long: "b".repeat(1000),
    veryLong: "c".repeat(10000),
    huge: "d".repeat(100000),
  },
} as const;

/**
 * Benchmark test scenarios
 */
export const BenchmarkScenarios = {
  /** Individual operation benchmarks */
  operations: [
    {
      name: "map_number_arithmetic",
      operation: (x: number) => x * 2 + 1,
      inputSize: 10000,
      expectedMaxTime: PerformanceThresholds.timing.complex.array1K,
    },
    {
      name: "map_string_manipulation",
      operation: (x: string) => x.toUpperCase().trim(),
      inputSize: 1000,
      expectedMaxTime: PerformanceThresholds.timing.complex.array1K,
    },
    {
      name: "flatMap_validation_chain",
      operation: (x: number) =>
        x >= 0 ? { ok: true, value: x } : { ok: false, error: "negative" },
      inputSize: 1000,
      expectedMaxTime: PerformanceThresholds.timing.complex.array1K,
    },
    {
      name: "zip_tuple_creation",
      operation: (x: number) => [x, x * 2] as [number, number],
      inputSize: 1000,
      expectedMaxTime: PerformanceThresholds.timing.complex.array1K,
    },
  ],

  /** Chain operation benchmarks */
  chains: [
    {
      name: "linear_chain_10",
      chainLength: 10,
      operation: (x: number, i: number) => x + i,
      initialValue: 0,
      expectedMaxTime: PerformanceThresholds.timing.complex.chain10,
    },
    {
      name: "linear_chain_100",
      chainLength: 100,
      operation: (x: number, i: number) => x + i,
      initialValue: 0,
      expectedMaxTime: PerformanceThresholds.timing.complex.chain100,
    },
    {
      name: "complex_transform_chain",
      chainLength: 20,
      operations: [
        (x: number) => x * 2,
        (x: number) => Math.sqrt(x),
        (x: number) => Math.floor(x),
        (x: number) => x.toString(),
        (x: string) => parseInt(x, 10),
        (x: number) => x + 1,
      ],
      initialValue: 10,
      expectedMaxTime: PerformanceThresholds.timing.complex.chain10,
    },
  ],

  /** Memory intensive benchmarks */
  memory: [
    {
      name: "large_array_processing",
      inputSize: 10000,
      operation: (arr: number[]) =>
        arr.map((x) => x * 2).filter((x) => x > 100),
      expectedMaxMemory: PerformanceThresholds.memory.array10K * 2, // 2x for transformed array
    },
    {
      name: "nested_object_processing",
      inputSize: 1000,
      operation: (objs: any[]) =>
        objs.map((obj) => ({
          ...obj,
          processed: true,
          nested: { ...obj.nested },
        })),
      expectedMaxMemory: PerformanceThresholds.memory.array1K * 3, // 3x for nested copies
    },
  ],

  /** Async operation benchmarks */
  async: [
    {
      name: "simple_async_map",
      delayMs: 10,
      operation: async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return x * 2;
      },
      inputSize: 100,
      expectedMaxTime: PerformanceThresholds.timing.async.simple * 2, // Account for delay
    },
    {
      name: "async_chain_10",
      chainLength: 10,
      delayPerOperation: 5,
      operation: async (x: number, i: number) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return x + i;
      },
      initialValue: 0,
      expectedMaxTime: PerformanceThresholds.timing.async.chain10,
    },
    {
      name: "concurrent_operations",
      concurrency: 10,
      delayMs: 20,
      operation: async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return x * 2;
      },
      inputSize: 10,
      expectedMaxTime: PerformanceThresholds.timing.async.concurrent,
    },
  ],
} as const;

/**
 * Performance regression test data
 */
export const RegressionTests = {
  /** Known performance characteristics for regression testing */
  baselines: {
    syncResult_map: {
      operation: "syncResult.map",
      inputSize: 1000,
      baselineTimeMs: 0.5,
      toleranceFactor: 2.0,
    },
    syncResult_flatMap: {
      operation: "syncResult.flatMap",
      inputSize: 1000,
      baselineTimeMs: 1.0,
      toleranceFactor: 2.0,
    },
    asyncResult_map: {
      operation: "asyncResult.map",
      inputSize: 100,
      baselineTimeMs: 10.0,
      toleranceFactor: 2.0,
    },
    betterResult_hybrid: {
      operation: "betterResult.hybrid_operations",
      inputSize: 500,
      baselineTimeMs: 5.0,
      toleranceFactor: 2.0,
    },
  },

  /** Memory leak detection baselines */
  memoryBaselines: {
    result_creation: {
      count: 10000,
      baselineMemoryBytes: 1000000, // 1MB
      toleranceFactor: 1.5,
    },
    chain_operations: {
      chainLength: 100,
      iterations: 100,
      baselineMemoryBytes: 500000, // 500KB
      toleranceFactor: 2.0,
    },
  },
} as const;

/**
 * Stress testing scenarios
 */
export const StressTests = {
  /** High-volume operation testing */
  highVolume: [
    {
      name: "million_operations",
      operationCount: 1000000,
      operation: (i: number) => i * 2,
      expectedMaxTimeMs: 1000, // 1 second
    },
    {
      name: "deep_nesting",
      nestingDepth: 1000,
      operation: (depth: number) =>
        Array.from({ length: depth }, (_, i) => ({ nested: i })),
      expectedMaxTimeMs: 100, // 100ms
    },
  ],

  /** Concurrent load testing */
  concurrency: [
    {
      name: "concurrent_chains",
      concurrency: 100,
      chainLength: 10,
      operation: (x: number) => x + 1,
      expectedMaxTimeMs: 500, // 500ms
    },
    {
      name: "async_concurrent",
      concurrency: 50,
      delayMs: 100,
      operation: async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return x * 2;
      },
      expectedMaxTimeMs: 200, // Should complete in ~200ms, not 5000ms
    },
  ],

  /** Memory pressure testing */
  memoryPressure: [
    {
      name: "large_dataset_processing",
      datasetSize: 1000000,
      operation: (data: number[]) =>
        data.filter((x) => x % 2 === 0).map((x) => x * 2),
      expectedMaxMemoryMB: 100, // 100MB
    },
    {
      name: "frequent_creation_disposal",
      iterations: 100000,
      operation: () => ({ ok: true, value: Math.random() }),
      expectedMaxMemoryMB: 50, // 50MB
    },
  ],
} as const;

/**
 * Performance analysis utilities
 */
export const PerformanceAnalysis = {
  /** Calculate performance statistics */
  calculateStats: (measurements: number[]) => {
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);

    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      sum,
    };
  },

  /** Analyze scaling behavior */
  analyzeScaling: (measurements: Array<{ size: number; time: number }>) => {
    if (measurements.length < 2) return null;

    const first = measurements[0];
    const last = measurements[measurements.length - 1];

    const sizeRatio = last.size / first.size;
    const timeRatio = last.time / first.time;

    let scalingType: "linear" | "sublinear" | "superlinear" | "unknown";

    if (timeRatio <= sizeRatio * 1.5) {
      scalingType = "sublinear";
    } else if (timeRatio <= sizeRatio * 2.5) {
      scalingType = "linear";
    } else {
      scalingType = "superlinear";
    }

    return {
      scalingType,
      sizeRatio,
      timeRatio,
      efficiency: sizeRatio / timeRatio,
    };
  },

  /** Detect potential memory leaks */
  detectMemoryLeaks: (memorySnapshots: number[]) => {
    if (memorySnapshots.length < 3) return false;

    // Check for consistent memory growth
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
