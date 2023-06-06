import { Result } from "./result";
import { Option } from "./option";

export const matchRes = <T, E, U>(
	r: Result<T, E>,
	branches: { Ok: (val: T) => U; Err: (err: E) => U },
): U => {
	if (r.isOk()) {
		return branches.Ok(r.unwrap());
	} else {
		return branches.Err(r.unwrapErr());
	}
};

export const matchOpt = <T, U>(
	o: Option<T>,
	branches: { Some: (val: T) => U; None: () => U },
): U => {
	if (o.isSome()) {
		return branches.Some(o.unwrap());
	} else {
		return branches.None();
	}
};
