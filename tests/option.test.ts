import { Option, UnwrappedNone } from "@carbonteq/fp";

describe("option construction", () => {
	it("should construct Some opt", () => {
		const opt = Option.Some(123456);

		expect(opt).toBeDefined();
	});

	it("should construct None opt", () => {
		const opt = Option.None;

		expect(opt).toBeDefined();
	});
});

describe("option unwrapping", () => {
	it("should return value for Some", () => {
		const opt = Option.Some(123456);

		expect(opt).toBeDefined();
	});

	it("should throw UnwrappedNone on None", () => {
		const opt = Option.None;

		expect(() => opt.unwrap()).toThrowError(UnwrappedNone);
	});
});
