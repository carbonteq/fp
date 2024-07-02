import type { Option } from "./option";
import type { Result } from "./result";

export const matchRes = <T, E, U>(
	r: Result<T, E>,
	branches: { Ok: (val: T) => U; Err: (err: E) => U },
): U => {
	if (r.isOk()) {
		return branches.Ok(r.unwrap());
	}
	return branches.Err(r.unwrapErr());
};

export const matchOpt = <T, U>(
	o: Option<T>,
	branches: { Some: (val: T) => U; None: () => U },
): U => {
	if (o.isSome()) {
		return branches.Some(o.unwrap());
	}
	return branches.None();
};
