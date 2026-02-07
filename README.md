# Carbonteq Functional Programming Utilities (fp)

## Description

`fp` is a lightweight TypeScript library designed to simplify functional programming by providing essential types like `Option` and `Result`. It helps developers handle errors, manage optional values, and write expressive, composable code.

## Installation

```sh
npm i @carbonteq/fp
```

```sh
pnpm i @carbonteq/fp
```

```sh
yarn add @carbonteq/fp
```

```sh
bun add @carbonteq/fp
```

## But why fp?

In JavaScript and TypeScript, dealing with `null`, `undefined`, and errors can lead to verbose, error-prone code. `fp` introduces functional paradigms that make handling these cases cleaner and more reliable. By leveraging `fp`, you can reduce boilerplate, improve readability, and create more maintainable applications.

To demonstrate the utility of `fp`, let us consider a use case where we need to retrieve a user's email and address.

## Without using the `fp` library

```typescript
function getUserByEmail(user: { email?: string }): string | null {
  return user.email ? user.email : null;
}

function getUserAdress(user: { email?: string }): string | null {
  return user.email ? "Some Address" : null;
}

const email = getUserByEmail({ email: "test@test.com" });
if (email) {
  const address = getUserAdress(email);
  if (address) {
    console.log(`User ${email} has address: ${address}`);
  } else {
    console.error("Address not found");
  }
} else {
  console.error("Email not found");
}
// Output: User test@test.com has address: Some Address
```

Now imagine if we had more complex use cases that involved more than two optional values. We would have to nest if statements and handle errors manually. This is where `fp` comes in.

### With using the `fp` library

```typescript
import { Option, matchOpt } from "@carbonteq/fp";

function getUserByEmail(user: { email?: string }): Option<string> {
  return user.email ? Option.Some(user.email) : Option.None;
}

function getUserAddress(email: string): Option<string> {
  return Option.Some("Some Address");
}

const res = getUserByEmail({ email: "test@test.com" }).flatZip((email) =>
  getUserAddress(email),
);

matchOpt(res, {
  Some: (res) => {
    console.log(`User ${res[0]} has address: ${res[1]}`);
  },
  None: () => {
    console.error("User or Address not found");
  },
});
// Output: User test@test.com has address: Some Address
```

## Table of Contents

- [Examples](#examples)
- [Usage](#usage)
  - [The `Result` type](#the-result-type)
  - [The `Option` type](#the-option-type)
  - [The `ExperimentalResult` type (Experimental)](#the-experimentalresult-type-experimental)
  - [The `ExperimentalOption` type (Experimental)](#the-experimentaloption-type-experimental)
  - [The `Flow` namespace (Experimental)](#the-flow-namespace-experimental)
  - [Cheatsheet](#cheatsheet)
    - [map](#map)
    - [flatMap](#flatmap)
    - [zip](#zip)
    - [flatZip](#flatzip)
    - [Comparison of map and zip](#comparison-of-map-flatmap-zip-and-flatzip)
    - [Some Other Useful Functions](#some-other-useful-functions)
    - [Creating Values from Existing Data](#creating-values-from-existing-data)
    - [Exception Handling](#exception-handling)
    - [Transforming Inner Values](#transforming-inner-values)
    - [Combining & Converting](#combining--converting)
    - [Error Recovery & Side Effects](#error-recovery--side-effects)
    - [Aggregation Helpers](#aggregation-helpers)
- [Build Your First Pipeline](#build-your-first-pipeline)
  - [Synchronous Pipeline](#synchronous-pipeline)
  - [Asynchronous Pipeline](#asynchronous-pipeline)

## Examples

Examples are split between stable and experimental APIs.

- Stable `Result` and `Option` runnable examples live under `examples/result/` and `examples/option/`.
- Experimental `ExperimentalResult`, `ExperimentalOption`, and `Flow` examples live under `examples/` and are clearly marked as experimental.

See `examples/README.md` for the runnable index and file paths.

## Usage

## The `Result` type

`Result` represents a value that can be either a success (`Ok`) or a failure (`Err`). It simplifies error handling by making success and failure explicit.

```typescript
import { Result } from "@carbonteq/fp";

const res1: Result<number, string> = Result.Ok(5); // Contains the value 5
const res2: Result<number, string> = Result.Err("Some Error"); // Contains the error "Some Error"
```

Async variants

In the stable API, async mappers/binders are allowed on the same methods. The async work stays inside the Result, so the return type is `Result<Promise<T>, E>`. Use `toPromise()` when you need `Promise<Result<T, E>>`.

```typescript
// Sync
Result.Ok(5).map((x) => x * 2); // Result<number, never>
Result.Ok(5).flatMap((x) => Result.Ok(x * 2));

// Async (stable)
const mapped = Result.Ok(5).map(async (x) => x * 2); // Result<Promise<number>, never>
const chained = Result.Ok(5).flatMap(async (x) => Result.Ok(x * 2)); // Result<Promise<number>, never>
const resolved = await chained.toPromise(); // Promise<Result<number, never>>
```

## The `Option` type

The `Option` type represents a value that might or might not be present. It eliminates the need for manual checks for `null` or `undefined`.

```typescript
import { Option } from "@carbonteq/fp";

const opt1: Option<number> = Option.Some(5); // Contains the value 5
const opt2: Option<number> = Option.None; // Contains no value (None)
```

Async variants

In the stable API, async mappers/predicates are allowed on the same methods. The async work stays inside the Option, so the return type is `Option<Promise<T>>`. Use `toPromise()` when you need `Promise<Option<T>>`.

```typescript
// Sync
Option.Some(5).map((x) => x * 2); // Option<number>
Option.Some(5).flatMap((x) => Option.Some(x * 2));

// Async (stable)
const mapped = Option.Some(5).map(async (x) => x * 2); // Option<Promise<number>>
const chained = Option.Some(5).flatMap(async (x) => Option.Some(x * 2)); // Option<Promise<number>>
const filtered = Option.Some(5).filter(async (x) => x > 3); // Option<Promise<number>>
const resolved = await filtered.toPromise(); // Promise<Option<number>>
```

---

## The `ExperimentalResult` type (Experimental)

`ExperimentalResult` differs from the stable `Result` by providing explicit async methods like `mapAsync` and `flatMapAsync` that return `Promise<ExperimentalResult<T, E>>` directly, rather than returning `Result<Promise<T>, E>` and requiring `toPromise()`. It also includes generator-based APIs (`gen`, `asyncGen`, and adapter variants) used by `Flow`.

```typescript
import { ExperimentalResult } from "@carbonteq/fp";
```

## The `ExperimentalOption` type (Experimental)

`ExperimentalOption` mirrors the stable `Option` API but provides explicit async methods like `mapAsync`, `flatMapAsync`, and `filterAsync` that return `Promise<ExperimentalOption<T>>` rather than `Option<Promise<T>>`. It also includes generator-based APIs (`gen`, `asyncGen`, and adapter variants) and is the `Option` type used by `Flow`.

```typescript
import { ExperimentalOption } from "@carbonteq/fp";
```

---

## The `Flow` namespace (Experimental)

`Flow` is experimental and works with `ExperimentalOption` and `ExperimentalResult`. It provides a unified generator interface for working with both types simultaneously. It allows you to yield both types in the same generator, automatically short-circuiting on `Option.None` or `Result.Err`.

The return type of a `Flow` generator is always an `ExperimentalResult<T, E | UnwrappedNone>`, where:

- `T` is the return value of the generator function.
- `E` is the union of all error types yielded from `Result`s.
- `UnwrappedNone` is included if any `Option`s were yielded (representing the case where `None` caused a short-circuit).

```typescript
import {
  Flow,
  ExperimentalOption as Option,
  ExperimentalResult as Result,
  UnwrappedNone,
} from "@carbonteq/fp";

// Basic usage mixing Option and Result
const result = Flow.gen(function* () {
  const a = yield* Option.Some(5); // Unwraps Option<number> -> number
  const b = yield* Result.Ok(10); // Unwraps Result<number, never> -> number

  // If this was None, the flow would stop and return Result.Err(new UnwrappedNone())
  const c = yield* Option.fromNullable(20);

  return a + b + c;
});

console.log(result.unwrap()); // 35
```

### Async Flow

`Flow.asyncGen` works similarly but allows awaiting promises and yielding async operations.

```typescript
const result = await Flow.asyncGen(async function* () {
  const user = yield* Option.Some({ id: 1 });

  // You can await async functions returning Result/Option before yielding
  const profile = yield* await fetchProfile(user.id);

  return profile;
});
```

### Adapter Variant (`genAdapter`)

For better type inference in complex chains, use `genAdapter` (or `asyncGenAdapter`). It provides an adapter function (`$`) to wrap yielded values.

```typescript
const result = Flow.genAdapter(function* ($) {
  const val1 = yield* $(Option.Some(10));
  const val2 = yield* $(Result.Ok(20));
  return val1 + val2;
});
```

---

## Cheatsheet

### `map`

Transforms the `Some` or `Ok` value inside `Option` or `Result`.

If your mapper is async, `map` returns `Option<Promise<U>>` or `Result<Promise<U>, E>`. Use `toPromise()` when you need a resolved `Option`/`Result`.

Let's say we want to apply a 10% bonus to the account balance of a user.

```typescript
import { Option } from "@carbonteq/fp";

async function fetchUserBalanceFromDatabase(
  userId: string,
): Promise<Option<number>> {
  // Simulate fetching balance from a database
  await Promise.resolve(userId);
  return Option.Some(100);
}

async function applyBonus() {
  const userId = "user123"; // Example user ID
  const balanceOption = await Option.Some(userId)
    .flatMap(fetchUserBalanceFromDatabase)
    .map((balance) => balance * 1.1)
    .toPromise(); // Apply a 10% bonus if balance exists
  return balanceOption;
}

console.log(await applyBonus()); // Output: Some(110)
```

#### `flatMap`

`flatMap` is used to chain operations where each step returns an `Option` or `Result`. It avoids nested structures like `Option<Option<T>>` or `Result<Result<T, E>, E>` by "flattening" them into a single level.

Let's say we want to validate user input and then save it to a database:

```typescript
import { Result } from "@carbonteq/fp";

// Function to validate user input
const validateUserData = (
  name: string,
  age: number,
): Result<{ name: string; age: number }, Error> => {
  if (name.trim() === "") {
    return Result.Err(new Error("Name cannot be empty"));
  }
  if (age < 0 || age > 120) {
    return Result.Err(new Error("Age must be between 0 and 120"));
  }
  return Result.Ok({ name, age });
};

// Simulated asynchronous task to save user data to a "database"
const saveUserData = async (user: {
  name: string;
  age: number;
}): Promise<Result<string, Error>> => {
  // Simulate saving to database
  await Promise.resolve(user);
  return Result.Ok(`User ${user.name} saved successfully!`);
};

// Chaining validation and save using `flatMap`
const processUser = async (
  name: string,
  age: number,
): Promise<Result<string, Error>> => {
  const validationResult = await validateUserData(name, age)
    .flatMap(saveUserData)
    .toPromise();
  return validationResult;
};

console.log(await processUser("Alice", 30)); // Output: Result.Ok("User Alice saved successfully!")

/* validationResult is of type Result<string, Error> instead of Result<Result<string, Error>, Error> (which is what would have happened if we used map instead of flatMap) */
```

#### `zip`

Creates a tuple `[T, U]` where the second value `U` is *derived* from the first value `T` using a function `f`.
For example, suppose we want to pair the product's original price `T` and discounted price `U`.

```typescript
import { Result } from "@carbonteq/fp";

async function fetchProductPrice(
  productId: string,
): Promise<Result<number, Error>> {
  // Simulate fetching price from a database
  await Promise.resolve(productId);
  return Result.Ok(100);
}

async function applyDiscount(
  productId: string,
): Promise<Result<[number, number], Error>> {
  const originalPrice = await Result.Ok(productId)
    .flatMap(fetchProductPrice)
    .zip((price) => price * 0.9)
    .toPromise();
  return originalPrice; //originalPrice is of type Result<[number, number], Error>
}

console.log(await applyDiscount("123")); // Output: Result.Ok([100, 90])
```

Here `derivedPair` is a `Result<[number, number], Error>`. Note that `T` = `100` and `U` = `90`.

#### `flatZip`

Combines the current `Result<T, E>` with a **dependent** `Result<U, E2>` produced from `T`, or the current `Option<T>` with a dependent `Option<U>` produced from `T`. Unlike `zip`, which pairs a value with a plain derived value, `flatZip` expects the callback to return a `Result`/`Option` and then flattens the outcome into `[T, U]`. It proceeds only when both steps are `Ok`/`Some`; otherwise, it propagates the first `Err`/`None`.

Lets say we want to combine the product price and product stock into a tuple `[number, number]`.

```typescript
import { Option } from "@carbonteq/fp";

// Simulated function to fetch product price
async function fetchProductPrice(productId: string): Promise<Option<number>> {
  // Simulate fetching price from a database
  await Promise.resolve(productId);
  return Option.Some(100);
}

// Simulated function to fetch product stock (receives price, returns Option)
async function fetchProductStock(price: number): Promise<Option<number>> {
  // Simulate fetching stock from a database based on price
  await Promise.resolve(price);
  return Option.Some(50);
}

// Function to combine price and stock using flatZip
async function fetchProductDetails(
  productId: string,
): Promise<Option<[number, number]>> {
  const productDetails = await Option.Some(productId)
    .flatMap(fetchProductPrice)
    .flatZip(fetchProductStock)
    .toPromise();
  return productDetails; // Option<[number, number]>
}

console.log(await fetchProductDetails("123")); // Output: Option.Some([100, 50])
```

## Comparison of `map`, `flatMap`, `zip`, and `flatZip`

| **Method**            | **`map`**                                                         | **`flatMap`**                                                                                                                       | **`zip`**                                                                                  | **`flatZip`**                                                                                                |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Purpose**           | Transforms the value inside an `Ok` or `Some`.                    | Chains dependent computations where each computation returns a `Result` or `Option`.                                                | Combines the current value with another derived value into a tuple `[T, U]`.               | Chains a dependent computation returning `Result`/`Option` and combines both values into `[T, U]`.          |
| **Input**             | A function `(val: T) => U`.                                       | A function `(val: T) => Result<U, E2>` or `(val: T) => Option<U>` to transform the current value into another `Result` or `Option`. | A function `(val: T) => U` to derive a new value `U` from the current value `T`.           | A function `(val: T) => Result<U, E2>` or `(val: T) => Option<U>` that returns another `Result` or `Option`. |
| **Output**            | `Result<U, E>`, `Option<U>`                                       | `Result<U, E>`, `Option<U>`                                                                                                         | `Result<[T, U], E>`, `Option<[T, U]>`                                                      | `Result<[T, U], E>`, `Option<[T, U]>`.                                                                       |
| **Error Propagation** | Propagates `Err`/`None` if the `Result`/`Option` is `Err`/`None`. | Propagates the first `Err`/`None` encountered in the chain.                                                                         | Propagates `Err`/`None` if the current `Result`/`Option` or derived value is `Err`/`None`. | Propagates the first `Err`/`None` encountered between the two `Result`/`Option` values.                      |
| **Use Case**          | When you want to transform a value inside `Ok`/`Some`.            | When the next computation depends on the current value and returns a `Result`/`Option`.                                             | When you want to pair the current value with a derived one.                                | When you want to pair the current value with a dependent `Result`/`Option` computation.                     |

---

### Some Other Useful Functions

#### `mapErr`

Transforms the `Err` value inside `Result`.

```typescript
import { Result } from "@carbonteq/fp";

// Simulated function to divide two numbers
function divideNumbers(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return Result.Err(new Error("Division by zero"));
  }
  return Result.Ok(a / b);
}

// A safe divide function that returns a Result with a string error message if the division by zero occurs, instead of throwing an exception
function safeDivide(a: number, b: number): Result<number, string> {
  const res = divideNumbers(a, b).mapErr(
    (err) => `Operation failed: ${err.message}`,
  );
  return res;
}

// Example usage
console.log(safeDivide(10, 2)); // Result.Ok(5)
console.log(safeDivide(10, 0)); // Result.Err("Operation failed: Division by zero")
```

#### `mapOr`

Checks if the `Option` or `Result` is `Some` or `Ok`, and if so, applies the function to the value inside. If the `Option` or `Result` is `None` or `Err`, it returns the default value.

```typescript
import { Option } from "@carbonteq/fp";

// Simulated function to find a user by id
async function findUserById(id: number): Promise<Option<number>> {
  // Simulate a database call that either returns a user or null
  await Promise.resolve(id);
  if (id === 0) {
    return Option.None;
  }
  return Option.Some(id);
}

// A safe function that returns a string message (not an Option) - mapOr returns the value directly
async function safeFindUserById(id: number): Promise<string> {
  const userOpt = await findUserById(id);
  return userOpt.mapOr(`User not found`, (res) => `User: ${res}`);
}

// Example usage
console.log(await safeFindUserById(10)); // User: 10
console.log(await safeFindUserById(0)); // User not found
```

#### `all`

`all` is used to combine an array of Results. If any errors exist they are accumulated, else the values are accumulated.

```typescript
import { Result, matchRes } from "@carbonteq/fp";

type User = {
  userId: string;
  userName: string;
  createdAt: Date | string;
};

type Post = {
  postId: string;
  likes: number;
  replies: number;
  createdAt: Date | string;
  author: User["userId"];
};

type Like = {
  likeId: string;
  postId: Post["postId"];
  createdAt: Date | string;
  likedBy: User["userId"];
};

type Reply = {
  replyId: string;
  postId: Post["postId"];
  createdAt: Date | string;
  author: User["userId"];
};

type Hash = string;

async function fetchUser(userId: string): Promise<Result<User, unknown>> {
  return Result.Ok({
    userId,
    userName: "Functional Programmer",
    createdAt: "2025-01-01",
  });
}

async function fetchPosts(userId: string): Promise<Result<Post[], string>> {
  if (userId === "TRIAL_USER") {
    return Result.Err("User has no posts!");
  }
  return Result.Ok([
    {
      postId: "1",
      likes: 12,
      replies: 3,
      createdAt: "2025-01-01",
      author: userId,
    },
  ]);
}

async function fetchLikes(userId: string): Promise<Result<Like[], unknown>> {
  return Result.Ok([
    { likeId: "3", postId: "2", createdAt: "2025-01-01", likedBy: userId },
  ]);
}

async function fetchReplies(userId: string): Promise<Result<Reply[], string>> {
  if (userId === "TRIAL_USER") {
    return Result.Err("User has no replies!");
  }
  return Result.Ok([
    {
      replyId: "1",
      postId: "2",
      data: "Nice post!",
      createdAt: "2025-01-01",
      author: userId,
    },
  ]);
}

function generateHash(userId: string): Result<Hash, Error> {
  return Result.Ok(`${userId}_HASH_VALUE`);
}

async function getUserData(userId: string) {
  const userIdRes = Result.Ok(userId);

  const user = userIdRes.flatMap(fetchUser);
  const posts = userIdRes.flatMap(fetchPosts);
  const likes = userIdRes.flatMap(fetchLikes);
  const replies = userIdRes.flatMap(fetchReplies);
  const hash = userIdRes.flatMap(generateHash);

  const userData = await Result.all(
    user,
    posts,
    likes,
    replies,
    hash,
  ).toPromise();

  matchRes(userData, {
    Ok(v) {
      console.log(v);
    },
    Err(e) {
      console.log(e);
    },
  });
}

await getUserData("USER_ID");

// [
//   {
//     userId: 'USER_ID',
//     userName: 'Functional Programmer',
//     createdAt: '2025-01-01'
//   },
//   [
//     {
//       postId: '1',
//       likes: 12,
//       replies: 3,
//       createdAt: '2025-01-01',
//       userId: 'USER_ID'
//     }
//   ],
//   [ { postId: '2', createdAt: '2025-01-01', userId: 'USER_ID' } ],
//   [
//     {
//       postId: '2',
//       data: 'Nice post!',
//       createdAt: '2025-01-01',
//       userId: 'USER_ID'
//     }
//   ],
//   'USER_ID_HASH_VALUE'
// ]

await getUserData("TRIAL_USER");

// [ 'User has no posts!', 'User has no replies!' ]
```

#### `validate`

Built on top of `all`, `validate` is used to execute an array of validator functions in parallel. If all validations pass, the original value is retained. If any validations fail, the errors are accumulated. Both synchronous and asynchronous computations are handled.

```typescript
import { Result } from "@carbonteq/fp";

function hasMinimumLength(password: string): Result<boolean, Error> {
  return password.length < 8
    ? Result.Err(new Error("Password must be at least 8 characters"))
    : Result.Ok(true);
}

function hasSpecialCharacters(password: string): Result<boolean, Error> {
  const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
  return !specialCharsRegex.test(password)
    ? Result.Err(
        new Error("Password must contain at least one special character"),
      )
    : Result.Ok(true);
}

// Asynchronous validation function - checks if password is different from previous
async function isNotSameAsPrevious(
  password: string,
): Promise<Result<boolean, Error>> {
  // Simulate checking against a database of user's previous passwords
  return new Promise<Result<boolean, Error>>((resolve) => {
    setTimeout(() => {
      // For demo purposes, we'll consider "password123!" as the previous password
      if (password === "password123!") {
        resolve(
          Result.Err(
            new Error("New password cannot be the same as previous password"),
          ),
        );
      } else {
        resolve(Result.Ok(true));
      }
    }, 200); // simulate network delay
  });
}

const validatedOk = Result.Ok("password321!").validate([
  hasMinimumLength,
  hasSpecialCharacters,
]);
console.log(validatedOk.unwrap()); // password321!

const validatedErr = Result.Ok("pword").validate([
  hasMinimumLength,
  hasSpecialCharacters,
]);
console.log(validatedErr.unwrapErr()); // [Error: Password must be at least 8 characters, Error: Password must contain at least one special character]

const validatedErrs = await Result.Ok("password123!")
  .validate([hasMinimumLength, hasSpecialCharacters, isNotSameAsPrevious])
  .toPromise();
console.log(validatedErrs.unwrapErr()); // [Error: New password cannot be the same as previous password]
```

#### `unwrap`, `safeUnwrapErr`, `unwrapOr`, `unwrapOrElse`, `safeUnwrap`, and `unwrapErr`

These functions are used to extract the value from a `Result`. Note that **only `unwrap` and `safeUnwrap` are available for `Option`**.

```typescript
import { Result } from "@carbonteq/fp";

function divideNumbers(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return Result.Err(new Error("Division by zero"));
  }
  return Result.Ok(a / b);
}

// Example usage of each function
let result = divideNumbers(10, 2);
console.log(result.unwrap()); // unwrap: 5 (Extracts the value from Result.Ok, throwing an error if it's Err.)

result = divideNumbers(10, 0);
console.log(result.safeUnwrap()); // safeUnwrap: null (Safely unwraps the value, returning null if it's an Err instead of throwing an error.)

const errorResult = Result.Err(new Error("Something went wrong"));
console.log(errorResult.unwrapErr()); // unwrapErr: Error: Something went wrong (Extracts the error from Result.Err, throwing an error if it's Ok)
```

---

### Creating Values from Existing Data

#### `Option.fromNullable`

Creates an `Option` from a value that might be `null` or `undefined`, returning `None` for those values.

```typescript
import { Option } from "@carbonteq/fp";

function findUser(id: string): { name: string } | null {
  return id === "1" ? { name: "Alice" } : null;
}

const user = Option.fromNullable(findUser("1"));
console.log(user); // Some({ name: "Alice" })

const missing = Option.fromNullable(findUser("999"));
console.log(missing); // None
```

#### `Option.fromFalsy`

Creates an `Option` from a value, returning `None` for any falsy value (`false`, `0`, `""`, `null`, `undefined`).

```typescript
import { Option } from "@carbonteq/fp";

const valid = Option.fromFalsy("hello");
console.log(valid); // Some("hello")

const empty = Option.fromFalsy("");
console.log(empty); // None

const zero = Option.fromFalsy(0);
console.log(zero); // None
```

#### `Option.fromPredicate`

Creates an `Option` based on a predicate function - returns `Some` if the predicate returns `true`, else `None`.

```typescript
import { Option } from "@carbonteq/fp";

const age = 25;
const adult = Option.fromPredicate(age, (a) => a >= 18);
console.log(adult); // Some(25)

const minor = Option.fromPredicate(15, (a) => a >= 18);
console.log(minor); // None
```

#### `Result.fromNullable`

Creates a `Result` from a nullable value, returning `Err` with the provided error for `null` or `undefined`.

```typescript
import { Result } from "@carbonteq/fp";

function getConfig(key: string): string | undefined {
  return process.env[key];
}

const config = Result.fromNullable(getConfig("API_KEY"), "API_KEY not set");
console.log(config); // Ok("...") or Err("API_KEY not set")
```

#### `Result.fromPredicate`

Creates a `Result` based on a predicate function - returns `Ok` with the value if the predicate returns `true`, else `Err` with the provided error.

```typescript
import { Result } from "@carbonteq/fp";

const score = 85;
const passed = Result.fromPredicate(score, (s) => s >= 60, "Score too low");
console.log(passed); // Ok(85)

const failed = Result.fromPredicate(45, (s) => s >= 60, "Score too low");
console.log(failed); // Err("Score too low")
```

---

### Exception Handling

#### `Result.tryCatch`

Wraps a synchronous operation in a `Result`, catching any exceptions and converting them to `Err`.

```typescript
import { Result } from "@carbonteq/fp";

function parseJson(json: string): Result<unknown, Error> {
  return Result.tryCatch(
    () => JSON.parse(json),
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );
}

console.log(parseJson('{"name":"Alice"}')); // Ok({ name: "Alice" })
console.log(parseJson("invalid json")); // Err(SyntaxError: ...)
```

#### `Result.tryAsyncCatch`

Wraps an asynchronous operation in a `Result`, catching any exceptions and converting them to `Err`.

```typescript
import { Result } from "@carbonteq/fp";

async function fetchUserData(
  id: string,
): Promise<Result<{ name: string }, Error>> {
  return Result.tryAsyncCatch(
    async () => {
      const response = await fetch(`/api/users/${id}`);
      return response.json();
    },
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );
}

const user = await fetchUserData("123");
console.log(user); // Ok({ name: "..." }) or Err(Error: ...)
```

---

### Transforming Inner Values

#### `Option.filter`

Filters the value inside an `Option` based on a predicate, returning `None` if the predicate returns `false`.

```typescript
import { Option } from "@carbonteq/fp";

const age = Option.Some(25);
const adult = age.filter((a) => a >= 18);
console.log(adult); // Some(25)

const minor = Option.Some(15).filter((a) => a >= 18);
console.log(minor); // None
```

#### `Option.innerMap`

Transforms array elements inside an `Option<Array<T>>`.

```typescript
import { Option } from "@carbonteq/fp";

const numbers = Option.Some([1, 2, 3, 4, 5]);
const doubled = numbers.innerMap((n) => n * 2);
console.log(doubled); // Some([2, 4, 6, 8, 10])
```

#### `Result.innerMap`

Transforms array elements inside a `Result<Array<T>, E>`.

```typescript
import { Result } from "@carbonteq/fp";

const numbers = Result.Ok([1, 2, 3, 4, 5]);
const squared = numbers.innerMap((n) => n * n);
console.log(squared); // Ok([1, 4, 9, 16, 25])
```

#### `Result.mapBoth`

Transforms both the success value and the error value simultaneously.

```typescript
import { Result } from "@carbonteq/fp";

const result = Result.Ok(42);
const decorated = result.mapBoth(
  (val) => `Success: ${val}`,
  (err) => `Error: ${err}`,
);
console.log(decorated); // Ok("Success: 42")

const error = Result.Err("Something failed");
const decoratedError = error.mapBoth(
  (val) => `Success: ${val}`,
  (err) => `Error: ${err}`,
);
console.log(decoratedError); // Err("Error: Something failed")
```

---

### Combining & Converting

#### `Option.toResult`

Converts an `Option` to a `Result`, using the provided error for `None`.

```typescript
import { Option } from "@carbonteq/fp";

const user = Option.Some({ name: "Alice" });
const userResult = user.toResult("User not found");
console.log(userResult); // Ok({ name: "Alice" })

const missing = Option.None.toResult("User not found");
console.log(missing); // Err("User not found")
```

#### `Result.toOption`

Converts a `Result` to an `Option`, discarding error information.

```typescript
import { Result } from "@carbonteq/fp";

const success = Result.Ok(42);
const opt = success.toOption();
console.log(opt); // Some(42)

const failure = Result.Err("Failed");
const optFromErr = failure.toOption();
console.log(optFromErr); // None
```

#### `Result.zipErr`

Runs a validation/binding function on the Ok value that can produce a new error, while preserving the original Ok value. If the function returns an `Err`, that error is returned. If the initial result is already `Err`, it short-circuits and returns that error.

```typescript
import { Result } from "@carbonteq/fp";

const checkPermissions = (userId: string) =>
  Result.Ok(userId).zipErr((id) =>
    id === "guest"
      ? Result.Err("Guest users have limited access")
      : Result.Ok(undefined),
  );

const admin = checkPermissions("admin-123");
console.log(admin); // Ok("admin-123")

const guest = checkPermissions("guest");
console.log(guest); // Err("Guest users have limited access")

const okNoChange = Result.Ok("42").zipErr((id) => Result.Ok(id.length));
console.log(okNoChange); // Ok("42")

const alreadyFailed = Result.Err<string, string>("Network error").zipErr(() =>
  Result.Err("Validation error"),
);
console.log(alreadyFailed); // Err("Network error") - short-circuits
```

##### `mapErr` vs `zipErr`

`mapErr` transforms the error value only; it never runs on `Ok`. `zipErr` runs a binder on the `Ok` value that can *introduce* a new error, while preserving the original `Ok` value on success.

```typescript
import { Result } from "@carbonteq/fp";

const res = Result.Err<Error, number>(new Error("boom")).mapErr(
  (e) => e.message,
);
console.log(res); // Err("boom")

const ok = Result.Ok("42").zipErr((value) =>
  value === "0" ? Result.Err("invalid") : Result.Ok(value.length),
);
console.log(ok); // Ok("42")

const err = Result.Ok("0").zipErr((value) =>
  value === "0" ? Result.Err("invalid") : Result.Ok(value.length),
);
console.log(err); // Err("invalid")
```

#### `Result.flip`

Swaps the `Ok` and `Err` states, turning success into failure and vice versa.

```typescript
import { Result } from "@carbonteq/fp";

const success = Result.Ok("Success value");
const flipped = success.flip();
console.log(flipped); // Err("Success value")

const failure = Result.Err("Error value");
const flippedError = failure.flip();
console.log(flippedError); // Ok("Error value")
```

---

### Error Recovery & Side Effects

#### `tap`

Executes a side effect function for `Some` or `Ok` values, then returns the original `Option` or `Result`. Useful for logging, debugging, or executing effects without changing the value.

```typescript
import { Result } from "@carbonteq/fp";

// Simulated database functions
async function findUserById(
  userId: number,
): Promise<Result<Record<string, number>, string>> {
  // Simulate a database lookup
  await Promise.resolve(userId);
  if (userId === 0) {
    return Result.Err("User not found");
  }
  return Result.Ok({ id: userId, balance: 100 });
}

function updateBalance(
  user: Record<string, number>,
  amount: number,
): Result<Record<string, number>, string> {
  if (user.balance < amount) {
    return Result.Err("Insufficient funds");
  }
  return Result.Ok({ ...user, balance: user.balance - amount });
}

// Process withdrawal with logging
const res = (await findUserById(1))
  .tap((user) => console.log(`[Audit] User found: ${user.id}`))
  .flatMap((user) => updateBalance(user, 10))
  .tap((updated) =>
    console.log(`[Transaction] New balance: $${updated.balance}`),
  )
  .tapErr((error) => console.error(`[Alert] Transaction failed: ${error}`));

console.log(res); // Result.Ok({ id: 1, balance: 90 })
```

#### `Result.tapErr`

Executes a side effect function for `Err` values, then returns the original `Result`.

```typescript
import { Result } from "@carbonteq/fp";

const result = Result.Err("Connection failed");
const logged = result.tapErr((err) => {
  console.error(`[Error Log] ${new Date().toISOString()}: ${err}`);
});
console.log(logged); // Err("Connection failed")
// Output: [Error Log] 2025-01-07T...: Connection failed
```

#### `Result.orElse`

Recovers from an error by providing a fallback `Result`. If the current result is `Err`, the function is called with the error to produce a new result.

```typescript
import { Result } from "@carbonteq/fp";

function fetchFromCache(id: string): Result<string, Error> {
  return id === "cached"
    ? Result.Ok("Cached data")
    : Result.Err(new Error("Not in cache"));
}

function fetchFromAPI(id: string): Result<string, Error> {
  return id === "1"
    ? Result.Ok("API data")
    : Result.Err(new Error("Not found"));
}

const cached = fetchFromCache("cached").orElse((err) => fetchFromAPI("1"));
console.log(cached); // Ok("Cached data")

const fromAPI = fetchFromCache("123").orElse((err) => fetchFromAPI("1"));
console.log(fromAPI); // Ok("API data")

const failed = fetchFromCache("123").orElse((err) => fetchFromAPI("999"));
console.log(failed); // Err(Error: Not found)
```

---

### Aggregation Helpers

#### `Option.any`

Returns the first `Some` from a list of `Option`s, or `None` if all are `None`.

```typescript
import { Option } from "@carbonteq/fp";

const first = Option.any(
  Option.None,
  Option.Some("First value"),
  Option.Some("Second value"),
);
console.log(first); // Some("First value")

const allNone = Option.any(Option.None, Option.None, Option.None);
console.log(allNone); // None
```

#### `ExperimentalOption.gen`, `genAdapter`, `asyncGen`, `asyncGenAdapter`

Experimental generator-based methods for chaining Option operations with imperative-style syntax.

```typescript
import { ExperimentalOption as Option } from "@carbonteq/fp";

// Option.gen - simple sync chains (no adapter needed)
const syncResult = Option.gen(function* () {
  const a = yield* Option.Some(1);
  const b = yield* Option.Some(2);
  return a + b;
});
console.log(syncResult); // Some(3)

// Option.asyncGen - async chains with explicit await
const asyncResult = await Option.asyncGen(async function* () {
  const id = yield* Option.Some(1);
  const data = yield* await fetchUserData(id); // await Promise<Option> first
  const validated = yield* validate(data);
  return validated;
});

// Option.genAdapter - better type inference for complex sync chains
const complexSync = Option.genAdapter(function* ($) {
  const user = yield* $(fetchUser(123)); // sync Option
  const profile = yield* $(user.profile); // sync Option
  const valid = yield* $(validate(profile)); // sync Option
  return valid;
});

// Option.asyncGenAdapter - cleaner async with auto-await handling
const complexAsync = await Option.asyncGenAdapter(async function* ($) {
  const user = yield* $(fetchUser(123)); // sync or async Option
  const orders = yield* $(fetchOrders(user)); // Promise<Option> - auto-awaited
  const total = yield* $(calculateTotal(orders));
  return total;
});
```

**Key differences:**

- `gen` / `asyncGen`: Simple, direct `yield*` with Option values
- `genAdapter` / `asyncGenAdapter`: Uses `$()` adapter for better type inference and cleaner syntax

#### `Result.any`

Returns the first `Ok` from a list of `Result`s, or collects all errors if all are `Err`.

```typescript
import { Result } from "@carbonteq/fp";

const firstSuccess = Result.any(
  Result.Err("Error 1"),
  Result.Ok("First success"),
  Result.Ok("Second success"),
);
console.log(firstSuccess); // Ok("First success")

const allErrors = Result.any(
  Result.Err("Error 1"),
  Result.Err("Error 2"),
  Result.Err("Error 3"),
);
console.log(allErrors); // Err(["Error 1", "Error 2", "Error 3"])
```

#### `ExperimentalResult.gen`, `genAdapter`, `asyncGen`, `asyncGenAdapter`

Experimental generator-based methods for chaining Result operations with imperative-style syntax.

```typescript
import { ExperimentalResult as Result } from "@carbonteq/fp";

// Result.gen - simple sync chains (no adapter needed)
const syncResult = Result.gen(function* () {
  const a = yield* Result.Ok(1);
  const b = yield* Result.Ok(2);
  return a + b;
});
console.log(syncResult); // Ok(3)

// Result.asyncGen - async chains with explicit await
const asyncResult = await Result.asyncGen(async function* () {
  const id = yield* Result.Ok(1);
  const data = yield* await fetchUserData(id); // await Promise<Result> first
  const validated = yield* validate(data);
  return validated;
});

// Result.genAdapter - better type inference for complex sync chains
const complexSync = Result.genAdapter(function* ($) {
  const user = yield* $(fetchUser(123)); // sync Result
  const profile = yield* $(user.profile); // sync Result
  const valid = yield* $(validate(profile)); // sync Result
  return valid;
});

// Result.asyncGenAdapter - cleaner async with auto-await handling
const complexAsync = await Result.asyncGenAdapter(async function* ($) {
  const user = yield* $(fetchUser(123)); // sync or async Result
  const orders = yield* $(fetchOrders(user)); // Promise<Result> - auto-awaited
  const total = yield* $(calculateTotal(orders));
  return total;
});
```

**Key differences:**

- `gen` / `asyncGen`: Simple, direct `yield*` with Result values
- `genAdapter` / `asyncGenAdapter`: Uses `$()` adapter for better type inference and cleaner syntax

---

## Build Your First Pipeline

Let's build a pipeline for processing an e-commerce order. This example demonstrates handling user input validation, inventory checks, and order processing.

### Synchronous Pipeline

```typescript
import { Result, matchRes } from "@carbonteq/fp";

interface Order {
  productId: string;
  quantity: number;
  userId: string;
}

interface ProcessedOrder {
  orderId: string;
  total: number;
  status: "confirmed" | "failed";
  order: Order;
}

// Validate order input
function guardOrder(order: Order): Result<Order, string> {
  if (!order.productId) return Result.Err("Product ID is required");
  if (order.quantity <= 0) return Result.Err("Quantity must be positive");
  if (!order.userId) return Result.Err("User ID is required");
  return Result.Ok(order);
}

// Check product availability
function guardInventoryCheck(order: Order): Result<Order, string> {
  const availableStock = 100; // Simulated stock
  return order.quantity <= availableStock
    ? Result.Ok(order)
    : Result.Err(`Insufficient stock. Available: ${availableStock}`);
}

// Calculate order total
function calculateTotal(order: Order): Result<number, string> {
  const price = 29.99; // Simulated price
  return Result.Ok(order.quantity * price);
}

// Process the order
function processOrder(order: Order): Result<ProcessedOrder, string> {
  return Result.Ok(order)
    .validate([guardOrder, guardInventoryCheck])
    .flatZip(calculateTotal)
    .map(([order, total]) => ({
      orderId: `ORD-${Date.now()}`,
      total: total,
      status: "confirmed" as const,
      order: order,
    }))
    .mapErr((error) => `Order processing failed: ${error}`);
}

// Usage
const order: Order = {
  productId: "PROD-123",
  quantity: 2,
  userId: "USER-456",
};

const result = processOrder(order);

matchRes(result, {
  Ok: (processedOrder) => {
    console.log(`Order confirmed! Order ID: ${processedOrder.orderId}`);
    console.log(`Total: $${processedOrder.total.toFixed(2)}`);
    console.log(`Order: ${JSON.stringify(processedOrder.order)}`);
  },
  Err: (error) => {
    console.error(`Error: ${error}`);
  },
});

// Output:
// Order confirmed! Order ID: ORD-1716888600000
// Total: $59.98
// Order: {"productId":"PROD-123","quantity":2,"userId":"USER-456"}
```

#### Asynchronous Pipeline

Let's build an asynchronous pipeline for a user registration system that includes credentials verification and profile setup.

```typescript
import { matchRes, Result } from "@carbonteq/fp";

interface UserInput {
  email: string;
  password: string;
  name: string;
}

interface UserProfile {
  userId: string;
  email: string;
  name: string;
  verificationStatus: "pending" | "verified";
}

// Validate email format (synchronous)
function guardEmail(email: string): Result<string, string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email)
    ? Result.Ok(email)
    : Result.Err("Invalid email format");
}

// Check if email is already registered
async function guardEmailAvailability(
  email: string,
): Promise<Result<string, string>> {
  // Simulate database check
  await Promise.resolve(email);
  const registeredEmails = ["existing@example.com"];
  return !registeredEmails.includes(email)
    ? Result.Ok(email)
    : Result.Err("Email already registered");
}

// Validate password strength (synchronous)
function guardPassword(password: string): Result<string, string> {
  return password.length >= 8
    ? Result.Ok(password)
    : Result.Err("Password must be at least 8 characters");
}

// Create user profile
async function createUserProfile(
  input: UserInput,
): Promise<Result<UserProfile, string>> {
  const userProfile: UserProfile = {
    userId: `USER-${Date.now()}`,
    email: input.email,
    name: input.name,
    verificationStatus: "pending",
  };
  return Result.Ok(userProfile);
}

// Send verification email
async function sendVerificationEmail(
  profile: UserProfile,
): Promise<Result<UserProfile, string>> {
  // Simulate email sending and verification
  await Promise.resolve(profile);
  console.log(`Verification email sent to ${profile.email}`);
  return Result.Ok(profile);
}

// Main registration pipeline using validate + flatMap
async function registerUser(
  input: UserInput,
): Promise<Result<UserProfile, string | string[]>> {
  const res = await Result.Ok(input)
    .validate([
      ({ email }) => guardEmail(email),
      ({ email }) => guardEmailAvailability(email),
      ({ password }) => guardPassword(password),
    ])
    .flatMap(createUserProfile)
    .flatMap(sendVerificationEmail)
    .toPromise();

  return res;
}

// Usage
async function main() {
  const userInput: UserInput = {
    email: "newuser@example.com",
    password: "securepass123",
    name: "John Doe",
  };

  const result = await registerUser(userInput);

  matchRes(result, {
    Ok: (profile) => {
      console.log(`Email: ${profile.email}`);
      console.log("Registration successful!");
      console.log(`User ID: ${profile.userId}`);
      console.log(`Verification Status: ${profile.verificationStatus}`);
    },
    Err: (error) => {
      console.error(`Registration failed: ${error}`);
    },
  });
}

main();
// Output:
// Verification email sent to newuser@example.com
// Email: newuser@example.com
// Registration successful!
// User ID: USER-1737921964102
// Verification Status: pending
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
