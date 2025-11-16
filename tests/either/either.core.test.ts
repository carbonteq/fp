import { describe, expect, test } from "bun:test";
import {
  Either,
  UnwrappedLeftWithRight,
  UnwrappedRightWithLeft,
} from "@/either.js";

describe("Either construction", () => {
  describe("Either.Left", () => {
    test("creates Left values with sync values", () => {
      const either = Either.Left("error");

      expect(either.isLeft()).toBe(true);
      expect(either.isRight()).toBe(false);
      expect(either.isSyncLeft()).toBe(true);
      expect(either.isSyncRight()).toBe(false);
      expect(either.isAsyncLeft()).toBe(false);
      expect(either.isAsyncRight()).toBe(false);
    });

    test("creates Left values with different types", () => {
      const stringEither = Either.Left("string error");
      const numberEither = Either.Left(42);
      const objectEither = Either.Left({
        code: "ERR_001",
        message: "Something went wrong",
      });
      const arrayEither = Either.Left([1, 2, 3]);

      expect(stringEither.isLeft()).toBe(true);
      expect(numberEither.isLeft()).toBe(true);
      expect(objectEither.isLeft()).toBe(true);
      expect(arrayEither.isLeft()).toBe(true);
    });

    test("handles Left values with Promise values", async () => {
      const either = Either.Left(Promise.resolve("async-error"));

      expect(either.isLeft()).toBe(true);
      expect(either.isAsyncLeft()).toBe(true);
      expect(either.isSyncLeft()).toBe(false);

      const resolved = await either.isLeftResolved();
      expect(resolved).toBe(true);
    });
  });

  describe("Either.Right", () => {
    test("creates Right values with sync values", () => {
      const either = Either.Right("success");

      expect(either.isRight()).toBe(true);
      expect(either.isLeft()).toBe(false);
      expect(either.isSyncRight()).toBe(true);
      expect(either.isSyncLeft()).toBe(false);
      expect(either.isAsyncRight()).toBe(false);
      expect(either.isAsyncLeft()).toBe(false);
    });

    test("creates Right values with different types", () => {
      const stringEither = Either.Right("success");
      const numberEither = Either.Right(42);
      const objectEither = Either.Right({ data: "result" });
      const arrayEither = Either.Right([1, 2, 3]);

      expect(stringEither.isRight()).toBe(true);
      expect(numberEither.isRight()).toBe(true);
      expect(objectEither.isRight()).toBe(true);
      expect(arrayEither.isRight()).toBe(true);
    });

    test("handles Right values with Promise values", async () => {
      const either = Either.Right(Promise.resolve("async-success"));

      expect(either.isRight()).toBe(true);
      expect(either.isAsyncRight()).toBe(true);
      expect(either.isSyncRight()).toBe(false);

      const resolved = await either.isRightResolved();
      expect(resolved).toBe(true);
    });
  });

  describe("Either.fromPredicate", () => {
    test("creates Right when predicate is true", () => {
      const either = Either.fromPredicate(42, (x) => x > 40, "too-small");

      expect(either.isRight()).toBe(true);
      expect(either.safeUnwrap().kind).toBe("some");
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap().value).toBe(42);
      }
    });

    test("creates Left when predicate is false", () => {
      const either = Either.fromPredicate(42, (x) => x > 50, "too-small");

      expect(either.isLeft()).toBe(true);
      expect(either.safeUnwrapLeft().kind).toBe("some");
      if (either.safeUnwrapLeft().kind === "some") {
        expect(either.safeUnwrapLeft().value).toBe("too-small");
      }
    });

    test("works with complex predicates", () => {
      const user = { name: "John", age: 25, active: true };
      const either = Either.fromPredicate(
        user,
        (u) => u.age >= 18 && u.active,
        "invalid-user",
      );

      expect(either.isRight()).toBe(true);
    });
  });

  describe("Either.tryCatch", () => {
    test("creates Right when function succeeds", () => {
      const either = Either.tryCatch(
        () => "success",
        (error) => `error: ${error}`,
      );

      expect(either.isRight()).toBe(true);
      expect(either.safeUnwrap().kind).toBe("some");
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap().value).toBe("success");
      }
    });

    test("creates Left when function throws", () => {
      const either = Either.tryCatch(
        () => {
          throw new Error("Something went wrong");
        },
        (error) => `caught: ${error}`,
      );

      expect(either.isLeft()).toBe(true);
      expect(either.safeUnwrapLeft().kind).toBe("some");
      if (either.safeUnwrapLeft().kind === "some") {
        expect(either.safeUnwrapLeft().value).toContain("caught:");
      }
    });

    test("handles async functions", async () => {
      const asyncFn = async () => {
        await Promise.resolve();
        return "async-success";
      };

      const either = Either.tryCatch(
        asyncFn,
        (error) => `async-error: ${error}`,
      );

      expect(either.isRight()).toBe(true);
      const unwrapped = either.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("async-success");
    });
  });

  describe("Either.fromPromise", () => {
    test("creates Right when promise resolves", async () => {
      const promise = Promise.resolve("success");
      const either = await Either.fromPromise(
        promise,
        (error) => `error: ${error}`,
      );

      expect(either.isRight()).toBe(true);
      expect(either.safeUnwrap().kind).toBe("some");
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap().value).toBe("success");
      }
    });

    test("creates Left when promise rejects", async () => {
      const promise = Promise.reject(new Error("failure"));
      const either = await Either.fromPromise(
        promise,
        (error) => `caught: ${error}`,
      );

      expect(either.isLeft()).toBe(true);
      expect(either.safeUnwrapLeft().kind).toBe("some");
      if (either.safeUnwrapLeft().kind === "some") {
        expect(either.safeUnwrapLeft().value).toContain("caught:");
      }
    });
  });
});

describe("Either introspection methods", () => {
  describe("isLeft and isRight", () => {
    test("correctly identify Left and Right values", () => {
      const leftEither = Either.Left("error");
      const rightEither = Either.Right("success");

      expect(leftEither.isLeft()).toBe(true);
      expect(leftEither.isRight()).toBe(false);
      expect(rightEither.isLeft()).toBe(false);
      expect(rightEither.isRight()).toBe(true);
    });
  });

  describe("isSyncLeft and isSyncRight", () => {
    test("identify synchronous Left and Right values", () => {
      const leftEither = Either.Left("error");
      const rightEither = Either.Right("success");

      expect(leftEither.isSyncLeft()).toBe(true);
      expect(leftEither.isSyncRight()).toBe(false);
      expect(rightEither.isSyncLeft()).toBe(false);
      expect(rightEither.isSyncRight()).toBe(true);
    });
  });

  describe("isAsyncLeft and isAsyncRight", () => {
    test("identify asynchronous Left and Right values", () => {
      const asyncLeftEither = Either.Left(Promise.resolve("error"));
      const asyncRightEither = Either.Right(Promise.resolve("success"));

      expect(asyncLeftEither.isAsyncLeft()).toBe(true);
      expect(asyncLeftEither.isAsyncRight()).toBe(false);
      expect(asyncRightEither.isAsyncLeft()).toBe(false);
      expect(asyncRightEither.isAsyncRight()).toBe(true);
    });
  });

  describe("isLeftResolved and isRightResolved", () => {
    test("resolve async values correctly", async () => {
      const syncLeft = Either.Left("error");
      const syncRight = Either.Right("success");
      const asyncLeft = Either.Left(Promise.resolve("async-error"));
      const asyncRight = Either.Right(Promise.resolve("async-success"));
      const rejectedLeft = Either.Left(
        Promise.reject(new Error("rejected-error")),
      );
      const rejectedRight = Either.Right(
        Promise.reject(new Error("rejected-success")),
      );

      expect(await syncLeft.isLeftResolved()).toBe(true);
      expect(await syncLeft.isRightResolved()).toBe(false);
      expect(await syncRight.isRightResolved()).toBe(true);
      expect(await syncRight.isLeftResolved()).toBe(false);
      expect(await asyncLeft.isLeftResolved()).toBe(true);
      expect(await asyncRight.isRightResolved()).toBe(true);
      expect(await rejectedLeft.isLeftResolved()).toBe(false);
      expect(await rejectedRight.isRightResolved()).toBe(false);
    });
  });
});

describe("Either unwrapping methods", () => {
  describe("unwrap and unwrapLeft", () => {
    test("unwrap returns Right value or throws", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      expect(rightEither.unwrap()).toBe("success");
      expect(() => leftEither.unwrap()).toThrow(UnwrappedLeftWithRight);
    });

    test("unwrapLeft returns Left value or throws", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      expect(leftEither.unwrapLeft()).toBe("error");
      expect(() => rightEither.unwrapLeft()).toThrow(UnwrappedRightWithLeft);
    });

    test("handles Promise values correctly", async () => {
      const asyncRightEither = Either.Right(Promise.resolve("async-success"));
      const asyncLeftEither = Either.Left(Promise.resolve("async-error"));

      const rightUnwrapped = asyncRightEither.unwrap();
      const leftUnwrapped = asyncLeftEither.unwrapLeft();

      expect(await Promise.resolve(rightUnwrapped)).toBe("async-success");
      expect(await Promise.resolve(leftUnwrapped)).toBe("async-error");
    });
  });

  describe("safeUnwrap and safeUnwrapLeft", () => {
    test("safeUnwrap returns Option for Right values", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightOption = rightEither.safeUnwrap();
      const leftOption = leftEither.safeUnwrap();

      expect(rightOption.kind).toBe("some");
      if (rightOption.kind === "some") {
        expect(rightOption.value).toBe("success");
      }

      expect(leftOption.kind).toBe("none");
    });

    test("safeUnwrapLeft returns Option for Left values", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightOption = rightEither.safeUnwrapLeft();
      const leftOption = leftEither.safeUnwrapLeft();

      expect(leftOption.kind).toBe("some");
      if (leftOption.kind === "some") {
        expect(leftOption.value).toBe("error");
      }

      expect(rightOption.kind).toBe("none");
    });
  });

  describe("toTuple and toTupleResolved", () => {
    test("toTuple returns [null, value] for Right", () => {
      const either = Either.Right("success");
      const tuple = either.toTuple();

      expect(tuple).toEqual([null, "success"]);
    });

    test("toTuple returns [value, null] for Left", () => {
      const either = Either.Left("error");
      const tuple = either.toTuple();

      expect(tuple).toEqual(["error", null]);
    });

    test("toTupleResolved handles async values", async () => {
      const asyncRight = Either.Right(Promise.resolve("async-success"));
      const asyncLeft = Either.Left(Promise.resolve("async-error"));

      const rightTuple = await asyncRight.toTupleResolved();
      const leftTuple = await asyncLeft.toTupleResolved();

      expect(rightTuple).toEqual([null, "async-success"]);
      expect(leftTuple).toEqual(["async-error", null]);
    });

    test("toTuple throws for async values when not resolved", () => {
      const asyncRight = Either.Right(Promise.resolve("async-success"));
      const asyncLeft = Either.Left(Promise.resolve("async-error"));

      expect(() => asyncRight.toTuple()).toThrow();
      expect(() => asyncLeft.toTuple()).toThrow();
    });
  });
});

describe("Either unified operations", () => {
  describe("mapBoth", () => {
    test("maps both Left and Right tracks", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightResult = rightEither.mapBoth({
        left: (err) => `left-${err}`,
        right: (success) => `right-${success}`,
      });

      const leftResult = leftEither.mapBoth({
        left: (err) => `left-${err}`,
        right: (success) => `right-${success}`,
      });

      expect(rightResult.isRight()).toBe(true);
      if (rightResult.safeUnwrap().kind === "some") {
        expect(rightResult.safeUnwrap().value).toBe("right-success");
      }

      expect(leftResult.isLeft()).toBe(true);
      if (leftResult.safeUnwrapLeft().kind === "some") {
        expect(leftResult.safeUnwrapLeft().value).toBe("left-error");
      }
    });

    test("handles async mappers", async () => {
      const either = Either.Right("success");
      const result = either.mapBoth({
        left: async (err) => `async-left-${err}`,
        right: async (success) => `async-right-${success}`,
      });

      expect(result.isRight()).toBe(true);
      const unwrapped = result.unwrap();
      const resolved = await Promise.resolve(unwrapped);
      expect(resolved).toBe("async-right-success");
    });
  });

  describe("match", () => {
    test("executes appropriate branch based on Either state", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightResult = rightEither.match({
        left: (err) => `left-handler: ${err}`,
        right: (success) => `right-handler: ${success}`,
      });

      const leftResult = leftEither.match({
        left: (err) => `left-handler: ${err}`,
        right: (success) => `right-handler: ${success}`,
      });

      expect(rightResult).toBe("right-handler: success");
      expect(leftResult).toBe("left-handler: error");
    });

    test("handles async matchers", async () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightResult = rightEither.match({
        left: async (err) => `async-left: ${err}`,
        right: async (success) => `async-right: ${success}`,
      });

      const leftResult = leftEither.match({
        left: async (err) => `async-left: ${err}`,
        right: async (success) => `async-right: ${success}`,
      });

      expect(await Promise.resolve(rightResult)).toBe("async-right: success");
      expect(await Promise.resolve(leftResult)).toBe("async-left: error");
    });
  });

  describe("matchAsync", () => {
    test("always returns Promise", async () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightResult = await rightEither.matchAsync({
        left: (err) => `left: ${err}`,
        right: (success) => `right: ${success}`,
      });

      const leftResult = await leftEither.matchAsync({
        left: (err) => `left: ${err}`,
        right: (success) => `right: ${success}`,
      });

      expect(rightResult).toBe("right: success");
      expect(leftResult).toBe("left: error");
    });
  });
});

describe("Either track manipulation", () => {
  describe("swap", () => {
    test("swaps Left and Right tracks", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const swappedRight = rightEither.swap();
      const swappedLeft = leftEither.swap();

      expect(swappedRight.isLeft()).toBe(true);
      if (swappedRight.safeUnwrapLeft().kind === "some") {
        expect(swappedRight.safeUnwrapLeft().value).toBe("success");
      }

      expect(swappedLeft.isRight()).toBe(true);
      if (swappedLeft.safeUnwrap().kind === "some") {
        expect(swappedLeft.safeUnwrap().value).toBe("error");
      }
    });
  });

  describe("toLeft and toRight", () => {
    test("force conversion to specific track", () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const forcedLeft = rightEither.toLeft("forced-error");
      const forcedRight = leftEither.toRight("forced-success");

      expect(forcedLeft.isLeft()).toBe(true);
      expect(forcedRight.isRight()).toBe(true);
    });
  });

  describe("ifLeft and ifRight", () => {
    test("conditionally execute operations", () => {
      let leftCalled = false;
      let rightCalled = false;

      const _rightEither = Either.Right("success")
        .ifLeft(() => {
          leftCalled = true;
        })
        .ifRight(() => {
          rightCalled = true;
        });

      expect(leftCalled).toBe(false);
      expect(rightCalled).toBe(true);

      leftCalled = false;
      rightCalled = false;

      const _leftEither = Either.Left("error")
        .ifLeft(() => {
          leftCalled = true;
        })
        .ifRight(() => {
          rightCalled = true;
        });

      expect(leftCalled).toBe(true);
      expect(rightCalled).toBe(false);
    });
  });
});

describe("Either Option integration", () => {
  describe("fromOption", () => {
    test("creates Right from Some", () => {
      const option = { kind: "some" as const, value: "success" };
      const either = Either.fromOption(option, "error");

      expect(either.isRight()).toBe(true);
      if (either.safeUnwrap().kind === "some") {
        expect(either.safeUnwrap().value).toBe("success");
      }
    });

    test("creates Left from None", () => {
      const option = { kind: "none" as const };
      const either = Either.fromOption(option, "error");

      expect(either.isLeft()).toBe(true);
      if (either.safeUnwrapLeft().kind === "some") {
        expect(either.safeUnwrapLeft().value).toBe("error");
      }
    });
  });

  describe("toOption and toOptionLeft", () => {
    test("converts Right to Some Option", () => {
      const either = Either.Right("success");
      const option = either.toOption();

      expect(option.kind).toBe("some");
      if (option.kind === "some") {
        expect(option.value).toBe("success");
      }
    });

    test("converts Left to None Option", () => {
      const either = Either.Left("error");
      const option = either.toOption();

      expect(option.kind).toBe("none");
    });

    test("converts Left to Some OptionLeft", () => {
      const either = Either.Left("error");
      const option = either.toOptionLeft();

      expect(option.kind).toBe("some");
      if (option.kind === "some") {
        expect(option.value).toBe("error");
      }
    });

    test("converts Right to None OptionLeft", () => {
      const either = Either.Right("success");
      const option = either.toOptionLeft();

      expect(option.kind).toBe("none");
    });
  });
});

describe("Either async conversion", () => {
  describe("toPromise", () => {
    test("converts sync Either to resolved Promise Either", async () => {
      const rightEither = Either.Right("success");
      const leftEither = Either.Left("error");

      const rightPromise = await rightEither.toPromise();
      const leftPromise = await leftEither.toPromise();

      expect(rightPromise.isRight()).toBe(true);
      expect(leftPromise.isLeft()).toBe(true);
    });

    test("resolves async Either values", async () => {
      const asyncRightEither = Either.Right(Promise.resolve("async-success"));
      const asyncLeftEither = Either.Left(Promise.resolve("async-error"));

      const rightPromise = await asyncRightEither.toPromise();
      const leftPromise = await asyncLeftEither.toPromise();

      expect(rightPromise.isRight()).toBe(true);
      if (rightPromise.safeUnwrap().kind === "some") {
        expect(rightPromise.safeUnwrap().value).toBe("async-success");
      }

      expect(leftPromise.isLeft()).toBe(true);
      if (leftPromise.safeUnwrapLeft().kind === "some") {
        expect(leftPromise.safeUnwrapLeft().value).toBe("async-error");
      }
    });
  });
});

describe("Either string representation", () => {
  test("toString provides readable representation", () => {
    const rightEither = Either.Right("success");
    const leftEither = Either.Left("error");
    const asyncRightEither = Either.Right(Promise.resolve("async-success"));
    const asyncLeftEither = Either.Left(Promise.resolve("async-error"));

    expect(rightEither.toString()).toContain("Right");
    expect(rightEither.toString()).toContain("success");
    expect(leftEither.toString()).toContain("Left");
    expect(leftEither.toString()).toContain("error");
    expect(asyncRightEither.toString()).toContain("pending");
    expect(asyncLeftEither.toString()).toContain("pending");
  });
});

describe("Complex Either scenarios", () => {
  test("chained operations with track switching", () => {
    const result = Either.Right(10)
      .map((x) => x * 2)
      .flatMap((x) => (x > 15 ? Either.Left("too-large") : Either.Right(x)))
      .mapLeft((err) => `error-${err}`)
      .mapRight((val) => `success-${val}`);

    expect(result.isLeft()).toBe(true);
    if (result.safeUnwrapLeft().kind === "some") {
      expect(result.safeUnwrapLeft().value).toBe("error-too-large");
    }
  });

  test("error recovery patterns", () => {
    const result = Either.Left("initial-error")
      .mapLeft((err) => err.toUpperCase())
      .flatMapLeft((err) => Either.Right(`recovered-from-${err}`))
      .mapRight((success) => `final-${success}`);

    expect(result.isRight()).toBe(true);
    if (result.safeUnwrap().kind === "some") {
      expect(result.safeUnwrap().value).toBe(
        "final-recovered-from-INITIAL-ERROR",
      );
    }
  });

  test("async/sync mixing", async () => {
    const result = Either.Right(5)
      .map((x) => x * 2)
      .map(async (x) => {
        await Promise.resolve();
        return x + 1;
      })
      .map((x) => x * 3);

    expect(result.isRight()).toBe(true);
    const unwrapped = result.unwrap();
    const resolved = await Promise.resolve(unwrapped);
    expect(resolved).toBe(33); // (5 * 2 + 1) * 3
  });
});
