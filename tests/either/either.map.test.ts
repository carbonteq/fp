import { describe, test } from "bun:test";
import { Either } from "@/either.js";

const mapHelpers = {
  syncRightMapper: (_value: unknown) => "right-mapped" as const,
  asyncRightMapper: async (_value: unknown) => "right-mapped" as const,
  syncLeftMapper: (_value: unknown) => "left-mapped" as const,
  asyncLeftMapper: async (_value: unknown) => "left-mapped" as const,
  rightSeed: () => "right-seed" as const,
  leftSeed: () => "left-seed" as const,
};

describe("Either.mapRight behavior", () => {
  describe("sync mappers", () => {
    test.todo("maps Right values with mapHelpers.syncRightMapper");
    test.todo("short-circuits Left values before mapHelpers.syncRightMapper");
  });

  describe("async mappers", () => {
    test.todo("maps Right values with mapHelpers.asyncRightMapper");
    test.todo("short-circuits Left values before mapHelpers.asyncRightMapper");
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.mapRight(mapHelpers.asyncRightMapper).mapRight(mapHelpers.syncRightMapper) on Right branches",
    );
    test.todo(
      "short-circuits Either.mapRight(mapHelpers.asyncRightMapper).mapRight(mapHelpers.syncRightMapper) on Left branches",
    );
    test.todo(
      "supports chaining Either.mapRight(mapHelpers.syncRightMapper).mapLeft(mapHelpers.syncLeftMapper) without mutating the original Either",
    );
    test.todo(
      "propagates Left across Either.mapRight(mapHelpers.asyncRightMapper).mapLeft(mapHelpers.asyncLeftMapper) flows",
    );
  });
});

describe("Either.mapLeft behavior", () => {
  describe("sync mappers", () => {
    test.todo("maps Left values with mapHelpers.syncLeftMapper");
    test.todo("preserves Right values when mapHelpers.syncLeftMapper is used");
  });

  describe("async mappers", () => {
    test.todo("maps Left values with mapHelpers.asyncLeftMapper");
    test.todo("preserves Right values when mapHelpers.asyncLeftMapper is used");
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.mapLeft(mapHelpers.asyncLeftMapper).mapLeft(mapHelpers.syncLeftMapper) on Left branches",
    );
    test.todo(
      "does not remap Right branches when chaining Either.mapLeft(mapHelpers.syncLeftMapper).mapLeft(mapHelpers.asyncLeftMapper)",
    );
    test.todo(
      "allows Either.mapLeft(mapHelpers.syncLeftMapper).mapRight(mapHelpers.syncRightMapper) permutations",
    );
    test.todo(
      "supports Either.mapLeft(mapHelpers.asyncLeftMapper).mapRight(mapHelpers.asyncRightMapper) permutations",
    );
  });
});
