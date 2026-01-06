import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";
import {
  AsyncTestHelpers,
  ErrorTestHelpers,
  TestDataFactory,
  TestScenarios,
} from "./test-utils";

/**
 * Transformation Methods Tests
 *
 * These tests verify the core transformation methods defined in the Option specification.
 * All tests assume the API will be fixed to properly expose these methods.
 *
 * Methods covered:
 * - map<U>(fn: (val: T) => U | Promise<U>): Option<U | Promise<U>>
 * - flatMap<U>(fn: (val: T) => Option<U> | Promise<Option<U>>): Option<U | Promise<U>>
 * - zip<U>(fn: (val: T) => U | Promise<U>): Option<[T, U] | Promise<[T, U]>>
 * - flatZip<U>(fn: (val: T) => Option<U> | Promise<Option<U>>): Option<[T, U] | Promise<[T, U]>>
 */

describe("ExperimentalOption - Transformation Methods", () => {
  describe("map() transformations", () => {
    describe("Sync transformations on Sync Some", () => {
      it("should transform values correctly", () => {
        const testCases = [
          { input: 42, transform: (x: number) => x * 2, expected: 84 },
          {
            input: "hello",
            transform: (x: string) => x.toUpperCase(),
            expected: "HELLO",
          },
          { input: false, transform: (x: boolean) => !x, expected: true },
          { input: [1, 2], transform: (x: number[]) => x.length, expected: 2 },
        ];

        for (const { input, transform, expected } of testCases) {
          const opt = ExperimentalOption.Some(input);
          const result = opt.map(transform);
          expect(result.unwrap()).toBe(expected);
        }
      });

      it("should maintain type safety", () => {
        const numberOpt = ExperimentalOption.Some(42);
        const stringOpt = ExperimentalOption.Some("hello");

        // These should compile without type errors
        const stringResult = numberOpt.map((x) => x.toString());
        const lengthResult = stringOpt.map((x) => x.length);

        expect(stringResult.unwrap()).toBe("42");
        expect(lengthResult.unwrap()).toBe(5);
      });

      it("should handle function chaining", () => {
        const opt = ExperimentalOption.Some(5);

        const result = opt
          .map((x) => x * 2)
          .map((x) => x + 1)
          .map((x) => x.toString())
          .map((x) => parseInt(x, 10));

        expect(result.unwrap()).toBe(11);
      });
    });

    describe("Async transformations on Sync Some", () => {
      it("should convert to AsyncOpt with async transformation", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.map(async (x) => {
          await AsyncTestHelpers.delay(1);
          return x * 2;
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toBe(84);
      });

      it("should handle Promise values in transformations", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.map((x) => Promise.resolve(x * 2));

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toBe(84);
      });

      it("should handle async function chaining", async () => {
        const opt = ExperimentalOption.Some(5);

        const result = opt
          .map((x) => x * 2) // sync
          .map(async (x) => {
            // async
            await AsyncTestHelpers.delay(1);
            return x + 1;
          })
          .map((x) => x.toString()); // sync on async result

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toBe("11");
      });
    });

    describe("Transformations on None", () => {
      it("should propagate None through sync transformations", () => {
        const none = ExperimentalOption.None;

        const result = none
          .map((x) => x * 2)
          .map((x) => x.toString())
          .map((x) => parseInt(x, 10));

        expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
      });

      it("should propagate None through async transformations", async () => {
        const none = ExperimentalOption.None;

        const result = none.map(async (x) => {
          await AsyncTestHelpers.delay(1);
          return x * 2;
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        await ErrorTestHelpers.expectThrows(
          () => result.unwrap(),
          "Called unwrap on a None value",
        );
      });
    });

    describe("Error handling in transformations", () => {
      it("should handle thrown errors in sync transformations", () => {
        const opt = ExperimentalOption.Some(42);

        expect(() => {
          opt.map((x) => {
            throw new Error("Transformation error");
          });
        }).toThrow("Transformation error");
      });

      it("should handle rejected promises in async transformations", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.map(async (x) => {
          await AsyncTestHelpers.delay(1);
          throw new Error("Async transformation error");
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        await ErrorTestHelpers.expectThrows(
          () => result.unwrap(),
          "Async transformation error",
        );
      });
    });
  });

  describe("flatMap() operations", () => {
    describe("Sync flatMap on Sync Some", () => {
      it("should flatten nested Options", () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatMap((x) => ExperimentalOption.Some(x * 2));

        expect(result.unwrap()).toBe(84);
        expect(result.value.constructor.name).toBe("SyncOpt");
      });

      it("should handle None results", () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatMap((x) => ExperimentalOption.None);

        expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
      });

      it("should handle conditional Option creation", () => {
        const opt = ExperimentalOption.Some(42);

        const evenOpt = opt.flatMap((x) =>
          x % 2 === 0
            ? ExperimentalOption.Some("even")
            : ExperimentalOption.None,
        );

        const oddOpt = opt.flatMap((x) =>
          x % 2 === 1
            ? ExperimentalOption.Some("odd")
            : ExperimentalOption.None,
        );

        expect(evenOpt.unwrap()).toBe("even");
        expect(() => oddOpt.unwrap()).toThrow("Called unwrap on a None value");
      });

      it("should enable complex chaining", () => {
        const opt = ExperimentalOption.Some("  hello world  ");

        const result = opt
          .flatMap((s) =>
            s.trim()
              ? ExperimentalOption.Some(s.trim())
              : ExperimentalOption.None,
          )
          .flatMap((s) =>
            s.length > 0 ? ExperimentalOption.Some(s) : ExperimentalOption.None,
          )
          .flatMap((s) => ExperimentalOption.Some(s.toUpperCase()));

        expect(result.unwrap()).toBe("HELLO WORLD");
      });
    });

    describe("Async flatMap operations", () => {
      it("should handle async Option returning functions", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatMap(async (x) => {
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.Some(x * 2);
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toBe(84);
      });

      it("should handle async None results", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatMap(async (x) => {
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.None;
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        await ErrorTestHelpers.expectThrows(
          () => result.unwrap(),
          "Called unwrap on a None value",
        );
      });

      it("should handle Promise<Option<U>>", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatMap((x) =>
          Promise.resolve(ExperimentalOption.Some(x * 2)),
        );

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toBe(84);
      });
    });

    describe("flatMap on None", () => {
      it("should propagate None without calling function", () => {
        const none = ExperimentalOption.None;
        let callCount = 0;

        const result = none.flatMap((x) => {
          callCount++;
          return ExperimentalOption.Some(x * 2);
        });

        expect(callCount).toBe(0);
        expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
      });
    });
  });

  describe("zip() operations", () => {
    describe("Sync zip on Sync Some", () => {
      it("should pair original and transformed values", () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.zip((x) => x * 2);

        expect(result.unwrap()).toEqual([42, 84]);
      });

      it("should handle different value types", () => {
        const testCases = [
          {
            input: "hello",
            transform: (x: string) => x.length,
            expected: ["hello", 5],
          },
          {
            input: [1, 2, 3],
            transform: (x: number[]) => x.join(","),
            expected: [[1, 2, 3], "1,2,3"],
          },
          {
            input: true,
            transform: (x: boolean) => (x ? "yes" : "no"),
            expected: [true, "yes"],
          },
        ];

        for (const { input, transform, expected } of testCases) {
          const opt = ExperimentalOption.Some(input);
          const result = opt.zip(transform);
          expect(result.unwrap()).toEqual(expected);
        }
      });

      it("should enable keeping original value", () => {
        const user = ExperimentalOption.Some({ name: "Alice", age: 30 });

        const withAgeCategory = user.zip((u) => ({
          ...u,
          category: u.age >= 18 ? "adult" : "minor",
        }));

        expect(withAgeCategory.unwrap()).toEqual([
          { name: "Alice", age: 30 },
          { name: "Alice", age: 30, category: "adult" },
        ]);
      });
    });

    describe("Async zip operations", () => {
      it("should handle async transformations", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.zip(async (x) => {
          await AsyncTestHelpers.delay(1);
          return x * 2;
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toEqual([42, 84]);
      });

      it("should handle Promise transformations", async () => {
        const opt = ExperimentalOption.Some("hello");

        const result = opt.zip((x) => Promise.resolve(x.length));

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toEqual(["hello", 5]);
      });
    });

    describe("zip on None", () => {
      it("should propagate None without calling function", () => {
        const none = ExperimentalOption.None;
        let callCount = 0;

        const result = none.zip((x) => {
          callCount++;
          return x * 2;
        });

        expect(callCount).toBe(0);
        expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
      });
    });
  });

  describe("flatZip() operations", () => {
    describe("Sync flatZip on Sync Some", () => {
      it("should pair with Option results", () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatZip((x) =>
          x % 2 === 0
            ? ExperimentalOption.Some("even")
            : ExperimentalOption.None,
        );

        expect(result.unwrap()).toEqual([42, "even"]);
      });

      it("should handle None results", () => {
        const opt = ExperimentalOption.Some(41); // odd number

        const result = opt.flatZip((x) =>
          x % 2 === 0
            ? ExperimentalOption.Some("even")
            : ExperimentalOption.None,
        );

        expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
      });

      it("should enable safe conditional pairing", () => {
        const user = ExperimentalOption.Some({
          name: "Alice",
          email: "alice@example.com",
        });

        const withValidatedEmail = user.flatZip((u) => {
          const email = u.email;
          if (email && email.includes("@")) {
            return ExperimentalOption.Some(email.toLowerCase());
          }
          return ExperimentalOption.None;
        });

        expect(withValidatedEmail.unwrap()).toEqual([
          { name: "Alice", email: "alice@example.com" },
          "alice@example.com",
        ]);
      });
    });

    describe("Async flatZip operations", () => {
      it("should handle async Option returning functions", async () => {
        const opt = ExperimentalOption.Some(42);

        const result = opt.flatZip(async (x) => {
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.Some(x * 2);
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        expect(await result.unwrap()).toEqual([42, 84]);
      });

      it("should handle async None results", async () => {
        const opt = ExperimentalOption.Some(41);

        const result = opt.flatZip(async (x) => {
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.None;
        });

        expect(result.value.constructor.name).toBe("AsyncOpt");
        await ErrorTestHelpers.expectThrows(
          () => result.unwrap(),
          "Called unwrap on a None value",
        );
      });
    });

    describe("flatZip on None", () => {
      it("should propagate None without calling function", () => {
        const none = ExperimentalOption.None;
        let callCount = 0;

        const result = none.flatZip((x) => {
          callCount++;
          return ExperimentalOption.Some(x * 2);
        });

        expect(callCount).toBe(0);
        expect(() => result.unwrap()).toThrow("Called unwrap on a None value");
      });
    });
  });

  describe("Transformation Combinations", () => {
    it("should support complex pipelines using all transformation methods", () => {
      const data = ExperimentalOption.Some("  123abc  ");

      const result = data
        // Clean and validate
        .flatMap((s) =>
          s.trim()
            ? ExperimentalOption.Some(s.trim())
            : ExperimentalOption.None,
        )
        .zip((s) => s.length) // Keep original with length
        .flatZip(([original, length]) =>
          length > 0
            ? ExperimentalOption.Some({ original, length })
            : ExperimentalOption.None,
        )
        // Extract number
        .map(({ original }) => original)
        .flatMap((s) => {
          const match = s.match(/\d+/);
          return match
            ? ExperimentalOption.Some(parseInt(match[0], 10))
            : ExperimentalOption.None;
        })
        // Transform number
        .map((n) => n * 2);

      expect(result.unwrap()).toBe(246);
    });

    it("should handle mixed sync/async pipelines", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt
        .map((x) => x * 2) // sync
        .zip(async (x) => {
          // async zip
          await AsyncTestHelpers.delay(1);
          return x.toString();
        })
        .flatZip(async ([num, str]) => {
          // async flatZip
          await AsyncTestHelpers.delay(1);
          return ExperimentalOption.Some(`${num}:${str}`);
        })
        .map((pair) => pair.toUpperCase()); // sync on async result

      expect(result.value.constructor.name).toBe("AsyncOpt");
      expect(await result.unwrap()).toBe("84:84");
    });
  });

  describe("Type Safety in Transformations", () => {
    it("should preserve types through map chains", () => {
      const numberOpt = ExperimentalOption.Some(42);

      // This should compile and work correctly
      const stringOpt = numberOpt
        .map((n) => n.toString())
        .map((s) => s.length)
        .map((l) => l > 5);

      expect(stringOpt.unwrap()).toBe(false);
    });

    it("should handle complex generic types", () => {
      type User = { id: number; name: string };
      const userOpt = ExperimentalOption.Some<User>({ id: 1, name: "Alice" });

      const result = userOpt
        .map((u) => u.id)
        .zip((id) => ExperimentalOption.Some(`user-${id}`))
        .flatZip(([id, userStr]) =>
          ExperimentalOption.Some({ id, display: userStr }),
        );

      expect(result.unwrap()).toEqual({ id: 1, display: "user-1" });
    });
  });
});
