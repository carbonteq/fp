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
# But why fp?
In JavaScript and TypeScript, dealing with `null`, `undefined`, and errors can lead to verbose, error-prone code. `fp` introduces functional paradigms that make handling these cases cleaner and more reliable. By leveraging `fp`, you can reduce boilerplate, improve readability, and create more maintainable applications.

To demonstrate the utility of `fp`, let us consider a use case where we need to retrieve a user's email and address.

### Without using the `fp` library
```typescript
function getUserByEmail(user: { email?: string }): string | null {
  return user.email ? user.email : null;
}

function getUserAdress(user: { email?: string }): string | null {
  return user.email ? "Some Address" : null;
}

const email = getUserByEmail({email: "test@test.com"});
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

### With using the `fp` library

```typescript
import { Option, matchOpt } from "@carbonteq/fp";

function getUserByEmail(user: { email?: string }): Option<string> {
  return user.email ? Option.Some(user.email) : Option.None;
}

function getUserAddress(user: { email?: string }): Option<string> {
  return user.email ? Option.Some("Some Address") : Option.None;
}

const res = getUserByEmail({ email: "test@test.com" })
            .flatZip((email) => getUserAddress({ email })) 

matchOpt(res, {
  Some: (res) => {
    console.log(`User ${res[0]} has address: ${res[1]}`);
  },
  None: () => {
    console.error("User or Address not found");
  }
});
// Output: User test@test.com has address: Some Address

```
# Table of Contents
- [Usage](#usage)
  - [The `Result` type](#the-result-type)
  - [The `Option` type](#the-option-type)
  - [Cheatsheet](#cheatsheet)
    - [map](#map)
    - [flatMap](#flatmap)
    - [zip](#zip)
    - [flatZip](#flatzip)
    - [Comparison of map and zip](#comparison-of-map-flatmap-zip-and-flatzip)
    - [Some Other Useful Functions](#some-other-useful-functions)
      - [mapErr](#maperr)
      - [mapOr](#mapor)
      - [tap](#tap)
      - [unwrap](#unwrap-safeunwraperr-unwrapor-unwraporelse-safeunwrap-and-unwraperr)
      - [safeUnwrapErr](#unwrap-safeunwraperr-unwrapor-unwraporelse-safeunwrap-and-unwraperr)
      - [unwrapOr](#unwrap-safeunwraperr-unwrapor-unwraporelse-safeunwrap-and-unwraperr)
      - [unwrapOrElse](#unwrap-safeunwraperr-unwrapor-unwraporelse-safeunwrap-and-unwraperr)
      - [safeUnwrap](#unwrap-safeunwraperr-unwrapor-unwraporelse-safeunwrap-and-unwraperr)
      - [unwrapErr](#unwrap-safeunwraperr-unwrapor-unwraporelse-safeunwrap-and-unwraperr)
- [Build Your First Pipeline](#build-your-first-pipeline)
  - [Synchronous Pipeline](#synchronous-pipeline)
  - [Asynchronous Pipeline](#asynchronous-pipeline)

# Usage

## The `Result` type
`Result` represents a value that can be either a success (`Ok`) or a failure (`Err`). It simplifies error handling by making success and failure explicit.

```typescript
import { Result } from "@carbonteq/fp";

const res1: Result<number, string> = Result.Ok(5); // Contains the value 5
const res2: Result<number, string> = Result.Err("Some Error"); // Contains the error "Some Error"
```

## The `Option` type
The `Option` type represents a value that might or might not be present. It eliminates the need for manual checks for `null` or `undefined`.

```typescript
import { Option } from "@carbonteq/fp";

const opt1: Option<number> = Option.Some(5); // Contains the value 5
const opt2: Option<number> = Option.None; // Contains no value (None)
```

---

## Cheatsheet

#### `map`
Transforms the `Some` or `Ok` value inside `Option` or `Result`.

Let's say we want to apply a 10% bonus to the account balance of a user.

```typescript
import { Option } from "@carbonteq/fp";

async function fetchUserBalanceFromDatabase(userId: string): Promise<Option<number>> {
    // Simulate fetching balance from a database
    await Promise.resolve(userId);
    return Option.Some(100);
}

async function applyBonus() {
    const userId = "user123"; // Example user ID
    const balanceOption = (await fetchUserBalanceFromDatabase(userId))
                          .map((balance) => balance * 1.1); // Apply a 10% bonus if balance exists
    return balanceOption;
}

console.log(await applyBonus()); // Output: Some(110)
```

#### `flatMap`
`flatMap` is used to chain operations where each step returns an `Option` or `Result`. It avoids nested structures like `Option<Option<T>>` or `Result<Result<T, E>, E>` by "flattening" them into a single level.

Let's say we want to validate user input and then save it to a database:

```typescript
import {Result} from "@carbonteq/fp";

// Function to validate user input
const validateUserData = (name: string, age: number): Result<{ name: string; age: number }, Error> => {
  if (name.trim() === "") {
    return Result.Err(new Error("Name cannot be empty"));
  }
  if (age < 0 || age > 120) {
    return Result.Err(new Error("Age must be between 0 and 120"));
  }
  return Result.Ok({ name, age });
};

// Simulated asynchronous task to save user data to a "database"
const saveUserData = async (user: { name: string; age: number }): Promise<Result<string, Error>> => {
    // Simulate saving to database
    await Promise.resolve(user);
    return Result.Ok(`User ${user.name} saved successfully!`);
};

// Chaining validation and save using `flatMap`
const processUser = async (name: string, age: number): Promise<Result<string, Error>> => {
  const validationResult = await validateUserData(name, age)
                          .flatMap(async (user) => await saveUserData(user)); 
  return validationResult;
};

console.log(await processUser("Alice", 30)); // Output: Result.Ok("User Alice saved successfully!")

/* validationResult is of type Result<string, Error> instead of Result<Result<string, Error>, Error> (which is what would have happened if we used map instead of flatMap) */

```

#### `zip`
Creates a tuple `[T, U]` where the second value `U` is _derived_ from the first value `T` using a function `f`.
For example, suppose we want to pair the product's original price `T` and discounted price `U`.
```typescript
import { Result} from "@carbonteq/fp";

async function fetchProductPrice(productId: string): Promise<Result<number, Error>> {
    // Simulate fetching price from a database
    await Promise.resolve(productId);
    return Result.Ok(100);
}

async function applyDiscount(productId: string): Promise<Result<[number, number], Error>> {
    const originalPrice = (await fetchProductPrice(productId))
                          .zip((price) => price * 0.9)
    return originalPrice; //originalPrice is of type Result<[number, number], Error>
}

console.log(await applyDiscount("123")); // Output: Result.Ok([100, 90])

```
Here `derivedPair` is a `Result<[number, number], Error>`. Note that `T` = `100` and `U` = `90`.

#### `flatZip`
Combines the current `Result<T, E>` with another `Result<U, E2>`, or the current `Option<T>` with another `Option<U>`. Unlike zip, which pairs a value with a derived one, flatZip works with **two independent Result/Option values** and combines their contents into a tuple `[T, U]`. It ensures the Result/Option values are Ok/Some to proceed; otherwise, it propagates the first encountered Err/None.

Lets say we want to combine the product price and product stock into a tuple `[number, number]`.
```typescript
import { Option } from "@carbonteq/fp";

// Simulated function to fetch product price
async function fetchProductPrice(productId: string): Promise<Option<number>> {
  // Simulate fetching price from a database
  await Promise.resolve(productId);
  return Option.Some(100);
}

// Simulated function to fetch product stock
async function fetchProductStock(productId: string): Promise<Option<number>> {
  // Simulate fetching stock from a database
  await Promise.resolve(productId);
  return Option.Some(50);
}

// Function to combine price and stock using flatZip
async function fetchProductDetails(productId: string): Promise<Option<[number, number]>> {
  const productDetails = await (await fetchProductPrice(productId))
                        .flatZip(() => fetchProductStock(productId));
  return productDetails; // Option<[number, number]>
}

console.log(await fetchProductDetails("123")); // Output: Option.Some([100, 50])
```
## Comparison of `map`, `flatMap`, `zip`, and `flatZip`

| **Method**            | **`map`**                                                         | **`flatMap`**                                                                                | **`zip`**                                                                                    | **`flatZip`**                                                           |   |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | - |
| **Purpose**           | Transforms the value inside an `Ok` or `Some`. | Chains dependent computations where each computation returns a `Result` or `Option`.                     | Combines the current value with another derived value into a tuple `[T, U]`.                 | Combines two independent `Result` or `Option` values into a tuple `[T, U]`.         |
| **Input**             | A function `(val: T) => U`.                                       | A function `(val: T) => Result<U, E2>` or `(val: T) => Option<U>` to transform the current value into another `Result` or `Option`. | A function `(val: T) => U` to derive a new value `U` from the current value `T`.             | A function `(val: T) => Result<U, E2>` or `(val: T) => Option<U>` that returns another `Result` or `Option`.   |
| **Output**            | `Result<U, E>`, `Option<U>`                                                    | `Result<U, E>`, `Option<U>`                                                                            | `Result<[T, U], E>`, `Option<[T, U]>`                                                                        | `Result<[T, U], E>`, `Option<[T, U]>`.                                                    |
| **Error Propagation** | Propagates `Err`/`None` if the `Result`/`Option` is `Err`/`None`.                        | Propagates the first `Err`/`None` encountered in the chain.                                         | Propagates `Err`/`None` if the current `Result`/`Option` or derived value is `Err`/`None`.                          | Propagates the first `Err`/`None` encountered between the two `Result`/`Option` values. |
| **Use Case**          | When you want to transform a value inside `Ok`/`Some`.                   | When the next computation depends on the current value and returns a `Result`/`Option`.               | When you want to pair the current value with a derived one. | When you want to combine two independent `Result`/`Option` values into a tuple.  |

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
  const res = divideNumbers(a, b)
              .mapErr((err) => `Operation failed: ${err.message}`);
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

// A safe function that returns a string error message if the user is not found, instead of throwing an exception
async function safeFindUserById(id: number): Promise<Option<string>> {
  const res = (await findUserById(id))
              .mapOr(`User not found`, (res) => `User: ${res}`);
  return res;
}

// Example usage
console.log(await safeFindUserById(10)); // Some(User: 10)
console.log(await safeFindUserById(0)); // Some(User not found)

```

#### `tap`

`tap` is used to perform side effects on the `Result`/`Option` value without altering its contents. It is useful for logging, auditing, debugging complex chains of operations etc.
```typescript
import { Result } from "@carbonteq/fp";

// Simulated database functions
async function findUserById(userId: number): Promise<Result<Record<string, number>, string>> {
  // Simulate a database lookup
  await Promise.resolve(userId);
  if (userId === 0) {
    return Result.Err('User not found');
  }
  return Result.Ok({ id: userId, balance: 100 });
}

function updateBalance(user: Record<string, number>, amount: number): Result<Record<string, number>, string> {
  if (user.balance < amount) {
    return Result.Err('Insufficient funds');
  }
  return Result.Ok({ ...user, balance: user.balance - amount });
}

// Process withdrawal with logging
const res = (await findUserById(1))
  .tap(user => console.log(`[Audit] User found: ${user.id}`))
  .flatMap(user => updateBalance(user, 10)
    .tap(updated => console.log(`[Transaction] New balance: $${updated.balance}`))
    .mapErr(error => console.error(`[Alert] Transaction failed: ${error}`))
  );

console.log(res); // Result.Ok({ id: 1, balance: 90 })
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
console.log(result.safeUnwrapErr()); // safeUnwrapErr: null (returns error if Err, null if Ok)

result = divideNumbers(10, 0);
console.log(result.unwrapOr(0)); // unwrapOr: 0 (Returns the contained value if Ok, or a default value if Err)
console.log(result.unwrapOrElse(() => 0)); // unwrapOrElse: 0 (Similar to unwrapOr, but the default value is generated by a function.)
console.log(result.safeUnwrap()); // safeUnwrap: null (Safely unwraps the value, returning null if it's an Err instead of throwing an error.)

const errorResult = Result.Err(new Error("Something went wrong"));
console.log(errorResult.unwrapErr()); // unwrapErr: Error: Something went wrong (Extracts the error from Result.Err, throwing an error if it's Ok)

```

## Build Your First Pipeline

Let's build a pipeline for processing an e-commerce order. This example demonstrates handling user input validation, inventory checks, and order processing.

#### Synchronous Pipeline

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
  status: 'confirmed' | 'failed';
  order: Order;
}

// Validate order input
function validateOrder(order: Order): Result<Order, string> {
  if (!order.productId) return Result.Err("Product ID is required");
  if (order.quantity <= 0) return Result.Err("Quantity must be positive");
  if (!order.userId) return Result.Err("User ID is required");
  return Result.Ok(order);
}

// Check product availability
function checkInventory(order: Order): Result<Order, string> {
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
  return validateOrder(order)
    .flatMap((validOrder) => checkInventory(validOrder))
    .flatZip((checkedOrder) => calculateTotal(checkedOrder))
    .map(([order, total]) => ({
      orderId: `ORD-${Date.now()}`,
      total: total,
      status: 'confirmed' as const,
      order: order
    }))
    .mapErr(error => `Order processing failed: ${error}`);
}

// Usage
const order: Order = {
  productId: "PROD-123",
  quantity: 2,
  userId: "USER-456"
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
  }
});

// Output:
// Order confirmed! Order ID: ORD-1716888600000
// Total: $59.98
// Order: {"productId":"PROD-123","quantity":2,"userId":"USER-456"}
  
```

#### Asynchronous Pipeline

Let's build an asynchronous pipeline for a user registration system that includes credentials verification and profile setup.

```typescript
import { Result, matchRes } from "@carbonteq/fp";

interface UserInput {
  email: string;
  password: string;
  name: string;
}

interface UserProfile {
  userId: string;
  email: string;
  name: string;
  verificationStatus: 'pending' | 'verified';
}

// Validate email format
async function validateEmail(email: string): Promise<Result<string, string>> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email)
    ? Result.Ok(email)
    : Result.Err("Invalid email format");
}

// Check if email is already registered
async function checkEmailAvailability(email: string): Promise<Result<string, string>> {
  // Simulate database check
  await Promise.resolve(email);
  const registeredEmails = ["existing@example.com"];
  return !registeredEmails.includes(email)
    ? Result.Ok(email)
    : Result.Err("Email already registered");
}

// Validate password strength
async function validatePassword(password: string): Promise<Result<string, string>> {
  return password.length >= 8
    ? Result.Ok(password)
    : Result.Err("Password must be at least 8 characters");
}

// Create user profile
async function createUserProfile(input: UserInput): Promise<Result<UserProfile, string>> {
  const userProfile: UserProfile = {
    userId: `USER-${Date.now()}`,
    email: input.email,
    name: input.name,
    verificationStatus: 'pending'
  };
  return Result.Ok(userProfile);
}

// Send verification email
async function sendVerificationEmail(profile: UserProfile): Promise<Result<UserProfile, string>> {
  // Simulate email sending and verification
  await Promise.resolve(profile);
  console.log(`Verification email sent to ${profile.email}`);
  return Result.Ok(profile);
}

// Main registration pipeline
async function registerUser(input: UserInput): Promise<Result<UserProfile, string>> {

  const res = await (await validateEmail(input.email)) // if email is valid, then move forward in chain, otherwise return Err
    .flatMap(async () => (await validatePassword(input.password)) // if password is valid, then move forward in chain, otherwise return Err
      .flatMap(async () => (await checkEmailAvailability(input.email)) // if email is not registered, then move forward in chain, otherwise return Err
        .flatMap(async () => (await createUserProfile({ // if user profile is created, then move forward in chain, otherwise return Err
          email: input.email,
          password: input.password,
          name: input.name
        }))
          .flatMap(async (profile) => await sendVerificationEmail(profile)) // finally send verification email
        )
      )
    )

  return res;
}

// Usage
async function main() {
  const userInput: UserInput = {
    email: "newuser@example.com",
    password: "securepass123",
    name: "John Doe"
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
    }
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
