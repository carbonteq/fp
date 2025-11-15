import { describe, test } from "bun:test";
import { Either } from "@/either.js";

const flatMapHelpers = {
  syncRightBinder: (_value: unknown) => "right-binder" as const,
  asyncRightBinder: async (_value: unknown) => "right-binder" as const,
  syncLeftBinder: (_value: unknown) => "left-binder" as const,
  asyncLeftBinder: async (_value: unknown) => "left-binder" as const,
  rightSeed: () => "right-seed" as const,
  leftSeed: () => "left-seed" as const,
};

describe("Either.flatMapRight behavior", () => {
  describe("sync binders", () => {
    test.todo("flatMaps Right values with flatMapHelpers.syncRightBinder");
    test.todo(
      "short-circuits Left values before flatMapHelpers.syncRightBinder",
    );
  });

  describe("async binders", () => {
    test.todo("flatMaps Right values with flatMapHelpers.asyncRightBinder");
    test.todo(
      "short-circuits Left values before flatMapHelpers.asyncRightBinder",
    );
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.flatMapRight(flatMapHelpers.asyncRightBinder).flatMapRight(flatMapHelpers.syncRightBinder) on Right branches",
    );
    test.todo(
      "short-circuits Either.flatMapRight(flatMapHelpers.asyncRightBinder).flatMapRight(flatMapHelpers.syncRightBinder) on Left branches",
    );
    test.todo(
      "propagates Left when chaining Either.flatMapRight(flatMapHelpers.syncRightBinder).flatMapLeft(flatMapHelpers.syncLeftBinder)",
    );
    test.todo(
      "supports Either.flatMapRight(flatMapHelpers.asyncRightBinder).flatMapLeft(flatMapHelpers.asyncLeftBinder) compositions",
    );
  });
});

describe("Either.flatMapLeft behavior", () => {
  describe("sync binders", () => {
    test.todo("flatMaps Left values with flatMapHelpers.syncLeftBinder");
    test.todo(
      "preserves Right values when flatMapHelpers.syncLeftBinder is used",
    );
  });

  describe("async binders", () => {
    test.todo("flatMaps Left values with flatMapHelpers.asyncLeftBinder");
    test.todo(
      "preserves Right values when flatMapHelpers.asyncLeftBinder is used",
    );
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.flatMapLeft(flatMapHelpers.asyncLeftBinder).flatMapLeft(flatMapHelpers.syncLeftBinder) on Left branches",
    );
    test.todo(
      "does not disturb Right branches when chaining Either.flatMapLeft(flatMapHelpers.syncLeftBinder).flatMapLeft(flatMapHelpers.asyncLeftBinder)",
    );
    test.todo(
      "allows Either.flatMapLeft(flatMapHelpers.syncLeftBinder).flatMapRight(flatMapHelpers.syncRightBinder) permutations",
    );
    test.todo(
      "supports Either.flatMapLeft(flatMapHelpers.asyncLeftBinder).flatMapRight(flatMapHelpers.asyncRightBinder) permutations",
    );
  });
});
