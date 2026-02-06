import { describe, expect, it } from "bun:test";
import { ExperimentalResult as Result } from "@/result-experimental.js";

// Distinct error types with different properties to ensure union is required
type Err1 = { _tag: "Err1"; message: string };
type Err2 = { _tag: "Err2"; code: number };
type Err3 = { _tag: "Err3"; details: string[] };

const makeErr1 = (msg: string): Err1 => ({ _tag: "Err1", message: msg });
const makeErr2 = (code: number): Err2 => ({ _tag: "Err2", code });
const makeErr3 = (details: string[]): Err3 => ({ _tag: "Err3", details });

const validate = (s: string): Result<string, Err1> =>
  s.length > 0 ? Result.Ok(s) : Result.Err(makeErr1("empty string"));

const parse = (s: string): Result<number, Err2> => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? Result.Err(makeErr2(400)) : Result.Ok(n);
};

const process = (n: number): Result<boolean, Err3> =>
  n > 0 ? Result.Ok(true) : Result.Err(makeErr3(["must be positive"]));

describe("ExperimentalResult error type union inference", () => {
  describe("gen (no adapter)", () => {
    it("should union error types from multiple yields", () => {
      const result = Result.gen(function* () {
        const validated = yield* validate("test");
        const parsed = yield* parse("42");
        const processed = yield* process(parsed);
        return { validated, parsed, processed };
      });

      // Type assertion: result should have union error type
      const _typeCheck: Result<
        { validated: string; parsed: number; processed: boolean },
        Err1 | Err2 | Err3
      > = result;

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({
        validated: "test",
        parsed: 42,
        processed: true,
      });
    });

    it("should handle errors from any yield point", () => {
      const result = Result.gen(function* () {
        const validated = yield* validate(""); // Will fail
        const parsed = yield* parse("42");
        return { validated, parsed };
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.unwrapErr()).toEqual({
          _tag: "Err1",
          message: "empty string",
        });
      }
    });
  });

  describe("genAdapter", () => {
    it("should union error types from multiple yields", () => {
      const result = Result.genAdapter(function* ($) {
        const validated = yield* $(validate("test"));
        const parsed = yield* $(parse("42"));
        const processed = yield* $(process(parsed));
        return { validated, parsed, processed };
      });

      // Type assertion: result should have union error type
      const _typeCheck: Result<
        { validated: string; parsed: number; processed: boolean },
        Err1 | Err2 | Err3
      > = result;

      expect(result.isOk()).toBe(true);
    });
  });

  describe("asyncGen (no adapter)", () => {
    it("should union error types from multiple yields", async () => {
      const result = await Result.asyncGen(async function* () {
        const validated = yield* validate("test");
        const parsed = yield* parse("42");
        const processed = yield* process(parsed);
        return { validated, parsed, processed };
      });

      // Type assertion: result should have union error type
      const _typeCheck: Result<
        { validated: string; parsed: number; processed: boolean },
        Err1 | Err2 | Err3
      > = result;

      expect(result.isOk()).toBe(true);
    });
  });

  describe("asyncGenAdapter", () => {
    it("should union error types from multiple yields", async () => {
      const result = await Result.asyncGenAdapter(async function* ($) {
        const validated = yield* $(validate("test"));
        const parsed = yield* $(parse("42"));
        const processed = yield* $(process(parsed));
        return { validated, parsed, processed };
      });

      // Type assertion: result should have union error type
      const _typeCheck: Result<
        { validated: string; parsed: number; processed: boolean },
        Err1 | Err2 | Err3
      > = result;

      expect(result.isOk()).toBe(true);
    });
  });

  describe("consistency between gen and genAdapter", () => {
    it("should infer same error union for both approaches", () => {
      const genResult = Result.gen(function* () {
        const a = yield* validate("x");
        const b = yield* parse("1");
        return { a, b };
      });

      const adapterResult = Result.genAdapter(function* ($) {
        const a = yield* $(validate("x"));
        const b = yield* $(parse("1"));
        return { a, b };
      });

      // Both should be assignable to the same type
      const _check1: Result<{ a: string; b: number }, Err1 | Err2> = genResult;
      const _check2: Result<{ a: string; b: number }, Err1 | Err2> =
        adapterResult;

      expect(genResult.isOk()).toBe(true);
      expect(adapterResult.isOk()).toBe(true);
    });
  });

  describe("consistency between asyncGen and asyncGenAdapter", () => {
    it("should infer same error union for both approaches", async () => {
      const asyncGenResult = await Result.asyncGen(async function* () {
        const a = yield* validate("x");
        const b = yield* parse("1");
        return { a, b };
      });

      const asyncAdapterResult = await Result.asyncGenAdapter(
        async function* ($) {
          const a = yield* $(validate("x"));
          const b = yield* $(parse("1"));
          return { a, b };
        },
      );

      // Both should be assignable to the same type
      const _check1: Result<{ a: string; b: number }, Err1 | Err2> =
        asyncGenResult;
      const _check2: Result<{ a: string; b: number }, Err1 | Err2> =
        asyncAdapterResult;

      expect(asyncGenResult.isOk()).toBe(true);
      expect(asyncAdapterResult.isOk()).toBe(true);
    });
  });
});
