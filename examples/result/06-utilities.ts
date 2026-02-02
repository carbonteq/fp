import { Result } from "../../dist/result.mjs";

const checkPermissions = (userId: string) =>
  Result.Ok(userId).zipErr((id) =>
    id === "guest"
      ? Result.Err("Guest users have limited access")
      : Result.Ok(undefined),
  );

const admin = checkPermissions("admin-123");
const guest = checkPermissions("guest");
console.log("zipErr ok:", admin.unwrap());
console.log("zipErr err:", guest.unwrapErr());

const logged = Result.Ok(10)
  .tap((value) => console.log("tap:", value))
  .map((value) => value + 1)
  .tapErr((error) => console.error("tapErr:", error));

console.log("tap result:", logged.unwrap());

const fallback = Result.Err("Not in cache").orElse(() => Result.Ok("API data"));
console.log("orElse:", fallback.unwrap());

const first = Result.any(
  Result.Err("Error 1"),
  Result.Ok("First success"),
  Result.Ok("Second success"),
);
console.log("any:", first.unwrap());

const flipped = Result.Ok("Success value").flip();
console.log("flip:", flipped.unwrapErr());

const asOption = Result.Ok(42).toOption();
console.log("toOption:", asOption.unwrap());
