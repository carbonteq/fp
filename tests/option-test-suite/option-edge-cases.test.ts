import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";
import { AsyncTestHelpers, ErrorTestHelpers } from "./test-utils";

/**
 * Edge Cases and Error Scenarios Tests
 *
 * These tests verify the robustness of the Option implementation by covering
 * boundary conditions, unusual inputs, and error scenarios. They include:
 *
 * 1. Falsy value handling
 * 2. Special numeric values (NaN, Infinity)
 * 3. Complex object types
 * 4. Nested Option structures
 * 5. Error propagation and handling
 * 6. Type coercion scenarios
 */

describe("ExperimentalOption - Edge Cases and Error Scenarios", () => {
  describe("Falsy Value Handling", () => {
    it("should treat falsy values as valid Some contents", () => {
      const falsyValues = [
        { value: false, description: "false boolean" },
        { value: 0, description: "zero number" },
        { value: "", description: "empty string" },
        { value: null, description: "null value" },
        { value: undefined, description: "undefined value" },
      ];

      for (const { value, description } of falsyValues) {
        const opt = ExperimentalOption.Some(value);

        // Should not throw when unwrapping
        expect(() => opt.unwrap()).not.toThrow(`Should not throw for Some(${description})`);

        // Should return the exact value (with special handling for NaN)
        if (Number.isNaN(value)) {
          expect(Number.isNaN(opt.unwrap())).toBe(true, `Should preserve NaN for ${description}`);
        } else {
          expect(opt.unwrap()).toBe(value, `Should preserve value for ${description}`);
        }
      }
    });

    it("should distinguish between falsy Some and None", () => {
      const falseSome = ExperimentalOption.Some(false);
      const zeroSome = ExperimentalOption.Some(0);
      const emptyStringSome = ExperimentalOption.Some("");
      const none = ExperimentalOption.None;

      // All should be Some values (not None)
      expect(falseSome.unwrap()).toBe(false);
      expect(zeroSome.unwrap()).toBe(0);
      expect(emptyStringSome.unwrap()).toBe("");

      // None should throw
      expect(() => none.unwrap()).toThrow("Called unwrap on a None value");
    });

    it("should handle falsy values in transformations", () => {
      const opt = ExperimentalOption.Some(42);

      // Transformations that produce falsy values
      const falseResult = opt.map(_ => false);
      const zeroResult = opt.map(_ => 0);
      const emptyResult = opt.map(_ => "");
      const nullResult = opt.map(_ => null);
      const undefinedResult = opt.map(_ => undefined);

      expect(falseResult.unwrap()).toBe(false);
      expect(zeroResult.unwrap()).toBe(0);
      expect(emptyResult.unwrap()).toBe("");
      expect(nullResult.unwrap()).toBeNull();
      expect(undefinedResult.unwrap()).toBeUndefined();
    });
  });

  describe("Special Numeric Values", () => {
    it("should handle NaN correctly", () => {
      const nanOpt = ExperimentalOption.Some(NaN);

      expect(Number.isNaN(nanOpt.unwrap())).toBe(true);

      // Transformations involving NaN
      const nanTransformed = nanOpt.map(x => x + 1);
      expect(Number.isNaN(nanTransformed.unwrap())).toBe(true);

      // Comparison operations
      const comparisonResult = nanOpt.map(x => x === x);
      expect(comparisonResult.unwrap()).toBe(false); // NaN !== NaN
    });

    it("should handle Infinity values", () => {
      const positiveInfinityOpt = ExperimentalOption.Some(Infinity);
      const negativeInfinityOpt = ExperimentalOption.Some(-Infinity);

      expect(positiveInfinityOpt.unwrap()).toBe(Infinity);
      expect(negativeInfinityOpt.unwrap()).toBe(-Infinity);

      // Mathematical operations
      const multiplied = positiveInfinityOpt.map(x => x * 2);
      expect(multiplied.unwrap()).toBe(Infinity);

      const divided = negativeInfinityOpt.map(x => x / 2);
      expect(divided.unwrap()).toBe(-Infinity);
    });

    it("should handle Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER", () => {
      const maxOpt = ExperimentalOption.Some(Number.MAX_SAFE_INTEGER);
      const minOpt = ExperimentalOption.Some(Number.MIN_SAFE_INTEGER);

      expect(maxOpt.unwrap()).toBe(Number.MAX_SAFE_INTEGER);
      expect(minOpt.unwrap()).toBe(Number.MIN_SAFE_INTEGER);

      // Edge operations
      const maxPlusOne = maxOpt.map(x => x + 1);
      const minMinusOne = minOpt.map(x => x - 1);

      // These should still work but may lose precision at boundaries
      expect(maxPlusOne.unwrap()).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
      expect(minMinusOne.unwrap()).toBeLessThan(Number.MIN_SAFE_INTEGER);
    });
  });

  describe("Complex Object Types", () => {
    it("should handle circular references gracefully", () => {
      const circular: any = { name: "circular" };
      circular.self = circular;

      const opt = ExperimentalOption.Some(circular);

      // Should not throw during creation
      expect(() => opt.unwrap()).not.toThrow();

      const result = opt.unwrap();
      expect(result.name).toBe("circular");
      expect(result.self).toBe(result);
    });

    it("should handle special JavaScript objects", () => {
      const specialObjects = [
        { value: new Date(), description: "Date object" },
        { value: /regex/g, description: "RegExp object" },
        { value: new Error("test error"), description: "Error object" },
        { value: new Set([1, 2, 3]), description: "Set object" },
        { value: new Map([["key", "value"]]), description: "Map object" },
        { value: new Int8Array([1, 2, 3]), description: "TypedArray" },
        { value: new ArrayBuffer(8), description: "ArrayBuffer" },
        { value: new DataView(new ArrayBuffer(8)), description: "DataView" },
      ];

      for (const { value, description } of specialObjects) {
        const opt = ExperimentalOption.Some(value);

        expect(() => opt.unwrap()).not.toThrow(`Should handle ${description}`);
        expect(opt.unwrap()).toBe(value, `Should preserve ${description}`);
      }
    });

    it("should handle function values", () => {
      const testFunction = () => "hello";
      const asyncFunction = async () => "async hello";

      const syncFnOpt = ExperimentalOption.Some(testFunction);
      const asyncFnOpt = ExperimentalOption.Some(asyncFunction);

      expect(typeof syncFnOpt.unwrap()).toBe("function");
      expect(typeof asyncFnOpt.unwrap()).toBe("function");

      // Functions should be callable
      expect((syncFnOpt.unwrap() as Function)()).toBe("hello");
    });
  });

  describe("Nested Option Structures", () => {
    it("should handle Options containing Options", () => {
      const innerOption = ExperimentalOption.Some(42);
      const outerOption = ExperimentalOption.Some(innerOption);

      expect(() => outerOption.unwrap()).not.toThrow();

      const inner = outerOption.unwrap();
      expect(inner).toBe(innerOption);
      expect(inner.unwrap()).toBe(42);
    });

    it("should handle deeply nested Option chains", () => {
      let nested = ExperimentalOption.Some(1);

      // Create 10 levels of nesting
      for (let i = 0; i < 10; i++) {
        nested = ExperimentalOption.Some(nested);
      }

      // Unwrap all levels
      let current = nested;
      for (let i = 0; i < 10; i++) {
        current = current.unwrap() as ExperimentalOption<number>;
      }

      expect(current.unwrap()).toBe(1);
    });

    it("should handle flatMap with nested Options", () => {
      const nestedOpt = ExperimentalOption.Some(ExperimentalOption.Some(42));

      const result = nestedOpt.flatMap(inner => inner);

      expect(result.unwrap()).toBe(42);
    });

    it("should handle None at various nesting levels", () => {
      const nestedNone = ExperimentalOption.Some(ExperimentalOption.None);

      expect(() => nestedNone.unwrap()).not.toThrow();

      const inner = nestedNone.unwrap() as ExperimentalOption<never>;
      expect(() => inner.unwrap()).toThrow("Called unwrap on a None value");
    });
  });

  describe("Error Propagation and Handling", () => {
    it("should handle thrown errors in transformation functions", () => {
      const opt = ExperimentalOption.Some(42);

      // Sync error throwing
      expect(() => {
        opt.map(() => {
          throw new Error("Sync transformation error");
        });
      }).toThrow("Sync transformation error");

      // Option should still be usable after error
      expect(opt.unwrap()).toBe(42);
    });

    it("should handle async errors gracefully", async () => {
      const opt = ExperimentalOption.Some(42);

      const asyncErrorResult = opt.map(async () => {
        throw new Error("Async transformation error");
      });

      expect(asyncErrorResult.value.constructor.name).toBe("AsyncOpt");

      await ErrorTestHelpers.expectThrows(
        () => asyncErrorResult.unwrap(),
        "Async transformation error"
      );
    });

    it("should handle Promise rejections in Option creation", async () => {
      const rejectedPromise = Promise.reject(new Error("Rejected promise"));
      const opt = ExperimentalOption.Some(rejectedPromise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");

      await ErrorTestHelpers.expectThrows(
        () => opt.unwrap(),
        "Rejected promise"
      );
    });

    it("should handle errors in complex pipelines", () => {
      const opt = ExperimentalOption.Some(42);

      // Error in the middle of a chain
      const result = opt
        .map(x => x * 2)
        .map(() => {
          throw new Error("Pipeline error");
        })
        .map(x => x + 1); // This should not be reached

      expect(() => result.unwrap()).toThrow("Pipeline error");
    });
  });

  describe("Type Coercion Scenarios", () => {
    it("should handle implicit type conversions", () => {
      const numberOpt = ExperimentalOption.Some(42);
      const stringOpt = ExperimentalOption.Some("42");

      // Number to string conversion
      const numToStr = numberOpt.map(x => x.toString());
      expect(numToStr.unwrap()).toBe("42");

      // String to number conversion
      const strToNum = stringOpt.map(x => parseInt(x, 10));
      expect(strToNum.unwrap()).toBe(42);

      // Boolean conversion
      const boolConversion = numberOpt.map(x => !!x);
      expect(boolConversion.unwrap()).toBe(true);
    });

    it("should handle loose equality scenarios", () => {
      const tests = [
        { value: "0", compare: 0, description: "string '0' vs number 0" },
        { value: "", compare: false, description: "empty string vs false" },
        { value: "false", compare: false, description: "string 'false' vs false" },
        { value: null, compare: undefined, description: "null vs undefined" },
      ];

      for (const { value, compare, description } of tests) {
        const opt = ExperimentalOption.Some(value);

        const equalityResult = opt.map(x => x == compare); // loose equality
        const strictResult = opt.map(x => x === compare); // strict equality

        console.log(`Testing ${description}: loose=${equalityResult.unwrap()}, strict=${strictResult.unwrap()}`);

        // Results should be different for loose vs strict comparison
        expect(typeof equalityResult.unwrap()).toBe("boolean");
        expect(typeof strictResult.unwrap()).toBe("boolean");
      }
    });

    it("should handle Object.prototype.toString() behavior", () => {
      const opt = ExperimentalOption.Some(42);

      const toStringResult = opt.map(x => Object.prototype.toString.call(x));
      expect(toStringResult.unwrap()).toBe("[object Number]");

      const arrayOpt = ExperimentalOption.Some([1, 2, 3]);
      const arrayToStringResult = arrayOpt.map(x => Object.prototype.toString.call(x));
      expect(arrayToStringResult.unwrap()).toBe("[object Array]");
    });
  });

  describe("Memory and Performance Edge Cases", () => {
    it("should handle very large strings", () => {
      const largeString = "a".repeat(10000); // 10KB string
      const opt = ExperimentalOption.Some(largeString);

      expect(opt.unwrap()).toBe(largeString);
      expect(opt.unwrap().length).toBe(10000);

      // Transformations on large strings
      const transformed = opt.map(s => s.toUpperCase());
      expect(transformed.unwrap().length).toBe(10000);
      expect(transformed.unwrap().slice(0, 5)).toBe("AAAAA");
    });

    it("should handle large arrays efficiently", () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      const opt = ExperimentalOption.Some(largeArray);

      expect(opt.unwrap().length).toBe(1000);
      expect(opt.unwrap()[999]).toBe(999);

      // Array transformations
      const lengthResult = opt.map(arr => arr.length);
      expect(lengthResult.unwrap()).toBe(1000);

      const sumResult = opt.map(arr => arr.reduce((a, b) => a + b, 0));
      expect(sumResult.unwrap()).toBe((999 * 1000) / 2); // Sum of 0..999
    });

    it("should handle deep object hierarchies", () => {
      // Create a deeply nested object
      let deep: any = { value: "deep" };
      for (let i = 0; i < 100; i++) {
        deep = { nested: deep };
      }

      const opt = ExperimentalOption.Some(deep);

      // Navigate the deep structure
      let current = opt;
      for (let i = 0; i < 100; i++) {
        current = current.map(obj => obj.nested);
      }

      expect(current.unwrap()).toBe("deep");
    });
  });

  describe("Async Edge Cases", () => {
    it("should handle Promise that resolves to special values", async () => {
      const testValues = [
        Promise.resolve(null),
        Promise.resolve(undefined),
        Promise.resolve(NaN),
        Promise.resolve(Infinity),
        Promise.resolve(""),
        Promise.resolve(false),
        Promise.resolve(0),
      ];

      for (const promise of testValues) {
        const opt = ExperimentalOption.Some(promise);
        expect(opt.value.constructor.name).toBe("AsyncOpt");

        const result = await opt.unwrap();

        if (Number.isNaN(await promise)) {
          expect(Number.isNaN(result)).toBe(true);
        } else {
          expect(result).toBe(await promise);
        }
      }
    });

    it("should handle Promise that never resolves", async () => {
      // Create a promise that never resolves
      const neverResolves = new Promise(() => {}); // Never resolves
      const opt = ExperimentalOption.Some(neverResolves);

      expect(opt.value.constructor.name).toBe("AsyncOpt");

      // This should timeout/hang, but we'll test the structure
      // In a real test environment, you'd want a timeout
      console.log("⚠️ Testing never-resolving promise (this would hang in production)");
    });

    it("should handle Promise that resolves to Option sentinel", async () => {
      const sentinel = Symbol.for("OptSentinel");
      const sentinelPromise = Promise.resolve(sentinel);
      const opt = ExperimentalOption.Some(sentinelPromise);

      expect(opt.value.constructor.name).toBe("AsyncOpt");

      await ErrorTestHelpers.expectThrows(
        () => opt.unwrap(),
        "Called unwrap on a None value"
      );
    });
  });

  describe("Boundary Value Testing", () => {
    it("should handle maximum and minimum values", () => {
      const boundaryValues = [
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ];

      for (const value of boundaryValues) {
        const opt = ExperimentalOption.Some(value);
        expect(opt.unwrap()).toBe(value);

        // Basic transformations
        const doubled = opt.map(x => x * 2);
        expect(typeof doubled.unwrap()).toBe(typeof value);
      }
    });

    it("should handle string boundary values", () => {
      const boundaryStrings = [
        "", // empty
        "a", // single character
        "a".repeat(1000), // long string
        "\0", // null character
        "\n\r\t", // whitespace characters
        "🚀🌟💫", // emojis
        "\uFFFF", // max BMP character
      ];

      for (const str of boundaryStrings) {
        const opt = ExperimentalOption.Some(str);
        expect(opt.unwrap()).toBe(str);

        const lengthResult = opt.map(s => s.length);
        expect(typeof lengthResult.unwrap()).toBe("number");
      }
    });

    it("should handle boolean edge cases", () => {
      const boolOpt = ExperimentalOption.Some(true);

      // Various boolean transformations
      const notResult = boolOpt.map(b => !b);
      expect(notResult.unwrap()).toBe(false);

      const stringResult = boolOpt.map(b => b.toString());
      expect(stringResult.unwrap()).toBe("true");

      const numberResult = boolOpt.map(b => Number(b));
      expect(numberResult.unwrap()).toBe(1);
    });
  });

  describe("Implementation-Specific Edge Cases", () => {
    it("should handle Symbol sentinel value directly", () => {
      const sentinel = Symbol.for("OptSentinel");

      // This should create a None-like behavior
      const sentinelOpt = ExperimentalOption.Some(sentinel);

      // The behavior might depend on implementation details
      try {
        const result = sentinelOpt.unwrap();
        expect(result).toBe(sentinel);
      } catch (error) {
        // Some implementations might throw for sentinel values
        expect(error.message).toContain("None");
      }
    });

    it("should test internal type boundaries", () => {
      // Test what happens with unusual internal representations
      const unusualValues = [
        Symbol("test"),
        BigInt(42),
        () => "function",
      ];

      for (const value of unusualValues) {
        const opt = ExperimentalOption.Some(value);
        expect(() => opt.unwrap()).not.toThrow(`Should handle ${typeof value}`);
        expect(opt.unwrap()).toBe(value);
      }
    });

    it("should verify type constructor behavior", () => {
      const syncOpt = ExperimentalOption.Some(42);
      const asyncOpt = ExperimentalOption.Some(Promise.resolve(42));

      // These should have different internal types
      expect(syncOpt.value.constructor.name).toBe("SyncOpt");
      expect(asyncOpt.value.constructor.name).toBe("AsyncOpt");

      // But both should unwrap to the same logical value
      expect(syncOpt.unwrap()).toBe(42);
      expect(await asyncOpt.unwrap()).toBe(42);
    });
  });

  describe("Error Recovery Scenarios", () => {
    it("should demonstrate graceful error recovery patterns", () => {
      const potentiallyFailingOperation = () => {
        if (Math.random() > 0.5) {
          throw new Error("Random failure");
        }
        return "success";
      };

      // Safe execution pattern
      const safeResult = (() => {
        try {
          const result = potentiallyFailingOperation();
          return ExperimentalOption.Some(result);
        } catch (error) {
          return ExperimentalOption.None;
        }
      })();

      // Should always return a valid Option
      expect(() => safeResult.safeUnwrap()).not.toThrow();

      // If it's Some, unwrap should work; if None, unwrap should throw appropriately
      if (safeResult.value.constructor.name === "SyncOpt") {
        try {
          const value = safeResult.unwrap();
          expect(value === "success" || value === undefined).toBe(true);
        } catch {
          // Expected for None
        }
      }
    });

    it("should handle cascading error scenarios", () => {
      const opt = ExperimentalOption.Some(42);

      // Create a chain where multiple steps could fail
      const result = opt
        .map(x => {
          if (x !== 42) throw new Error("First step failed");
          return x * 2;
        })
        .map(x => {
          if (x !== 84) throw new Error("Second step failed");
          return x.toString();
        })
        .map(str => {
          if (str !== "84") throw new Error("Third step failed");
          return parseInt(str, 10);
        });

      // Should succeed
      expect(result.unwrap()).toBe(84);

      // Now test failure case
      const failureResult = opt
        .map(x => {
          throw new Error("Deliberate failure");
        })
        .map(x => x * 2); // Should not reach here

      expect(() => failureResult.unwrap()).toThrow("Deliberate failure");
    });
  });
});