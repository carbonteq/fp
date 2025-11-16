import { describe, expect, test } from "bun:test";
import { Either } from "@/either.js";

const zipHelpers = {
  syncRightMapper: (value: number) => `zip-right-${value * 2}` as const,
  asyncRightMapper: async (value: number) =>
    `async-zip-right-${value * 3}` as const,
  syncLeftMapper: (value: string) => `zip-left-${value.toUpperCase()}` as const,
  asyncLeftMapper: async (value: string) =>
    `async-zip-left-${value.toLowerCase()}` as const,
  syncTupleMapper: (value: number) => [value, value * 2] as const,
  asyncTupleMapper: async (value: number) =>
    [value, await Promise.resolve(value * 4)] as const,
  rightSeed: () => 42 as const,
  leftSeed: () => "initial-error" as const,
};

describe("Either.zip behavior", () => {
  describe("sync mappers", () => {
    test("zips Right values into tuples", () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either.zip(zipHelpers.syncRightMapper);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toEqual([42, "zip-right-84"]);
      }
    });

    test("short-circuits Left values before zip operation", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either.zip(zipHelpers.syncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("preserves original value in tuple first position", () => {
      const either = Either.Right(15);
      const result = either.zip((x) => `mapped-${x}`);

      expect(result.isRight()).toBe(true);
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toEqual([15, "mapped-15"]);
      }
    });
  });

  describe("async mappers", () => {
    test("zips Right values with async mapper", async () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either.zip(zipHelpers.asyncRightMapper);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([42, "async-zip-right-126"]);
    });

    test("short-circuits Left values before async zip operation", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either.zip(zipHelpers.asyncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });
  });

  describe("chaining behavior", () => {
    test("supports multiple zip operations", () => {
      const either = Either.Right(10);
      const result = either
        .zip((x) => x * 2)
        .zip(([original, mapped]) => `final-${original}-${mapped}`);

      expect(result.isRight()).toBe(true);
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toEqual([[10, 20], "final-10-20"]);
      }
    });

    test("short-circuits after switching to Left track", () => {
      const either = Either.Right(10);
      const result = either
        .zip((x) => Either.Left(`error-${x}`) as any) // This switches to Left
        .zip((x) => x); // This should be skipped

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("error-10");
      }
    });
  });
});

describe("Either.zipRight behavior", () => {
  describe("sync mappers", () => {
    test("zips Right values with zipHelpers.syncRightMapper", () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either.zipRight(zipHelpers.syncRightMapper);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toEqual([42, "zip-right-84"]);
      }
    });

    test("short-circuits Left values before zipHelpers.syncRightMapper", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either.zipRight(zipHelpers.syncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("preserves original Right value as first tuple element", () => {
      const either = Either.Right("original");
      const result = either.zipRight((value) => `mapped-${value}`);

      expect(result.isRight()).toBe(true);
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toEqual([
          "original",
          "mapped-original",
        ]);
      }
    });
  });

  describe("async mappers", () => {
    test("zips Right values with zipHelpers.asyncRightMapper and zipHelpers.asyncTupleMapper", async () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either.zipRight(zipHelpers.asyncRightMapper);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([42, "async-zip-right-126"]);
    });

    test("short-circuits Left values before zipHelpers.asyncRightMapper", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either.zipRight(zipHelpers.asyncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.zipRight(zipHelpers.asyncRightMapper).zipRight(zipHelpers.syncTupleMapper) on Right branches", async () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either
        .zipRight(zipHelpers.asyncRightMapper)
        .zipRight(([original, mapped]) => `final-${original}-${mapped}`);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([
        [42, "async-zip-right-126"],
        "final-42-async-zip-right-126",
      ]);
    });

    test("short-circuits Either.zipRight(zipHelpers.asyncRightMapper).zipRight(zipHelpers.syncTupleMapper) on Left branches", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either
        .zipRight(zipHelpers.asyncRightMapper)
        .zipRight(([original, mapped]) => `final-${original}-${mapped}`);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("supports chaining Either.zipRight(zipHelpers.syncRightMapper).zipLeft(zipHelpers.syncLeftMapper) without mutating the original Either", () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result1 = either.zipRight(zipHelpers.syncRightMapper);
      const result2 = result1.zipLeft(zipHelpers.syncLeftMapper);

      // Original should be unchanged
      expect(either.isRight()).toBe(true);
      expect(either.safeUnwrap().kind).toBe("some");
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap().value).toBe(42);
      }

      // First result should be zipped
      expect(result1.isRight()).toBe(true);
      expect(result1.safeUnwrap().kind).toBe("some");
      if (result1.safeUnwrap().kind === "some") {
        expect(result1.safeUnwrap().value).toEqual([42, "zip-right-84"]);
      }

      // Second result should be unchanged (still on Right track)
      expect(result2.isRight()).toBe(true);
      expect(result2.safeUnwrap().kind).toBe("some");
      if (result2.safeUnwrap().kind === "some") {
        expect(result2.safeUnwrap().value).toEqual([42, "zip-right-84"]);
      }
    });

    test("propagates Left across Either.zipRight(zipHelpers.asyncRightMapper).zipLeft(zipHelpers.asyncLeftMapper) flows", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either
        .zipRight(zipHelpers.asyncRightMapper)
        .zipLeft(zipHelpers.asyncLeftMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("enables complex tuple transformations", () => {
      const either = Either.Right(10);
      const result = either
        .zipRight((x) => x * 2)
        .zipRight(([original, doubled]) => original + doubled)
        .zipRight(([[orig, dbl], sum]) => [orig, dbl, sum]);

      expect(result.isRight()).toBe(true);
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toEqual([[10, 20], 30, [10, 20, 30]]);
      }
    });
  });
});

describe("Either.zipLeft behavior", () => {
  describe("sync mappers", () => {
    test("zips Left values with zipHelpers.syncLeftMapper", () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either.zipLeft(zipHelpers.syncLeftMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toEqual([
          "initial-error",
          "zip-left-INITIAL-ERROR",
        ]);
      }
    });

    test("preserves Right values when zipHelpers.syncLeftMapper is used", () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either.zipLeft(zipHelpers.syncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });

    test("preserves original Left value as first tuple element", () => {
      const either = Either.Left("original-error");
      const result = either.zipLeft((error) => `mapped-${error}`);

      expect(result.isLeft()).toBe(true);
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toEqual([
          "original-error",
          "mapped-original-error",
        ]);
      }
    });
  });

  describe("async mappers", () => {
    test("zips Left values with zipHelpers.asyncLeftMapper", async () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either.zipLeft(zipHelpers.asyncLeftMapper);

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toEqual([
        "initial-error",
        "async-zip-left-initial-error",
      ]);
    });

    test("preserves Right values when zipHelpers.asyncLeftMapper is used", () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either.zipLeft(zipHelpers.asyncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.zipLeft(zipHelpers.asyncLeftMapper).zipLeft(zipHelpers.syncLeftMapper) on Left branches", async () => {
      const either = Either.Left(zipHelpers.leftSeed());
      const result = either
        .zipLeft(zipHelpers.asyncLeftMapper)
        .zipLeft(([original, mapped]) => `final-${original}-${mapped}`);

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toEqual([
        ["initial-error", "async-zip-left-initial-error"],
        "final-initial-error-async-zip-left-initial-error",
      ]);
    });

    test("does not remap Right branches when chaining Either.zipLeft(zipHelpers.syncLeftMapper).zipLeft(zipHelpers.asyncLeftMapper)", () => {
      const either = Either.Right(zipHelpers.rightSeed());
      const result = either
        .zipLeft(zipHelpers.syncLeftMapper)
        .zipLeft(zipHelpers.asyncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });

    test("allows Either.zipLeft(zipHelpers.syncLeftMapper).zipRight(zipHelpers.syncRightMapper) permutations", () => {
      // Test starting with Left
      const leftEither = Either.Left(zipHelpers.leftSeed());
      const leftResult = leftEither
        .zipLeft(zipHelpers.syncLeftMapper)
        .zipRight(zipHelpers.syncRightMapper);

      expect(leftResult.isLeft()).toBe(true);
      expect(leftResult.safeUnwrapLeft().kind).toBe("some");
      if (leftResult.safeUnwrapLeft().kind === "some") {
        expect(leftResult.safeUnwrapLeft().value).toEqual([
          "initial-error",
          "zip-left-INITIAL-ERROR",
        ]);
      }

      // Test starting with Right
      const rightEither = Either.Right(zipHelpers.rightSeed());
      const rightResult = rightEither
        .zipLeft(zipHelpers.syncLeftMapper)
        .zipRight(zipHelpers.syncRightMapper);

      expect(rightResult.isRight()).toBe(true);
      expect(rightResult.safeUnwrap().kind).toBe("some");
      if (rightResult.safeUnwrap().kind === "some") {
        expect(rightResult.safeUnwrap().value).toEqual([42, "zip-right-84"]);
      }
    });

    test("supports Either.zipLeft(zipHelpers.asyncLeftMapper).zipRight(zipHelpers.asyncRightMapper) permutations", async () => {
      // Test starting with Left
      const leftEither = Either.Left(zipHelpers.leftSeed());
      const leftResult = leftEither
        .zipLeft(zipHelpers.asyncLeftMapper)
        .zipRight(zipHelpers.asyncRightMapper);

      expect(leftResult.isLeft()).toBe(true);
      const unwrappedLeft = leftResult.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toEqual([
        "initial-error",
        "async-zip-left-initial-error",
      ]);

      // Test starting with Right
      const rightEither = Either.Right(zipHelpers.rightSeed());
      const rightResult = rightEither
        .zipLeft(zipHelpers.asyncLeftMapper)
        .zipRight(zipHelpers.asyncRightMapper);

      expect(rightResult.isRight()).toBe(true);
      const unwrapped = rightResult.unwrap();
      const rightResolved = await Promise.resolve(unwrapped);
      expect(rightResolved).toEqual([42, "async-zip-right-126"]);
    });

    test("enables complex Left track tuple transformations", () => {
      const either = Either.Left("error");
      const result = either
        .zipLeft((err) => err.toUpperCase())
        .zipLeft(([original, upper]) => [original, upper, original.length])
        .zipLeft(([[orig, up], len]) => ({
          original: orig,
          uppercase: up,
          length: len,
        }));

      expect(result.isLeft()).toBe(true);
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toEqual({
          original: "error",
          uppercase: "ERROR",
          length: 5,
        });
      }
    });
  });
});

describe("Complex zip scenarios", () => {
  test("alternating zipRight and zipLeft operations maintain track correctly", () => {
    const either = Either.Right(10);
    const result = either
      .zipRight((x) => x * 2) // Still on Right: [10, 20]
      .zipLeft((err) => `left-${err}`) // Skipped, still on Right
      .zipRight(([orig, dbl]) => orig + dbl) // Still on Right: [[10, 20], 30]
      .zipLeft((err) => `final-left-${err}`); // Skipped, still on Right

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap().value).toEqual([[10, 20], 30]);
    }
  });

  test("zip operations after track switching", () => {
    const either = Either.Left("start-error");
    const result = either
      .zipLeft((err) => err.toUpperCase()) // On Left: ["start-error", "START-ERROR"]
      .flatMapLeft(([_orig, upper]) => Either.Right(`recovered-${upper}`)) // Switch to Right
      .zipRight((success) => success.length); // On Right: ["recovered-START-ERROR", 21]

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap().value).toEqual(["recovered-START-ERROR", 21]);
    }
  });

  test("zip preserves immutability of original Either", () => {
    const original = Either.Right(100);
    const zipped = original.zip((x) => x * 2);

    // Original should be unchanged
    expect(original.isRight()).toBe(true);
    if (original.safeUnwrap().kind === "some") {
      expect(original.safeUnwrap().value).toBe(100);
    }

    // Zipped should contain tuple
    expect(zipped.isRight()).toBe(true);
    if (zipped.safeUnwrap().kind === "some") {
      expect(zipped.safeUnwrap().value).toEqual([100, 200]);
    }
  });
});
