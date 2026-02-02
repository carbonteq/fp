import { Result } from "../../dist/result.mjs";

const getConfig = (key: string): string | undefined =>
  key === "API_KEY" ? "secret" : undefined;

const config = Result.fromNullable(getConfig("API_KEY"), "API_KEY not set");
console.log("fromNullable:", config.unwrap());

const passed = Result.fromPredicate(
  85,
  (score) => score >= 60,
  "Score too low",
);
console.log("fromPredicate ok:", passed.unwrap());

const parseJson = (json: string): Result<unknown, Error> =>
  Result.tryCatch(
    () => JSON.parse(json),
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );

console.log("tryCatch:", parseJson('{"name":"Alice"}').unwrap());

const fetchUserData = (id: string): Result<Promise<{ name: string }>, Error> =>
  Result.tryAsyncCatch(
    async () => {
      await Promise.resolve(id);
      return { name: "Test User" };
    },
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );

const asyncResult = await fetchUserData("123").unwrap();
console.log("tryAsyncCatch:", asyncResult.name);
