import { Option, Result, matchOpt, matchRes } from "../lib";

describe("match Result", () => {
	it("should run Ok handler on Ok values", () => {
		const spyFn = jest.fn((val: number) => val);
		const r = Result.Ok(33);

		const matched = matchRes(r, {
			Ok: spyFn,
			Err: (_v) => 13,
		});

		expect(matched).toBe(33);
		expect(spyFn).toHaveBeenCalledTimes(1);
		expect(spyFn).toHaveBeenCalledWith(33);
	});

	it("should run Err handler on Err values", () => {
		const spyFn = jest.fn((val: number) => val);
		const r = Result.Err(42);

		const matched = matchRes(r, {
			Err: spyFn,
			Ok: (_v) => 13,
		});

		expect(matched).toBe(42);
		expect(spyFn).toHaveBeenCalledTimes(1);
		expect(spyFn).toHaveBeenCalledWith(42);
	});
});

describe("match Option", () => {
	it("should run Some handler on filled Option", () => {
		const spyFn = jest.fn((val: number) => val);
		const opt = Option.Some(33);

		const matched = matchOpt(opt, {
			Some: spyFn,
			None: () => 13,
		});

		expect(matched).toBe(33);
		expect(spyFn).toHaveBeenCalledTimes(1);
		expect(spyFn).toHaveBeenCalledWith(33);
	});

	it("should run None handler on empty Option", () => {
		const spyFn = jest.fn(() => 42);
		const opt = Option.None;

		const matched = matchOpt(opt, {
			None: spyFn,
			Some: () => 13,
		});

		expect(matched).toBe(42);
		expect(spyFn).toHaveBeenCalledTimes(1);
		expect(spyFn).toHaveBeenCalledWith();
	});
});
