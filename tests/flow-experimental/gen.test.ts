import { describe, expect, test } from "bun:test";
import {
  ExperimentalFlowError,
  ExperimentalFlow as XFlow,
} from "@/flow-experimental.js";
import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "@/option-experimental.js";
import { ExperimentalResult as Result } from "@/result-experimental.js";

class ValidationError extends ExperimentalFlowError {
  readonly _tag = "ValidationError";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends ExperimentalFlowError {
  readonly _tag = "NotFoundError";
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

describe("XFlow.gen", () => {
  test("handles all successes", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(1);
      const b = yield* Result.Ok(2);
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(3);
  });

  test("handles Option.None short-circuit", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(1);
      yield* Option.None;
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });

  test("handles Result.Err short-circuit", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(1);
      yield* Result.Err("error");
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("error");
  });

  test("handles mixed short-circuits (stops at first)", () => {
    const result = XFlow.gen(function* () {
      yield* Option.None;
      yield* Result.Err("error");
      return 1;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });

  test("handles FlowError short-circuit", () => {
    const result = XFlow.gen(function* () {
      const a = yield* Option.Some(1);
      yield* new ValidationError("Value must be positive");
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toBe("Value must be positive");
  });

  test("handles multiple FlowError types", () => {
    const result = XFlow.gen(function* () {
      const value = 0;
      if (value <= 0) {
        yield* new ValidationError("Value must be positive");
      }
      return value;
    });

    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err).toBeInstanceOf(ValidationError);
  });

  test("FlowError short-circuit stops execution", () => {
    let executedAfterError = false;

    const result = XFlow.gen(function* () {
      yield* new NotFoundError("Resource not found");
      executedAfterError = true;
      return 1;
    });

    expect(result.isErr()).toBe(true);
    expect(executedAfterError).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  test("FlowError preserves error type in union", () => {
    const getValue = (input: number) =>
      XFlow.gen(function* () {
        if (input < 0) {
          yield* new ValidationError("negative");
        }
        if (input === 0) {
          yield* new NotFoundError("zero");
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
});
