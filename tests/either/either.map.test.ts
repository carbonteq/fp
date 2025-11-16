import { describe, expect, test } from "bun:test";
import { Either } from "@/either.js";

const mapHelpers = {
  syncRightMapper: (value: number) => `right-${value * 2}` as const,
  asyncRightMapper: async (value: number) =>
    `async-right-${value * 3}` as const,
  syncLeftMapper: (value: string) => `left-${value.toUpperCase()}` as const,
  asyncLeftMapper: async (value: string) =>
    `async-left-${value.toLowerCase()}` as const,
  rightSeed: () => 42 as const,
  leftSeed: () => "initial-error" as const,
};

describe("Either.mapRight behavior", () => {
  describe("sync mappers", () => {
    test("maps Right values with mapHelpers.syncRightMapper", () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either.mapRight(mapHelpers.syncRightMapper);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe("right-84");
      }
    });

    test("short-circuits Left values before mapHelpers.syncRightMapper", () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either.mapRight(mapHelpers.syncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("preserves Left state through multiple mapRight operations", () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either
        .mapRight(mapHelpers.syncRightMapper)
        .mapRight(mapHelpers.syncRightMapper)
        .mapRight(mapHelpers.syncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });
  });

  describe("async mappers", () => {
    test("maps Right values with mapHelpers.asyncRightMapper", async () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either.mapRight(mapHelpers.asyncRightMapper);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("async-right-126");
    });

    test("short-circuits Left values before mapHelpers.asyncRightMapper", () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either.mapRight(mapHelpers.asyncRightMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.mapRight(mapHelpers.asyncRightMapper).mapRight(mapHelpers.syncRightMapper) on Right branches", async () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either
        .mapRight(mapHelpers.asyncRightMapper)
        .mapRight((value: string) => `sync-${value}`);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("sync-async-right-126");
    });

    test("short-circuits Either.mapRight(mapHelpers.asyncRightMapper).mapRight(mapHelpers.syncRightMapper) on Left branches", () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either
        .mapRight(mapHelpers.asyncRightMapper)
        .mapRight((value: string) => `sync-${value}`);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("supports chaining Either.mapRight(mapHelpers.syncRightMapper).mapLeft(mapHelpers.syncLeftMapper) without mutating the original Either", () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result1 = either.mapRight(mapHelpers.syncRightMapper);
      const result2 = result1.mapLeft(mapHelpers.syncLeftMapper);

      // Original should be unchanged
      expect(either.isRight()).toBe(true);
      expect(either.safeUnwrap().kind).toBe("some");
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap().value).toBe(42);
      }

      // First result should be mapped
      expect(result1.isRight()).toBe(true);
      expect(result1.safeUnwrap().kind).toBe("some");
      if (result1.safeUnwrap().kind === "some") {
        expect(result1.safeUnwrap().value).toBe("right-84");
      }

      // Second result should be unchanged (still on Right track)
      expect(result2.isRight()).toBe(true);
      expect(result2.safeUnwrap().kind).toBe("some");
      if (result2.safeUnwrap().kind === "some") {
        expect(result2.safeUnwrap().value).toBe("right-84");
      }
    });

    test("propagates Left across Either.mapRight(mapHelpers.asyncRightMapper).mapLeft(mapHelpers.asyncLeftMapper) flows", () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either
        .mapRight(mapHelpers.asyncRightMapper)
        .mapLeft(mapHelpers.asyncLeftMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("initial-error");
      }
    });

    test("supports chaining multiple mapRight operations on Right track", () => {
      const either = Either.Right(5);
      const result = either
        .mapRight((x) => x * 2)
        .mapRight((x) => x + 10)
        .mapRight((x) => `final-${x}`);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe("final-20");
      }
    });
  });
});

describe("Either.mapLeft behavior", () => {
  describe("sync mappers", () => {
    test("maps Left values with mapHelpers.syncLeftMapper", () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either.mapLeft(mapHelpers.syncLeftMapper);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("left-INITIAL-ERROR");
      }
    });

    test("preserves Right values when mapHelpers.syncLeftMapper is used", () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either.mapLeft(mapHelpers.syncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });

    test("preserves Right state through multiple mapLeft operations", () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either
        .mapLeft(mapHelpers.syncLeftMapper)
        .mapLeft(mapHelpers.syncLeftMapper)
        .mapLeft(mapHelpers.syncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });
  });

  describe("async mappers", () => {
    test("maps Left values with mapHelpers.asyncLeftMapper", async () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either.mapLeft(mapHelpers.asyncLeftMapper);

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("async-left-initial-error");
    });

    test("preserves Right values when mapHelpers.asyncLeftMapper is used", () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either.mapLeft(mapHelpers.asyncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.mapLeft(mapHelpers.asyncLeftMapper).mapLeft(mapHelpers.syncLeftMapper) on Left branches", async () => {
      const either = Either.Left(mapHelpers.leftSeed());
      const result = either
        .mapLeft(mapHelpers.asyncLeftMapper)
        .mapLeft((value: string) => `sync-${value}`);

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("sync-async-left-initial-error");
    });

    test("does not remap Right branches when chaining Either.mapLeft(mapHelpers.syncLeftMapper).mapLeft(mapHelpers.asyncLeftMapper)", () => {
      const either = Either.Right(mapHelpers.rightSeed());
      const result = either
        .mapLeft(mapHelpers.syncLeftMapper)
        .mapLeft(mapHelpers.asyncLeftMapper);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap().kind).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap().value).toBe(42);
      }
    });

    test("allows Either.mapLeft(mapHelpers.syncLeftMapper).mapRight(mapHelpers.syncRightMapper) permutations", () => {
      // Test starting with Left
      const leftEither = Either.Left(mapHelpers.leftSeed());
      const leftResult = leftEither
        .mapLeft(mapHelpers.syncLeftMapper)
        .mapRight(mapHelpers.syncRightMapper);

      expect(leftResult.isLeft()).toBe(true);
      expect(leftResult.safeUnwrapLeft().kind).toBe("some");
      if (leftResult.safeUnwrapLeft().kind === "some") {
        expect(leftResult.safeUnwrapLeft().value).toBe("left-INITIAL-ERROR");
      }

      // Test starting with Right
      const rightEither = Either.Right(mapHelpers.rightSeed());
      const rightResult = rightEither
        .mapLeft(mapHelpers.syncLeftMapper)
        .mapRight(mapHelpers.syncRightMapper);

      expect(rightResult.isRight()).toBe(true);
      expect(rightResult.safeUnwrap().kind).toBe("some");
      if (rightResult.safeUnwrap().kind === "some") {
        expect(rightResult.safeUnwrap().value).toBe("right-84");
      }
    });

    test("supports Either.mapLeft(mapHelpers.asyncLeftMapper).mapRight(mapHelpers.asyncRightMapper) permutations", async () => {
      // Test starting with Left
      const leftEither = Either.Left(mapHelpers.leftSeed());
      const leftResult = leftEither
        .mapLeft(mapHelpers.asyncLeftMapper)
        .mapRight(mapHelpers.asyncRightMapper);

      expect(leftResult.isLeft()).toBe(true);
      const unwrappedLeft = leftResult.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("async-left-initial-error");

      // Test starting with Right
      const rightEither = Either.Right(mapHelpers.rightSeed());
      const rightResult = rightEither
        .mapLeft(mapHelpers.asyncLeftMapper)
        .mapRight(mapHelpers.asyncRightMapper);

      expect(rightResult.isRight()).toBe(true);
      const unwrapped = rightResult.unwrap();
      const rightResolved = await Promise.resolve(unwrapped);
      expect(rightResolved).toBe("async-right-126");
    });

    test("supports chaining multiple mapLeft operations on Left track", () => {
      const either = Either.Left("error");
      const result = either
        .mapLeft((err) => err.toUpperCase())
        .mapLeft((err) => `prefix-${err}`)
        .mapLeft((err) => `final-${err}`);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft().kind).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft().value).toBe("final-prefix-ERROR");
      }
    });
  });
});

describe("Either.map (alias for mapRight) behavior", () => {
  test("map is an alias for mapRight", () => {
    const either = Either.Right(10);
    const result1 = either.map((x) => x * 3);
    const result2 = either.mapRight((x) => x * 3);

    expect(result1.isRight()).toBe(true);
    expect(result2.isRight()).toBe(true);

    expect(result1.safeUnwrap().kind).toBe("some");
    expect(result2.safeUnwrap().kind).toBe("some");

    if (
      result1.safeUnwrap().kind === "some" &&
      result2.safeUnwrap().kind === "some"
    ) {
      expect(result1.safeUnwrap().value).toBe(result2.safeUnwrap().value);
      expect(result1.safeUnwrap().value).toBe(30);
    }
  });

  test("map short-circuits on Left values", () => {
    const either = Either.Left("error");
    const result = either.map((x) => x * 3);

    expect(result.isLeft()).toBe(true);
    expect(result.safeUnwrapLeft().kind).toBe("some");
    if (result.safeUnwrapLeft().kind === "some") {
      expect(result.safeUnwrapLeft().value).toBe("error");
    }
  });
});
