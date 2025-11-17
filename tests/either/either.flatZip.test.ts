import { describe, expect, test } from "bun:test";
import { Either } from "@/either.js";

const flatZipHelpers = {
  syncRightBinder: (value: number) =>
    Either.Right<string, string>(`flatzip-right-${value * 2}`),
  asyncRightBinder: async (value: number) =>
    Either.Right<string, string>(`async-flatzip-right-${value * 3}`),
  syncLeftBinder: (value: string) => Either.Left<number, number>(value.length),
  asyncLeftBinder: async (value: string) =>
    Either.Left<number, number>((await Promise.resolve(value)).length),
  rightToLeftBinder: (value: number) =>
    Either.Left<string, string>(`error-${value}`),
  leftToRightBinder: (value: string) =>
    Either.Right<string, string>(`success-${value}`),
  syncTupleBinder: (value: number) =>
    Either.Right<string, [number, number]>([value, value * 2]),
  asyncTupleBinder: async (value: number) =>
    Either.Right<string, [number, number]>([
      value,
      await Promise.resolve(value * 4),
    ]),
  rightSeed: () => 42 as const,
  leftSeed: () => "initial-error" as const,
};

describe("Either.flatZip behavior", () => {
  describe("sync binders", () => {
    test("flatZips Right values into tuples with successful binders", () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either.flatZip(flatZipHelpers.syncRightBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toEqual([42, "flatzip-right-84"]);
      }
    });

    test("handles Left values from binder", () => {
      const either = Either.Right(10);
      const result = either.flatZip(flatZipHelpers.rightToLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("error-10");
      }
    });

    test("short-circuits Left values before flatZip operation", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either.flatZip(flatZipHelpers.syncRightBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });
  });

  describe("async binders", () => {
    test("flatZips Right values with async binders", async () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either.flatZip(flatZipHelpers.asyncRightBinder);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([42, "async-flatzip-right-126"]);
    });

    test("handles async Left values from binder", async () => {
      const either = Either.Right(15);
      const result = either.flatZip(async (value) => {
        await Promise.resolve();
        return Either.Left(`async-error-${value}`);
      });

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("async-error-15");
    });

    test("short-circuits Left values before async flatZip operation", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either.flatZip(flatZipHelpers.asyncRightBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });
  });
});

describe("Either.flatZipRight behavior", () => {
  describe("sync binders", () => {
    test("flatZips Right values with flatZipHelpers.syncRightBinder and flatZipHelpers.syncTupleBinder", () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either.flatZipRight(flatZipHelpers.syncRightBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toEqual([42, "flatzip-right-84"]);
      }
    });

    test("short-circuits Left values before flatZipHelpers.syncRightBinder", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either.flatZipRight(flatZipHelpers.syncRightBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("enables track switching within flatZipRight", () => {
      const either = Either.Right(20);
      const result = either.flatZipRight(flatZipHelpers.rightToLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("error-20");
      }
    });

    test("preserves original Right value in tuple when binder succeeds", () => {
      const either = Either.Right("original");
      const result = either.flatZipRight((value) =>
        Either.Right(`mapped-${value}`),
      );

      expect(result.isRight()).toBe(true);
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toEqual(["original", "mapped-original"]);
      }
    });
  });

  describe("async binders", () => {
    test("flatZips Right values with flatZipHelpers.asyncRightBinder and flatZipHelpers.asyncTupleBinder", async () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either.flatZipRight(flatZipHelpers.asyncRightBinder);

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([42, "async-flatzip-right-126"]);
    });

    test("short-circuits Left values before flatZipHelpers.asyncRightBinder", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either.flatZipRight(flatZipHelpers.asyncRightBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("handles async track switching within flatZipRight", async () => {
      const either = Either.Right(25);
      const result = either.flatZipRight(async (value) => {
        await Promise.resolve();
        return Either.Left(`async-error-${value * 2}`);
      });

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toBe("async-error-50");
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.flatZipRight(flatZipHelpers.asyncRightBinder).flatZipRight(flatZipHelpers.syncTupleBinder) on Right branches", async () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either
        .flatZipRight(flatZipHelpers.asyncRightBinder)
        .flatZipRight(([original, mapped]) =>
          Either.Right(`final-${original}-${mapped}`),
        );

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([
        [42, "async-flatzip-right-126"],
        "final-42-async-flatzip-right-126",
      ]);
    });

    test("short-circuits Either.flatZipRight(flatZipHelpers.asyncRightBinder).flatZipRight(flatZipHelpers.syncTupleBinder) on Left branches", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either
        .flatZipRight(flatZipHelpers.asyncRightBinder)
        .flatZipRight(([original, mapped]) =>
          Either.Right(`final-${original}-${mapped}`),
        );

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("supports chaining Either.flatZipRight(flatZipHelpers.syncRightBinder).flatZipLeft(flatZipHelpers.syncLeftBinder) without mutating the original Either", () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result1 = either.flatZipRight(flatZipHelpers.syncRightBinder);
      const result2 = result1.flatZipLeft(flatZipHelpers.syncLeftBinder);

      // Original should be unchanged
      expect(either.isRight()).toBe(true);
      expect(either.safeUnwrap()).toBe("some");
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap()).toBe(42);
      }

      // First result should be flatZipped
      expect(result1.isRight()).toBe(true);
      expect(result1.safeUnwrap()).toBe("some");
      if (result1.safeUnwrap().kind === "some") {
        expect(result1.safeUnwrap()).toEqual([42, "flatzip-right-84"]);
      }

      // Second result should be unchanged (still on Right track)
      expect(result2.isRight()).toBe(true);
      expect(result2.safeUnwrap()).toBe("some");
      if (result2.safeUnwrap().kind === "some") {
        expect(result2.safeUnwrap()).toEqual([42, "flatzip-right-84"]);
      }
    });

    test("propagates Left across Either.flatZipRight(flatZipHelpers.asyncRightBinder).flatZipLeft(flatZipHelpers.asyncLeftBinder) flows", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either
        .flatZipRight(flatZipHelpers.asyncRightBinder)
        .flatZipLeft(flatZipHelpers.asyncLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("initial-error");
      }
    });

    test("enables complex transformations with track switching", () => {
      const either = Either.Right(10);
      const result = either
        .flatZipRight((value) => Either.Left(`error-${value * 2}`)) // Switch to Left
        .flatZipLeft((error) => Either.Left(`nested-${error}`)); // Stay on Left

      expect(result.isLeft()).toBe(true);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toBe("nested-error-20");
      }
    });
  });
});

describe("Either.flatZipLeft behavior", () => {
  describe("sync binders", () => {
    test("flatZips Left values with flatZipHelpers.syncLeftBinder", () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either.flatZipLeft(flatZipHelpers.syncLeftBinder);

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.safeUnwrapLeft()).toBe("some");
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toEqual([
          "initial-error",
          "initial-error".length,
        ]);
      }
    });

    test("preserves Right values when flatZipHelpers.syncLeftBinder is used", () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either.flatZipLeft(flatZipHelpers.syncLeftBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe(42);
      }
    });

    test("enables track switching from Left to Right", () => {
      const either = Either.Left("error-message");
      const result = either.flatZipLeft(flatZipHelpers.leftToRightBinder);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toEqual([
          "error-message",
          "success-error-message",
        ]);
      }
    });

    test("preserves original Left value in tuple when binder stays on Left", () => {
      const either = Either.Left("original-error");
      const result = either.flatZipLeft((error) =>
        Either.Left(`mapped-${error}`),
      );

      expect(result.isLeft()).toBe(true);
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toEqual([
          "original-error",
          "mapped-original-error",
        ]);
      }
    });
  });

  describe("async binders", () => {
    test("flatZips Left values with flatZipHelpers.asyncLeftBinder", async () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either.flatZipLeft(flatZipHelpers.asyncLeftBinder);

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toEqual(["initial-error", "initial-error".length]);
    });

    test("preserves Right values when flatZipHelpers.asyncLeftBinder is used", () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either.flatZipLeft(flatZipHelpers.asyncLeftBinder);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe(42);
      }
    });

    test("handles async track switching from Left to Right", async () => {
      const either = Either.Left("async-error");
      const result = either.flatZipLeft(async (value) => {
        await Promise.resolve();
        return Either.Right(`async-success-${value}`);
      });

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual(["async-error", "async-success-async-error"]);
    });
  });

  describe("mixed chaining permutations", () => {
    test("supports Either.flatZipLeft(flatZipHelpers.asyncLeftBinder).flatZipLeft(flatZipHelpers.syncLeftBinder) on Left branches", async () => {
      const either = Either.Left(flatZipHelpers.leftSeed());
      const result = either
        .flatZipLeft(flatZipHelpers.asyncLeftBinder)
        .flatZipLeft(([original, length]) =>
          Either.Left(`final-${original}-${length}`),
        );

      expect(result.isLeft()).toBe(true);
      const unwrappedLeft = result.unwrapLeft();
      const resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toEqual([
        ["initial-error", "initial-error".length],
        `final-initial-error-${"initial-error".length}`,
      ]);
    });

    test("does not remap Right branches when chaining Either.flatZipLeft(flatZipHelpers.syncLeftBinder).flatZipLeft(flatZipHelpers.asyncLeftBinder)", () => {
      const either = Either.Right(flatZipHelpers.rightSeed());
      const result = either
        .flatZipLeft(flatZipHelpers.syncLeftBinder)
        .flatZipLeft(flatZipHelpers.asyncLeftBinder);

      expect(result.isRight()).toBe(true);
      expect(result.safeUnwrap()).toBe("some");
      if (result.safeUnwrap().kind === "some") {
        expect(result.safeUnwrap()).toBe(42);
      }
    });

    test("allows Either.flatZipLeft(flatZipHelpers.syncLeftBinder).flatZipRight(flatZipHelpers.syncRightBinder) permutations", () => {
      // Test starting with Left and staying on Left
      const leftEither = Either.Left(flatZipHelpers.leftSeed());
      const leftResult = leftEither
        .flatZipLeft(flatZipHelpers.syncLeftBinder)
        .flatZipRight(flatZipHelpers.syncRightBinder);

      expect(leftResult.isLeft()).toBe(true);
      expect(leftResult.safeUnwrapLeft()).toBe("some");
      if (leftResult.safeUnwrapLeft().kind === "some") {
        expect(leftResult.safeUnwrapLeft()).toEqual([
          "initial-error",
          "initial-error".length,
        ]);
      }

      // Test starting with Left and switching to Right
      const switchEither = Either.Left(flatZipHelpers.leftSeed());
      const switchResult = switchEither
        .flatZipLeft(flatZipHelpers.leftToRightBinder)
        .flatZipRight(flatZipHelpers.syncRightBinder);

      expect(switchResult.isRight()).toBe(true);
      expect(switchResult.safeUnwrap()).toBe("some");
      if (switchResult.safeUnwrap().kind === "some") {
        expect(switchResult.safeUnwrap()).toEqual([
          ["initial-error", "success-initial-error"],
          "flatzip-right-success-initial-error".length * 2,
        ]);
      }

      // Test starting with Right
      const rightEither = Either.Right(flatZipHelpers.rightSeed());
      const rightResult = rightEither
        .flatZipLeft(flatZipHelpers.syncLeftBinder)
        .flatZipRight(flatZipHelpers.syncRightBinder);

      expect(rightResult.isRight()).toBe(true);
      expect(rightResult.safeUnwrap()).toBe("some");
      if (rightResult.safeUnwrap().kind === "some") {
        expect(rightResult.safeUnwrap()).toEqual([42, "flatzip-right-84"]);
      }
    });

    test("supports Either.flatZipLeft(flatZipHelpers.asyncLeftBinder).flatZipRight(flatZipHelpers.asyncRightBinder) permutations", async () => {
      // Test starting with Left and staying on Left
      const leftEither = Either.Left(flatZipHelpers.leftSeed());
      const leftResult = leftEither
        .flatZipLeft(flatZipHelpers.asyncLeftBinder)
        .flatZipRight(flatZipHelpers.asyncRightBinder);

      expect(leftResult.isLeft()).toBe(true);
      const unwrappedLeft = leftResult.unwrapLeft();
      const _resolved = await Promise.resolve(unwrappedLeft);
      expect(resolved).toEqual(["initial-error", "initial-error".length]);

      // Test starting with Left and switching to Right
      const switchEither = Either.Left(flatZipHelpers.leftSeed());
      const switchResult = switchEither
        .flatZipLeft(flatZipHelpers.leftToRightBinder)
        .flatZipRight(flatZipHelpers.asyncRightBinder);

      expect(switchResult.isRight()).toBe(true);
      const unwrapped = switchResult.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toEqual([
        ["initial-error", "success-initial-error"],
        "async-flatzip-right-success-initial-error".length * 3,
      ]);

      // Test starting with Right
      const rightEither = Either.Right(flatZipHelpers.rightSeed());
      const rightResult = rightEither
        .flatZipLeft(flatZipHelpers.asyncLeftBinder)
        .flatZipRight(flatZipHelpers.asyncRightBinder);

      expect(rightResult.isRight()).toBe(true);
      const rightUnwrapped = rightResult.unwrap();
      const rightResolved = await Promise.resolve(rightUnwrapped);
      expect(rightResolved).toEqual([42, "async-flatzip-right-126"]);
    });

    test("enables complex bidirectional track switching with flatZip", () => {
      const either = Either.Left("start-error");
      const result = either
        .flatZipLeft((error) => Either.Right(`recovered-${error}`)) // Switch to Right
        .flatZipRight(([_original, success]) =>
          Either.Left(`final-${success}`),
        ); // Switch back to Left

      expect(result.isLeft()).toBe(true);
      if (result.safeUnwrapLeft().kind === "some") {
        expect(result.safeUnwrapLeft()).toEqual([
          ["start-error", "recovered-start-error"],
          "final-recovered-start-error",
        ]);
      }
    });
  });
});

describe("Complex flatZip scenarios", () => {
  test("alternating flatZipRight and flatZipLeft operations maintain track correctly", () => {
    const either = Either.Right(10);
    const result = either
      .flatZipRight((x) => Either.Right(x * 2)) // Still on Right: [10, 20]
      .flatZipLeft((err) => Either.Left(`left-${err}`)) // Skipped, still on Right
      .flatZipRight(([orig, dbl]) => Either.Right(orig + dbl)) // Still on Right: [[10, 20], 30]
      .flatZipLeft((err) => Either.Left(`final-left-${err}`)); // Skipped, still on Right

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap()).toEqual([[10, 20], 30]);
    }
  });

  test("flatZip operations after track switching", () => {
    const either = Either.Left("start-error");
    const result = either
      .flatZipLeft((err) => Either.Left(err.toUpperCase())) // Stay on Left: ["start-error", "START-ERROR"]
      .flatMapLeft(([_orig, upper]) => Either.Right(`recovered-${upper}`)) // Switch to Right
      .flatZipRight((success) => Either.Right(success.length)); // Stay on Right: [["recovered-START-ERROR"], 21]

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap()).toEqual([["recovered-START-ERROR"], 21]);
    }
  });

  test("flatZip preserves immutability of original Either", () => {
    const original = Either.Right(100);
    const flatZipped = original.flatZip((x) => Either.Right(x * 2));

    // Original should be unchanged
    expect(original.isRight()).toBe(true);
    if (original.safeUnwrap().kind === "some") {
      expect(original.safeUnwrap()).toBe(100);
    }

    // FlatZipped should contain tuple
    expect(flatZipped.isRight()).toBe(true);
    if (flatZipped.safeUnwrap().kind === "some") {
      expect(flatZipped.safeUnwrap()).toEqual([100, 200]);
    }
  });

  test("nested flatZip operations with complex transformations", () => {
    const either = Either.Right(5);
    const result = either
      .flatZipRight((x) => Either.Right(x * 2)) // [5, 10]
      .flatZipRight(([orig, dbl]) => Either.Right([orig, dbl, orig + dbl])) // [[5, 10], [5, 10, 15]]
      .flatZipRight(([[_orig, _dbl], sum]) => Either.Right(`result-${sum[2]}`)); // [[[5, 10], [5, 10, 15]], "result-15"]

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap()).toEqual([
        [
          [5, 10],
          [5, 10, 15],
        ],
        "result-15",
      ]);
    }
  });

  test("flatZip with error recovery patterns", () => {
    const either = Either.Right(10);
    const result = either
      .flatZipRight((x) =>
        x > 5 ? Either.Left(`too-large-${x}`) : Either.Right(x * 2),
      )
      .flatZipLeft((error) => Either.Right(`recovered-from-${error}`));

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap()).toEqual([
        ["too-large-10"],
        "recovered-from-too-large-10",
      ]);
    }
  });
});
