/**
 * SyncResult Comprehensive Tests
 *
 * Comprehensive test suite for SyncResult<T, E> class.
 * Tests all functionality with exhaustive coverage including edge cases.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { SyncResult } from "@/internal/result.experimental";
import {
  ComplexAssertions,
  PerformanceMeasurement,
  ResultMatchers,
  syncBuilder,
  TestData,
  TestResultTransforms,
  TestTransforms,
} from "../index";

describe("SyncResult", () => {
  beforeEach(() => {
    // Reset any global state before each test
  });

  describe("Construction and Basic Behavior", () => {
    test("should create Ok values with static constructor", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
    });

    test("should create Err values with static constructor", () => {
      const result = SyncResult.Err<number, string>("error");
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
    });

    test("should work with various data types", () => {
      const stringResult = SyncResult.Ok<string, string>("hello");
      const objectResult = SyncResult.Ok<object, string>({ a: 1 });
      const arrayResult = SyncResult.Ok<number[], string>([1, 2, 3]);
      const nullResult = SyncResult.Ok<null, string>(null);

      expect(stringResult.isOk()).toBe(true);
      expect(objectResult.isOk()).toBe(true);
      expect(arrayResult.isOk()).toBe(true);
      expect(nullResult.isOk()).toBe(true);
    });

    test("should work with complex error types", () => {
      const errorObj = { code: 500, message: "Server error" };
      const result = SyncResult.Err<string, typeof errorObj>(errorObj);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toEqual(errorObj);
    });
  });

  describe("State Inspection and Type Guards", () => {
    test("isOk should function as type guard", () => {
      const result = SyncResult.Ok<number, string>(42);

      if (result.isOk()) {
        // TypeScript should know this is SyncResult<number, never>
        const value: number = result.unwrap();
        expect(value).toBe(42);
      }
    });

    test("isErr should function as type guard", () => {
      const result = SyncResult.Err<number, string>("error");

      if (result.isErr()) {
        // TypeScript should know this is SyncResult<never, string>
        const error: string = result.unwrapErr();
        expect(error).toBe("error");
      }
    });

    test("state should be mutually exclusive", () => {
      const okResult = SyncResult.Ok<number, string>(42);
      const errResult = SyncResult.Err<number, string>("error");

      expect(okResult.isOk() && okResult.isErr()).toBe(false);
      expect(errResult.isOk() && errResult.isErr()).toBe(false);
    });
  });

  describe("Value Extraction and Error Handling", () => {
    test("unwrap should return value for Ok", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(result.unwrap()).toBe(42);
    });

    test("unwrap should throw descriptive error for Err", () => {
      const result = SyncResult.Err<number, string>("test error");
      expect(() => result.unwrap()).toThrow("Called unwrap on an Err value");
    });

    test("unwrapErr should return error for Err", () => {
      const result = SyncResult.Err<number, string>("error");
      expect(result.unwrapErr()).toBe("error");
    });

    test("unwrapErr should throw descriptive error for Ok", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(() => result.unwrapErr()).toThrow(
        "Called unwrapErr on an Ok value",
      );
    });

    test("safeUnwrap should return success object for Ok", () => {
      const result = SyncResult.Ok<number, string>(42);
      const safe = result.safeUnwrap();

      expect(safe.success).toBe(true);
      expect(safe.value).toBe(42);
    });

    test("safeUnwrap should return failure object for Err", () => {
      const result = SyncResult.Err<number, string>("error");
      const safe = result.safeUnwrap();

      expect(safe.success).toBe(false);
      expect(safe.value).toBe(Symbol.for("SentinelSym"));
    });

    test("safeUnwrap should handle all data types", () => {
      const objectResult = SyncResult.Ok<object, string>({ test: true });
      const arrayResult = SyncResult.Err<number[], string>("array error");

      const objectSafe = objectResult.safeUnwrap();
      const arraySafe = arrayResult.safeUnwrap();

      expect(objectSafe.success).toBe(true);
      expect(objectSafe.value).toEqual({ test: true });

      expect(arraySafe.success).toBe(false);
      expect(arraySafe.value).toBe(Symbol.for("SentinelSym"));
    });
  });

  describe("Transformation Methods", () => {
    describe("map", () => {
      test("should transform Ok values", () => {
        const result = SyncResult.Ok<number, string>(42).map((x) => x * 2);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(84);
      });

      test("should preserve Err values", () => {
        const result = SyncResult.Err<number, string>("error").map(
          (x) => x * 2,
        );

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("error");
      });

      test("should allow type transformations", () => {
        const result = SyncResult.Ok<number, string>(42)
          .map((x) => x.toString())
          .map((s) => s.length);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(2); // "42" has length 2
      });

      test("should handle complex transformations", () => {
        const result = SyncResult.Ok<number[], string>([1, 2, 3])
          .map((arr) => arr.reduce((a, b) => a + b, 0))
          .map((sum) => sum * 2);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(12); // (1+2+3)*2 = 12
      });

      test("should handle null/undefined transformations", () => {
        const result = SyncResult.Ok<number | null, string>(null).map(
          (x) => x ?? 0,
        );

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(0);
      });
    });

    describe("mapErr", () => {
      test("should transform Err values", () => {
        const result = SyncResult.Err<number, string>("error").mapErr(
          (err) => `Error: ${err}`,
        );

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("Error: error");
      });

      test("should preserve Ok values", () => {
        const result = SyncResult.Ok<number, string>(42).mapErr(
          (err) => `Error: ${err}`,
        );

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(42);
      });

      test("should allow error type transformations", () => {
        const result = SyncResult.Err<number, string>("network error").mapErr(
          (err) => ({ type: "NetworkError", message: err }),
        );

        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.type).toBe("NetworkError");
        expect(error.message).toBe("network error");
      });
    });

    describe("flatMap", () => {
      test("should chain Ok values", () => {
        const result = SyncResult.Ok<number, string>(42)
          .flatMap((x) => SyncResult.Ok(x * 2))
          .flatMap((x) => SyncResult.Ok(x + 10));

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(94); // (42*2)+10 = 94
      });

      test("should short-circuit on Err", () => {
        const result = SyncResult.Err<number, string>("initial")
          .flatMap((x) => SyncResult.Ok(x * 2))
          .flatMap((x) => SyncResult.Ok(x + 10));

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("initial");
      });

      test("should propagate new errors", () => {
        const result = SyncResult.Ok<number, string>(42)
          .flatMap((x) => SyncResult.Err<number, string>("new error"))
          .flatMap((x) => SyncResult.Ok(x + 10)); // Won't execute

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("new error");
      });

      test("should allow error type changes", () => {
        const result = SyncResult.Ok<number, string>(42).flatMap((x) =>
          SyncResult.Err<number, { code: number }>({ code: 404 }),
        );

        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.code).toBe(404);
      });

      test("should handle complex validation chains", () => {
        const validatePositive = (x: number) =>
          x >= 0
            ? SyncResult.Ok<number, string>(x)
            : SyncResult.Err<number, string>("negative");

        const validateEven = (x: number) =>
          x % 2 === 0
            ? SyncResult.Ok<number, string>(x)
            : SyncResult.Err<number, string>("odd");

        const result = SyncResult.Ok<number, string>(8)
          .flatMap(validatePositive)
          .flatMap(validateEven);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(8);
      });
    });

    describe("zip", () => {
      test("should combine Ok value with transformed value", () => {
        const result = SyncResult.Ok<number, string>(42).zip((x) => x * 2);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toEqual([42, 84]);
      });

      test("should preserve Err values", () => {
        const result = SyncResult.Err<number, string>("error").zip(
          (x) => x * 2,
        );

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("error");
      });

      test("should handle complex zipping", () => {
        const result = SyncResult.Ok<string, string>("hello")
          .zip((str) => str.length)
          .zip(([str, len]) => `${str}_${len}`);

        expect(result.isOk()).toBe(true);
        const value = result.unwrap();
        expect(value).toEqual([["hello", 5], "hello_5"]);
      });
    });

    describe("flatZip", () => {
      test("should combine Ok value with another Result's Ok value", () => {
        const result = SyncResult.Ok<number, string>(42).flatZip((x) =>
          SyncResult.Ok(x + 5),
        );

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toEqual([42, 47]);
      });

      test("should propagate error when zipped Result fails", () => {
        const result = SyncResult.Ok<number, string>(42).flatZip((x) =>
          SyncResult.Err<number, string>("invalid"),
        );

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("invalid");
      });

      test("should preserve original Err values", () => {
        const result = SyncResult.Err<number, string>("initial").flatZip((x) =>
          SyncResult.Err<number, string>("zipped error"),
        );

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe("initial");
      });

      test("should handle nested flatZip operations", () => {
        const result = SyncResult.Ok<number, string>(10)
          .flatZip((x) => SyncResult.Ok(x * 2))
          .flatZip(([x, y]) => SyncResult.Ok(x + y));

        expect(result.isOk()).toBe(true);
        const value = result.unwrap();
        expect(value).toEqual([10, [10, 20], 30]);
      });
    });
  });

  describe("Cloning Operations", () => {
    test("clone should create identical copy", () => {
      const original = SyncResult.Ok<number, string>(42);
      const cloned = original.clone();

      expect(cloned.isOk()).toBe(true);
      expect(cloned.unwrap()).toBe(42);
      expect(cloned).not.toBe(original); // Different instances
    });

    test("clone should preserve error state", () => {
      const original = SyncResult.Err<number, string>("error");
      const cloned = original.clone();

      expect(cloned.isErr()).toBe(true);
      expect(cloned.unwrapErr()).toBe("error");
      expect(cloned).not.toBe(original);
    });

    test("cloneOk should preserve value and change error type", () => {
      const original = SyncResult.Ok<number, string>(42);
      const cloned = original.cloneOk<number, { code: number }>();

      expect(cloned.isOk()).toBe(true);
      expect(cloned.unwrap()).toBe(42);
    });

    test("cloneErr should preserve error and change value type", () => {
      const original = SyncResult.Err<number, string>("error");
      const cloned = original.cloneErr<boolean, string>();

      expect(cloned.isErr()).toBe(true);
      expect(cloned.unwrapErr()).toBe("error");
    });
  });

  describe("Complex Operation Chains", () => {
    test("should handle long operation chains efficiently", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "long_chain",
        () => {
          let result = SyncResult.Ok<number, string>(0);

          for (let i = 1; i <= 100; i++) {
            result = result.map((x) => x + i);
          }

          return result.unwrap();
        },
      );

      expect(duration).toBeLessThan(5); // Should be very fast
      // Sum of 1 to 100 = 5050
    });

    test("should handle complex nested transformations", () => {
      interface User {
        id: number;
        name: string;
        active: boolean;
      }

      const result = SyncResult.Ok<number, string>(1)
        .map((id) => ({ id, name: `User ${id}`, active: true }) as User)
        .zip((user) => user.name.length)
        .flatMap(([user, nameLen]) =>
          user.active
            ? SyncResult.Ok([user, nameLen] as [User, number])
            : SyncResult.Err([user, nameLen] as [User, number]),
        );

      expect(result.isOk()).toBe(true);
      const [user, nameLen] = result.unwrap();
      expect(user.id).toBe(1);
      expect(user.name).toBe("User 1");
      expect(nameLen).toBe(6);
    });

    test("should short-circuit efficiently on errors", async () => {
      const { duration } = await PerformanceMeasurement.measureTime(
        "error_short_circuit",
        () => {
          return SyncResult.Err<number, string>("initial")
            .map((x) => x * 2) // Won't execute
            .flatMap((x) => SyncResult.Ok(x + 10)) // Won't execute
            .zip((x) => x.toString()) // Won't execute
            .unwrapErr();
        },
      );

      expect(duration).toBeLessThan(1); // Should be extremely fast
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    test("should handle null and undefined values correctly", () => {
      const nullResult = SyncResult.Ok<null, string>(null);
      const undefinedResult = SyncResult.Ok<undefined, string>(undefined);
      const nullError = SyncResult.Ok<string, null>("value");
      const undefinedError = SyncResult.Ok<string, undefined>("value");

      expect(nullResult.unwrap()).toBe(null);
      expect(undefinedResult.unwrap()).toBe(undefined);

      // Convert to errors
      const nullErrResult = nullError.mapErr(() => null);
      const undefinedErrResult = undefinedError.mapErr(() => undefined);

      expect(nullErrResult.isOk()).toBe(true);
      expect(undefinedErrResult.isOk()).toBe(true);
    });

    test("should handle NaN and special numeric values", () => {
      const nanResult = SyncResult.Ok<number, string>(NaN);
      const infinityResult = SyncResult.Ok<number, string>(Infinity);
      const negInfinityResult = SyncResult.Ok<number, string>(-Infinity);

      expect(nanResult.unwrap()).toBeNaN();
      expect(infinityResult.unwrap()).toBe(Infinity);
      expect(negInfinityResult.unwrap()).toBe(-Infinity);
    });

    test("should handle circular references safely", () => {
      const obj: any = { name: "test" };
      obj.self = obj; // Circular reference

      const result = SyncResult.Ok<any, string>(obj);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().name).toBe("test");
      expect(result.unwrap().self).toBe(obj);
    });

    test("should handle very large numbers", () => {
      const largeNum = Number.MAX_SAFE_INTEGER;
      const result = SyncResult.Ok<number, string>(largeNum).map((x) => x / 2);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(Math.floor(largeNum / 2));
    });

    test("should handle empty arrays and objects", () => {
      const emptyArrayResult = SyncResult.Ok<string[], string>([]);
      const emptyObjectResult = SyncResult.Ok<object, string>({});

      expect(emptyArrayResult.unwrap()).toEqual([]);
      expect(emptyObjectResult.unwrap()).toEqual({});
    });
  });

  describe("Type Safety and Inference", () => {
    test("should maintain type safety through operations", () => {
      const result = SyncResult.Ok<number, string>(42)
        .map((x) => x.toString()) // Type: SyncResult<string, string>
        .map((s) => s.length) // Type: SyncResult<number, string>
        .flatMap((n) => (n > 0 ? SyncResult.Ok(n) : SyncResult.Err("zero"))); // Type: SyncResult<number, string>

      // TypeScript should infer correct types
      if (result.isOk()) {
        const value: number = result.unwrap();
        expect(typeof value).toBe("number");
      }
    });

    test("should handle generic type parameters correctly", () => {
      function createResult<T>(value: T): SyncResult<T, string> {
        return SyncResult.Ok(value);
      }

      const stringResult = createResult("hello");
      const numberResult = createResult(42);
      const objectResult = createResult({ test: true });

      expect(stringResult.unwrap()).toBe("hello");
      expect(numberResult.unwrap()).toBe(42);
      expect(objectResult.unwrap()).toEqual({ test: true });
    });

    test("should handle complex generic scenarios", () => {
      interface Container<T> {
        value: T;
        metadata: string;
      }

      function processContainer<T, E>(
        container: Container<T>,
        processor: (value: T) => SyncResult<T, E>,
      ): SyncResult<Container<T>, E> {
        return SyncResult.Ok(container)
          .flatMap((c) => processor(c.value))
          .map((processedValue) => ({ ...container, value: processedValue }));
      }

      const container: Container<number> = { value: 42, metadata: "test" };
      const result = processContainer(container, (x) =>
        x > 0 ? SyncResult.Ok(x) : SyncResult.Err("negative"),
      );

      expect(result.isOk()).toBe(true);
      const processed = result.unwrap();
      expect(processed.value).toBe(42);
      expect(processed.metadata).toBe("test");
    });
  });

  describe("Performance Characteristics", () => {
    test("should handle high-frequency operations efficiently", async () => {
      const iterations = 10000;

      const { duration } = await PerformanceMeasurement.measureTime(
        "high_frequency",
        () => {
          for (let i = 0; i < iterations; i++) {
            const result = SyncResult.Ok(i, "error")
              .map((x) => x * 2)
              .flatMap((x) => SyncResult.Ok(x + 1))
              .zip((x) => x.toString())
              .unwrap();
          }
        },
      );

      expect(duration).toBeLessThan(100); // Should complete 10k operations in < 100ms
    });

    test("should not create memory leaks", () => {
      const results: SyncResult<number, string>[] = [];

      // Create many results
      for (let i = 0; i < 1000; i++) {
        results.push(SyncResult.Ok(i, "error").map((x) => x * 2));
      }

      expect(results).toHaveLength(1000);

      // All should be correct
      results.forEach((result, i) => {
        expect(result.unwrap()).toBe(i * 2);
      });

      // Clear references for garbage collection
      results.length = 0;
    });
  });

  describe("Integration with Test Utilities", () => {
    test("should work with test builders", () => {
      const builder = syncBuilder.withDefaults("test", "builder_error");

      const okResult = builder.ok();
      const errResult = builder.err();

      ResultMatchers.toBeOk(okResult, "test");
      ResultMatchers.toBeErr(errResult, "builder_error");
    });

    test("should work with test data generators", () => {
      const numbers = TestData.numbers.positive;
      const results = numbers.map((n) => syncBuilder.okWith(n));

      ComplexAssertions.assertUniformState(results, true);
      results.forEach((result, i) => {
        expect(result.unwrap()).toBe(numbers[i]);
      });
    });

    test("should work with transformation utilities", () => {
      const result = syncBuilder
        .ok()
        .map(TestTransforms.numeric.double)
        .map(TestTransforms.numeric.toString);

      ResultMatchers.toBeOk(result, "84");
    });
  });
});
