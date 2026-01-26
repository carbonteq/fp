/**
 * Result.genAdapter() - Generator with adapter for better type inference
 *
 * genAdapter() works like gen() but provides an adapter function ($)
 * for improved type inference, especially with complex error types.
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs";

// ============================================================================
// BASIC GENADAPTER EXAMPLES
// ============================================================================

console.log("=== Result.genAdapter() Examples ===\n");

// Example 1: Simple genAdapter with adapter function
const simple = Result.genAdapter(function* ($) {
  const value = yield* $(Result.Ok(42));
  return value;
});
console.log("1. Simple genAdapter:", simple.unwrap()); // 42

// Example 2: Multiple yields with adapter
const multiple = Result.genAdapter(function* ($) {
  const a = yield* $(Result.Ok(5));
  const b = yield* $(Result.Ok(10));
  return a + b;
});
console.log("2. Multiple yields:", multiple.unwrap()); // 15

// Example 3: genAdapter improves type inference with different error types
type Error1 = { type: "error1"; message: string };
type Error2 = { type: "error2"; message: string };

const operation1 = (n: number): Result<number, Error1> => {
  return n > 0
    ? Result.Ok(n)
    : Result.Err({ type: "error1", message: "Not positive" });
};

const operation2 = (n: number): Result<number, Error2> => {
  return n < 100
    ? Result.Ok(n)
    : Result.Err({ type: "error2", message: "Too large" });
};

const combined = Result.genAdapter(function* ($) {
  const a = yield* $(Result.Ok(50));
  const b = yield* $(operation1(a));
  const c = yield* $(operation2(b));
  return c;
});
// Type is Result<number, Error1 | Error2>
console.log("3. Combined error types:", combined.unwrap()); // 50

// Example 4: genAdapter for validation with rich error types
type ValidationError =
  | { field: "email"; code: "INVALID_FORMAT" }
  | { field: "email"; code: "REQUIRED" }
  | { field: "password"; code: "TOO_SHORT" }
  | { field: "password"; code: "NO_NUMBER" };

const validateEmail = (email: string): Result<string, ValidationError> => {
  if (!email) return Result.Err({ field: "email", code: "REQUIRED" });
  if (!email.includes("@"))
    return Result.Err({ field: "email", code: "INVALID_FORMAT" });
  return Result.Ok(email);
};

const validatePassword = (
  password: string,
): Result<string, ValidationError> => {
  if (password.length < 8)
    return Result.Err({ field: "password", code: "TOO_SHORT" });
  if (!/\d/.test(password))
    return Result.Err({ field: "password", code: "NO_NUMBER" });
  return Result.Ok(password);
};

const validateCredentials = (email: string, password: string) => {
  return Result.genAdapter(function* ($) {
    const validEmail = yield* $(validateEmail(email));
    const validPassword = yield* $(validatePassword(password));
    return { email: validEmail, password: validPassword };
  });
};
console.log(
  "4. Valid credentials:",
  validateCredentials("user@example.com", "pass1234").unwrap(),
); // { email: "user@example.com", password: "pass1234" }
console.log(
  "    Invalid email:",
  validateCredentials("invalid", "pass123").unwrapErr(),
); // { field: "email", code: "INVALID_FORMAT" }

// Example 5: genAdapter with method calls on objects
class Counter {
  constructor(private value: number = 0) {}

  increment(): Result<number, "overflow"> {
    if (this.value >= Number.MAX_SAFE_INTEGER) {
      return Result.Err("overflow");
    }
    this.value++;
    return Result.Ok(this.value);
  }

  decrement(): Result<number, "underflow"> {
    if (this.value <= Number.MIN_SAFE_INTEGER) {
      return Result.Err("underflow");
    }
    this.value--;
    return Result.Ok(this.value);
  }

  getValue() {
    return this.value;
  }
}

const counterOps = Result.genAdapter(function* ($) {
  const counter = new Counter(0);

  const a = yield* $(counter.increment());
  const b = yield* $(counter.increment());
  const c = yield* $(counter.decrement());

  return { a, b, c, final: counter.getValue() };
});
console.log("5. Counter ops:", counterOps.unwrap()); // { a: 1, b: 2, c: 1, final: 1 }

// Example 6: genAdapter for API composition
type ApiError = { status: number; message: string };

const fetchUser = (
  id: number,
): Result<{ id: number; name: string }, ApiError> => {
  return Result.Ok({ id, name: `User ${id}` });
};

const fetchSettings = (
  _userId: number,
): Result<{ theme: string }, ApiError> => {
  return Result.Ok({ theme: "dark" });
};

const fetchPreferences = (
  _userId: number,
): Result<{ language: string }, ApiError> => {
  return Result.Ok({ language: "en" });
};

const fetchUserData = (userId: number) => {
  return Result.genAdapter(function* ($) {
    const user = yield* $(fetchUser(userId));
    const settings = yield* $(fetchSettings(user.id));
    const preferences = yield* $(fetchPreferences(user.id));

    return {
      user,
      settings,
      preferences,
    };
  });
};
console.log("6. Fetch user data:", fetchUserData(1).unwrap()); // { user: { id: 1, name: "User 1" }, settings: { theme: "dark" }, preferences: { language: "en" } }

// Example 7: genAdapter with conditional logic
const conditional = Result.genAdapter(function* ($) {
  const input = yield* $(Result.Ok(5));

  if (input > 0) {
    const doubled = yield* $(Result.Ok(input * 2));
    return { value: doubled, source: "doubled" as const };
  }

  return { value: input, source: "original" as const };
});
console.log("7. Conditional:", conditional.unwrap()); // { value: 10, source: "doubled" }

// Example 8: genAdapter for parallel-like operations (sequential but cleaner)
const processData = Result.genAdapter(function* ($) {
  const step1 = yield* $(Result.Ok("raw data"));
  const step2 = yield* $(Result.Ok(step1.toUpperCase()));
  const step3 = yield* $(Result.Ok(step2.trim()));
  const step4 = yield* $(Result.Ok(step3.split(" ")));
  return step4;
});
console.log("8. Process data:", processData.unwrap()); // ["RAW", "DATA"]

// Example 9: genAdapter with error type narrowing
type HttpError =
  | { type: "network"; message: string }
  | { type: "timeout"; message: string }
  | { type: "server"; status: number };

const fetchData = (): Result<string, HttpError> => {
  return Result.Ok("data");
};

const processDataWithError = () => {
  return Result.genAdapter(function* ($) {
    const data = yield* $(fetchData());

    // Error type is narrowed to HttpError here
    return data.toUpperCase();
  });
};
console.log("9. Process with error:", processDataWithError().unwrap()); // "DATA"

// Example 10: genAdapter for building complex state
interface State {
  user: { id: number; name: string } | null;
  config: { theme: string } | null;
  data: string[] | null;
}

const buildState = () =>
  Result.genAdapter(function* ($) {
    const state: State = {
      user: null,
      config: null,
      data: null,
    };

    state.user = yield* $(fetchUser(1));
    state.config = yield* $(fetchSettings(state.user.id));
    state.data = yield* $(Result.Ok(["item1", "item2"]));

    return state;
  });

console.log("10. Build state:", buildState().unwrap()); // { user: { id: 1, name: "User 1" }, config: { theme: "dark" }, data: ["item1", "item2"] }

// Example 11: genAdapter with try-catch pattern
const safeParseInt = (str: string): Result<number, "parse_error"> => {
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? Result.Err("parse_error") : Result.Ok(parsed);
};

const safeDivide = (a: number, b: number): Result<number, "divide_by_zero"> => {
  return b !== 0 ? Result.Ok(a / b) : Result.Err("divide_by_zero");
};

const safeCalculate = (aStr: string, bStr: string) => {
  return Result.genAdapter(function* ($) {
    const a = yield* $(safeParseInt(aStr));
    const b = yield* $(safeParseInt(bStr));
    const result = yield* $(safeDivide(a, b));
    return result;
  });
};
console.log("11. Safe calculate:", safeCalculate("10", "2").unwrap()); // 5
console.log("    Divide by zero:", safeCalculate("10", "0").unwrapErr()); // "divide_by_zero"

// Example 12: genAdapter with array iteration
const processArray = () =>
  Result.genAdapter(function* ($) {
    const numbers = yield* $(Result.Ok([1, 2, 3, 4, 5]));
    const results: number[] = [];

    for (const num of numbers) {
      const doubled = yield* $(Result.Ok(num * 2));
      results.push(doubled);
    }

    return results;
  });
console.log("12. Process array:", processArray().unwrap()); // [2, 4, 6, 8, 10]

// Example 13: genAdapter for multi-step validation
type FieldValidation =
  | { field: "username"; error: "TOO_SHORT" | "INVALID_CHARS" }
  | { field: "email"; error: "INVALID_FORMAT" }
  | { field: "age"; error: "TOO_YOUNG" };

const validateUsername = (
  username: string,
): Result<string, FieldValidation> => {
  if (username.length < 3)
    return Result.Err({ field: "username", error: "TOO_SHORT" });
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return Result.Err({ field: "username", error: "INVALID_CHARS" });
  return Result.Ok(username);
};

const validateAge = (age: number): Result<number, FieldValidation> => {
  if (age < 18) return Result.Err({ field: "age", error: "TOO_YOUNG" });
  return Result.Ok(age);
};

const registerUser = (username: string, age: number) => {
  return Result.genAdapter(function* ($) {
    const validUsername = yield* $(validateUsername(username));
    const validAge = yield* $(validateAge(age));

    return {
      username: validUsername,
      age: validAge,
      registered: true,
    };
  });
};
console.log("13. Register user:", registerUser("alice123", 25).unwrap()); // { username: "alice123", age: 25, registered: true }
console.log("    Invalid username:", registerUser("ab", 25).unwrapErr()); // { field: "username", error: "TOO_SHORT" }

// Example 14: genAdapter for nested Result operations
const nested = Result.genAdapter(function* ($) {
  const outer = yield* $(Result.Ok(5));

  // Nested genAdapter call
  const inner = Result.genAdapter(function* ($) {
    const a = yield* $(Result.Ok(outer));
    const b = yield* $(Result.Ok(a * 2));
    return b;
  });

  return yield* $(inner);
});
console.log("14. Nested:", nested.unwrap()); // 10

// Example 15: genAdapter with accumulator
const sumWithAdapter = Result.genAdapter(function* ($) {
  const numbers = yield* $(Result.Ok([1, 2, 3, 4, 5]));
  let sum = 0;

  for (const num of numbers) {
    sum += num;
  }

  return sum;
});
console.log("15. Sum with adapter:", sumWithAdapter.unwrap()); // 15

// Example 16: genAdapter vs gen - same behavior, different syntax
const genResult = Result.gen(function* () {
  const a = yield* Result.Ok(1);
  const b = yield* Result.Ok(2);
  return a + b;
});

const adapterResult = Result.genAdapter(function* ($) {
  const a = yield* $(Result.Ok(1));
  const b = yield* $(Result.Ok(2));
  return a + b;
});

console.log("16. gen:", genResult.unwrap()); // 3
console.log("    genAdapter:", adapterResult.unwrap()); // 3

// Example 17: genAdapter for transaction-like operations
type TransactionError =
  | { type: "insufficient_funds"; balance: number; required: number }
  | { type: "account_not_found"; id: number };

interface Account {
  id: number;
  balance: number;
}

const getAccount = (id: number): Result<Account, TransactionError> => {
  if (id === 999) return Result.Err({ type: "account_not_found", id });
  return Result.Ok({ id, balance: 100 });
};

const checkBalance = (
  account: Account,
  amount: number,
): Result<Account, TransactionError> => {
  if (account.balance < amount) {
    return Result.Err({
      type: "insufficient_funds",
      balance: account.balance,
      required: amount,
    });
  }
  return Result.Ok(account);
};

const transferFunds = (fromId: number, toId: number, amount: number) => {
  return Result.genAdapter(function* ($) {
    const fromAccount = yield* $(getAccount(fromId));
    const toAccount = yield* $(getAccount(toId));
    const validatedFrom = yield* $(checkBalance(fromAccount, amount));

    return {
      from: { ...validatedFrom, balance: validatedFrom.balance - amount },
      to: { ...toAccount, balance: toAccount.balance + amount },
      amount,
    };
  });
};
console.log("17. Transfer funds:", transferFunds(1, 2, 50).unwrap()); // { from: { id: 1, balance: 50 }, to: { id: 2, balance: 150 }, amount: 50 }
console.log("    Insufficient funds:", transferFunds(1, 2, 200).unwrapErr()); // { type: "insufficient_funds", balance: 100, required: 200 }

console.log("\n=== All genAdapter examples completed ===");
