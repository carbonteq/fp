import { describe, expect, test } from "bun:test";
import { Flow } from "../../src/flow.js";
import { Option, UnwrappedNone } from "../../src/option.js";
import { Result } from "../../src/result.js";

class ValidationError extends Error {
  readonly _tag = "ValidationError";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  readonly _tag = "NotFoundError";
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

describe("Flow.genAdapter", () => {
  test("handles all successes with adapter", () => {
    const result = Flow.genAdapter(function* ($) {
      const a = yield* $(Option.Some(10));
      const b = yield* $(Result.Ok(20));
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(30);
  });

  test("handles Option.None short-circuit with adapter", () => {
    const result = Flow.genAdapter(function* ($) {
      yield* $(Option.Some(1));
      yield* $(Option.None);
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });

  test("handles Result.Err short-circuit with adapter", () => {
    const err = new Error("oops");
    const result = Flow.genAdapter(function* ($) {
      yield* $(Option.Some(1));
      yield* $(Result.Err(err));
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(err);
  });

  test("handles $.fail() for direct error yielding", () => {
    const result = Flow.genAdapter(function* ($) {
      const a = yield* $(Option.Some(1));
      yield* $.fail(new ValidationError("Value must be positive"));
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect((result.unwrapErr() as ValidationError).message).toBe(
      "Value must be positive",
    );
  });

  test("$.fail() short-circuits execution", () => {
    let executedAfterError = false;

    const result = Flow.genAdapter(function* ($) {
      yield* $.fail(new NotFoundError("Resource not found"));
      executedAfterError = true;
      return 1;
    });

    expect(result.isErr()).toBe(true);
    expect(executedAfterError).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  test("$.fail() works with multiple error types", () => {
    const getValue = (input: number) =>
      Flow.genAdapter(function* ($) {
        if (input < 0) {
          yield* $.fail(new ValidationError("negative"));
        }
        if (input === 0) {
          yield* $.fail(new NotFoundError("zero"));
        }
        return input * 2;
      });

    const res1 = getValue(-1);
    expect(res1.isErr()).toBe(true);
    expect(res1.unwrapErr()).toBeInstanceOf(ValidationError);

    const res2 = getValue(0);
    expect(res2.isErr()).toBe(true);
    expect(res2.unwrapErr()).toBeInstanceOf(NotFoundError);

    const res3 = getValue(5);
    expect(res3.isOk()).toBe(true);
    expect(res3.unwrap()).toBe(10);
  });

  test("$.fail() can be mixed with $(Result) and $(Option)", () => {
    const result = Flow.genAdapter(function* ($) {
      const a = yield* $(Option.Some(10));
      const b = yield* $(Result.Ok(20));

      if (a + b < 50) {
        yield* $.fail(new ValidationError("Sum too small"));
      }

      return a + b;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });
});
