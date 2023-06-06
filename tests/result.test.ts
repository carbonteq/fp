import { Result, UnwrappedErrWithOk, UnwrappedOkWithErr } from "@carbonteq/fp";

class DummyError extends Error {
	constructor() {
		super("dummyErr");
		this.name = "DummyError";
	}
}

describe("Result construction", () => {
	it("ok result", () => {
		const r = Result.Ok("dummy");

		expect(r.toString()).toBe("Result::Ok<dummy>");
	});

	it("err result", () => {
		const r = Result.Err(new DummyError());

		expect(r.toString()).toBe("Result::Err<DummyError: dummyErr>");
	});
});

describe("unwrapping value from result", () => {
	it("on Ok should be...ok", () => {
		const r = Result.Ok(42);

		expect(r.unwrap()).toBe(42);
	});

	it("on Err should throw an error", () => {
		const r = Result.Err(new DummyError());

		expect(() => r.unwrap()).toThrow(DummyError);
	});

	it("on non-Error Err val should throw UnwrappedOkWithErr", () => {
		const r = Result.Err(3);

		expect(() => r.unwrap()).toThrow(UnwrappedOkWithErr);
	});
});

describe("unwrapping error from result", () => {
	it("on Err should be...ok", () => {
		const r = Result.Err(42);

		expect(r.unwrapErr()).toBe(42);
	});

	it("on Ok should throw UnwrappedErrWithOk", () => {
		const r = Result.Ok(3);

		expect(() => r.unwrapErr()).toThrow(UnwrappedErrWithOk);
	});
});

describe("unwrapping value from result safetly", () => {
	it("on Ok should return a non null value", () => {
		const r = Result.Ok(42);

		expect(r.safeUnwrap()).toBe(42);
	});

	it("on Err should return null", () => {
		const r = Result.Err(new DummyError());

		expect(r.safeUnwrap()).toBe(null);
	});
});

describe("unwrapping err from result safetly", () => {
	it("on Err should return a non null value", () => {
		const r = Result.Err(42);

		expect(r.safeUnwrapErr()).toBe(42);
	});

	it("on Ok should return null", () => {
		const r = Result.Ok(91);

		expect(r.safeUnwrapErr()).toBe(null);
	});
});
