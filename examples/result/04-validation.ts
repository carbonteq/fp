import { Result } from "../../dist/result.mjs";

const hasMinimumLength = (password: string): Result<boolean, Error> =>
  password.length < 8
    ? Result.Err(new Error("Password must be at least 8 characters"))
    : Result.Ok(true);

const hasSpecialCharacters = (password: string): Result<boolean, Error> => {
  const specialCharsRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/;
  return !specialCharsRegex.test(password)
    ? Result.Err(
        new Error("Password must contain at least one special character"),
      )
    : Result.Ok(true);
};

const isNotSameAsPrevious = async (
  password: string,
): Promise<Result<boolean, Error>> => {
  await Promise.resolve();
  return password === "password123!"
    ? Result.Err(
        new Error("New password cannot be the same as previous password"),
      )
    : Result.Ok(true);
};

const validated = Result.Ok("password321!").validate([
  hasMinimumLength,
  hasSpecialCharacters,
]);
console.log("validate ok:", validated.unwrap());

const validatedErrs = await Result.Ok("password123!")
  .validate([hasMinimumLength, hasSpecialCharacters, isNotSameAsPrevious])
  .toPromise();
console.log("validate errs:", validatedErrs.unwrapErr().length);

const user = Result.Ok("USER_ID");
const posts = user.map((id) => ({ id, title: "Hello" }));
const likes = user.map((id) => ({ id, count: 3 }));

const aggregated = Result.all(user, posts, likes);
console.log("all:", aggregated.unwrap());
