import { describe, expect, it } from "bun:test";
import { SyncOpt } from "@/internal/option.experimental";

describe("SyncOpt", () => {
  describe("constructor and static methods", () => {
    it("should create Some value with Some method", () => {
      const opt = SyncOpt.Some(42);
      expect(opt.value).toBe(42);
    });

    it("should create None value with None property", () => {
      const opt = SyncOpt.None;
      expect(opt.value).toBe(Symbol.for("OptSentinel"));
    });

    it("should create Some value with constructor", () => {
      const opt = new SyncOpt(42);
      expect(opt.value).toBe(42);
    });

    it("should create None value with constructor", () => {
      const opt = new SyncOpt(Symbol.for("OptSentinel"));
      expect(opt.value).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("toPromise", () => {
    it("should convert Some to promise", async () => {
      const opt = SyncOpt.Some(42);
      const promised = await opt.toPromise();
      expect(promised.value).toBe(42);
    });

    it("should convert None to promise", async () => {
      const opt = SyncOpt.None;
      const promised = await opt.toPromise();
      expect(promised.value).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("unwrap", () => {
    it("should return value for Some", () => {
      const opt = SyncOpt.Some(42);
      expect(opt.unwrap()).toBe(42);
    });

    it("should throw error for None", () => {
      const opt = SyncOpt.None;
      expect(() => opt.unwrap()).toThrow("Called unwrap on a None value");
    });
  });

  describe("safeUnwrap", () => {
    it("should return success object for Some", () => {
      const opt = SyncOpt.Some(42);
      const result = opt.safeUnwrap();
      expect(result).toEqual({ success: true, value: 42 });
    });

    it("should return failure object for None", () => {
      const opt = SyncOpt.None;
      const result = opt.safeUnwrap();
      expect(result).toEqual({ success: false });
    });
  });

  describe("map", () => {
    it("should map Some value", () => {
      const opt = SyncOpt.Some(42);
      const mapped = opt.map((x) => x * 2);
      expect(mapped.value).toBe(84);
    });

    it("should return None for None input", () => {
      const opt = SyncOpt.None;
      const mapped = opt.map((x) => x * 2);
      expect(mapped).toBe(SyncOpt.None);
    });

    it("should handle different return types", () => {
      const opt = SyncOpt.Some("hello");
      const mapped = opt.map((s) => s.length);
      expect(mapped.value).toBe(5);
    });

    it("should handle undefined return", () => {
      const opt = SyncOpt.Some(42);
      const mapped = opt.map(() => undefined);
      expect(mapped.value).toBe(undefined);
    });

    it("should handle null return", () => {
      const opt = SyncOpt.Some(42);
      const mapped = opt.map(() => null);
      expect(mapped.value).toBe(null);
    });
  });

  describe("flatMap", () => {
    it("should flatMap Some value returning Some", () => {
      const opt = SyncOpt.Some(42);
      const mapped = opt.flatMap((x) => SyncOpt.Some(x * 2));
      expect(mapped.value).toBe(84);
    });

    it("should flatMap Some value returning None", () => {
      const opt = SyncOpt.Some(42);
      const mapped = opt.flatMap(() => SyncOpt.None);
      expect(mapped).toBe(SyncOpt.None);
    });

    it("should return None for None input", () => {
      const opt = SyncOpt.None;
      const mapped = opt.flatMap((x) => SyncOpt.Some(x * 2));
      expect(mapped).toBe(SyncOpt.None);
    });

    it("should handle chaining of flatMaps", () => {
      const opt = SyncOpt.Some(42);
      const result = opt
        .flatMap((x) => SyncOpt.Some(x.toString()))
        .flatMap((s) => SyncOpt.Some(s.length))
        .flatMap((len) => SyncOpt.Some(len * 2));
      expect(result.value).toBe(4);
    });

    it("should handle different types", () => {
      const opt = SyncOpt.Some("hello");
      const mapped = opt.flatMap((s) => SyncOpt.Some(s.length));
      expect(mapped.value).toBe(5);
    });
  });

  describe("zip", () => {
    it("should zip Some value with computed value", () => {
      const opt = SyncOpt.Some(42);
      const zipped = opt.zip((x) => x * 2);
      expect(zipped.value).toEqual([42, 84]);
    });

    it("should return None for None input", () => {
      const opt = SyncOpt.None;
      const zipped = opt.zip((x) => x * 2);
      expect(zipped).toBe(SyncOpt.None);
    });

    it("should handle different return types", () => {
      const opt = SyncOpt.Some("hello");
      const zipped = opt.zip((s) => s.length);
      expect(zipped.value).toEqual(["hello", 5]);
    });

    it("should handle functions returning undefined", () => {
      const opt = SyncOpt.Some(42);
      const zipped = opt.zip(() => undefined);
      expect(zipped.value).toEqual([42, undefined]);
    });

    it("should handle functions returning null", () => {
      const opt = SyncOpt.Some(42);
      const zipped = opt.zip(() => null);
      expect(zipped.value).toEqual([42, null]);
    });
  });

  describe("flatZip", () => {
    it("should flatZip Some value with Some computed value", () => {
      const opt = SyncOpt.Some(42);
      const zipped = opt.flatZip((x) => SyncOpt.Some(x * 2));
      expect(zipped.value).toEqual([42, 84]);
    });

    it("should return None when flatZip Some with None computed value", () => {
      const opt = SyncOpt.Some(42);
      const zipped = opt.flatZip(() => SyncOpt.None);
      expect(zipped).toBe(SyncOpt.None);
    });

    it("should return None for None input", () => {
      const opt = SyncOpt.None;
      const zipped = opt.flatZip((x) => SyncOpt.Some(x * 2));
      expect(zipped).toBe(SyncOpt.None);
    });

    it("should handle chaining of flatZips", () => {
      const opt = SyncOpt.Some(42);
      const firstStep = opt.flatZip((x) => SyncOpt.Some(x.toString()));
      expect(firstStep.value).toEqual([42, "42"]);

      const secondStep = firstStep.flatZip(([_original, str]) =>
        SyncOpt.Some(str.length),
      );
      expect(secondStep.value).toEqual([[42, "42"], 2]);
    });

    it("should handle different types", () => {
      const opt = SyncOpt.Some("hello");
      const zipped = opt.flatZip((s) => SyncOpt.Some(s.length));
      expect(zipped.value).toEqual(["hello", 5]);
    });
  });

  describe("type inference and generic constraints", () => {
    it("should maintain type correctness through operations", () => {
      const opt: SyncOpt<number> = SyncOpt.Some(42);
      const mapped: SyncOpt<string> = opt.map((x) => x.toString());
      const flatMapped: SyncOpt<number> = mapped.flatMap((s) =>
        SyncOpt.Some(s.length),
      );
      const zipped: SyncOpt<[string, number]> = flatMapped.zip(
        (len) => len * 2,
      );

      expect(zipped.value).toEqual([2, 4]);
    });

    it("should work with complex types", () => {
      interface User {
        id: number;
        name: string;
      }

      const user: SyncOpt<User> = SyncOpt.Some({ id: 1, name: "Alice" });
      const userName = user.map((u) => u.name);
      const userWithAge = user.flatMap((u) => SyncOpt.Some({ ...u, age: 30 }));

      expect(userName.value).toBe("Alice");
      expect(userWithAge.value).toEqual({ id: 1, name: "Alice", age: 30 });
    });

    it("should handle array types", () => {
      const numbers = SyncOpt.Some([1, 2, 3]);
      const doubled = numbers.map((arr) => arr.map((x) => x * 2));
      const sum = numbers.flatMap((arr) =>
        SyncOpt.Some(arr.reduce((a, b) => a + b, 0)),
      );

      expect(doubled.value).toEqual([2, 4, 6]);
      expect(sum.value).toBe(6);
    });
  });

  describe("edge cases", () => {
    it("should handle zero values", () => {
      const opt = SyncOpt.Some(0);
      expect(opt.value).toBe(0);
      expect(opt.unwrap()).toBe(0);
      expect(opt.map((x) => x + 1).value).toBe(1);
    });

    it("should handle empty string", () => {
      const opt = SyncOpt.Some("");
      expect(opt.value).toBe("");
      expect(opt.unwrap()).toBe("");
      expect(opt.map((s) => s.length).value).toBe(0);
    });

    it("should handle false boolean", () => {
      const opt = SyncOpt.Some(false);
      expect(opt.value).toBe(false);
      expect(opt.unwrap()).toBe(false);
      expect(opt.map((b) => !b).value).toBe(true);
    });

    it("should handle NaN", () => {
      const opt = SyncOpt.Some(Number.NaN);
      expect(Number.isNaN(opt.value)).toBe(true);
      expect(Number.isNaN(opt.unwrap())).toBe(true);
    });
  });
});
