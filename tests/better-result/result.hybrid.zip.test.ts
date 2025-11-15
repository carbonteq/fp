import { afterEach, describe, expect, it } from "bun:test";
import { Result } from "@/result.hybrid";
import { expectSyncValue } from "../testUtils";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

const double = (n: number) => n * 2;
const asyncDouble = async (n: number) => n * 2;

afterEach(() => {
  Result.resetErrorMapper();
});

describe("Hybrid Result.zip", () => {
  it("zips synchronous mapper output", () => {
    const r = Result.Ok(2);
    const zipped = r.zip(double);

    expect(zipped.unwrap()).toEqual([2, 4]);
  });

  it("promotes to async when mapper returns a promise", async () => {
    const r = Result.Ok(2);
    const zipped = r.zip(asyncDouble);

    const value = zipped.unwrap();
    expect(value).toBeInstanceOf(Promise);
    expect(await value).toEqual([2, 4]);
  });

  it("propagates Err without invoking mapper", () => {
    const err = new DummyError();
    const r = Result.Err(err);
    const zipped = r.zip(double);

    const unwrapped = expectSyncValue(zipped.unwrapErr());
    expect(unwrapped).toBe(err);
  });

  it("maps mapper errors through the global error mapper", () => {
    Result.setErrorMapper((error) => new DummyError(String(error)));

    const zipped = Result.Ok<number, DummyError>(10).zip(() => {
      throw "boom";
    });

    expect(zipped.isErr()).toBeTrue();
    const mapped = expectSyncValue(zipped.unwrapErr());
    expect(mapped).toBeInstanceOf(DummyError);
    expect(mapped.message).toBe("boom");
  });
});

describe("Hybrid Result.flatZip", () => {
  it("combines synchronous mapper Result", () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip((n) => Result.Ok(n * 3));

    expect(zipped.unwrap()).toEqual([2, 6]);
  });

  it("promotes to async when mapper returns async Result", async () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip(async (n) => Result.Ok(n * 3));

    const value = zipped.unwrap();
    expect(value).toBeInstanceOf(Promise);
    expect(await value).toEqual([2, 6]);
  });

  it("propagates mapper Err", () => {
    const r = Result.Ok(2);
    const zipped = r.flatZip(() => Result.Err(new DummyError()));

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.unwrapErr()).toBeInstanceOf(DummyError);
  });

  it("maps mapper throws through the error mapper", () => {
    Result.setErrorMapper(() => new DummyError("mapped"));

    const zipped = Result.Ok<number, DummyError>(5).flatZip(() => {
      throw "fail";
    });

    expect(zipped.isErr()).toBeTrue();
    const mapped = zipped.unwrapErr();
    expect(mapped).toBeInstanceOf(DummyError);
    expect((mapped as DummyError).message).toBe("mapped");
  });
});

describe("Hybrid Result.zipErr", () => {
  it("preserves the original Ok payload when mapper succeeds", () => {
    const base = Result.Ok(7);
    const zipped = base.zipErr(() => Result.Ok("ignored"));

    expect(zipped.unwrap()).toBe(7);
  });

  it("propagates mapper errors while discarding mapper Ok payload", () => {
    const base = Result.Ok(7);
    const zipped = base.zipErr(() => Result.Err("bad"));

    expect(zipped.isErr()).toBeTrue();
    expect(zipped.unwrapErr()).toEqual("bad");
  });

  it("promotes to async when mapper returns an async Result", async () => {
    const base = Result.Ok(9);
    const zipped = base.zipErr(async () => Result.Err("oops"));

    const awaited = await zipped.toPromise();
    expect(awaited.isErr()).toBeTrue();
    expect(awaited.unwrapErr()).toEqual("oops");
  });

  it("does not invoke mapper when base result is Err", () => {
    const err = new DummyError();
    const base = Result.Err(err);
    const zipped = base.zipErr(() => {
      throw new Error("should not run");
    });

    expect(zipped.unwrapErr()).toBe(err);
  });

  it("maps thrown mapper errors through the global error mapper", () => {
    Result.setErrorMapper((error) => new DummyError(String(error)));

    const zipped = Result.Ok(3).zipErr(() => {
      throw "zip-err";
    });

    expect(zipped.isErr()).toBeTrue();
    const mapped = zipped.unwrapErr();
    expect(mapped).toBeInstanceOf(DummyError);
    expect((mapped as DummyError).message).toBe("zip-err");
  });
});
