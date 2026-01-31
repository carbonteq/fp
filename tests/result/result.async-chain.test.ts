import { describe, expect, it, mock } from "bun:test";
import { Result } from "@/result.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Result async chain short-circuiting", () => {
  it("should not call map after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => n + 1);
    const result = Result.Ok(1)
      .flatMap(async () => {
        await delay(10);
        return Result.Err<string, number>("boom");
      })
      .map(sideEffect);

    const resolved = await result.toPromise();

    expect(sideEffect).not.toHaveBeenCalled();
    expect(result.isErr()).toBeTrue();
    expect(resolved.isErr()).toBeTrue();
  });

  it("should not call zip after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => n + 1);
    const result = Result.Ok(1)
      .flatMap(async () => {
        await delay(10);
        return Result.Err<string, number>("boom");
      })
      .zip(sideEffect);

    const resolved = await result.toPromise();

    expect(sideEffect).not.toHaveBeenCalled();
    expect(result.isErr()).toBeTrue();
    expect(resolved.isErr()).toBeTrue();
  });

  it("should not call flatZip after async flatMap resolves to Err", async () => {
    const sideEffect = mock((n: number) => Result.Ok(n + 1));
    const result = Result.Ok(1)
      .flatMap(async () => {
        await delay(10);
        return Result.Err<string, number>("boom");
      })
      .flatZip(sideEffect);

    const resolved = await result.toPromise();

    expect(sideEffect).not.toHaveBeenCalled();
    expect(result.isErr()).toBeTrue();
    expect(resolved.isErr()).toBeTrue();
  });
});
