import { describe, expect, test } from "bun:test";
import { Flow } from "../../src/flow.js";
import { Option, UnwrappedNone } from "../../src/option.js";
import { Result } from "../../src/result.js";

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
});
