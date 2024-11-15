import * as assert from "node:assert";
import { describe, it, mock } from "node:test";
import { Option, Result, matchOpt, matchRes } from "@/index.js";

describe("match Result", () => {
  it("should run Ok handler on Ok values", () => {
    const spyFn = mock.fn((val: number) => val);
    const r = Result.Ok(33);

    const matched = matchRes(r, {
      Ok: spyFn,
      Err: (_v) => 13,
    });

    assert.strictEqual(matched, 33);
    assert.deepEqual(spyFn.mock.callCount(), 1);
    assert.deepEqual(spyFn.mock.calls[0]?.arguments?.[0], 33);
    assert.strictEqual(spyFn.mock.callCount(), 1);
    assert.strictEqual(spyFn.mock.calls[0]?.arguments?.[0], 33);
  });

  it("should run Err handler on Err values", () => {
    const spyFn = mock.fn((val: number) => val);
    const r = Result.Err(42);

    const matched = matchRes(r, {
      Err: spyFn,
      Ok: (_v) => 13,
    });

    assert.strictEqual(matched, 42);
    assert.strictEqual(spyFn.mock.callCount(), 1);
    assert.strictEqual(spyFn.mock.calls[0]?.arguments?.[0], 42);
  });
});

describe("match Option", () => {
  it("should run Some handler on filled Option", () => {
    const spyFn = mock.fn((val: number) => val);
    const opt = Option.Some(33);

    const matched = matchOpt(opt, {
      Some: spyFn,
      None: () => 13,
    });

    assert.strictEqual(matched, 33);
    assert.strictEqual(spyFn.mock.callCount(), 1);
    assert.strictEqual(spyFn.mock.calls[0]?.arguments?.[0], 33);
  });

  it("should run None handler on empty Option", () => {
    const spyFn = mock.fn(() => 42);
    const opt = Option.None;

    const matched = matchOpt(opt, {
      None: spyFn,
      Some: () => 13,
    });

    assert.strictEqual(matched, 42);
    assert.strictEqual(spyFn.mock.callCount(), 1);
  });
});
