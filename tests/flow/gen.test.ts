import { describe, expect, test } from "bun:test";
import { Flow } from "../../src/flow.js";
import { Option, UnwrappedNone } from "../../src/option.js";
import { Result } from "../../src/result.js";

describe("Flow.gen", () => {
  test("handles all successes", () => {
    const result = Flow.gen(function* () {
      const a = yield* Option.Some(1);
      const b = yield* Result.Ok(2);
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(3);
  });

  test("handles Option.None short-circuit", () => {
    const result = Flow.gen(function* () {
      const a = yield* Option.Some(1);
      yield* Option.None;
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });

  test("handles Result.Err short-circuit", () => {
    const result = Flow.gen(function* () {
      const a = yield* Option.Some(1);
      yield* Result.Err("error");
      return a;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("error");
  });

  test("handles mixed short-circuits (stops at first)", () => {
    const result = Flow.gen(function* () {
      yield* Option.None;
      yield* Result.Err("error");
      return 1;
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UnwrappedNone);
  });
});
