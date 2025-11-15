import { afterEach, describe, expect, it } from "bun:test";
import { Result } from "@/result.hybrid";

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

    const res = Result.Ok(2).map(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "boom";
    });

    const err = res.unwrapErr();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
  });
});
