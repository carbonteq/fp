import { Option } from "../../dist/option.mjs";

const doubled = Option.Some(3).map((value) => value * 2);
console.log("map:", doubled.unwrap());

const fetchUserBalanceFromDatabase = async (
  userId: string,
): Promise<Option<number>> => {
  await Promise.resolve(userId);
  return Option.Some(100);
};

const applyBonus = async (): Promise<Option<number>> => {
  return await Option.Some("user123")
    .flatMap(fetchUserBalanceFromDatabase)
    .map((balance) => balance * 1.1)
    .toPromise();
};

const result = await applyBonus();
console.log("flatMap:", result.unwrap());

const findUserById = async (id: number): Promise<Option<number>> => {
  await Promise.resolve(id);
  return id === 0 ? Option.None : Option.Some(id);
};

const safeFindUserById = async (id: number): Promise<string> => {
  const res = (await findUserById(id)).mapOr(
    "User not found",
    (value) => `User: ${value}`,
  );
  return res;
};

console.log("mapOr:", await safeFindUserById(10));
