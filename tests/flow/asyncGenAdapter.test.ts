import { describe, expect, test } from "bun:test";
import { Flow } from "@/flow.js";
import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "@/option-experimental.js";
import { ExperimentalResult as Result } from "@/result-experimental.js";

class ValidationError extends Error {
  readonly _tag = "ValidationError";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class ServiceUnavailableError extends Error {
  readonly _tag = "ServiceUnavailableError";
  constructor(service: string) {
    super(`${service} unavailable`);
    this.name = "ServiceUnavailableError";
  }
}

describe("Flow.asyncGenAdapter", () => {
  test("handles all successes with adapter async", async () => {
    const result = await Flow.asyncGenAdapter(async function* ($) {
      const a = yield* $(Option.Some(10));
      const b = yield* $(Result.Ok(20));
      const c = yield* $(Promise.resolve(Option.Some(30)));
      return a + b + c;
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(60);
  });

  test("handles Option.None short-circuit with adapter async", async () => {
    const result = await Flow.asyncGenAdapter(async function* ($) {
      yield* $(Option.Some(1));
      yield* $(Promise.resolve(Option.None));
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });

  test("handles Result.Err short-circuit with adapter async", async () => {
    const err = new Error("oops");
    const result = await Flow.asyncGenAdapter(async function* ($) {
      yield* $(Option.Some(1));
      yield* $(Promise.resolve(Result.Err(err)));
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(err);
  });

  test("handles $.fail() for direct error yielding async", async () => {
    const result = await Flow.asyncGenAdapter(async function* ($) {
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

  test("$.fail() short-circuits execution async", async () => {
    let executedAfterError = false;

    const result = await Flow.asyncGenAdapter(async function* ($) {
      yield* $.fail(new ServiceUnavailableError("Database"));
      executedAfterError = true;
      return 1;
    });

    expect(result.isErr()).toBe(true);
    expect(executedAfterError).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(ServiceUnavailableError);
    expect(result.unwrapErr().message).toBe("Database unavailable");
  });

  test("$.fail() works with async operations", async () => {
    const fetchData = async (id: number): Promise<Result<string, Error>> => {
      await new Promise((r) => setTimeout(r, 1));
      if (id === 0) return Result.Err(new Error("Invalid ID"));
      return Result.Ok(`data-${id}`);
    };

    const result = await Flow.asyncGenAdapter(async function* ($) {
      const data = yield* $(fetchData(1));

      if (data.length < 10) {
        yield* $.fail(new ValidationError("Data too short"));
      }

      return data;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  test("$.fail() can be mixed with $() for Option, Result, and Promise", async () => {
    const result = await Flow.asyncGenAdapter(async function* ($) {
      const a = yield* $(Option.Some(10));
      const b = yield* $(Result.Ok(20));
      const c = yield* $(Promise.resolve(Option.Some(5)));

      if (a + b + c < 50) {
        yield* $.fail(new ValidationError("Sum too small"));
      }

      return a + b + c;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });
});
