import { describe, expect, test } from "bun:test";
import { AsyncResult } from "@/internal/result.experimental";
import { double, TEST_ERROR } from "./test-utils";

describe("AsyncResult", () => {
  test("should create Ok value", async () => {
    const result = AsyncResult.Ok<string, string>("hello");
    expect(await result.isOk()).toBe(true);
    expect(await result.isErr()).toBe(false);
  });

  test("should create Err value", async () => {
    const result = AsyncResult.Err<string, string>("error");
    expect(await result.isOk()).toBe(false);
    expect(await result.isErr()).toBe(true);
  });

  test("should unwrap Ok value successfully", async () => {
    const result = AsyncResult.Ok("success");
    expect(await result.unwrap()).toBe("success");
  });

  test("should unwrap Err value successfully", async () => {
    const result = AsyncResult.Err<string, string>("error");
    expect(await result.unwrapErr()).toBe("error");
  });

  test("should throw when unwrapping Err value", async () => {
    const result = AsyncResult.Err<string, string>("error");
    await expect(result.unwrap()).rejects.toThrow(
      "Called unwrap on an Err value",
    );
  });

  test("should throw when unwrapping Err on Ok value", async () => {
    const result = AsyncResult.Ok<string, string>("success");
    await expect(result.unwrapErr()).rejects.toThrow(
      "Called unwrapErr on an Ok value",
    );
  });

  test("should safe unwrap Ok value", async () => {
    const result = AsyncResult.Ok("value");
    const safe = await result.safeUnwrap();
    expect(safe.success).toBe(true);
    expect(safe.value).toBe("value");
  });

  test("should safe unwrap Err value", async () => {
    const result = AsyncResult.Err<string, string>("error");
    const safe = await result.safeUnwrap();
    expect(safe.success).toBe(false);
    expect(safe.value).toEqual(expect.any(Symbol));
  });

  test("should map Ok value", async () => {
    const result = AsyncResult.Ok(5).map(double);
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe(10);
  });

  test("should not map Err value", async () => {
    const result = AsyncResult.Err<number, string>(TEST_ERROR).map(double);
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe(TEST_ERROR);
  });

  test("should map Err value", async () => {
    const result = AsyncResult.Err<string, string>(TEST_ERROR).mapErr(
      (e: string) => e.toUpperCase(),
    );
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("TEST ERROR");
  });

  test("should not mapErr Ok value", async () => {
    const result = AsyncResult.Ok("success").mapErr((e: string) =>
      e.toUpperCase(),
    );
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe("success");
  });

  test("should flatMap Ok value", async () => {
    const result = AsyncResult.Ok(5).flatMap((x) => AsyncResult.Ok(x * 2));
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe(10);
  });

  test("should flatMap Ok to Err", async () => {
    const result = AsyncResult.Ok(5).flatMap((_x) =>
      AsyncResult.Err("too small"),
    );
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("too small");
  });

  test("should not flatMap Err value", async () => {
    const result = AsyncResult.Err<number, string>("error").flatMap((x) =>
      AsyncResult.Ok(x * 2),
    );
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("error");
  });

  test("should zip Ok value with function result", async () => {
    const result = AsyncResult.Ok(5).zip((x) => x * 2);
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toEqual([5, 10]);
  });

  test("should not zip Err value", async () => {
    const result = AsyncResult.Err<number, string>("error").zip((x) => x * 2);
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("error");
  });

  test("should flatZip Ok value with successful function", async () => {
    const result = AsyncResult.Ok(5).flatZip((x) => AsyncResult.Ok(x * 2));
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toEqual([5, 10]);
  });

  test("should flatZip Ok value with failing function", async () => {
    const result = AsyncResult.Ok(5).flatZip((_x) =>
      AsyncResult.Err("calculation failed"),
    );
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("calculation failed");
  });

  test("should not flatZip Err value", async () => {
    const result = AsyncResult.Err<number, string>("error").flatZip((x) =>
      AsyncResult.Ok(x * 2),
    );
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("error");
  });

  test("should chain multiple map operations", async () => {
    const result = AsyncResult.Ok(5)
      .map((x) => x * 2)
      .map((x) => x + 1)
      .map((x) => x.toString());
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe("11");
  });

  test("should chain flatMap operations", async () => {
    const result = AsyncResult.Ok(5)
      .flatMap((x) => AsyncResult.Ok(x * 2))
      .flatMap((x) => AsyncResult.Ok(x + 1));
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe(11);
  });

  test("should short-circuit on error in chain", async () => {
    const result = AsyncResult.Err<number, string>("initial error")
      .map((x) => x * 2)
      .flatMap((x) => AsyncResult.Ok(x + 1))
      .map((x) => x.toString());
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("initial error");
  });

  test("should handle mixed operations", async () => {
    const result = AsyncResult.Ok(5)
      .zip((x) => x * 2)
      .flatMap(([x, y]) => AsyncResult.Ok(x + y))
      .map((sum) => sum * 10);
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe(150);
  });

  test("should work with synchronous functions returning AsyncResult in flatMap", async () => {
    const syncFn = (x: number): AsyncResult<number, string> => {
      if (x > 0) {
        return AsyncResult.Ok(x * 2);
      }
      return AsyncResult.Err("negative number");
    };

    const result = AsyncResult.Ok(5).flatMap(syncFn);
    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe(10);
  });

  test("should handle synchronous function failure in flatMap", async () => {
    const syncFn = (x: number): AsyncResult<number, string> => {
      if (x > 10) {
        return AsyncResult.Ok(x * 2);
      }
      return AsyncResult.Err("too small");
    };

    const result = AsyncResult.Ok(5).flatMap(syncFn);
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("too small");
  });

  test("should preserve async nature through transformations", async () => {
    const result = AsyncResult.Ok("hello")
      .map((s) => s.length)
      .zip((len) => len * 2)
      .flatMap(([orig, doubled]) => AsyncResult.Ok(orig + doubled));

    expect(await result.isOk()).toBe(true);
    expect(await result.unwrap()).toBe(15); // 5 + 10
  });
});
