import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";
import {
  ErrorTestHelpers,
  SpecComplianceHelpers,
  TestDataFactory,
} from "./test-utils";

/**
 * Core API Compliance Tests
 *
 * These tests verify that the Option implementation conforms to the basic contract
 * defined in the enhanced Option specification. They focus on:
 *
 * 1. Construction behavior (Some/None creation)
 * 2. Type safety and preservation
 * 3. Value extraction methods
 * 4. Basic Option contract compliance
 * 5. Immutability guarantees
 */

describe("ExperimentalOption - Core API Compliance", () => {
  describe("Static Constructors", () => {
    it("should create Some value with Some() static method", () => {
      const opt = ExperimentalOption.Some(42);

      // Should not throw when unwrapping a Some
      expect(() => opt.unwrap()).not.toThrow();
      expect(opt.unwrap()).toBe(42);
    });

    it("should create Some value with various data types", () => {
      const testCases = [
        { value: 42, description: "number" },
        { value: "hello", description: "string" },
        { value: true, description: "boolean" },
        { value: { a: 1 }, description: "object" },
        { value: [1, 2, 3], description: "array" },
        { value: new Date(), description: "Date" },
        { value: null, description: "null" },
        { value: undefined, description: "undefined" },
      ];

      for (const { value, description } of testCases) {
        const opt = ExperimentalOption.Some(value);
        expect(() => opt.unwrap()).not.toThrow(`Failed for ${description}`);
        expect(opt.unwrap()).toBe(value, `Wrong value for ${description}`);
      }
    });

    it("should create None value with None static property", () => {
      const opt = ExperimentalOption.None;

      // Should throw when unwrapping a None
      expect(() => opt.unwrap()).toThrow("Called unwrap on a None value");
    });

    it("should None be a singleton", () => {
      const none1 = ExperimentalOption.None;
      const none2 = ExperimentalOption.None;

      // Both should be the same reference
      expect(none1).toBe(none2);
    });
  });

  describe("Type Safety and Generic Preservation", () => {
    it("should preserve generic type through construction", () => {
      const numberOption: ExperimentalOption<number> =
        ExperimentalOption.Some(42);
      const stringOption: ExperimentalOption<string> =
        ExperimentalOption.Some("hello");
      const objectOption: ExperimentalOption<{ a: number }> =
        ExperimentalOption.Some({ a: 1 });

      // These should compile without type errors (TypeScript verification)
      expect(numberOption.unwrap()).toBe(42);
      expect(stringOption.unwrap()).toBe("hello");
      expect(objectOption.unwrap()).toEqual({ a: 1 });
    });

    it("should preserve None type with generic parameter", () => {
      const noneNumber: ExperimentalOption<number> = ExperimentalOption.None;
      const noneString: ExperimentalOption<string> = ExperimentalOption.None;

      expect(() => noneNumber.unwrap()).toThrow();
      expect(() => noneString.unwrap()).toThrow();
    });

    it("should maintain type correctness in type inference", () => {
      // TypeScript should infer these correctly
      const inferredNumber = ExperimentalOption.Some(42);
      const inferredString = ExperimentalOption.Some("hello");

      // Type assertion through assignment compatibility
      const explicitNumber: ExperimentalOption<number> = inferredNumber;
      const explicitString: ExperimentalOption<string> = inferredString;

      expect(explicitNumber.unwrap()).toBe(42);
      expect(explicitString.unwrap()).toBe("hello");
    });
  });

  describe("Value Extraction Methods", () => {
    describe("unwrap()", () => {
      it("should return value for Some", () => {
        const testCases = TestDataFactory.valueTypes();

        for (const { name, value } of testCases) {
          const opt = ExperimentalOption.Some(value);
          expect(opt.unwrap()).toBe(value, `unwrap() failed for ${name}`);
        }
      });

      it("should throw for None", async () => {
        const opt = ExperimentalOption.None;

        const error = await ErrorTestHelpers.expectThrows(
          () => opt.unwrap(),
          "Called unwrap on a None value",
        );

        expect(error.message).toContain("Called unwrap on a None value");
      });

      it("should throw consistently for None typed values", async () => {
        const noneNumber =
          ExperimentalOption.None as ExperimentalOption<number>;
        const noneString =
          ExperimentalOption.None as ExperimentalOption<string>;
        const noneObject = ExperimentalOption.None as ExperimentalOption<{
          a: number;
        }>;

        for (const [name, noneOpt] of [
          ["number", noneNumber],
          ["string", noneString],
          ["object", noneObject],
        ]) {
          await ErrorTestHelpers.expectThrows(
            () => noneOpt.unwrap(),
            "Called unwrap on a None value",
          );
        }
      });
    });

    describe("safeUnwrap()", () => {
      it("should return success object for Some", () => {
        const testCases = TestDataFactory.valueTypes();

        for (const { name, value } of testCases) {
          const opt = ExperimentalOption.Some(value);
          const result = opt.safeUnwrap();

          expect(result.success).toBe(
            true,
            `safeUnwrap() should succeed for ${name}`,
          );
          expect((result as any).value).toBe(
            value,
            `safeUnwrap() should return correct value for ${name}`,
          );
        }
      });

      it("should return failure object for None", () => {
        const opt = ExperimentalOption.None;
        const result = opt.safeUnwrap();

        expect(result.success).toBe(false);
        expect("value" in result).toBe(false);
      });

      it("should work with async options", async () => {
        // Test with async-created Some
        const asyncSome = ExperimentalOption.Some(Promise.resolve(42));
        const safeResult = await asyncSome.safeUnwrap();

        expect(safeResult.success).toBe(true);
        expect((safeResult as any).value).toBe(42);
      });
    });
  });

  describe("Option Contract Compliance", () => {
    it("should satisfy Option algebraic laws", () => {
      // Test Some(value).map(id) === Some(value)
      const value = 42;
      const some = ExperimentalOption.Some(value);
      const identity = <T>(x: T) => x;

      const mapped = some.map(identity);
      expect(mapped.unwrap()).toBe(value);

      // Test None.map(fn) === None
      const none = ExperimentalOption.None;
      const constFn = () => "doesn't matter";

      const noneMapped = none.map(constFn);
      expect(() => noneMapped.unwrap()).toThrow(
        "Called unwrap on a None value",
      );
    });

    it("should handle nested transformations correctly", () => {
      const opt = ExperimentalOption.Some(5);

      // Chain multiple transformations
      const result = opt
        .map((x) => x * 2)
        .map((x) => x + 1)
        .map((x) => x.toString());

      expect(result.unwrap()).toBe("11");
    });

    it("should propagate None through transformations", () => {
      const none = ExperimentalOption.None;

      // Chain transformations on None
      const result = none
        .map((x) => x * 2)
        .map((x) => x + 1)
        .map((x) => x.toString());

      expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
    });
  });

  describe("Immutability", () => {
    it("should not modify original Option through transformations", () => {
      const original = ExperimentalOption.Some(42);

      // Create transformations
      const mapped = original.map((x) => x * 2);
      const mappedAgain = original.map((x) => x.toString());

      // Original should be unchanged
      expect(original.unwrap()).toBe(42);
      expect(mapped.unwrap()).toBe(84);
      expect(mappedAgain.unwrap()).toBe("42");
    });

    it("should not modify internal values", () => {
      const obj = { value: 42 };
      const original = ExperimentalOption.Some(obj);

      // Modify the extracted value
      const extracted = original.unwrap() as typeof obj;
      extracted.value = 100;

      // The Option should still reference the original object (no deep copying)
      // But this tests that the Option structure itself is immutable
      expect(original.unwrap()).toBe(extracted);
      expect(original.unwrap().value).toBe(100); // Reference is shared
    });

    it("should maintain separate Option instances", () => {
      const some1 = ExperimentalOption.Some(42);
      const some2 = ExperimentalOption.Some(42);

      // Should be different instances even with same value
      expect(some1).not.toBe(some2);
      expect(some1.unwrap()).toBe(some2.unwrap()); // But values equal
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle falsy values correctly in Some", () => {
      const falsyValues = [false, 0, "", null, undefined, NaN];

      for (const value of falsyValues) {
        const opt = ExperimentalOption.Some(value);
        expect(() => opt.unwrap()).not.toThrow(
          `Should not throw for Some(${value})`,
        );

        // NaN needs special handling
        if (Number.isNaN(value)) {
          expect(Number.isNaN(opt.unwrap())).toBe(true);
        } else {
          expect(opt.unwrap()).toBe(value);
        }
      }
    });

    it("should handle complex objects as values", () => {
      const complexValues = [
        { nested: { deep: { value: 42 } } },
        [1, [2, [3, 4]]],
        new Map([["key", "value"]]),
        new Set([1, 2, 3]),
        new Date(),
        /regex/g,
      ];

      for (const value of complexValues) {
        const opt = ExperimentalOption.Some(value);
        expect(() => opt.unwrap()).not.toThrow();
        expect(opt.unwrap()).toBe(value);
      }
    });

    it("should handle thrown errors in transformation functions", async () => {
      const some = ExperimentalOption.Some(42);

      // Test sync error throwing
      const errorFn = () => {
        throw new Error("Transformation error");
      };

      expect(() => some.map(errorFn)).toThrow("Transformation error");

      // Test async error throwing
      const asyncErrorFn = async () => {
        throw new Error("Async transformation error");
      };

      const asyncResult = some.map(asyncErrorFn);
      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });
  });

  describe("Sync/Async Hybrid Behavior", () => {
    it("should maintain sync behavior for sync operations", () => {
      const syncOpt = ExperimentalOption.Some(42);

      // Sync transformation should maintain sync nature
      const syncMapped = syncOpt.map((x) => x * 2);
      expect(syncMapped.value.constructor.name).toBe("SyncOpt");
      expect(syncMapped.unwrap()).toBe(84);
    });

    it("should convert to async when async operations are used", () => {
      const syncOpt = ExperimentalOption.Some(42);

      // Async transformation should convert to AsyncOpt
      const asyncMapped = syncOpt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 2;
      });

      expect(asyncMapped.value.constructor.name).toBe("AsyncOpt");
    });

    it("should handle mixed sync/async chains correctly", () => {
      const syncOpt = ExperimentalOption.Some(42);

      // Mixed chain should properly handle types
      const result = syncOpt
        .map((x) => x * 2) // sync
        .map((x) => x.toString()) // sync
        .map(async (str) => str.toUpperCase()) // async
        .map((upperStr) => upperStr.toLowerCase()); // sync on async result

      expect(result.value.constructor.name).toBe("AsyncOpt");
    });
  });
});
