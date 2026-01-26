/**
 * Option.flatZip() - Pair original with value from another Option
 *
 * flatZip() is like zip() but the function returns an Option.
 * It pairs the original value with the unwrapped value from the Option.
 * If either Option is None, None propagates.
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs";

// ============================================================================
// BASIC FLATZIP EXAMPLES
// ============================================================================

console.log("=== Option.flatZip() Examples ===\n");

// Example 1: Basic flatZip - pair value with Option-returning function
const flatZipped = Option.Some(5).flatZip((x) => Option.Some(x * 2));
console.log("1. FlatZip 5 with Some(10):", flatZipped.unwrap()); // [5, 10]

// Example 2: flatZip with None - None propagates
const flatZippedNone = Option.Some(5).flatZip((_x) => Option.None);
console.log("2. FlatZip with None:", flatZippedNone._tag); // "None"

// Example 3: flatZip on initial None - short-circuits
const initialNone = Option.None.flatZip((x: number) => Option.Some(x * 2));
console.log("3. FlatZip on initial None:", initialNone._tag); // "None"

// Example 4: Chaining flatZips - accumulate values
const chained = Option.Some(1)
  .flatZip((a) => Option.Some(a + 1)) // [1, 2]
  .flatZip(([a, b]) => Option.Some(a + b)); // [[1, 2], 3]

console.log("4. Chained flatZip:", chained.unwrap()); // [[1, 2], 3]

// Example 5: Practical - User and their posts
type UserId = number;
type User = { id: UserId; name: string };
type Post = { id: number; authorId: UserId; title: string };

const getUser = (id: UserId): Option<User> => {
  return Option.Some({ id, name: `User ${id}` });
};

const getUserPosts = (user: User): Option<Post[]> => {
  return Option.Some([
    { id: 1, authorId: user.id, title: `${user.name}'s Post` },
  ]);
};

const userWithPosts = getUser(1).flatZip((user) => getUserPosts(user));
console.log("5. User with posts:", userWithPosts.unwrap()); // [{ id: 1, name: "User 1" }, [{ ... }]]

// Example 6: flatZip for dependent lookups
type ProductId = number;
type Product = { id: ProductId; name: string; price: number };
type Inventory = { productId: ProductId; quantity: number };

const getProduct = (id: ProductId): Option<Product> => {
  return Option.Some({ id, name: "Widget", price: 10 });
};

const getInventory = (product: Product): Option<Inventory> => {
  return Option.Some({ productId: product.id, quantity: 100 });
};

const productWithInventory = getProduct(1).flatZip((product) =>
  getInventory(product),
);
console.log("6. Product with inventory:", productWithInventory.unwrap()); // [{ id: 1, name: "Widget", price: 10 }, { productId: 1, quantity: 100 }]

// Example 7: flatZip for validation with context preservation
const validateEmailBasic = (email: string): Option<string> => {
  return email.includes("@") ? Option.Some(email) : Option.None;
};

const normalizeEmail = (email: string): Option<string> => {
  return Option.Some(email.toLowerCase().trim());
};

const emailWithValidation = Option.Some("USER@EXAMPLE.COM")
  .flatZip((email) => normalizeEmail(email))
  .flatZip(([_original, normalized]) => validateEmailBasic(normalized));

console.log("7. Email validation chain:", emailWithValidation.unwrap()); // [["USER@EXAMPLE.COM", "user@example.com"], "user@example.com"]

// Example 8: flatZip for building complex objects step by step
type Address = { street: string; city: string };
type Person = { name: string; age: number };

const validatePerson = (data: {
  name: string;
  age: number;
}): Option<Person> => {
  return data.age >= 18 ? Option.Some(data) : Option.None;
};

const fetchAddress = (_person: Person): Option<Address> => {
  return Option.Some({ street: "123 Main St", city: "Anytown" });
};

const createPersonWithAddress = (data: { name: string; age: number }) => {
  return validatePerson(data).flatMap((person) =>
    fetchAddress(person).map((address) => ({
      ...person,
      address,
    })),
  );
};

console.log(
  "8. Person with address:",
  createPersonWithAddress({ name: "Alice", age: 25 }).unwrap(),
); // { name: "Alice", age: 25, address: { street: "123 Main St", city: "Anytown" } }

// Example 9: flatZip vs flatMap - preserving original
const flatMapResult = Option.Some(5).flatMap((x) => Option.Some(x * 2)); // Option<number>
const flatZipResult = Option.Some(5).flatZip((x) => Option.Some(x * 2)); // Option<[5, 10]>

console.log("9. flatMap loses original:", flatMapResult.unwrap()); // 10
console.log("    flatZip preserves:", flatZipResult.unwrap()); // [5, 10]

// Example 10: flatZip for collecting audit trail
type AuditLog<T> = { timestamp: number; data: T };

const withAudit = <T>(option: Option<T>): Option<[T, AuditLog<T>]> => {
  const timestamp = Date.now();
  return option.flatZip((data) => Option.Some({ timestamp, data }));
};

const auditedResult = withAudit(Option.Some({ value: 42 }));
console.log("10. Audited result:", auditedResult.unwrap()); // [{ value: 42 }, { timestamp: ..., data: { value: 42 } }]

// Example 11: flatZip for maintaining context through transformations
type Context<T> = { original: T; current: T };

const withContext = <T>(value: T): Option<Context<T>> => {
  return Option.Some({ original: value, current: value });
};

const transformWithContext = <T>(
  context: Option<Context<T>>,
  fn: (value: T) => Option<T>,
): Option<Context<T>> => {
  return context.flatMap((ctx) =>
    fn(ctx.current).map((newCurrent) => ({
      original: ctx.original,
      current: newCurrent,
    })),
  );
};

const result2 = transformWithContext(withContext(10), (n) =>
  Option.Some(n * 2),
).flatMap((ctx) =>
  transformWithContext(Option.Some(ctx), (n) => Option.Some(n + 5)),
);

console.log("11. Context through transformations:", result2.unwrap()); // { original: 10, current: 25 }

// Example 12: flatZip for branching logic
const getConfig = (key: string): Option<string> => {
  const configs: Record<string, string> = {
    api_key: "secret123",
    timeout: "5000",
  };
  const value = configs[key];
  return value ? Option.Some(value) : Option.None;
};

const parseTimeout = (timeoutStr: string): Option<number> => {
  const parsed = parseInt(timeoutStr, 10);
  return Number.isNaN(parsed) ? Option.None : Option.Some(parsed);
};

const getConfigValue = (key: string): Option<[string, number]> => {
  return getConfig(key).flatZip((value) => parseTimeout(value));
};

console.log("12. Config value:", getConfigValue("timeout").unwrap()); // ["5000", 5000]
console.log("    Invalid config:", getConfigValue("api_key")._tag); // "None" (because "secret123" is not a number)

// Example 13: flatZip for multi-step validation pipeline
interface UserData {
  email: string;
  password: string;
  age: number;
}

const validateEmail = (email: string): Option<string> => {
  return email.includes("@") ? Option.Some(email) : Option.None;
};

const validatePassword = (password: string): Option<string> => {
  return password.length >= 8 ? Option.Some(password) : Option.None;
};

const validateAge = (age: number): Option<number> => {
  return age >= 18 ? Option.Some(age) : Option.None;
};

const validateUserData = (data: UserData): Option<UserData> => {
  return Option.Some(data)
    .flatMap((data) => validateEmail(data.email).map(() => data))
    .flatMap((data) => validatePassword(data.password).map(() => data))
    .flatMap((data) => validateAge(data.age).map(() => data));
};

console.log(
  "13. Valid user:",
  validateUserData({
    email: "test@example.com",
    password: "password123",
    age: 25,
  }).unwrap(),
); // { email: "test@example.com", password: "password123", age: 25 }
console.log(
  "    Invalid email:",
  validateUserData({
    email: "invalid",
    password: "password123",
    age: 25,
  })._tag,
); // "None"

// Example 14: flatZip for safe nested access with context
type Department = { name: string; manager?: Employee };
type Employee = { name: string; department?: Department };

const getDepartmentManager = (dept: Department): Option<Employee> => {
  return Option.fromNullable(dept.manager);
};

const getEmployeeDepartment = (emp: Employee): Option<Department> => {
  return Option.fromNullable(emp.department);
};

const getManagerWithEmployee = (
  emp: Employee,
): Option<[Employee, Employee]> => {
  return Option.Some(emp).flatZip((emp) =>
    getEmployeeDepartment(emp).flatMap((dept) => getDepartmentManager(dept)),
  );
};

const dept: Department = { name: "Engineering", manager: { name: "Alice" } };
const emp: Employee = { name: "Bob", department: dept };

console.log("14. Manager with employee:", getManagerWithEmployee(emp).unwrap()); // [emp, manager]

console.log("\n=== All flatZip examples completed ===");
