import { describe, expect, test } from "bun:test";
import { BetterResult } from "@/internal/result.experimental";

describe("BetterResult", () => {
  test("should create sync Ok value", () => {
    const result = BetterResult.Ok<string, string>("hello");
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
    expect(result.unwrap()).toBe("hello");
  });

  test("should create sync Err value", () => {
    const result = BetterResult.Err<string, string>("error");
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("error");
  });

  test("should create async Ok value from promise", async () => {
    const promise = Promise.resolve("hello");
    const result = BetterResult.fromPromise<string, string>(promise);
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
    expect(await result.isErr()).toBe(false);
    expect(await result.unwrap()).toBe("hello");
  });

  test("should create async Err value from rejected promise", async () => {
    const promise = Promise.reject("error");
    const result = BetterResult.fromPromise<string, string>(promise);
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(false);
    expect(await result.isErr()).toBe(true);
    expect(await result.unwrapErr()).toBe("error");
  });

  test("should convert sync to async with toPromise", async () => {
    const syncResult = BetterResult.Ok("sync");
    const asyncResult = await syncResult.toPromise();
    expect(asyncResult.isAsync()).toBe(false);
    expect(asyncResult.isOk()).toBe(true);
    expect(asyncResult.unwrap()).toBe("sync");
  });

  test("should convert async to async with toPromise", async () => {
    const asyncResult = BetterResult.fromPromise(Promise.resolve("async"));
    const convertedResult = await asyncResult.toPromise();
    expect(convertedResult.isAsync()).toBe(false);
    expect(convertedResult.isOk()).toBe(true);
    expect(convertedResult.unwrap()).toBe("async");
  });

  test("should map sync Ok value", () => {
    const result = BetterResult.Ok(5).map((x) => x * 2);
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(10);
  });

  test("should map async Ok value", async () => {
    const result = BetterResult.fromPromise(Promise.resolve(5)).map(
      (x) => x * 2,
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should not map sync Err value", () => {
    const result = BetterResult.Err<number, string>("error").map((x) => x * 2);
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(false);
  });

  test("should not map async Err value", async () => {
    const result = BetterResult.fromPromise(Promise.reject("error")).map(
      (x) => x * 2,
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(false);
  });

  test("should flatMap sync Ok value to sync result", () => {
    const result = BetterResult.Ok(5).flatMap((x) => BetterResult.Ok(x * 2));
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(true);
  });

  test("should flatMap sync Ok value to async result", async () => {
    const result = BetterResult.Ok(5).flatMap((x) =>
      BetterResult.fromPromise(Promise.resolve(x * 2)),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should flatMap async Ok value to sync result", async () => {
    const result = BetterResult.fromPromise(Promise.resolve(5)).flatMap((x) =>
      BetterResult.Ok(x * 2),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should flatMap async Ok value to async result", async () => {
    const result = BetterResult.fromPromise(Promise.resolve(5)).flatMap((x) =>
      BetterResult.fromPromise(Promise.resolve(x * 2)),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should not flatMap sync Err value", () => {
    const result = BetterResult.Err<number, string>("error").flatMap((x) =>
      BetterResult.Ok(x * 2),
    );
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(false);
  });

  test("should not flatMap async Err value", async () => {
    const result = BetterResult.fromPromise(Promise.reject("error")).flatMap(
      (x) => BetterResult.Ok(x * 2),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(false);
  });

  test("should zip sync Ok value", () => {
    const result = BetterResult.Ok(5).zip((x) => x * 2);
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(true);
  });

  test("should zip async Ok value", async () => {
    const result = BetterResult.fromPromise(Promise.resolve(5)).zip(
      (x) => x * 2,
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should not zip sync Err value", () => {
    const result = BetterResult.Err<number, string>("error").zip((x) => x * 2);
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(false);
  });

  test("should not zip async Err value", async () => {
    const result = BetterResult.fromPromise(Promise.reject("error")).zip(
      (x) => x * 2,
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(false);
  });

  test("should flatZip sync Ok value with sync result", () => {
    const result = BetterResult.Ok(5).flatZip((x) => BetterResult.Ok(x * 2));
    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(true);
  });

  test("should flatZip sync Ok value with async result", async () => {
    const result = BetterResult.Ok(5).flatZip((x) =>
      BetterResult.fromPromise(Promise.resolve(x * 2)),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should flatZip async Ok value with sync result", async () => {
    const result = BetterResult.fromPromise(Promise.resolve(5)).flatZip((x) =>
      BetterResult.Ok(x * 2),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should flatZip async Ok value with async result", async () => {
    const result = BetterResult.fromPromise(Promise.resolve(5)).flatZip((x) =>
      BetterResult.fromPromise(Promise.resolve(x * 2)),
    );
    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should handle flatZip with failing function", async () => {
    const syncResult = BetterResult.Ok(5).flatZip((_x) =>
      BetterResult.Err("failed"),
    );
    expect(syncResult.isAsync()).toBe(false);
    expect(syncResult.isOk()).toBe(false);

    const asyncResult = BetterResult.Ok(5).flatZip((_x) =>
      BetterResult.fromPromise(Promise.reject("async failed")),
    );
    expect(asyncResult.isAsync()).toBe(true);
    expect(await asyncResult.isOk()).toBe(false);
  });

  test("should chain mixed sync and async operations", async () => {
    const result = BetterResult.Ok(5)
      .map((x) => x * 2)
      .flatMap((x) => BetterResult.fromPromise(Promise.resolve(x + 1)))
      .zip((x) => x * 3)
      .flatMap(([x, y]) => BetterResult.Ok(x + y));

    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should handle complex mixed operations", async () => {
    const computeAsync = async (n: number): Promise<number> => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n * n;
    };

    const result = BetterResult.fromPromise(computeAsync(5))
      .map((x) => x + 10)
      .flatZip((x) => BetterResult.Ok(x / 2))
      .flatMap(([sum, half]) =>
        BetterResult.fromPromise(Promise.resolve(sum + half)),
      );

    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
  });

  test("should preserve error types through transformations", () => {
    type AppError = { code: string; message: string };

    const result = BetterResult.Err<number, AppError>({
      code: "VALIDATION",
      message: "Invalid input",
    })
      .map((x) => x * 2)
      .flatMap((x) => BetterResult.Ok(x + 1));

    expect(result.isAsync()).toBe(false);
    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toEqual({
      code: "VALIDATION",
      message: "Invalid input",
    });
  });

  // Tests for unwrap and unwrapErr methods
  test("should unwrap sync Ok value", () => {
    const result = BetterResult.Ok("success");
    expect(result.unwrap()).toBe("success");
  });

  test("should unwrap sync Err value", () => {
    const result = BetterResult.Err<string, string>("error");
    expect(result.unwrapErr()).toBe("error");
  });

  test("should unwrap async Ok value", async () => {
    const result = BetterResult.fromPromise(Promise.resolve("async success"));
    expect(await result.unwrap()).toBe("async success");
  });

  test("should unwrap async Err value", async () => {
    const result = BetterResult.fromPromise(Promise.reject("async error"));
    expect(await result.unwrapErr()).toBe("async error");
  });

  test("should safe unwrap sync Ok value", async () => {
    const result = BetterResult.Ok("value");
    const safe = await result.safeUnwrap();
    expect(safe.success).toBe(true);
    expect(safe.value).toBe("value");
  });

  test("should safe unwrap sync Err value", async () => {
    const result = BetterResult.Err<string, string>("error");
    const safe = await result.safeUnwrap();
    expect(safe.success).toBe(false);
    expect(safe.value).toEqual(expect.any(Symbol));
  });

  test("should safe unwrap async Ok value", async () => {
    const result = BetterResult.fromPromise(Promise.resolve("async value"));
    const safe = await result.safeUnwrap();
    expect(safe.success).toBe(true);
    expect(safe.value).toBe("async value");
  });

  test("should safe unwrap async Err value", async () => {
    const result = BetterResult.fromPromise(Promise.reject("async error"));
    const safe = await result.safeUnwrap();
    expect(safe.success).toBe(false);
    expect(safe.value).toEqual(expect.any(Symbol));
  });

  // Tests for clone methods
  test("should clone sync Ok value", () => {
    const original = BetterResult.Ok("test");
    const cloned = original.clone();
    expect(cloned.isAsync()).toBe(false);
    expect(cloned.isOk()).toBe(true);
    expect(cloned.unwrap()).toBe("test");
    expect(cloned).not.toBe(original);
  });

  test("should clone sync Err value", () => {
    const original = BetterResult.Err<string, string>("error");
    const cloned = original.clone();
    expect(cloned.isAsync()).toBe(false);
    expect(cloned.isErr()).toBe(true);
    expect(cloned.unwrapErr()).toBe("error");
    expect(cloned).not.toBe(original);
  });

  test("should clone async Ok value", async () => {
    const original = BetterResult.fromPromise(Promise.resolve("async test"));
    const cloned = original.clone();
    expect(cloned.isAsync()).toBe(true);
    expect(await cloned.isOk()).toBe(true);
    expect(await cloned.unwrap()).toBe("async test");
    expect(cloned).not.toBe(original);
  });

  test("should clone async Err value", async () => {
    const original = BetterResult.fromPromise(Promise.reject("async error"));
    const cloned = original.clone();
    expect(cloned.isAsync()).toBe(true);
    expect(await cloned.isErr()).toBe(true);
    expect(await cloned.unwrapErr()).toBe("async error");
    expect(cloned).not.toBe(original);
  });

  test("should cloneOk with different error type", () => {
    const original = BetterResult.Ok<string, string>("success");
    const cloned = original.cloneOk<number>();
    expect(cloned.isAsync()).toBe(false);
    expect(cloned.isOk()).toBe(true);
    expect(cloned.unwrap()).toBe("success");
  });

  test("should cloneErr with different success type", () => {
    const original = BetterResult.Err<string, string>("error");
    const cloned = original.cloneErr<number>();
    expect(cloned.isAsync()).toBe(false);
    expect(cloned.isErr()).toBe(true);
    expect(cloned.unwrapErr()).toBe("error");
  });

  test("should cloneOk async with different error type", async () => {
    const original = BetterResult.fromPromise(Promise.resolve("async success"));
    const cloned = original.cloneOk<number>();
    expect(cloned.isAsync()).toBe(true);
    expect(await cloned.isOk()).toBe(true);
    expect(await cloned.unwrap()).toBe("async success");
  });

  test("should cloneErr async with different success type", async () => {
    const original = BetterResult.fromPromise(Promise.reject("async error"));
    const cloned = original.cloneErr<number>();
    expect(cloned.isAsync()).toBe(true);
    expect(await cloned.isErr()).toBe(true);
    expect(await cloned.unwrapErr()).toBe("async error");
  });

  // Integration tests with new methods
  test("should handle complex operations with unwrap methods", async () => {
    const result = BetterResult.Ok(5)
      .map((x) => x * 2)
      .flatMap((x) => BetterResult.fromPromise(Promise.resolve(x + 1)))
      .zip((x) => x * 3)
      .flatMap(([x, y]) => BetterResult.Ok(x + y));

    expect(result.isAsync()).toBe(true);
    expect(await result.isOk()).toBe(true);
    const finalValue = await result.unwrap();
    expect(finalValue).toBe(44); // ((5*2)+1) + ((5*2)+1)*3 = 11 + 33 = 44
  });

  test("should handle error propagation with unwrap methods", async () => {
    const result = BetterResult.Err<number, string>("initial error")
      .map((x) => x * 2)
      .flatMap((x) => BetterResult.Ok(x + 1))
      .zip((x) => x * 3);

    expect(result.isAsync()).toBe(false);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("initial error");
  });
});
