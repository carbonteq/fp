import { afterEach, describe, expect, it, mock } from "bun:test";
import { Result } from "@/result.hybrid";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

afterEach(() => {
  Result.resetErrorMapper();
});

describe("Hybrid Result.all", () => {
  it("combines synchronous Ok results", () => {
    const combined = Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3));

    expect(combined.unwrap()).toEqual([1, 2, 3]);
  });

  it("returns Err when any result fails", () => {
    const err = new DummyError();
    const combined = Result.all(Result.Ok(1), Result.Err(err), Result.Ok(3));

    expect(combined.unwrapErr()).toEqual([err]);
  });

  it("handles async participants without rejecting", async () => {
    const err = new DummyError();
    const combined = Result.all(
      Result.Ok(1),
      Result.Ok(Promise.resolve(2)),
      Result.Err(err),
    );

    const settled = combined.unwrap();
    expect(settled).toBeInstanceOf(Promise);

    expect(settled).rejects.toThrow();

    const aggregated = await combined.toPromise();
    expect(aggregated.isErr()).toBeTrue();
    expect(aggregated.unwrapErr()).toEqual([err]);
  });

  it("combines mixed sync and async Ok results", async () => {
    const combined = Result.all(
      Result.Ok(1),
      Result.Ok(Promise.resolve(2)),
      Result.Ok(3),
    );

    const awaited = await combined.toPromise();
    expect(awaited.isOk()).toBeTrue();
    expect(awaited.unwrap()).toEqual([1, 2, 3]);
  });

  it("aggregates errors from sync and async participants", async () => {
    const err1 = new DummyError("sync");
    const err2 = new DummyError("async");
    const combined = Result.all(
      Result.Err(err1),
      Result.Ok(1),
      Result.Err(Promise.resolve(err2)),
    );

    const awaited = await combined.toPromise();
    expect(awaited.isErr()).toBeTrue();
    expect(awaited.unwrapErr()).toEqual([err1, err2]);
  });

  it("maps rejected Ok promises through the global error mapper", async () => {
    Result.setErrorMapper((error) => new DummyError(String(error)));

    const combined = Result.all(
      Result.Ok(1),
      Result.Ok(Promise.reject("explode")),
    );

    const awaited = await combined.toPromise();
    expect(awaited.isErr()).toBeTrue();
    const errors = awaited.unwrapErr();
    expect(Array.isArray(errors)).toBeTrue();
    const errorArray = errors as unknown[];
    const mapped = errorArray[0];
    expect(mapped).toBeInstanceOf(DummyError);
    expect((mapped as DummyError).message).toBe("explode");
  });
});

describe("Hybrid Result.validate", () => {
  const valueValidator = (value: number) =>
    value > 0 ? Result.Ok(value) : Result.Err("invalid");

  const asyncValidator = async (value: number) =>
    value % 2 === 0 ? Result.Ok(value) : Result.Err("odd");

  it("returns original value when all validators pass", async () => {
    const res = Result.Ok(10).validate([valueValidator, asyncValidator]);

    const awaited = await res.toPromise();
    expect(awaited.unwrap()).toBe(10);
  });

  it("collects validation errors", async () => {
    const res = Result.Ok(-5).validate([valueValidator, asyncValidator]);

    const awaited = await res.toPromise();
    expect(awaited.isErr()).toBeTrue();
    expect(awaited.unwrapErr()).toEqual(["invalid", "odd"]);
  });

  it("collects errors from mixed sync and async validators", async () => {
    const res = Result.Ok(3).validate([
      () => Result.Err("too-small"),
      async () => Result.Err("odd"),
    ]);

    const awaited = await res.toPromise();
    expect(awaited.isErr()).toBeTrue();
    expect(awaited.unwrapErr()).toEqual(["too-small", "odd"]);
  });

  it("maps thrown validator errors through the global mapper", () => {
    Result.setErrorMapper((error) => new DummyError(String(error)));

    const res = Result.Ok(10).validate([
      () => {
        throw "boom";
      },
    ]);

    expect(res.isErr()).toBeTrue();
    const errors = res.unwrapErr();
    expect(errors).toBeArray();
    const errorArray = errors as unknown[];
    const mapped = errorArray[0];
    expect(mapped).toBeInstanceOf(DummyError);
    expect((mapped as DummyError).message).toBe("boom");
  });

  it("short-circuits when the base result is Err", () => {
    const validator = mock(() => Result.Ok(null));
    const err = new DummyError();
    const res = Result.Err(err).validate([validator]);

    expect(validator).not.toHaveBeenCalled();
    expect(res.unwrapErr()).toBe(err);
  });
});
