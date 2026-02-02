import { Result } from "../../dist/result.mjs";

type User = { name: string; age: number };

const doubled = Result.Ok(3).map((value) => value * 2);
console.log("map:", doubled.unwrap());

const validateUserData = (name: string, age: number): Result<User, Error> => {
  if (name.trim() === "") {
    return Result.Err(new Error("Name cannot be empty"));
  }
  if (age < 0 || age > 120) {
    return Result.Err(new Error("Age must be between 0 and 120"));
  }
  return Result.Ok({ name, age });
};

const saveUserData = async (user: User): Promise<Result<string, Error>> => {
  await Promise.resolve(user);
  return Result.Ok(`User ${user.name} saved successfully!`);
};

const processUser = async (
  name: string,
  age: number,
): Promise<Result<string, Error>> => {
  return await validateUserData(name, age).flatMap(saveUserData).toPromise();
};

const result = await processUser("Alice", 30);
console.log("flatMap ok:", result.unwrap());

const invalid = await processUser("", 30);
console.log("flatMap err:", invalid.unwrapErr().message);
