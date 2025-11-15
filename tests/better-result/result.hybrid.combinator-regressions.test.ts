import { afterEach, describe, expect, it } from "bun:test";
import { ExperimentalResult as Result } from "@/result.experimental";

describe("HybridResult combinator regressions", () => {
  afterEach(() => {
    Result.resetErrorMapper();
  });

  describe("mapErr", () => {
    it("captures exceptions thrown by the mapper", () => {
      const boom = new Error("boom");
      const result = Result.Err("initial").mapErr(() => {
        throw boom;
      });

      expect(result.unwrapErr()).toBe(boom);
    });

    it("applies the global error mapper to thrown literals", () => {
      Result.setErrorMapper((value: unknown) => {
        if (typeof value === "string") {
          return new Error(value);
        }
        return value;
      });

      const mapped = Result.Err("initial").mapErr(() => {
        throw "mapped";
      });

      const err = mapped.unwrapErr();
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("mapped");
    });
  });

  describe("mapBoth", () => {
    it("returns Err when the Ok mapper throws", async () => {
      const failure = new Error("failure");
      const result = Result.Ok(42).mapBoth(
        () => {
          throw failure;
        },
        (err) => `error:${err}`,
      );

      expect(result.isErr()).toBeTrue();
      const r = result.unwrapErr();
      expect(r).not.toBeInstanceOf(Promise);
      // @ts-expect-error
      expect(await r).toBe(failure);
    });

    it("supports async error-side mapping", async () => {
      const result = Result.Err("bad").mapBoth(
        (x) => x,
        async (err) => `error:${err}`,
      );

      const err = result.unwrapErr();
      expect(err).toBeInstanceOf(Promise);
      expect(err).resolves.toBe("error:bad");
    });
  });

  describe("orElse", () => {
    it("allows fallback factories to inspect the error", () => {
      const errResult = Result.Err<string, string>("missing");
      const value = errResult.orElse((err) => `fallback:${err}`);

      expect(value).toBe("fallback:missing");
    });

    it("promotes to async when the fallback returns a promise", async () => {
      const errResult = Result.Err<string, string>("missing");
      const value = errResult.orElse(async () => "fallback");

      expect(value).toBeInstanceOf(Promise);
      expect(value).resolves.toBe("fallback");
    });

    it("maps thrown fallback errors with the global mapper", () => {
      Result.setErrorMapper((value: unknown) => {
        if (typeof value === "string") {
          return new Error(value);
        }
        return value;
      });

      expect(() =>
        Result.Err("boom").orElse(() => {
          throw "fallback failed";
        }),
      ).toThrowError(new Error("fallback failed"));
    });
  });
});
