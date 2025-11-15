import { describe, test } from "bun:test";
import { Either } from "@/either.js";

const zipHelpers = {
  syncRightMapper: (_value: unknown) => ["zip-right"] as const,
  asyncRightMapper: async (_value: unknown) => ["zip-right"] as const,
  syncLeftMapper: (_value: unknown) => ["zip-left"] as const,
  asyncLeftMapper: async (_value: unknown) => ["zip-left"] as const,
  syncTupleMapper: (_value: unknown) => ["zip-tuple"] as const,
  asyncTupleMapper: async (_value: unknown) => ["zip-tuple"] as const,
  rightSeed: () => "right-seed" as const,
  leftSeed: () => "left-seed" as const,
};

describe("Either.zipRight behavior", () => {
  describe("sync mappers", () => {
    test.todo(
      "zips Right values with zipHelpers.syncRightMapper and zipHelpers.syncTupleMapper",
    );
    test.todo("short-circuits Left values before zipHelpers.syncRightMapper");
  });

  describe("async mappers", () => {
    test.todo(
      "zips Right values with zipHelpers.asyncRightMapper and zipHelpers.asyncTupleMapper",
    );
    test.todo("short-circuits Left values before zipHelpers.asyncRightMapper");
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.zipRight(zipHelpers.asyncRightMapper).zipRight(zipHelpers.syncTupleMapper) on Right branches",
    );
    test.todo(
      "short-circuits Either.zipRight(zipHelpers.asyncRightMapper).zipRight(zipHelpers.syncTupleMapper) on Left branches",
    );
    test.todo(
      "supports chaining Either.zipRight(zipHelpers.syncRightMapper).zipLeft(zipHelpers.syncLeftMapper) without mutating the original Either",
    );
    test.todo(
      "propagates Left across Either.zipRight(zipHelpers.asyncRightMapper).zipLeft(zipHelpers.asyncLeftMapper) flows",
    );
  });
});

describe("Either.zipLeft behavior", () => {
  describe("sync mappers", () => {
    test.todo("zips Left values with zipHelpers.syncLeftMapper");
    test.todo("preserves Right values when zipHelpers.syncLeftMapper is used");
  });

  describe("async mappers", () => {
    test.todo("zips Left values with zipHelpers.asyncLeftMapper");
    test.todo("preserves Right values when zipHelpers.asyncLeftMapper is used");
  });

  describe("mixed chaining permutations", () => {
    test.todo(
      "supports Either.zipLeft(zipHelpers.asyncLeftMapper).zipLeft(zipHelpers.syncLeftMapper) on Left branches",
    );
    test.todo(
      "does not remap Right branches when chaining Either.zipLeft(zipHelpers.syncLeftMapper).zipLeft(zipHelpers.asyncLeftMapper)",
    );
    test.todo(
      "allows Either.zipLeft(zipHelpers.syncLeftMapper).zipRight(zipHelpers.syncRightMapper) permutations",
    );
    test.todo(
      "supports Either.zipLeft(zipHelpers.asyncLeftMapper).zipRight(zipHelpers.asyncRightMapper) permutations",
    );
  });
});
