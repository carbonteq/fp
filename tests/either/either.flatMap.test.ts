import { describe, expect, test } from "bun:test";
import { Either } from "@/either.js";

const flatMapHelpers = {
  syncRightBinder: (value: number) =>
    Either.Right<string, string>(`right-${value * 2}`),
  asyncRightBinder: async (value: number) =>
    Either.Right<string, string>(`async-right-${value * 3}`),
  syncLeftBinder: (value: string) => Either.Left<number, number>(value.length),
  asyncLeftBinder: async (value: string) =>
    Either.Left<number, number>((await Promise.resolve(value)).length),
  rightToLeftBinder: (value: number) =>
    Either.Left<string, string>(`error-${value}`),
  leftToRightBinder: (value: string) =>
    Either.Right<string, string>(`success-${value}`),
  rightSeed: () => 42 as const,
  leftSeed: () => "initial-error" as const,
};

describe("Either.flatMapRight behavior", () => {
  describe("sync binders", () => {
    test("flatMaps Right values with flatMapHelpers.syncRightBinder", () => {
      const either = Either.Right(flatMapHelpers.rightSeed());
      const result = either.flatMapRight(flatMapHelpers.syncRightBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe("right-84");
      }
    });

    test("short-circuits Left values before flatMapHelpers.syncRightBinder", () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either.flatMapRight(flatMapHelpers.syncRightBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("supports track switching from Right to Left", () => {
      const either = Either.Right(10);
      const result = either.flatMapRight(flatMapHelpers.rightToLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("error-10");
      }
    });

    test("enables subsequent Left operations after track switching", () => {
      const either = Either.Right(10);
      const result = either
        .flatMapRight(flatMapHelpers.rightToLeftBinder)
        .mapLeft((err) => `processed-${err}`);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("processed-error-10");
      }
    });
  });

  describe("async binders", () => {
    test("flatMaps Right values with flatMapHelpers.asyncRightBinder", async () => {
      const either = Either.Right(flatMapHelpers.rightSeed());
      const result = either.flatMapRight(flatMapHelpers.asyncRightBinder);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("async-right-126");
    });

    test("short-circuits Left values before flatMapHelpers.asyncRightBinder", () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either.flatMapRight(flatMapHelpers.asyncRightBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("supports async track switching from Right to Left", async () => {
      const either = Either.Right(15);
      const result = either.flatMapRight(async (value) => {
        await Promise.resolve(); // simulate async work
        return Either.Left(`async-error-${value}`);
      });

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("async-error-15");
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.flatMapRight(flatMapHelpers.asyncRightBinder).flatMapRight(flatMapHelpers.syncRightBinder) on Right branches", async () => {
      const either = Either.Right(flatMapHelpers.rightSeed());
      const result = either
        .flatMapRight(flatMapHelpers.asyncRightBinder)
        .flatMapRight((value: string) => Either.Right(`final-${value}`));

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("final-async-right-126");
    });

    test("short-circuits Either.flatMapRight(flatMapHelpers.asyncRightBinder).flatMapRight(flatMapHelpers.syncRightBinder) on Left branches", () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either
        .flatMapRight(flatMapHelpers.asyncRightBinder)
        .flatMapRight((value: string) => Either.Right(`final-${value}`));

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("propagates Left when chaining Either.flatMapRight(flatMapHelpers.syncRightBinder).flatMapLeft(flatMapHelpers.syncLeftBinder)", () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either
        .flatMapRight(flatMapHelpers.syncRightBinder)
        .flatMapLeft(flatMapHelpers.syncLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("supports Either.flatMapRight(flatMapHelpers.asyncRightBinder).flatMapLeft(flatMapHelpers.asyncLeftBinder) compositions", async () => {
      // Test starting with Left (flatMapRight should short-circuit)
      const leftEither = Either.Left(flatMapHelpers.leftSeed());
      const leftResult = leftEither
        .flatMapRight(flatMapHelpers.asyncRightBinder)
        .flatMapLeft(flatMapHelpers.asyncLeftBinder);

      expect(leftResult.isLeft()).toBe(true);
      expect(leftResult.safeUnwrapLeft()).toBe("some");
      if (leftResult.safeUnwrapLeft().kind === "some") {
        expect(leftResult.safeUnwrapLeft()).toBe("initial-error");
      }

      // Test starting with Right and switching to Left
      const rightEither = Either.Right(flatMapHelpers.rightSeed());
      const rightResult = rightEither
        .flatMapRight(flatMapHelpers.rightToLeftBinder)
        .flatMapLeft(flatMapHelpers.asyncLeftBinder);

      expect(rightResult.isLeft()).toBe(true);
      const unwrappedLeft = rightResult.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe(9); // length of "error-42"
    });

    test("enables complex track switching flows", () => {
      const either = Either.Right(5);
      const result = either
        .flatMapRight((value) => Either.Left(`error-${value * 2}`)) // Switch to Left
        .mapLeft((error) => `processed-${error}`) // Process on Left
        .flatMapLeft((error) => Either.Right(`recovered-${error}`)); // Switch back to Right

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe("recovered-processed-error-10");
      }
    });

    test("preserves original Either during chaining", () => {
      const original = Either.Right(100);
      const chained = original
        .flatMapRight(flatMapHelpers.syncRightBinder)
        .flatMapRight(flatMapHelpers.syncRightBinder);

      // Original should be unchanged
      expect(original.isRight()).toBe(true);
      expect(original.safeUnwrap()).toBe("some");
      if (original.safeUnwrap().kind === "some") {
        expect(original.safeUnwrap()).toBe(100);
      }

      // Chained should have final result
      expect(chained.isRight()).toBe(true);
      expect(chained.safeUnwrap()).toBe("some");
      if (chained.safeUnwrap().kind === "some") {
        expect(chained.safeUnwrap()).toBe("right-336"); // 100 * 2 = 200, then 200 * 2 = 400, then "right-400"
      }
    });
  });
});

describe("Either.flatMapLeft behavior", () => {
  describe("sync binders", () => {
    test("flatMaps Left values with flatMapHelpers.syncLeftBinder", () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either.flatMapLeft(flatMapHelpers.syncLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error".length);
      }
    });

    test("preserves Right values when flatMapHelpers.syncLeftBinder is used", () => {
      const either = Either.Right(flatMapHelpers.rightSeed());
      const result = either.flatMapLeft(flatMapHelpers.syncLeftBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe(42);
      }
    });

    test("supports track switching from Left to Right", () => {
      const either = Either.Left("error-message");
      const result = either.flatMapLeft(flatMapHelpers.leftToRightBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe("success-error-message");
      }
    });

    test("enables subsequent Right operations after track switching", () => {
      const either = Either.Left("error");
      const result = either
        .flatMapLeft(flatMapHelpers.leftToRightBinder)
        .mapRight((success) => `processed-${success}`);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe("processed-success-error");
      }
    });
  });

  describe("async binders", () => {
    test("flatMaps Left values with flatMapHelpers.asyncLeftBinder", async () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either.flatMapLeft(flatMapHelpers.asyncLeftBinder);

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("initial-error".length);
    });

    test("preserves Right values when flatMapHelpers.asyncLeftBinder is used", () => {
      const either = Either.Right(flatMapHelpers.rightSeed());
      const result = either.flatMapLeft(flatMapHelpers.asyncLeftBinder);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe(42);
      }
    });

    test("supports async track switching from Left to Right", async () => {
      const either = Either.Left("async-error");
      const result = either.flatMapLeft(async (value) => {
        await Promise.resolve(); // simulate async work
        return Either.Right(`async-success-${value}`);
      });

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("async-success-async-error");
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.flatMapLeft(flatMapHelpers.asyncLeftBinder).flatMapLeft(flatMapHelpers.syncLeftBinder) on Left branches", async () => {
      const either = Either.Left(flatMapHelpers.leftSeed());
      const result = either
        .flatMapLeft(flatMapHelpers.asyncLeftBinder)
        .flatMapLeft((value: number) => Either.Left(`final-${value}`));

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe(`final-${"initial-error".length}`);
    });

    test("does not disturb Right branches when chaining Either.flatMapLeft(flatMapHelpers.syncLeftBinder).flatMapLeft(flatMapHelpers.asyncLeftBinder)", () => {
      const either = Either.Right(flatMapHelpers.rightSeed());
      const result = either
        .flatMapLeft(flatMapHelpers.syncLeftBinder)
        .flatMapLeft(flatMapHelpers.asyncLeftBinder);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe(42);
      }
    });

    test("allows Either.flatMapLeft(flatMapHelpers.syncLeftBinder).flatMapRight(flatMapHelpers.syncRightBinder) permutations", () => {
      // Test starting with Left and staying on Left
      const leftEither = Either.Left(flatMapHelpers.leftSeed());
      const leftResult = leftEither
        .flatMapLeft(flatMapHelpers.syncLeftBinder)
        .flatMapRight(flatMapHelpers.syncRightBinder);

      expect(leftResult.isLeft()).toBe(true);
      expect(leftResult.safeUnwrapLeft()).toBe("some");
      if (leftResult.safeUnwrapLeft().kind === "some") {
        expect(leftResult.safeUnwrapLeft()).toBe("initial-error".length);
      }

      // Test starting with Left and switching to Right
      const switchEither = Either.Left(flatMapHelpers.leftSeed());
      const switchResult = switchEither
        .flatMapLeft(flatMapHelpers.leftToRightBinder)
        .flatMapRight(flatMapHelpers.syncRightBinder);

      expect(switchResult.isRight()).toBe(true);
      expect(switchResult.safeUnwrap()).toBe("some");
      if (switchResult.safeUnwrap().kind === "some") {
        expect(switchResult.safeUnwrap()).toBe("right-success-initial-error");
      }

      // Test starting with Right
      const rightEither = Either.Right(flatMapHelpers.rightSeed());
      const rightResult = rightEither
        .flatMapLeft(flatMapHelpers.syncLeftBinder)
        .flatMapRight(flatMapHelpers.syncRightBinder);

      expect(rightResult.isRight()).toBe(true);
      expect(rightResult.safeUnwrap()).toBe("some");
      if (rightResult.safeUnwrap().kind === "some") {
        expect(rightResult.safeUnwrap()).toBe("right-84");
      }
    });

    test("supports Either.flatMapLeft(flatMapHelpers.asyncLeftBinder).flatMapRight(flatMapHelpers.asyncRightBinder) permutations", async () => {
      // Test starting with Left and staying on Left
      const leftEither = Either.Left(flatMapHelpers.leftSeed());
      const leftResult = leftEither
        .flatMapLeft(flatMapHelpers.asyncLeftBinder)
        .flatMapRight(flatMapHelpers.asyncRightBinder);

      expect(leftResult.isLeft()).toBe(true);
      const unwrappedLeft = leftResult.unwrapLeft();
      const _resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("initial-error".length);

      // Test starting with Left and switching to Right
      const switchEither = Either.Left(flatMapHelpers.leftSeed());
      const switchResult = switchEither
        .flatMapLeft(flatMapHelpers.leftToRightBinder)
        .flatMapRight(flatMapHelpers.asyncRightBinder);

      expect(switchResult.isRight()).toBe(true);
      const unwrapped = switchResult.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("async-right-success-initial-error");

      // Test starting with Right
      const rightEither = Either.Right(flatMapHelpers.rightSeed());
      const rightResult = rightEither
        .flatMapLeft(flatMapHelpers.asyncLeftBinder)
        .flatMapRight(flatMapHelpers.asyncRightBinder);

      expect(rightResult.isRight()).toBe(true);
      const rightUnwrapped = rightResult.unwrap();
      const rightResolved = await Promise.resolve(rightUnwrapped);
      expect(rightResolved).toBe("async-right-126");
    });

    test("enables complex bidirectional track switching flows", () => {
      const either = Either.Left("start-error");
      const result = either
        .flatMapLeft((error) => Either.Right(`recovered-${error}`)) // Switch to Right
        .mapRight((success) => success.toUpperCase()) // Process on Right
        .flatMapRight((success) => Either.Left(`final-${success}`)); // Switch back to Left

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("final-RECOVERED-START-ERROR");
      }
    });
  });
});

describe("Either.flatMap (alias for flatMapRight) behavior", () => {
  test("flatMap is an alias for flatMapRight", () => {
    const either = Either.Right(10);
    const result1 = either.flatMap((x) => Either.Right(x * 3));
    const result2 = either.flatMapRight((x) => Either.Right(x * 3));

    expect(result1.isRight()).toBe(true);
    expect(result2.isRight()).toBe(true);

    expect(result1.safeUnwrap()).toBe("some");
    expect(result2.safeUnwrap()).toBe("some");

    if (
      result1.safeUnwrap().kind === "some" &&
      result2.safeUnwrap().kind === "some"
    ) {
      expect(result1.safeUnwrap()).toBe(result2.safeUnwrap());
      expect(result1.safeUnwrap()).toBe(30);
    }
  });

  test("flatMap short-circuits on Left values", () => {
    const either = Either.Left("error");
    const result = either.flatMap((x) => Either.Right(x * 3));

    expect(result.isLeft()).toBe(true);
    expect(result.safeUnwrapLeft()).toBe("some");
    if (result.safeUnwrapLeft().kind === "some") {
      expect(result.safeUnwrapLeft()).toBe("error");
    }
  });
});
