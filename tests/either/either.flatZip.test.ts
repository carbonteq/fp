import { describe, test } from "bun:test";
import { Either } from "@/either.js";

const flatZipHelpers = {
  syncRightBinder: (_value: unknown) => ["zip-right"] as const,
  asyncRightBinder: async (_value: unknown) => ["zip-right"] as const,
  syncLeftBinder: (_value: unknown) => ["zip-left"] as const,
  asyncLeftBinder: async (_value: unknown) => ["zip-left"] as const,
  syncTupleBinder: (_value: unknown) => ["zip-tuple"] as const,
  asyncTupleBinder: async (_value: unknown) => ["zip-tuple"] as const,
  rightSeed: () => "right-seed" as const,
  leftSeed: () => "left-seed" as const,
};

describe("Either.flatZipRight behavior", () => {
  describe("sync binders", () => {
    test.todo(
      "flatZips Right values with flatZipHelpers.syncRightBinder and flatZipHelpers.syncTupleBinder",
    );
    test.todo(
      "short-circuits Left values before flatZipHelpers.syncRightBinder",
    );
  });

  describe("async binders", () => {
    test.todo(
      "flatZips Right values with flatZipHelpers.asyncRightBinder and flatZipHelpers.asyncTupleBinder",
    );
    test.todo(
      "short-circuits Left values before flatZipHelpers.asyncRightBinder",
    );
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.flatZipRight(flatZipHelpers.asyncRightBinder).flatZipRight(flatZipHelpers.syncTupleBinder) on Right branches",
    );
    test.todo(
      "short-circuits Either.flatZipRight(flatZipHelpers.asyncRightBinder).flatZipRight(flatZipHelpers.syncTupleBinder) on Left branches",
    );
    test.todo(
      "supports chaining Either.flatZipRight(flatZipHelpers.syncRightBinder).flatZipLeft(flatZipHelpers.syncLeftBinder) without mutating the original Either",
    );
    test.todo(
      "propagates Left across Either.flatZipRight(flatZipHelpers.asyncRightBinder).flatZipLeft(flatZipHelpers.asyncLeftBinder) flows",
    );
  });
});

describe("Either.flatZipLeft behavior", () => {
  describe("sync binders", () => {
    test.todo("flatZips Left values with flatZipHelpers.syncLeftBinder");
    test.todo(
      "preserves Right values when flatZipHelpers.syncLeftBinder is used",
    );
  });

  describe("async binders", () => {
    test.todo("flatZips Left values with flatZipHelpers.asyncLeftBinder");
    test.todo(
      "preserves Right values when flatZipHelpers.asyncLeftBinder is used",
    );
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.flatZipLeft(flatZipHelpers.asyncLeftBinder).flatZipLeft(flatZipHelpers.syncLeftBinder) on Left branches",
    );
    test.todo(
      "does not remap Right branches when chaining Either.flatZipLeft(flatZipHelpers.syncLeftBinder).flatZipLeft(flatZipHelpers.asyncLeftBinder)",
    );
    test.todo(
      "allows Either.flatZipLeft(flatZipHelpers.syncLeftBinder).flatZipRight(flatZipHelpers.syncRightBinder) permutations",
    );
    test.todo(
      "supports Either.flatZipLeft(flatZipHelpers.asyncLeftBinder).flatZipRight(flatZipHelpers.asyncRightBinder) permutations",
    );
  });
});
