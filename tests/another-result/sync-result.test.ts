import { describe, expect, test } from "bun:test";
import { SyncResult } from "@/internal/result.experimental";
import {
  addOne,
  addOneResult,
  double,
  doubleResult,
  pairWithTriple,
  sumPair,
  TEST_ERROR,
  toString,
  triple,
} from "./test-utils";

describe("SyncResult", () => {
  test("should create Ok value", () => {
    const result = SyncResult.Ok<string, string>("hello");
    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
  });

  test("should create Err value", () => {
    const result = SyncResult.Err<string, string>("error");
    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);
  });

  test("should correctly identify Ok state with type guard", () => {
    const result = SyncResult.Ok<number, string>(42);
    if (result.isOk()) {
      expect(result.unwrap()).toBe(42);
    }
  });

  test("should correctly identify Err state with type guard", () => {
    const result = SyncResult.Err<number, string>("failed");
    if (result.isErr()) {
      expect(result.unwrapErr()).toBe("failed");
    }
  });

  test("should unwrap Ok value successfully", () => {
    const result = SyncResult.Ok("success");
    expect(result.unwrap()).toBe("success");
  });

  test("should unwrap Err value successfully", () => {
    const result = SyncResult.Err<string, string>("error");
    expect(result.unwrapErr()).toBe("error");
  });

  test("should throw when unwrapping Err value", () => {
    const result = SyncResult.Err<string, string>("error");
    expect(() => result.unwrap()).toThrow("Called unwrap on an Err value");
  });

  test("should throw when unwrapping Err on Ok value", () => {
    const result = SyncResult.Ok<string, string>("success");
    expect(() => result.unwrapErr()).toThrow("Called unwrapErr on an Ok value");
  });

  test("should safe unwrap Ok value", () => {
    const result = SyncResult.Ok("value");
    const safe = result.safeUnwrap();
    expect(safe.success).toBe(true);
    expect(safe.value).toBe("value");
  });

  test("should safe unwrap Err value", () => {
    const result = SyncResult.Err<string, string>("error");
    const safe = result.safeUnwrap();
    expect(safe.success).toBe(false);
    expect(safe.value).toEqual(expect.any(Symbol));
  });

  test("should map Ok value", () => {
    const result = SyncResult.Ok(5).map(double);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(10);
  });

  test("should not map Err value", () => {
    const result = SyncResult.Err<number, string>(TEST_ERROR).map(double);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(TEST_ERROR);
  });

  test("should map Err value", () => {
    const result = SyncResult.Err<string, string>(TEST_ERROR).mapErr(
      (e: string) => e.toUpperCase(),
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("TEST ERROR");
  });

  test("should not mapErr Ok value", () => {
    const result = SyncResult.Ok("success").mapErr((e: string) =>
      e.toUpperCase(),
    );
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe("success");
  });

  test("should flatMap Ok value", () => {
    const result = SyncResult.Ok(5).flatMap((x) =>
      SyncResult.Ok(doubleResult(x)),
    );
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(10);
  });

  test("should flatMap Ok to Err", () => {
    const result = SyncResult.Ok(5).flatMap((x) =>
      SyncResult.Err(x < 10 ? "too small" : "ok"),
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("too small");
  });

  test("should not flatMap Err value", () => {
    const result = SyncResult.Err<number, string>(TEST_ERROR).flatMap((x) =>
      SyncResult.Ok(doubleResult(x)),
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(TEST_ERROR);
  });

  test("should zip Ok value with function result", () => {
    const result = SyncResult.Ok(5).zip(pairWithTriple);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([5, 15]);
  });

  test("should not zip Err value", () => {
    const result = SyncResult.Err<number, string>(TEST_ERROR).zip(
      pairWithTriple,
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(TEST_ERROR);
  });

  test("should flatZip Ok value with successful function", () => {
    const result = SyncResult.Ok(5).flatZip((x) =>
      SyncResult.Ok(doubleResult(x)),
    );
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([5, 10]);
  });

  test("should flatZip Ok value with failing function", () => {
    const result = SyncResult.Ok(5).flatZip((_x) =>
      SyncResult.Err("calculation failed"),
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe("calculation failed");
  });

  test("should not flatZip Err value", () => {
    const result = SyncResult.Err<number, string>(TEST_ERROR).flatZip((x) =>
      SyncResult.Ok(doubleResult(x)),
    );
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(TEST_ERROR);
  });

  test("should clone Ok value", () => {
    const original = SyncResult.Ok("test");
    const cloned = original.clone();
    expect(cloned.isOk()).toBe(true);
    expect(cloned.unwrap()).toBe("test");
    expect(cloned).not.toBe(original);
  });

  test("should clone Err value", () => {
    const original = SyncResult.Err<string, string>("error");
    const cloned = original.clone();
    expect(cloned.isErr()).toBe(true);
    expect(cloned.unwrapErr()).toBe("error");
    expect(cloned).not.toBe(original);
  });

  test("should cloneOk with different error type", () => {
    const original = SyncResult.Ok<string, string>("success");
    const cloned = original.cloneOk<number>();
    expect(cloned.isOk()).toBe(true);
    expect(cloned.unwrap()).toBe("success");
  });

  test("should cloneErr with different success type", () => {
    const original = SyncResult.Err<string, string>("error");
    const cloned = original.cloneErr<number>();
    expect(cloned.isErr()).toBe(true);
    expect(cloned.unwrapErr()).toBe("error");
  });

  test("should chain multiple map operations", () => {
    const result = SyncResult.Ok(5).map(double).map(addOne).map(toString);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe("11");
  });

  test("should chain flatMap operations", () => {
    const result = SyncResult.Ok(5)
      .flatMap((x) => SyncResult.Ok(doubleResult(x)))
      .flatMap((x) => SyncResult.Ok(addOneResult(x)));
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(11);
  });

  test("should short-circuit on error in chain", () => {
    const result = SyncResult.Err<number, string>(TEST_ERROR)
      .map(double)
      .flatMap((x) => SyncResult.Ok(addOneResult(x)))
      .map(toString);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBe(TEST_ERROR);
  });

  test("should handle mixed operations", () => {
    const result = SyncResult.Ok(5)
      .zip(pairWithTriple)
      .flatMap(([x, y]) => SyncResult.Ok(sumPair([x, y])))
      .map(triple);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(60); // (5 + 15) * 3 = 60
  });
});
