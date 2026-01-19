/**
 * Option.genAdapter() - Generator with adapter for better type inference
 *
 * Option.genAdapter() provides the same imperative-style code as gen(),
 * but with an adapter function ($) for improved type inference when working
 * with different Option types.
 */

import { Option } from "../../dist/option.mjs";

// ============================================================================
// BASIC GENADAPTER EXAMPLES
// ============================================================================

console.log("=== Option.genAdapter() Examples ===\n");

// Example 1: Simple genAdapter with single yield
const simple = Option.genAdapter(function* ($) {
  const value = yield* $(Option.Some(42));
  return value;
});
console.log("1. Simple genAdapter:", simple.unwrap()); // 42

// Example 2: Multiple yields - sequence operations
const multiple = Option.genAdapter(function* ($) {
  const a = yield* $(Option.Some(5));
  const b = yield* $(Option.Some(10));
  return a + b;
});
console.log("2. Multiple yields:", multiple.unwrap()); // 15

// Example 3: Short-circuit on first None
const shortCircuit = Option.genAdapter(function* ($) {
  const a = yield* $(Option.Some(5));
  const b = yield* $(Option.None); // This causes None to return
  const c = yield* $(Option.Some(10)); // This is never reached
  return a + b + c;
});
console.log("3. Short-circuit:", shortCircuit._tag); // "None"

// Example 4: genAdapter with function calls
const fetchValue = (key: string): Option<number> => {
  if (key === "valid") return Option.Some(42);
  return Option.None;
};

const withFetch = Option.genAdapter(function* ($) {
  const a = yield* $(fetchValue("valid"));
  const b = yield* $(fetchValue("valid"));
  return a + b;
});
console.log("4. With fetch:", withFetch.unwrap()); // 84

// Example 5: genAdapter for validation pipeline
const validatePositive = (n: number): Option<number> => {
  return n > 0 ? Option.Some(n) : Option.None;
};

const validateEven = (n: number): Option<number> => {
  return n % 2 === 0 ? Option.Some(n) : Option.None;
};

const validate = Option.genAdapter(function* ($) {
  const input = yield* $(Option.Some(4));
  const positive = yield* $(validatePositive(input));
  const even = yield* $(validateEven(positive));
  return even * 2;
});
console.log("5. Validation pipeline:", validate.unwrap()); // 8

// Example 6: genAdapter vs gen - both work the same way
const genVersion = Option.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* Option.Some(a * 2);
  return b + 10;
});

const genAdapterVersion = Option.genAdapter(function* ($) {
  const a = yield* $(Option.Some(5));
  const b = yield* $(Option.Some(a * 2));
  return b + 10;
});
console.log("6. gen:", genVersion.unwrap()); // 20
console.log("   genAdapter:", genAdapterVersion.unwrap()); // 20

// Example 7: genAdapter for complex object building
interface User {
  id: number;
  name: string;
  email: string;
}

const buildUser = Option.genAdapter(function* ($) {
  const id = yield* $(Option.Some(123));
  const name = yield* $(Option.Some("Alice"));
  const email = yield* $(Option.Some("alice@example.com"));

  return { id, name, email } as User;
});
console.log("7. Build user:", buildUser.unwrap()); // { id: 123, name: "Alice", email: "alice@example.com" }

// Example 8: genAdapter with method calls on objects
type Calculator = {
  add: (n: number) => Option<number>;
  multiply: (n: number) => Option<number>;
};

const calculator: Calculator = {
  add: (n) => Option.Some(n + 10),
  multiply: (n) => Option.Some(n * 2),
};

const calculate = Option.genAdapter(function* ($) {
  const result1 = yield* $(calculator.add(5));
  const result2 = yield* $(calculator.multiply(result1));
  return result2;
});
console.log("8. Method calls:", calculate.unwrap()); // 30 ((5 + 10) * 2)

// Example 9: genAdapter for dependent lookups
type UserId = number;
type BasicUser = { id: UserId; name: string };
type PostId = number;
type Post = { id: PostId; authorId: UserId; title: string };

const users: Map<UserId, BasicUser> = new Map([
  [1, { id: 1, name: "Alice" }],
  [2, { id: 2, name: "Bob" }],
]);

const posts: Map<PostId, Post> = new Map([
  [101, { id: 101, authorId: 1, title: "Hello" }],
  [102, { id: 102, authorId: 2, title: "World" }],
]);

const getUser = (id: UserId): Option<BasicUser> => {
  const user = users.get(id);
  return user ? Option.Some(user) : Option.None;
};

const getPost = (id: PostId): Option<Post> => {
  const post = posts.get(id);
  return post ? Option.Some(post) : Option.None;
};

const getPostWithAuthor = (postId: PostId) => {
  return Option.genAdapter(function* ($) {
    const post = yield* $(getPost(postId));
    const author = yield* $(getUser(post.authorId));
    return { post, author };
  });
};
console.log("9. Post with author:", getPostWithAuthor(101).unwrap()); // { post: {...}, author: {...} }

// Example 10: genAdapter with conditional logic
const conditional = Option.genAdapter(function* ($) {
  const input = yield* $(Option.Some(5));
  if (input > 0) {
    return input * 2;
  }
  return input;
});
console.log("10. Conditional:", conditional.unwrap()); // 10

// Example 11: genAdapter for nested object access
type Address = { street: string; city: string };
type Company = { name: string; address?: Address };
type Person = { name: string; company?: Company };

const getPersonCity = (person: Person) => {
  return Option.genAdapter(function* ($) {
    const company = yield* $(Option.fromNullable(person.company));
    const address = yield* $(Option.fromNullable(company.address));
    return address.city;
  });
};

const person1: Person = {
  name: "Alice",
  company: { name: "Acme", address: { street: "123 Main", city: "NYC" } },
};
const person2: Person = { name: "Bob" };

console.log("11a. Get city (present):", getPersonCity(person1).unwrap()); // "NYC"
console.log("11b. Get city (missing):", getPersonCity(person2)._tag); // "None"

// Example 12: genAdapter with safe parsing utilities
const safeParseInt = (str: string): Option<number> => {
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? Option.None : Option.Some(parsed);
};

const safeDivide = (a: number, b: number): Option<number> => {
  return b !== 0 ? Option.Some(a / b) : Option.None;
};

const parseAndCalculate = (aStr: string, bStr: string) => {
  return Option.genAdapter(function* ($) {
    const a = yield* $(safeParseInt(aStr));
    const b = yield* $(safeParseInt(bStr));
    const result = yield* $(safeDivide(a, b));
    return result;
  });
};
console.log("12a. Parse and calculate:", parseAndCalculate("10", "2").unwrap()); // 5
console.log(
  "12b. Parse and divide by zero:",
  parseAndCalculate("10", "0")._tag,
); // "None"

// Example 13: genAdapter for multi-step validation

const validateEmail = (email: string): Option<string> => {
  return email.includes("@") ? Option.Some(email) : Option.None;
};

const validatePassword = (password: string): Option<string> => {
  return password.length >= 8 ? Option.Some(password) : Option.None;
};

const validateAge = (age: number): Option<number> => {
  return age >= 18 ? Option.Some(age) : Option.None;
};

const validateUserData = (data: {
  email: string;
  password: string;
  age: number;
}) => {
  return Option.genAdapter(function* ($) {
    const validEmail = yield* $(validateEmail(data.email));
    const validPassword = yield* $(validatePassword(data.password));
    const validAge = yield* $(validateAge(data.age));

    return {
      email: validEmail,
      password: validPassword,
      age: validAge,
    };
  });
};
console.log(
  "13. Valid user:",
  validateUserData({
    email: "test@example.com",
    password: "password123",
    age: 25,
  }).unwrap(),
); // { email: "test@example.com", password: "password123", age: 25 }

// Example 14: genAdapter with accumulator pattern
const accumulator = Option.genAdapter(function* ($) {
  let acc = 0;
  const values = yield* $(Option.Some([1, 2, 3, 4, 5]));

  for (const value of values) {
    acc += value;
  }

  return acc;
});
console.log("14. Accumulator:", accumulator.unwrap()); // 15

// Example 15: genAdapter for array iteration
const sumValidNumbers = (arr: (number | string)[]) => {
  return Option.genAdapter(function* ($) {
    let sum = 0;
    for (const item of arr) {
      const num = yield* $(
        typeof item === "number" ? Option.Some(item) : Option.None,
      );
      sum += num;
    }
    return sum;
  });
};
console.log(
  "15. Sum valid numbers:",
  sumValidNumbers([1, 2, "oops", 3, 4])._tag,
); // "None" (hits "oops")
console.log(
  "    Sum valid numbers (all valid):",
  sumValidNumbers([1, 2, 3, 4, 5]).unwrap(),
); // 15

// Example 16: genAdapter for transaction-like operations
type Account = { balance: number };
const accounts = new Map<number, Account>([
  [1, { balance: 100 }],
  [2, { balance: 50 }],
]);

const getAccount = (id: number): Option<Account> => {
  return Option.fromNullable(accounts.get(id));
};

const debit = (account: Account, amount: number): Option<Account> => {
  return account.balance >= amount
    ? Option.Some({ balance: account.balance - amount })
    : Option.None;
};

const credit = (account: Account, amount: number): Option<Account> => {
  return Option.Some({ balance: account.balance + amount });
};

const transfer = (fromId: number, toId: number, amount: number) => {
  return Option.genAdapter(function* ($) {
    const fromAccount = yield* $(getAccount(fromId));
    const toAccount = yield* $(getAccount(toId));

    const debited = yield* $(debit(fromAccount, amount));
    const credited = yield* $(credit(toAccount, amount));

    return { from: debited, to: credited };
  });
};
console.log("16. Transfer:", transfer(1, 2, 30).unwrap()); // { from: { balance: 70 }, to: { balance: 80 } }
console.log("    Transfer (insufficient):", transfer(2, 1, 100)._tag); // "None"

// Example 17: genAdapter with Option.all
const getAllValues = Option.genAdapter(function* ($) {
  const [a, b, c] = yield* $(
    Option.all(Option.Some(1), Option.Some(2), Option.Some(3)),
  );
  return a + b + c;
});
console.log("17. Option.all in genAdapter:", getAllValues.unwrap()); // 6

// Example 18: genAdapter with Option.any
const getFirstValid = Option.genAdapter(function* ($) {
  const value = yield* $(Option.any(Option.None, Option.None, Option.Some(42)));
  return value;
});
console.log("18. Option.any in genAdapter:", getFirstValid.unwrap()); // 42

// Example 19: genAdapter for filtering with context
const findFirstEven = (numbers: number[]) => {
  return Option.genAdapter(function* ($) {
    for (const num of numbers) {
      if (num % 2 === 0) {
        return num;
      }
    }
    return yield* $(Option.None as Option<never>);
  });
};
console.log("19. Find first even:", findFirstEven([1, 3, 5, 7, 8]).unwrap()); // 8
console.log("    No even found:", findFirstEven([1, 3, 5, 7])._tag); // "None"

// Example 20: genAdapter comparing with gen
console.log("\n=== gen vs genAdapter Comparison ===\n");

console.log("gen:");
console.log("  - Simpler: yield* Option.Some(value)");
console.log("  - Direct, no adapter needed");
console.log("  - Good for simple cases");

console.log("\ngenAdapter:");
console.log("  - Explicit: yield* $(Option.Some(value))");
console.log("  - Better type inference for complex cases");
console.log("  - Adapter ($) makes yields clear");
console.log("  - Easier to scan for Option operations");

// Example 21: genAdapter with complex state building
type State = {
  count: number;
  sum: number;
  max: number;
};

const buildState = (numbers: number[]) => {
  return Option.genAdapter(function* ($) {
    const first = yield* $(Option.fromNullable(numbers[0]));
    let state: State = { count: 1, sum: first, max: first };

    for (let i = 1; i < numbers.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: it's ok
      const num = numbers[i]!;
      state = {
        count: state.count + 1,
        sum: state.sum + num,
        max: Math.max(state.max, num),
      };
    }

    return state;
  });
};
console.log("21. Build state:", buildState([3, 7, 2, 9, 1]).unwrap()); // { count: 5, sum: 22, max: 9 }

// Example 22: genAdapter for nested operations
const nestedOperation = Option.genAdapter(function* ($) {
  const outer = yield* $(Option.Some(5));

  const inner = Option.genAdapter(function* ($) {
    const doubled = yield* $(Option.Some(outer * 2));
    const tripled = yield* $(Option.Some(outer * 3));
    return { doubled, tripled };
  });

  return yield* $(inner);
});
console.log("22. Nested operations:", nestedOperation.unwrap()); // { doubled: 10, tripled: 15 }

// Example 23: genAdapter with fromPredicate
const isPositive = (n: number): boolean => n > 0;
const isEven = (n: number): boolean => n % 2 === 0;

const validateNumber = (n: number) => {
  return Option.genAdapter(function* ($) {
    const positive = yield* $(Option.fromPredicate(n, isPositive));
    const even = yield* $(Option.fromPredicate(positive, isEven));
    return even;
  });
};
console.log("23. Validate number (4):", validateNumber(4).unwrap()); // 4
console.log("    Validate number (5):", validateNumber(5)._tag); // "None"
console.log("    Validate number (-2):", validateNumber(-2)._tag); // "None"

// Example 24: genAdapter for sequential API-like calls
type ApiConfig = { baseUrl: string; apiKey: string };
type ApiResponse<T> = { data: T; status: number };

const fetchConfig = (): Option<ApiConfig> => {
  return Option.Some({ baseUrl: "https://api.example.com", apiKey: "secret" });
};

const fetchUser = (
  _config: ApiConfig,
  id: number,
): Option<ApiResponse<{ name: string }>> => {
  return Option.Some({ data: { name: `User ${id}` }, status: 200 });
};

const fetchUserPosts = (
  _config: ApiConfig,
  _userId: number,
): Option<ApiResponse<{ title: string }[]>> => {
  return Option.Some({ data: [{ title: "Post 1" }], status: 200 });
};

const getDashboard = (userId: number) => {
  return Option.genAdapter(function* ($) {
    const config = yield* $(fetchConfig());
    const userResponse = yield* $(fetchUser(config, userId));
    const postsResponse = yield* $(fetchUserPosts(config, userId));

    return {
      user: userResponse.data,
      posts: postsResponse.data,
      apiConfig: { baseUrl: config.baseUrl, apiKey: "***" },
    };
  });
};
console.log("24. Dashboard:", getDashboard(1).unwrap()); // { user: { name: "User 1" }, posts: [...], apiConfig: {...} }

// Example 25: genAdapter with unwrapOr
const getValueOrDefault = Option.genAdapter(function* ($) {
  const value = yield* $(Option.fromNullable(process.env.MY_VALUE));
  return value;
}).unwrapOr("default");

console.log("25. UnwrapOr:", getValueOrDefault); // "default" (env var not set)

console.log("\n=== All genAdapter examples completed ===");
