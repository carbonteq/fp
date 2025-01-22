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

# Usage

To demonstrate the utility of `fp`, let us consider a use case where we need to retrieve a user's email and address.

### Example: Without using the `fp` library
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

### Example: Using the `Option` type
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

### Example: Without `Result`
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

### Example: With `Result`
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

### Functions

#### `map`
Transforms the value inside `Option` or `Result`.
```typescript
Some(2).map(x => x * 2); // Some(4)
Ok(2).map(x => x + 3);   // Ok(5)
```

#### `flatMap`
Chains computations that return `Option` or `Result`.
```typescript
Some(2).flatMap(x => (x > 1 ? Some(x * 2) : None)); // Some(4)
Ok(2).flatMap(x => Ok(x * 3));                      // Ok(6)
```

#### `zip`
Combines two `Option` or `Result` values into a single pair if both are present/Ok.
```typescript
Some(2).zip(Some(3)); // Some([2, 3])
Ok(2).zip(Ok(3));     // Ok([2, 3])
```

#### `flatZip`
Combines two values and flattens the result.
```typescript
Some(2).flatZip(Some(3)); // Some([2, 3])
```

#### `mapErr`
Transforms the error in a `Result`.
```typescript
Err("error").mapErr(err => `Custom: ${err}`); // Err("Custom: error")
```

#### `tap`
Runs a side effect without altering the value.
```typescript
Some(2).tap(x => console.log(x)); // Logs: 2
Ok(2).tap(x => console.log(x));   // Logs: 2
```

---

## Installation
```bash
npm install @carbonteq/fp
```

---

## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.