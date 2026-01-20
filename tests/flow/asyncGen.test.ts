import { describe, expect, test } from "bun:test";
import { Flow } from "../../src/flow.js";
import { Option, UnwrappedNone } from "../../src/option.js";
import { Result } from "../../src/result.js";

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
});
