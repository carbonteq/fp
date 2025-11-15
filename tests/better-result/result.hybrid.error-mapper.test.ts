import { afterEach, describe, expect, it } from "bun:test";
import { ExperimentalResult as Result } from "@/result.experimental";
import { expectSyncValue } from "../testUtils";

describe("Hybrid Result error mapper", () => {
  afterEach(() => {
    Result.resetErrorMapper();
  });

  it("normalises thrown non-error values", () => {
    Result.setErrorMapper((value: unknown) => {
      if (typeof value === "string") {
        return new Error(value);
      }

      return value;
    });

    const res = Result.Ok<number, Error>(2).map(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "boom";
    });

    const err = expectSyncValue(res.unwrapErr());
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
  });
});
