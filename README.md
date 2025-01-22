# Carbonteq Functional Programming Utilities (fp)

## Description
`fp` is a lightweight TypeScript library designed to simplify functional programming by providing essential types like `Option` and `Result`. It helps developers handle errors, manage optional values, and write expressive, composable code.

## But why fp?
In JavaScript and TypeScript, dealing with `null`, `undefined`, and errors can lead to verbose, error-prone code. `fp` introduces functional paradigms that make handling these cases cleaner and more reliable. By leveraging `fp`, you can reduce boilerplate, improve readability, and create more maintainable applications.

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
# Table of Contents
- [Usage](#usage)
  - [Without using the `fp` library](#without-using-the-fp-library)
  - [Option](#option-handling-optional-values)
  - [Result](#result-handling-success-and-failure)
- [Cheatsheet](#cheatsheet)
  - [Comparison of map and zip](#comparison-of-map-flatmap-zip-and-flatzip)
- [Build Your First Pipeline](#build-your-first-pipeline)
  - [Synchronous Pipeline](#synchronous-pipeline)
  - [Asynchronous Pipeline](#asynchronous-pipeline)

# Usage

To demonstrate the utility of `fp`, let us consider a use case where we need to retrieve a user's email and address.

### Without using the `fp` library
```typescript
function getUserEmail(user: { email?: string }): string | null {
  return user.email ? user.email : null;
}

function getUserAdress(user: { email?: string }): string | null {
  return user.email ? "Some Address" : null;
}

const email = getUserEmail({email: "test@test.com"});
if (email) {
  const address = getUserAdress(email);
  if (address) {
    console.log(`User ${email} has address: ${address}`);
  }
  else {
    console.error("Address not found");
  }
}
else {
  console.error("Email not found");
}
// Output: User test@test.com has address: Some Address
```
Now imagine if we had more complex use cases that involved more than two optional values. We would have to nest if statements and handle errors manually. This is where `fp` comes in.

## Option: Handling Optional Values
The `Option` type represents a value that might or might not be present. It eliminates the need for manual checks for `null` or `undefined`.

### Using the `Option` type
```typescript
import { Option, matchOpt } from "@carbonteq/fp";

function getUserEmail(user: { email?: string }): Option<string> {
  return user.email ? Option.Some(user.email) : Option.None;
}

function getUserAdress(user: { email?: string }): Option<string> {
    return user.email ? Option.Some("Some Address") : Option.None;
}

const emailOption = getUserEmail({email: "test@test.com"})
        .flatMap(email => getUserAdress({email})
            .map(address => ({email, address}))
        );

matchOpt(emailOption, {
    Some: ({email, address}) => {
        console.log(`User ${email} has address: ${address}`);
    },
    None: () => {
        console.error("User or Adress not found");
    }
});
    
// Output: User test@test.com has address: Some Address

```

## Result: Handling Success and Failure
The `Result` type represents a value that can be either a success (`Ok`) or a failure (`Err`). It simplifies error handling by making success and failure explicit.

Let us consider a use case where we need to divide two numbers and then double the result if it is even.

### Without `Result`
```typescript
function divide(a: number, b: number): number | string {
  return b === 0 ? "Division by zero" : a / b;
}

function doubleEvenNumbers(a: number): number | string {
  return a % 2 !== 0 ? "Number is not even" : a * 2;
}

const result = divide(10, 0);
if (typeof result === "number") {
  const doubled = doubleEvenNumbers(result);
  if (typeof doubled === "number") {
    console.log(result, doubled);
  }
  else {
    console.error(doubled);
  }
}
else {
  console.error(result);
}
```

### With `Result`
```typescript
import { Result, matchRes } from "@carbonteq/fp";

function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? Result.Err("Division by zero") : Result.Ok(a / b);
}

function doubleEvenNumbers(a: number): Result<number, string> {
    return a % 2 === 0 ? Result.Ok(a * 2) : Result.Err("Number is not even");
}


const result = divide(10, 2)
    .flatMap(value => doubleEvenNumbers(value)
    .map(double => ({value, double}))
);

matchRes(result, {
    Ok: (val) => console.log(`Value: ${val.value}, Double: ${val.double}`),
    Err: (err) => console.error(err)
});
```

---

## Cheatsheet

#### `map`
Transforms the value inside `Option` or `Result`.

For `Option`, the code looks like this:
```typescript
import { Option} from "@carbonteq/fp";
const someValue: Option<number> = Option.Some(5);
const res1 = someValue.map((x) => x * 2); // Transform the value
console.log(res1.unwrap()); // Output: 10

const noneValue: Option<number> = Option.None;
const res2 = noneValue.map((x) => x * 2); // Do nothing if None
console.log(res2.safeUnwrap()); // Output: null
```

For `Result`, the code looks like this:
```typescript
import { Result} from "@carbonteq/fp";
const resultValue: Result<number, string> = Result.Ok(5);
const res = resultValue.map((x) => x * 2); // Transform the value
console.log(res.unwrap()); // Output: 10

const errorValue: Result<number, string> = Result.Err("Some Error");
const err = errorValue.map((x) => x * 2); // Do nothing if Err
console.log(err.unwrapErr()); // Output: Some Error
```

#### `flatMap`
`flatMap` is used to chain operations where each step returns an Option or Result. It avoids nested structures like `Option<Option<T>>` or `Result<Result<T, E>, E>` by "flattening" them into a single level.
Consider the following example:
```typescript
import { Option} from "@carbonteq/fp";

const optOne: Option<number> = Option.Some(5);
const optTwo: Option<number> = Option.Some(10);
const optThree: Option<number> = Option.Some(15);

const optResult = optOne
        .map(() => optTwo)
            .map( () => optThree); // This will return Option<Option<number>>
```
And we would need to unwrap the result two times to get the final value.
```typescript
const finalValue = optResult.unwrap().unwrap(); // Output: 15
```

This is where `flatMap` comes in. It allows us to chain the operations without nesting the Option types.
```typescript
import { Option} from "@carbonteq/fp";

const optOne: Option<number> = Option.Some(5);
const optTwo: Option<number> = Option.Some(10);
const optThree: Option<number> = Option.Some(15);

const optResult = optOne
        .flatMap(() => optTwo)
            .flatMap(() => optThree); // This will return Option<number>

console.log(optResult.unwrap()); // Output: 15
```
The same holds true for `Result`.

#### `zip`
Creates a tuple `[T, U]` where the second value `U` is _derived_ from the first value `T` using a function `f`.
For example, suppose we want to pair a number `T` with its square `U`.
```typescript
import { Result} from "@carbonteq/fp";

const result: Result<number, Error> = Result.Ok(5);
// Use zip to derive a pair
const derivedPair = result.zip((val) => val * val);
console.log(derivedPair.unwrap()); // Output: [5, 25]

```
Here `derivedPair` is a `Result<[number, number], Error>`. Note that `T` = `5` and `U` = `25`.

#### `flatZip`
Combines the current `Result<T, E>` with another `Result<U, E2>` provided by a function. Unlike zip, which pairs a value with a derived one, flatZip works with **two independent Result values** and combines their contents into a tuple `[T, U]`. It ensures both results are Ok to proceed; otherwise, it propagates the first encountered Err.
```typescript
import { Result } from "@carbonteq/fp";

const resOne: Result<number, Error> = Result.Ok(5);
const resTwo: Result<number, Error> = Result.Ok(10);
const combined = resOne.flatZip(() => resTwo); // Combine resOne and resTwo into [5, 10]
console.log(combined.unwrap()); // Output: [5, 10]
```
## Comparison of `map`, `flatMap`, `zip`, and `flatZip`

| **Method**            | **`map`**                                                         | **`flatMap`**                                                                                | **`zip`**                                                                                    | **`flatZip`**                                                           |   |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | - |
| **Purpose**           | Transforms the value inside an `Ok`. | Chains dependent computations where each computation returns a `Result`.                     | Combines the current value with another derived value into a tuple `[T, U]`.                 | Combines two independent `Result` values into a tuple `[T, U]`.         |
| **Input**             | A function `(val: T) => U`.                                       | A function `(val: T) => Result<U, E2>` to transform the current value into another `Result`. | A function `(val: T) => U` to derive a new value `U` from the current value `T`.             | A function `(val: T) => Result<U, E2>` that returns another `Result`.   |
| **Output**            | `Result<U, E>`                                                    | `Result<U, E>`                                                                            | `Result<[T, U], E>`                                                                        | `Result<[T, U], E>`.                                                    |
| **Error Propagation** | Propagates `Err` if the `Result` is `Err`.                        | Propagates the first `Err` encountered in the chain.                                         | Propagates `Err` if the current `Result` or derived value is `Err`.                          | Propagates the first `Err` encountered between the two `Result` values. |
| **Use Case**          | When you want to transform a value inside `Ok`.                   | When the next computation depends on the current value and returns a `Result`.               | When you want to pair the current value with a derived one. | When you want to combine two independent `Result` values into a tuple.  |

---

## Build Your First Pipeline

The pipeline will use the concepts explained above, such as `Option` and `Result`, to handle optional values and errors in a clean and functional way.

Let's say we're working on a financial application that processes transactions. We need to check if the transaction has a valid amount, if the user is active, and if the transaction is successful. Our goal is to process these transactions and ensure that we handle any missing or invalid values gracefully.

### Problem

We have a list of transactions, each with the following properties:
- `amount`: The amount of money in the transaction (it could be `null` or `undefined`).
- `userId`: The user associated with the transaction.
- `status`: The status of the transaction, which could be `"pending"`, `"completed"`, or `"failed"`.

Our task is to:
1. Check if the `amount` is present and valid.
2. Ensure the user is active.
3. Process the transaction if the status is `"completed"`.

### Solution Using `Option` and `Result`

Let's walk through how we can achieve this using `Option` for handling optional values and `Result` for error handling.

#### Synchronous Pipeline

```typescript
import { Option, Result, matchOpt, matchRes } from "@carbonteq/fp";

// Simulate an API call to check if the user is active
function getUserStatus(userId: string): Result<boolean, string> {
  const activeUsers = ["user1", "user2", "user3"];
  return activeUsers.includes(userId)
    ? Result.Ok(true)
    : Result.Err("User is not active");
}

// Validate if the transaction amount is valid
function validateAmount(amount: number | null | undefined): Option<number> {
  return amount && amount > 0 ? Option.Some(amount) : Option.None;
}

// Simulate a payment gateway processing the transaction
function processTransaction(amount: number): Result<string, string> {
  return amount > 1000
    ? Result.Ok("Transaction processed successfully")
    : Result.Err("Transaction failed due to low amount");
}

// Our pipeline: process each transaction and handle errors using Option and Result
function processUserTransaction(transaction: { userId: string; amount: number | null | undefined; status: string }) {
  const amountOption = validateAmount(transaction.amount)
        .map((amount) => getUserStatus(transaction.userId)
            .flatMap(() => transaction.status === "completed" ? processTransaction(amount) : Result.Err("User is not active"))
    )

  // Match the Option to handle valid and invalid amounts
  matchOpt(amountOption, {
    Some: (res) => {
        matchRes(res, {
            Ok: (value) => console.log(value),
            Err: (error) => console.error(error)
        });
    },
    None: () => console.error("Invalid transaction amount")
  });
}

// Example transactions
const transactions = [
  { userId: "user1", amount: 500, status: "completed" },
  { userId: "user2", amount: null, status: "completed" },
  { userId: "user4", amount: 2000, status: "pending" },
  { userId: "user3", amount: 1200, status: "completed" },
];

// Process all transactions
transactions.forEach(processUserTransaction);
// Output:
// Invalid transaction amount
// User is not active
// Transaction failed due to low amount
// Transaction processed successfully
```

#### Asynchronous Pipeline

```typescript
import { Option, Result, matchOpt, matchRes } from "@carbonteq/fp";

// Simulate an API call to check if the user is active
async function getUserStatus(userId: string): Promise<Result<boolean, string>> {
  const activeUsers = ["user1", "user2", "user3"];
  return activeUsers.includes(userId)
    ? Result.Ok(true)
    : Result.Err("User is not active");
}

// Validate if the transaction amount is valid
async function validateAmount(amount: number | null | undefined): Promise<Option<number>> {
  return amount && amount > 0 ? Option.Some(amount) : Option.None;
}

// Simulate a payment gateway processing the transaction
async function processTransaction(amount: number): Promise<Result<string, string>> {
  return amount > 1000
    ? Result.Ok("Transaction processed successfully")
    : Result.Err("Transaction failed due to low amount");
}

// Our pipeline: process each transaction and handle errors using Option and Result
async function processUserTransaction(transaction: { userId: string; amount: number | null | undefined; status: string }) {
  const amountOption = await validateAmount(transaction.amount)

  // Match the Option to handle valid and invalid amounts
  matchOpt(amountOption, {
    Some: async (opt) => {
        const res = await (await getUserStatus(transaction.userId))
            .flatMap(async () => transaction.status === "completed" ? await processTransaction(opt) : Result.Err("User is not active"))
        matchRes(res, {
            Ok: (value) => console.log(value),
            Err: (error) => console.error(error)
        });
    },
    None: () => console.error("Invalid transaction amount")
  });
}

// Example transactions
const transactions = [
  { userId: "user1", amount: 500, status: "completed" },
  { userId: "user2", amount: null, status: "completed" },
  { userId: "user4", amount: 2000, status: "pending" },
  { userId: "user3", amount: 1200, status: "completed" },
];

// Process all transactions
transactions.forEach(processUserTransaction);
// Output:
// Invalid transaction amount
// User is not active
// Transaction failed due to low amount
// Transaction processed successfully
```

## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.
