import { describe, expect, it } from "bun:test";
import {
  ExperimentalResult as Result,
  UnwrappedErrWithOk,
  UnwrappedOkWithErr,
} from "@/result.hybrid";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

describe("Hybrid Result construction", () => {
  it("creates an Ok result synchronously", () => {
    const r = Result.Ok(42);

    expect(r.unwrap()).toBe(42);
    expect(r.isOk()).toBeTrue();
    expect(r.isErr()).toBeFalse();
  });

  it("creates an Err result synchronously", () => {
    const r = Result.Err(new DummyError());

    expect(() => r.unwrap()).toThrow(UnwrappedOkWithErr);
    expect(r.unwrapErr()).toBeInstanceOf(DummyError);
    expect(r.isOk()).toBeFalse();
    expect(r.isErr()).toBeTrue();
  });

  it("wraps async Ok values and exposes them via promises", async () => {
    const r = Result.Ok(Promise.resolve(21));

    const asyncValue = r.unwrap();
    expect(asyncValue).toBeInstanceOf(Promise);
    expect(await asyncValue).toBe(21);
  });

  it("wraps async Err values and exposes them via promises", async () => {
    const err = new DummyError();
    const r = Result.Err(Promise.resolve(err));

    const asyncErr = r.unwrapErr();
    expect(asyncErr).toBeInstanceOf(Promise);
    expect(r.unwrap()).rejects.toThrow(UnwrappedOkWithErr);
    expect(await asyncErr).toBe(err);
  });
});

describe("Hybrid Result unwrapping behaviour", () => {
  it("throws UnwrappedOkWithErr when unwrapping Err synchronously", () => {
    const r = Result.Err("boom");

    expect(() => r.unwrap()).toThrow(UnwrappedOkWithErr);
  });

  it("throws UnwrappedErrWithOk when unwrapping Ok error synchronously", () => {
    const r = Result.Ok("ok");

    expect(() => r.unwrapErr()).toThrow(UnwrappedErrWithOk);
  });

  it("safeUnwrap returns null for Err", () => {
    const r = Result.Err(new DummyError());

    expect(r.safeUnwrap()).toBeNull();
  });

  it("toPromise resolves to a settled Result", async () => {
    const r = Result.Ok(Promise.resolve(10));
    const settled = await r.toPromise();

    expect(settled.unwrap()).toBe(10);
  });

  it("toPromise preserves Err state", async () => {
    const err = new DummyError();
    const r = Result.Err(Promise.resolve(err));
    const settled = await r.toPromise();

    expect(settled.unwrapErr()).toBe(err);
  });
});
