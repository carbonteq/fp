import { describe, expect, it } from "bun:test";
import { HybridResult } from "@/result.hybrid";

describe("Combinators & Helpers", () => {
  describe("map", () => {
    it("should map sync Ok results without promoting to async", () => {
      const result = HybridResult.Ok(42).map((x) => x * 2);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(84);
      expect(result.toString()).toBe("Result::Ok<84>");
    });

    it("should promote to async when mapper returns promise", async () => {
      const result = HybridResult.Ok(42).map((x) => Promise.resolve(x * 2));

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe(84);
    });

    it("should handle exceptions in mapper", () => {
      const result = HybridResult.Ok(42).map(() => {
        throw new Error("mapper error");
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(Error);
      expect((result.unwrapErr() as Error).message).toBe("mapper error");
    });

    it("should propagate Err results without calling mapper", () => {
      const result = HybridResult.Err<string, number>("error").map(
        (x) => x * 2,
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
    });

    it("should handle async Err results with map", async () => {
      const result = HybridResult.Err(Promise.resolve("async error")).map(
        (x) => x * 2,
      );

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrappedErr = await result.unwrapErr();
      expect(unwrappedErr).toBe("async error");
    });
  });

  describe("flatMap", () => {
    it("should flatMap sync results", () => {
      const result = HybridResult.Ok(42).flatMap((x) => HybridResult.Ok(x * 2));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(84);
    });

    it("should handle Err results in flatMap", () => {
      const result = HybridResult.Ok(42).flatMap(() =>
        HybridResult.Err("flatMap error"),
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("flatMap error");
    });

    it("should chain multiple flatMap operations", () => {
      const result = HybridResult.Ok(42)
        .flatMap((x) => HybridResult.Ok(x.toString()))
        .flatMap((s) => HybridResult.Ok(s.length));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(2);
    });

    it("should promote to async with async mappers", async () => {
      const result = HybridResult.Ok(42).flatMap((x) =>
        Promise.resolve(HybridResult.Ok(x * 2)),
      );

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe(84);
    });

    it("should propagate initial Err results", () => {
      const result = HybridResult.Err("initial error").flatMap((x) =>
        HybridResult.Ok(x * 2),
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("initial error");
    });
  });

  describe("zip", () => {
    it("should zip sync Ok results into tuples", () => {
      const result = HybridResult.Ok(42).zip((x) => x * 2);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([42, 84]);
    });

    it("should handle Err results in zip", () => {
      const result = HybridResult.Err<number, string>("error").zip(
        (x) => x * 2,
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
    });

    it("should promote to async when mapper returns promise", async () => {
      const result = HybridResult.Ok(42).zip((x) => Promise.resolve(x * 2));

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toEqual([42, 84]);
    });

    it("should handle exceptions in zip mapper", () => {
      const result = HybridResult.Ok(42).zip(() => {
        throw new Error("zip error");
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(Error);
    });
  });

  describe("flatZip", () => {
    it("should flatZip sync results into tuples", () => {
      const result = HybridResult.Ok(42).flatZip((x) => HybridResult.Ok(x * 2));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([42, 84]);
    });

    it("should handle Err results in flatZip", () => {
      const result = HybridResult.Ok(42).flatZip(() =>
        HybridResult.Err("flatZip error"),
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("flatZip error");
    });

    it("should handle initial Err results", () => {
      const result = HybridResult.Err("initial error").flatZip((x) =>
        HybridResult.Ok(x * 2),
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("initial error");
    });

    it("should promote to async with async mappers", async () => {
      const result = HybridResult.Ok(42).flatZip((x) =>
        Promise.resolve(HybridResult.Ok(x * 2)),
      );

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toEqual([42, 84]);
    });
  });

  describe("Result.all", () => {
    it("should combine all sync Ok results", () => {
      const result1 = HybridResult.Ok(42);
      const result2 = HybridResult.Ok("hello");
      const result3 = HybridResult.Ok(true);

      const combined = HybridResult.all(result1, result2, result3);

      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([42, "hello", true]);
    });

    it("should return all errors when any result is Err", () => {
      const result1 = HybridResult.Ok(42);
      const result2 = HybridResult.Err("error1");
      const result3 = HybridResult.Err("error2");

      const combined = HybridResult.all(result1, result2, result3);

      expect(combined.isErr()).toBe(true);
      expect(combined.unwrapErr()).toEqual(["error1", "error2"]);
    });

    it("should promote to async with async results", async () => {
      const result1 = HybridResult.Ok(42);
      const result2 = HybridResult.Ok(Promise.resolve("hello"));
      const result3 = HybridResult.Ok(true);

      const combined = HybridResult.all(result1, result2, result3);

      expect(combined.toString()).toBe("Result::Promise<...>");
      const unwrapped = await combined.unwrap();
      expect(unwrapped).toEqual([42, "hello", true]);
    });

    it("should handle mixed sync/async with errors", async () => {
      const result1 = HybridResult.Ok(42);
      const result2 = HybridResult.Err(Promise.resolve("async error"));
      const result3 = HybridResult.Ok(true);

      const combined = HybridResult.all(result1, result2, result3);

      expect(combined.toString()).toBe("Result::Promise<...>");
      const unwrappedErr = await combined.unwrapErr();
      expect(unwrappedErr).toEqual(["async error"]);
    });

    it("should handle empty array", () => {
      const combined = HybridResult.all();

      expect(combined.isOk()).toBe(true);
      expect(combined.unwrap()).toEqual([]);
    });
  });

  describe("validate", () => {
    it("should pass when all validators succeed", () => {
      const result = HybridResult.Ok(42).validate([
        (x) => HybridResult.Ok(x > 0),
        (x) => HybridResult.Ok(x < 100),
        (x) => HybridResult.Ok(x % 2 === 0),
      ]);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should return all validation errors", () => {
      const result = HybridResult.Ok(42).validate([
        (x) => HybridResult.Ok(x > 0),
        (x) => HybridResult.Err("too big"),
        (x) => HybridResult.Err("not odd"),
      ]);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toEqual(["too big", "not odd"]);
    });

    it("should return early if initial result is Err", () => {
      const result = HybridResult.Err("initial error").validate([
        (x) => HybridResult.Ok(x > 0),
        (x) => HybridResult.Err("validation error"),
      ]);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("initial error");
    });

    it("should handle async validators", async () => {
      const result = HybridResult.Ok(42).validate([
        (x) => HybridResult.Ok(x > 0),
        (x) => Promise.resolve(HybridResult.Ok(x < 100)),
        (x) => HybridResult.Ok(x % 2 === 0),
      ]);

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe(42);
    });

    it("should handle async initial result", async () => {
      const result = HybridResult.Ok(Promise.resolve(42)).validate([
        (x) => HybridResult.Ok(x > 0),
        (x) => HybridResult.Ok(x < 100),
      ]);

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe(42);
    });

    it("should handle exceptions in validators", () => {
      const result = HybridResult.Ok(42).validate([
        (x) => HybridResult.Ok(x > 0),
        (x) => {
          throw new Error("validator error");
        },
      ]);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toEqual([new Error("validator error")]);
    });
  });

  describe("mapErr", () => {
    it("should map Err values", () => {
      const result = HybridResult.Err("original error").mapErr(
        (err) => `Mapped: ${err}`,
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("Mapped: original error");
    });

    it("should propagate Ok values", () => {
      const result = HybridResult.Ok(42).mapErr((err) => `Mapped: ${err}`);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it("should promote to async with async mapper", async () => {
      const result = HybridResult.Err("original error").mapErr((err) =>
        Promise.resolve(`Mapped: ${err}`),
      );

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrappedErr = await result.unwrapErr();
      expect(unwrappedErr).toBe("Mapped: original error");
    });

    it("should handle async Err results", async () => {
      const result = HybridResult.Err(Promise.resolve("async error")).mapErr(
        (err) => `Mapped: ${err}`,
      );

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrappedErr = await result.unwrapErr();
      expect(unwrappedErr).toBe("Mapped: async error");
    });
  });

  describe("mapBoth", () => {
    it("should map both Ok and Err values", () => {
      const okResult = HybridResult.Ok(42).mapBoth(
        (x) => x * 2,
        (err) => `Error: ${err}`,
      );

      expect(okResult.isOk()).toBe(true);
      expect(okResult.unwrap()).toBe(84);

      const errResult = HybridResult.Err("test error").mapBoth(
        (x) => x * 2,
        (err) => `Error: ${err}`,
      );

      expect(errResult.isErr()).toBe(true);
      expect(errResult.unwrapErr()).toBe("Error: test error");
    });

    it("should promote to async with async mappers", async () => {
      const result = HybridResult.Ok(42).mapBoth(
        (x) => Promise.resolve(x * 2),
        (err) => `Error: ${err}`,
      );

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe(84);
    });
  });

  describe("orElse", () => {
    it("should return Ok value when result is Ok", () => {
      const result = HybridResult.Ok(42).orElse(0);

      expect(result).toBe(42);
    });

    it("should return default value when result is Err", () => {
      const result = HybridResult.Err("error").orElse(0);

      expect(result).toBe(0);
    });

    it("should handle async defaults", async () => {
      const syncResult = HybridResult.Err("error").orElse(Promise.resolve(100));

      expect(syncResult).toBeInstanceOf(Promise);
      expect(await syncResult).toBe(100);
    });

    it("should handle async results", async () => {
      const asyncResult = HybridResult.Ok(Promise.resolve(42)).orElse(0);

      expect(asyncResult).toBeInstanceOf(Promise);
      expect(await asyncResult).toBe(42);
    });
  });

  describe("andThen", () => {
    it("should work as alias for flatMap", () => {
      const result = HybridResult.Ok(42).andThen((x) => HybridResult.Ok(x * 2));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(84);
    });

    it("should handle Err results", () => {
      const result = HybridResult.Ok(42).andThen(() =>
        HybridResult.Err("andThen error"),
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("andThen error");
    });
  });

  describe("Complex Integration Tests", () => {
    it("should handle complex async/sync chains", async () => {
      const result = HybridResult.Ok("42")
        .map((x) => parseInt(x))
        .flatMap((x) => HybridResult.Ok(x * 2))
        .zip((x) => x.toString())
        .flatMap(([num, str]) => HybridResult.Ok(`${num}-${str}`))
        .mapBoth(
          (val) => val.toUpperCase(),
          (err) => `Error: ${err}`,
        );

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("84-84");
    });

    it("should handle complex validation scenarios", async () => {
      const result = HybridResult.Ok(Promise.resolve({ age: 25, name: "John" }))
        .validate([
          (person) =>
            person.age >= 18
              ? HybridResult.Ok(true)
              : HybridResult.Err("too young"),
          (person) =>
            person.name.length > 0
              ? HybridResult.Ok(true)
              : HybridResult.Err("empty name"),
        ])
        .map((person) => `Validated: ${person.name}, ${person.age}`)
        .mapErr((errors) => `Validation failed: ${errors.join(", ")}`);

      expect(result.toString()).toBe("Result::Promise<...>");
      const finalResult = await result.unwrap();
      expect(finalResult).toBe("Validated: John, 25");
    });

    it("should handle Result.all with complex mixed results", async () => {
      const results = [
        HybridResult.Ok(42),
        HybridResult.Ok(Promise.resolve("hello")),
        HybridResult.Ok(true).map((x) => !x),
        HybridResult.Ok({ value: 42 }).zip((obj) => obj.value * 2),
      ];

      const combined = HybridResult.all(...results);
      expect(combined.toString()).toBe("Result::Promise<...>");

      const unwrapped = await combined.unwrap();
      expect(unwrapped).toEqual([42, "hello", false, [{ value: 42 }, 84]]);
    });
  });
});
