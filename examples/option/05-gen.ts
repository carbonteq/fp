/**
 * Option.gen() - Generator-based syntax for Option composition
 *
 * Option.gen() provides imperative-style code while maintaining
 * functional optional handling. Short-circuits on first None.
 */

import { Option } from "../../dist/option.mjs";

// ============================================================================
// BASIC GEN EXAMPLES
// ============================================================================

console.log("=== Option.gen() Examples ===\n");

// Example 1: Simple gen with single yield
const simple = Option.gen(function* () {
  const value = yield* Option.Some(42);
  return value;
});
console.log("1. Simple gen:", simple.unwrap()); // 42

// Example 2: Multiple yields - sequence operations
const multiple = Option.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* Option.Some(10);
  return a + b;
});
console.log("2. Multiple yields:", multiple.unwrap()); // 15

// Example 3: Short-circuit on first None
const shortCircuit = Option.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* Option.None; // This causes None to return
  const c = yield* Option.Some(10); // This is never reached
  return a + b + c;
});
console.log("3. Short-circuit:", shortCircuit._tag); // "None"

// Example 4: gen with function calls
const fetchValue = (key: string): Option<number> => {
  if (key === "valid") return Option.Some(42);
  return Option.None;
};

const withFetch = Option.gen(function* () {
  const a = yield* fetchValue("valid");
  const b = yield* fetchValue("valid");
  return a + b;
});
console.log("4. With fetch:", withFetch.unwrap()); // 84

// Example 5: gen for validation pipeline
const validatePositive = (n: number): Option<number> => {
  return n > 0 ? Option.Some(n) : Option.None;
};

const validateEven = (n: number): Option<number> => {
  return n % 2 === 0 ? Option.Some(n) : Option.None;
};

const validate = Option.gen(function* () {
  const input = yield* Option.Some(4);
  const positive = yield* validatePositive(input);
  const even = yield* validateEven(positive);
  return even * 2;
});
console.log("5. Validation pipeline:", validate.unwrap()); // 8

// Example 6: gen vs flatMap readability
// flatMap version (nested)
const flatMapVersion = Option.Some(5).flatMap((a) =>
  Option.Some(a * 2).flatMap((b) => Option.Some(b + 10)),
);

// gen version (linear)
const genVersion = Option.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* Option.Some(a * 2);
  return b + 10;
});
console.log("6. flatMap:", flatMapVersion.unwrap()); // 20
console.log("   gen:", genVersion.unwrap()); // 20

// Example 7: gen for complex object building
interface User {
  id: number;
  name: string;
  email: string;
}

const buildUser = Option.gen(function* () {
  const id = yield* Option.Some(123);
  const name = yield* Option.Some("Alice");
  const email = yield* Option.Some("alice@example.com");

  return { id, name, email } as User;
});
console.log("7. Build user:", buildUser.unwrap()); // { id: 123, name: "Alice", email: "alice@example.com" }

// Example 8: gen with intermediate processing
const processData = Option.gen(function* () {
  const rawData = yield* Option.Some("  hello world  ");
  const trimmed = rawData.trim();
  const upper = trimmed.toUpperCase();
  const words = upper.split(" ");
  return words;
});
console.log("8. Process data:", processData.unwrap()); // ["HELLO", "WORLD"]

// Example 9: gen with array operations
const arrayOps = Option.gen(function* () {
  const numbers = yield* Option.Some([1, 2, 3, 4, 5]);
  const doubled = numbers.map((n) => n * 2);
  const filtered = doubled.filter((n) => n > 5);
  const sum = filtered.reduce((a, b) => a + b, 0);
  return sum;
});
console.log("9. Array operations:", arrayOps.unwrap()); // 24 (6 + 8 + 10)

// Example 10: gen for dependent operations
type UserId = number;
type BasicUser = { id: UserId; name: string };
type PostId = number;
type Post = { id: PostId; authorId: UserId; title: string };

const getUser = (id: UserId): Option<BasicUser> => {
  return Option.Some({ id, name: `User ${id}` });
};

const getPostsByUser = (user: BasicUser): Option<Post[]> => {
  return Option.Some([
    { id: 1, authorId: user.id, title: `${user.name}'s Post` },
  ]);
};

const getUserWithPosts = (userId: UserId) => {
  return Option.gen(function* () {
    const user = yield* getUser(userId);
    const posts = yield* getPostsByUser(user);
    return { user, posts };
  });
};
console.log("10. User with posts:", getUserWithPosts(1).unwrap()); // { user: { id: 1, name: "User 1" }, posts: [...] }

// Example 11: gen with no yields (just returns value)
// biome-ignore lint/correctness/useYield: test
const noYields = Option.gen(function* () {
  // oxlint-disable-next-line require-yield
  return 42;
});
console.log("11. No yields:", noYields.unwrap()); // 42

// Example 12: gen for error context collection
const validateName = (name: string): Option<string> => {
  return name.length > 0 ? Option.Some(name) : Option.None;
};

const validateEmail = (email: string): Option<string> => {
  return email.includes("@") ? Option.Some(email) : Option.None;
};

const validateForm = (name: string, email: string) => {
  return Option.gen(function* () {
    const validName = yield* validateName(name);
    const validEmail = yield* validateEmail(email);
    return { name: validName, email: validEmail };
  });
};
console.log(
  "12. Valid form:",
  validateForm("Alice", "alice@example.com").unwrap(),
); // { name: "Alice", email: "alice@example.com" }
console.log("    Invalid form:", validateForm("", "invalid")._tag); // "None"

// Example 13: gen handles many yields without stack overflow
const manyYields = Option.gen(function* () {
  let sum = 0;
  for (let i = 0; i < 100; i++) {
    const value = yield* Option.Some(i);
    sum += value;
  }
  return sum;
});
console.log("13. Many yields:", manyYields.unwrap()); // 4950 (sum of 0-99)

// Example 14: gen with conditional logic
const conditional = Option.gen(function* () {
  const input = yield* Option.Some(5);
  if (input > 0) {
    return input * 2;
  }
  return input;
});
console.log("14. Conditional:", conditional.unwrap()); // 10

// Example 15: gen with early return on None
const earlyReturn = Option.gen(function* () {
  const a = yield* Option.Some(5);
  const b = yield* validatePositive(a);
  const c = yield* validateEven(b);

  // If we reach here, all validations passed
  return c;
});
console.log("15. Early return:", earlyReturn._tag); // "None" (5 is not even)

// Example 16: gen for sequential lookup pattern
type Config = { apiKey: string; endpoint: string };
const fetchConfig = (): Option<Config> => {
  return Option.Some({ apiKey: "secret", endpoint: "/api" });
};

const validateConfig = (config: Config): Option<Config> => {
  return config.apiKey.length > 0 ? Option.Some(config) : Option.None;
};

const initialize = () => {
  return Option.gen(function* () {
    const config = yield* fetchConfig();
    const validated = yield* validateConfig(config);
    return { initialized: true, config: validated };
  });
};
console.log("16. Initialize:", initialize().unwrap()); // { initialized: true, config: { apiKey: "secret", endpoint: "/api" } }

// Example 17: gen preserves type information through yields
type NumberOption = Option<number>;
type StringOption = Option<string>;

const typedPipeline = Option.gen(function* () {
  const num = yield* Option.Some(42) as NumberOption;
  const str = yield* Option.Some(num.toString()) as StringOption;
  return { num, str };
});
console.log("17. Typed pipeline:", typedPipeline.unwrap()); // { num: 42, str: "42" }

// Example 18: gen with unwrapOrElse pattern
const withFallback = Option.gen(function* () {
  const primary = yield* fetchValue("invalid");
  return primary;
}).unwrapOr(0);
console.log("18. With fallback:", withFallback); // 0

// Example 19: gen for data transformation pipeline
type RawData = { value: string };
type ParsedData = { value: number };
type ValidatedData = { value: number; isValid: true };

const parse = (data: RawData): Option<ParsedData> => {
  const num = Number(data.value);
  return Number.isNaN(num) ? Option.None : Option.Some({ value: num });
};

const validateRawData = (data: ParsedData): Option<ValidatedData> => {
  return data.value > 0
    ? Option.Some({ value: data.value, isValid: true })
    : Option.None;
};

const processRawData = (raw: RawData) => {
  return Option.gen(function* () {
    const parsed = yield* parse(raw);
    const validated = yield* validateRawData(parsed);
    return validated;
  });
};
console.log("19. Process raw data:", processRawData({ value: "42" }).unwrap()); // { value: 42, isValid: true }

// Example 20: gen with accumulator pattern
const accumulator = Option.gen(function* () {
  let acc = 0;
  const values = yield* Option.Some([1, 2, 3, 4, 5]);

  for (const value of values) {
    acc += value;
  }

  return acc;
});
console.log("20. Accumulator:", accumulator.unwrap()); // 15

// Example 21: gen for safe navigation through nested objects
type Address = { street: string; city: string };
type Company = { name: string; address?: Address };
type Person = { name: string; company?: Company };

const getCity = (person: Person): Option<string> => {
  return Option.gen(function* () {
    const company = yield* Option.fromNullable(person.company);
    const address = yield* Option.fromNullable(company.address);
    return address.city;
  });
};

const person1: Person = {
  name: "Alice",
  company: { name: "Acme", address: { street: "123 Main", city: "NYC" } },
};
const person2: Person = { name: "Bob", company: { name: "Acme" } };
const person3: Person = { name: "Charlie" };

console.log("21a. Get city (present):", getCity(person1).unwrap()); // "NYC"
console.log("21b. Get city (no address):", getCity(person2)._tag); // "None"
console.log("21c. Get city (no company):", getCity(person3)._tag); // "None"

// Example 22: gen with Option.all
const getAllValues = Option.gen(function* () {
  const [a, b, c] = yield* Option.all(
    Option.Some(1),
    Option.Some(2),
    Option.Some(3),
  );
  return a + b + c;
});
console.log("22. Option.all in gen:", getAllValues.unwrap()); // 6

// Example 23: gen with Option.any
const getFirstValid = Option.gen(function* () {
  const value = yield* Option.any(
    Option.None,
    Option.None,
    Option.Some(42),
    Option.Some(99),
  );
  return value;
});
console.log("23. Option.any in gen:", getFirstValid.unwrap()); // 42

// Example 24: gen with match
const describeValue = Option.gen(function* () {
  const value = yield* Option.Some(5);

  return value;
}).match({
  Some: (v) => `Got ${v}`,
  None: () => "Got nothing",
});

console.log("24. Match in gen:", describeValue); // "Got 5"

// Example 25: gen combining multiple Option operations
const complexPipeline = Option.gen(function* () {
  // Start with a string
  const input = yield* Option.Some("42");

  // Parse it
  const parsed = yield* Option.fromNullable(Number(input)).filter(
    (n) => !Number.isNaN(n),
  );

  // Validate positive
  const positive = yield* Option.fromPredicate(parsed, (n) => n > 0);

  // Double it
  return positive * 2;
});
console.log("25. Complex pipeline:", complexPipeline.unwrap()); // 84

console.log("\n=== All gen examples completed ===");
