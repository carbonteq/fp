import { describe, expect, test } from "bun:test";
import { Flow } from "../../src/flow.js";
import { Option, UnwrappedNone } from "../../src/option.js";
import { Result } from "../../src/result.js";

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
});
