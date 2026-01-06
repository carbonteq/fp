import { describe, expect, test } from "bun:test";
import { SyncResult } from "@/internal/result.experimental";

describe("SyncResult", () => {
  describe("Construction", () => {
    test("should create Ok values", () => {
      const result = SyncResult.Ok<string, string>("success");
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
    });

    test("should create Err values", () => {
      const result = SyncResult.Err<string, string>("error");
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
    });
  });

  describe("State Inspection", () => {
    test("isOk should return true for Ok values", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(result.isOk()).toBe(true);
    });

    test("isOk should return false for Err values", () => {
      const result = SyncResult.Err<number, string>("error");
      expect(result.isOk()).toBe(false);
    });

    test("isErr should return false for Ok values", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(result.isErr()).toBe(false);
    });

    test("isErr should return true for Err values", () => {
      const result = SyncResult.Err<number, string>("error");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("Value Extraction", () => {
    test("unwrap should return value for Ok", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(result.unwrap()).toBe(42);
    });

    test("unwrap should throw for Err", () => {
      const result = SyncResult.Err<number, string>("error");
      expect(() => result.unwrap()).toThrow("Called unwrap on an Err value");
    });

    test("unwrapErr should return error for Err", () => {
      const result = SyncResult.Err<number, string>("error");
      expect(result.unwrapErr()).toBe("error");
    });

    test("unwrapErr should throw for Ok", () => {
      const result = SyncResult.Ok<number, string>(42);
      expect(() => result.unwrapErr()).toThrow(
        "Called unwrapErr on an Ok value",
      );
    });

    test("safeUnwrap should return success object for Ok", () => {
      const result = SyncResult.Ok<number, string>(42);
      const safe = result.safeUnwrap();
      expect(safe.success).toBe(true);
      expect(safe.value).toBe(42);
    });

    test("safeUnwrap should return failure object for Err", () => {
      const result = SyncResult.Err<number, string>("error");
      const safe = result.safeUnwrap();
      expect(safe.success).toBe(false);
      expect(safe.value).toBe(Symbol.for("SentinelSym"));
    });
  });

  describe("map", () => {
    test("should transform Ok values", () => {
      const result = SyncResult.Ok<number, string>(42).map((x) => x * 2);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(84);
    });

    test("should preserve Err values", () => {
      const result = SyncResult.Err<number, string>("error").map((x) => x * 2);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
    });

    test("should work with different output types", () => {
      const result = SyncResult.Ok<number, string>(42).map((x) => x.toString());
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("42");
    });
  });

  describe("flatMap", () => {
    test("should chain Ok values", () => {
      const result = SyncResult.Ok<number, string>(42).flatMap((x) =>
        SyncResult.Ok(x * 2),
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(84);
    });

    test("should short-circuit on Err", () => {
      const result = SyncResult.Err<number, string>("initial").flatMap((x) =>
        SyncResult.Ok(x * 2),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("initial");
    });

    test("should propagate new errors", () => {
      const result = SyncResult.Ok<number, string>(42).flatMap((x) =>
        SyncResult.Err<number, string>("new error"),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("new error");
    });
  });

  describe("zip", () => {
    test("should combine Ok value with transformed value", () => {
      const result = SyncResult.Ok<number, string>(42).zip((x) => x * 2);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([42, 84]);
    });

    test("should preserve Err values", () => {
      const result = SyncResult.Err<number, string>("error").zip((x) => x * 2);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("error");
    });
  });

  describe("flatZip", () => {
    test("should combine Ok value with another Result's Ok value", () => {
      const result = SyncResult.Ok<number, string>(42).flatZip((x) =>
        SyncResult.Ok(x + 5),
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([42, 47]);
    });

    test("should propagate error when zipped Result fails", () => {
      const result = SyncResult.Ok<number, string>(42).flatZip((x) =>
        SyncResult.Err<number, string>("invalid"),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("invalid");
    });

    test("should preserve original Err values", () => {
      const result = SyncResult.Err<number, string>("initial").flatZip((x) =>
        SyncResult.Err<number, string>("invalid"),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("initial");
    });
  });

  describe("Cloning", () => {
    test("clone should create identical copy", () => {
      const original = SyncResult.Ok<number, string>(42);
      const cloned = original.clone();
      expect(cloned.isOk()).toBe(true);
      expect(cloned.unwrap()).toBe(42);
    });

    test("cloneOk should preserve value and change error type", () => {
      const original = SyncResult.Ok<number, string>(42);
      const cloned = original.cloneOk<number, number>();
      expect(cloned.isOk()).toBe(true);
      expect(cloned.unwrap()).toBe(42);
    });

    test("cloneErr should preserve error and change value type", () => {
      const original = SyncResult.Err<number, string>("error");
      const cloned = original.cloneErr<string>();
      expect(cloned.isErr()).toBe(true);
      expect(cloned.unwrapErr()).toBe("error");
    });
  });
});
