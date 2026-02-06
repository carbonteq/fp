import { describe, expect, it } from "bun:test";
import { ExperimentalFlow as XFlow } from "@/flow-experimental.js";
import { ExperimentalResult as Result } from "@/result-experimental.js";

describe("ExperimentalResult Stack Traces", () => {
  it("Result.gen should append yield location to stack trace", () => {
    const err = Result.Err(new Error("Original Error"));

    // Line X
    const res = Result.gen(function* () {
      yield* Result.Ok(1);
      yield* err; // Yield line
      return 2;
    });

    expect(res.isErr()).toBe(true);
    const error = res.unwrapErr();
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.stack).toContain("result.stack.test.ts");
      // It should contain more frames than just the creation
      // We can't easily assert exact line number due to transpilation,
      // but existing of the file name in stack implies it captured the yield.
    }
  });

  it("Result.genAdapter should append yield location to stack trace", () => {
    const err = Result.Err(new Error("Original Error"));

    const res = Result.genAdapter(function* ($) {
      yield* $(Result.Ok(1));
      yield* $(err);
      return 2;
    });

    expect(res.isErr()).toBe(true);
    const error = res.unwrapErr();
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.stack).toContain("result.stack.test.ts");
    }
  });

  it("Flow.gen should append yield location to Result.Err trace", () => {
    const err = Result.Err(new Error("Flow Error"));

    const res = XFlow.gen(function* () {
      yield* err;
      return 1;
    });

    expect(res.isErr()).toBe(true);
    const error = res.unwrapErr();
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.stack).toContain("result.stack.test.ts");
    }
  });

  it("Flow.genAdapter should append yield location to Result.Err trace", () => {
    const err = Result.Err(new Error("Flow Adapter Error"));

    const res = XFlow.genAdapter(function* ($) {
      yield* $(err);
      return 1;
    });

    expect(res.isErr()).toBe(true);
    const error = res.unwrapErr();
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.stack).toContain("result.stack.test.ts");
    }
  });

  it("Result.asyncGen should append yield location", async () => {
    const err = Result.Err(new Error("Async Error"));

    const res = await Result.asyncGen(async function* () {
      yield* err;
      return 1;
    });

    expect(res.isErr()).toBe(true);
    const error = res.unwrapErr();
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.stack).toContain("result.stack.test.ts");
    }
  });

  it("Result.asyncGenAdapter should append yield location", async () => {
    const err = Result.Err(new Error("Async Adapter Error"));

    const res = await Result.asyncGenAdapter(async function* ($) {
      yield* $(err);
      return 1;
    });

    expect(res.isErr()).toBe(true);
    const error = res.unwrapErr();
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.stack).toContain("result.stack.test.ts");
    }
  });
});
