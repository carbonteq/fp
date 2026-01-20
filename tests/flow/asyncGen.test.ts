import { describe, expect, test } from "bun:test";
import { Flow, FlowError } from "../../src/flow.js";
import { Option, UnwrappedNone } from "../../src/option.js";
import { Result } from "../../src/result.js";

class ValidationError extends FlowError {
  readonly _tag = "ValidationError";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class ServiceUnavailableError extends FlowError {
  readonly _tag = "ServiceUnavailableError";
  constructor(service: string) {
    super(`${service} unavailable`);
    this.name = "ServiceUnavailableError";
  }
}

describe("Flow.asyncGen", () => {
  test("handles all successes async", async () => {
    const result = await Flow.asyncGen(async function* () {
      const a = yield* Option.Some(1);
      const b = yield* Result.Ok(2);
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(3);
  });

  test("handles awaited promises", async () => {
    const result = await Flow.asyncGen(async function* () {
      const a = yield* await Promise.resolve(Option.Some(1));
      const b = yield* await Promise.resolve(Result.Ok(2));
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(3);
  });

  test("handles Option.None short-circuit async", async () => {
    const result = await Flow.asyncGen(async function* () {
      const a = yield* Option.Some(1);
      yield* Option.None;
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });

  test("handles Result.Err short-circuit async", async () => {
    const result = await Flow.asyncGen(async function* () {
      const a = yield* Option.Some(1);
      yield* Result.Err("error");
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("error");
  });

  test("handles FlowError short-circuit async", async () => {
    const result = await Flow.asyncGen(async function* () {
      const a = yield* Option.Some(1);
      yield* new ValidationError("Value must be positive");
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toBe("Value must be positive");
  });

  test("FlowError short-circuit stops execution async", async () => {
    let executedAfterError = false;

    const result = await Flow.asyncGen(async function* () {
      yield* new ServiceUnavailableError("Database");
      executedAfterError = true;
      return 1;
    });

    expect(result.isErr()).toBe(true);
    expect(executedAfterError).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(ServiceUnavailableError);
    expect(result.unwrapErr().message).toBe("Database unavailable");
  });

  test("FlowError works with async operations", async () => {
    const fetchData = async (id: number): Promise<Result<string, Error>> => {
      if (id === 0) return Result.Err(new Error("Invalid ID"));
      return Result.Ok(`data-${id}`);
    };

    const result = await Flow.asyncGen(async function* () {
      const data = yield* await fetchData(1);

      if (data.length < 10) {
        yield* new ValidationError("Data too short");
      }

      return data;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });
});
