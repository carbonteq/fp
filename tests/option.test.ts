import * as assert from "node:assert";
import { describe, it } from "node:test";
import { Option, UnwrappedNone } from "@/option.js";

describe("option construction", () => {
  it("should construct Some opt", () => {
    const opt = Option.Some(123456);

    assert.ok(opt !== undefined);
  });

  it("should construct None opt", () => {
    const opt = Option.None;

    assert.ok(opt !== undefined);
  });
});

describe("option unwrapping", () => {
  it("should return value for Some", () => {
    const opt = Option.Some(123456);

    assert.ok(opt !== undefined);
  });

  it("should throw UnwrappedNone on None", () => {
    const opt = Option.None;

    assert.throws(() => opt.unwrap(), UnwrappedNone);
  });
});
