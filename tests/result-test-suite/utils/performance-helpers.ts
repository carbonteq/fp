/**
 * Performance Testing Utilities
 *
 * Provides utilities for measuring performance, memory usage,
 * and scalability of Result operations.
 */

/**
 * Performance measurement utilities
 */
export class PerformanceMeasurement {
  private measurements: Array<{
    name: string;
    duration: number;
    memory?: number;
    timestamp: number;
  }> = [];

  /**
   * Measures execution time of a function
   */
  static async measureTime<T>(
    name: string,
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; durationMs: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    return {
      result,
      durationMs: Math.round((endTime - startTime) * 100) / 100,
    };
  }

  /**
   * Measures memory usage before and after operation
   */
  static async measureMemory<T>(
    name: string,
    fn: () => T | Promise<T>,
  ): Promise<{
    result: T;
    memoryBefore: number;
    memoryAfter: number;
    memoryDiff: number;
  }> {
    if (!performance.memory) {
      // Fallback for environments without memory API
      const result = await fn();
      return {
        result,
        memoryBefore: 0,
        memoryAfter: 0,
        memoryDiff: 0,
      };
    }

    const memoryBefore = performance.memory.usedJSHeapSize;
    const result = await fn();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryAfter = performance.memory.usedJSHeapSize;

    return {
      result,
      memoryBefore,
      memoryAfter,
      memoryDiff: memoryAfter - memoryBefore,
    };
  }

  /**
   * Measures both time and memory
   */
  static async measureFull<T>(
    name: string,
    fn: () => T | Promise<T>,
  ): Promise<{
    result: T;
    durationMs: number;
    memoryBefore: number;
    memoryAfter: number;
    memoryDiff: number;
  }> {
    const startTime = performance.now();

    const memoryBefore = performance.memory?.usedJSHeapSize || 0;
    const result = await fn();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryAfter = performance.memory?.usedJSHeapSize || 0;
    const endTime = performance.now();

    return {
      result,
      durationMs: Math.round((endTime - startTime) * 100) / 100,
      memoryBefore,
      memoryAfter,
      memoryDiff: memoryAfter - memoryBefore,
    };
  }

  /**
   * Records a measurement
   */
  record(name: string, duration: number, memory?: number): void {
    this.measurements.push({
      name,
      duration,
      memory,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets all measurements
   */
  getMeasurements() {
    return [...this.measurements];
  }

  /**
   * Clears all measurements
   */
  clear(): void {
    this.measurements.length = 0;
  }

  /**
   * Gets statistics for measurements by name
   */
  getStats(name: string) {
    const measurements = this.measurements.filter((m) => m.name === name);
    if (measurements.length === 0) return null;

    const durations = measurements.map((m) => m.duration);
    const memories = measurements
      .filter((m) => m.memory !== undefined)
      .map((m) => m.memory!);

    return {
      count: measurements.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minMemory: memories.length > 0 ? Math.min(...memories) : 0,
      maxMemory: memories.length > 0 ? Math.max(...memories) : 0,
      avgMemory:
        memories.length > 0
          ? memories.reduce((a, b) => a + b, 0) / memories.length
          : 0,
    };
  }
}

/**
 * Creates performance benchmarks for Result operations
 */
export class ResultBenchmark {
  private measurement = new PerformanceMeasurement();

  /**
   * Benchmarks a Result operation with different input sizes
   */
  async benchmarkOperation<T, E>(
    operationName: string,
    operation: (input: T) => any,
    inputs: T[],
    iterations: number = 100,
  ): Promise<
    Array<{
      inputSize: number;
      stats: ReturnType<typeof PerformanceMeasurement.prototype.getStats>;
    }>
  > {
    const results = [];

    for (const input of inputs) {
      // Warm up
      for (let i = 0; i < 10; i++) {
        operation(input);
      }

      // Actual benchmark
      for (let i = 0; i < iterations; i++) {
        const { duration } = await PerformanceMeasurement.measureTime(
          `${operationName}_${inputs.indexOf(input)}`,
          () => operation(input),
        );
        this.measurement.record(
          `${operationName}_${inputs.indexOf(input)}`,
          duration,
        );
      }

      const stats = this.measurement.getStats(
        `${operationName}_${inputs.indexOf(input)}`,
      );
      results.push({
        inputSize: Array.isArray(input) ? input.length : 1,
        stats: stats!,
      });
    }

    return results;
  }

  /**
   * Benchmarks chaining operations
   */
  async benchmarkChaining<T, E>(
    operationName: string,
    createChain: (initialValue: T) => any,
    chainLengths: number[],
    iterations: number = 50,
  ) {
    const results = [];

    for (const chainLength of chainLengths) {
      const chain = createChain(chainLength as T);

      for (let i = 0; i < iterations; i++) {
        const { duration } = await PerformanceMeasurement.measureTime(
          `${operationName}_chain_${chainLength}`,
          () => chain,
        );
        this.measurement.record(
          `${operationName}_chain_${chainLength}`,
          duration,
        );
      }

      const stats = this.measurement.getStats(
        `${operationName}_chain_${chainLength}`,
      );
      results.push({ chainLength, stats: stats! });
    }

    return results;
  }

  /**
   * Benchmarks memory usage for large datasets
   */
  async benchmarkMemory<T, E>(
    operationName: string,
    operation: (data: T[]) => any,
    dataSizes: number[],
    iterations: number = 10,
  ) {
    const results = [];

    for (const size of dataSizes) {
      const data = Array.from({ length: size }, (_, i) => i as T);

      for (let i = 0; i < iterations; i++) {
        const { memoryDiff } = await PerformanceMeasurement.measureMemory(
          `${operationName}_size_${size}`,
          () => operation(data),
        );
        this.measurement.record(`${operationName}_size_${size}`, 0, memoryDiff);
      }

      const stats = this.measurement.getStats(`${operationName}_size_${size}`);
      results.push({ dataSize: size, stats: stats! });
    }

    return results;
  }

  /**
   * Clears all benchmark data
   */
  clear(): void {
    this.measurement.clear();
  }

  /**
   * Gets all benchmark results
   */
  getResults() {
    return this.measurement.getMeasurements();
  }
}

/**
 * Utility functions for creating test data of various sizes
 */
export const TestDataGenerators = {
  /**
   * Generates arrays of numbers for performance testing
   */
  generateNumberArrays: (sizes: number[]): number[][] => {
    return sizes.map((size) => Array.from({ length: size }, (_, i) => i));
  },

  /**
   * Generates Result arrays of different sizes
   */
  generateResultArrays: <T, E>(
    sizes: number[],
    okRatio: number = 0.8,
  ): Array<Array<any>> => {
    return sizes.map((size) =>
      Array.from({ length: size }, (_, i) =>
        i < size * okRatio
          ? { ok: true, value: i }
          : { ok: false, error: `error_${i}` },
      ),
    );
  },

  /**
   * Generates complex nested data structures
   */
  generateNestedData: (depth: number, breadth: number = 3): any => {
    if (depth === 0) {
      return Math.random();
    }

    return Array.from({ length: breadth }, () => ({
      value: Math.random(),
      nested: TestDataGenerators.generateNestedData(depth - 1, breadth),
    }));
  },

  /**
   * Generates operation chains of different lengths
   */
  generateChains: (lengths: number[]): Array<(x: number) => number> => {
    return lengths.map((length) => {
      const operations = Array.from(
        { length },
        (_, i) => (x: number) => x + i + 1,
      );
      return (initial: number) =>
        operations.reduce((acc, op) => op(acc), initial);
    });
  },
};

/**
 * Performance assertion helpers
 */
export const PerformanceAssertions = {
  /**
   * Asserts that operation completes within time limit
   */
  assertTimingConstraint: (actualDuration: number, maxExpectedMs: number) => {
    expect(actualDuration).toBeLessThanOrEqual(maxExpectedMs);
  },

  /**
   * Asserts that memory usage stays within bounds
   */
  assertMemoryConstraint: (memoryDiff: number, maxExpectedBytes: number) => {
    expect(memoryDiff).toBeLessThanOrEqual(maxExpectedBytes);
  },

  /**
   * Asserts linear scaling performance
   */
  assertLinearScaling: (
    measurements: Array<{ size: number; duration: number }>,
    toleranceFactor: number = 2,
  ) => {
    if (measurements.length < 2) return;

    const sorted = measurements.sort((a, b) => a.size - b.size);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const expectedRatio = last.size / first.size;
    const actualRatio = last.duration / first.duration;

    expect(actualRatio).toBeLessThanOrEqual(expectedRatio * toleranceFactor);
  },

  /**
   * Asserts no significant memory leaks
   */
  assertNoMemoryLeak: (
    memoryMeasurements: number[],
    thresholdFactor: number = 1.5,
  ) => {
    if (memoryMeasurements.length < 2) return;

    const initial = memoryMeasurements[0];
    const final = memoryMeasurements[memoryMeasurements.length - 1];

    const ratio = final / initial;
    expect(ratio).toBeLessThanOrEqual(thresholdFactor);
  },
};

// Default benchmark instance
export const benchmark = new ResultBenchmark();
