# Result Design Spec

## Goal

Provide a typesafe construct for encoding operations that can succeed or fail. A Result represents either success (`Ok<T>`) containing a value of type T, or failure (`Err<E>`) containing an error of type E. This allows for explicit error handling without exceptions and enables composable error-handling patterns.

All the mapping methods should allow both sync and async functions. In either case, the return type is still Result. This allows a fluent programming style even when some operations are async.

## Required API

### map

Takes a function that maps the contained success value to another value.
If the Result is Err, the function is not called and Err is returned.

```ts
map<U>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<U>): Result<Promise<U>, E>;
map<U>(this: Result<Promise<T>, E>, fn: (val: T) => U): Result<Promise<U>, E>;
map<U>(this: Result<T, E>, fn: (val: T) => Promise<U>): Result<Promise<U>, E>;
map<U>(this: Result<T, E>, fn: (val: T) => U): Result<U, E>;
```

### flatMap

Takes a function that maps the contained success value to another Result.
If the Result is Err, the function is not called and Err is returned.
Also known as `andThen`, `bind`, or `fmap`.

```ts
flatMap<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Result<Promise<U>, E2>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<Result<Promise<U>, E2>>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Result<U, E2>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<T, E>, fn: (val: T) => Promise<Result<Promise<U>, E2>>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<T, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<U>, E | E2>;
flatMap<U, E2>(this: Result<T, E>, fn: (val: T) => Result<U, E2>): Result<U, E | E2>;
```

### zip

Takes a function that maps the contained success value to another value, and combines it with the original value in a tuple.
If the Result is Err, Err is returned.

```ts
zip<U>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<U>): Result<Promise<[T, U]>, E>;
zip<U>(this: Result<Promise<T>, E>, fn: (val: T) => U): Result<Promise<[T, U]>, E>;
zip<U>(this: Result<T, E>, fn: (val: T) => Promise<U>): Result<Promise<[T, U]>, E>;
zip<U>(this: Result<T, E>, fn: (val: T) => U): Result<[T, U], E>;
```

### flatZip

Takes a function that maps the contained success value to another Result, and combines the original value with the Result's success value in a tuple.
If either Result is Err, Err is returned.

```ts
flatZip<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Result<Promise<U>, E2>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<Promise<T>, E>, fn: (val: T) => Promise<Result<U, E2>>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<T, E>, fn: (val: T) => Result<Promise<U>, E2>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<T, E>, fn: (val: T) -> Promise<Result<U, E2>>): Result<Promise<[T, U]>, E | E2>;
flatZip<U, E2>(this: Result<T, E>, fn: (val: T) -> Result<U, E2>): Result<[T, U], E | E2>;
```

## Additional Required Methods

### Error Mapping

#### mapErr

Maps the error value to another error type while preserving the success value.

```ts
mapErr<E2>(fn: (err: E) => E2): Result<T, E2>;
```

#### mapBoth

Maps both the success and error values simultaneously.

```ts
mapBoth<T2, E2>(fnOk: (val: T) => T2, fnErr: (err: E) => E2): Result<T2, E2>;
```

#### zipErr

Combines errors while retaining the original success value.

```ts
zipErr<E2>(fn: (val: T) -> Result<unknown, E2>): Result<T, E | E2>;
zipErr<E2>(fn: (val: T) -> Promise<Result<unknown, E2>>): Result<Promise<T>, E | E2>;
```

### Validation

#### validate

Runs multiple validators against the contained value and returns all validation errors.

```ts
validate<VE extends unknown[]>(validators: { [K in keyof VE]: (val: T) -> Result<unknown, VE[K]> }): Result<T, E | VE[number][]>;
validate<VE extends unknown[]>(validators: { [K in keyof VE]: (val: T) -> Promise<Result<unknown, VE[K]>> }): Result<Promise<T>, E | VE[number][]>;
```

### Aggregation

#### all (static)

Combines multiple Results into a single Result. Returns the first error encountered or all values if all succeed.

```ts
static all<T extends Result<unknown, unknown>[]>(...results: T): Result<CombinedResultOk<T>, CombinedResultErr<T>[]>;
```

### Utility Methods

#### flip

Swaps the success and error types, turning Ok<T, E> into Ok<E, T> and vice versa.

```ts
flip(): Result<E, T>;
```

#### innerMap

Maps over the values inside an Array contained within a Result.

```ts
innerMap<Out>(mapper: (val: In) -> Out): Result<Array<Out>, E>;
```

#### toPromise

Converts a Result containing a Promise to a Promise containing a Result.

```ts
toPromise(): Promise<Result<Awaited<T>, E>>;
```

## Core Instance Methods

### State Checking

- `isOk(): boolean` - Returns true if the Result is Ok
- `isErr(): boolean` - Returns true if the Result is Err
- `isUnit(): boolean` - Returns true if the Result is a unit Ok value

### Value Extraction

- `unwrap(): T | throws Error` - Returns the success value or throws if Err
- `unwrapErr(): E | throws Error` - Returns the error value or throws if Ok
- `safeUnwrap(): T | null` - Returns the success value or null if Err

### String Representation

- `toString(): string` - Returns string representation of the Result

## Static Constructors

```ts
static Ok<T, E = never>(val: T): Result<T, E>;
static Err<E, T = never>(err: E): Result<T, E>;
static readonly UNIT_RESULT: UnitResult; // Pre-created unit Result
```

## Example Usage

```ts
// Basic Result creation
const successValue: Result<number, string> = Result.Ok(42);
const errorValue: Result<number, string> = Result.Err("Something went wrong");
const asyncSuccessValue: Result<Promise<number>, string> = Result.Ok(
  Promise.resolve(100),
);

// map
const mappedSuccess = successValue.map((x) => x * 2); // Result.Ok(84)
const mappedError = errorValue.map((x) => x * 2); // Result.Err("Something went wrong")
const asyncMapped = asyncSuccessValue.map(async (x) => x + 10); // Result<Promise<110>, string>

// flatMap
const flatMappedSuccess = successValue.flatMap((x) => Result.Ok(x + 1)); // Result.Ok(43)
const flatMappedError = errorValue.flatMap((x) => Result.Ok(x + 1)); // Result.Err("Something went wrong")
const asyncFlatMapped = asyncSuccessValue.flatMap(async (x) =>
  Result.Ok(x * 3),
); // Result<Promise<300>, string>

// zip
const zippedSuccess = successValue.zip((x) => x * 10); // Result.Ok([42, 420])
const zippedError = errorValue.zip((x) => x * 10); // Result.Err("Something went wrong")
const asyncZipped = asyncSuccessValue.zip(async (x) => x + 50); // Result<Promise<[100, 150]>, string>

// flatZip
const flatZippedSuccess = successValue.flatZip((x) => Result.Ok(x + 5)); // Result.Ok([42, 47])
const flatZippedError = errorValue.flatZip((x) => Result.Ok(x + 5)); // Result.Err("Something went wrong")
const asyncFlatZipped = asyncSuccessValue.flatZip(async (x) =>
  Result.Ok(x * 2),
); // Result<Promise<[100, 200]>, string>

// mapErr
const mappedErr = errorValue.mapErr((err) => `Error: ${err}`); // Result.Err("Error: Something went wrong")
const mappedSuccess = successValue.mapErr((err) => `Error: ${err}`); // Result.Ok(42)

// validate
const validated = successValue.validate([
  (val) => (val > 0 ? Result.Ok(true) : Result.Err("Must be positive")),
  (val) => (val < 100 ? Result.Ok(true) : Result.Err("Must be less than 100")),
]); // Result.Ok(42)

const validatedFail = successValue.validate([
  (val) => (val > 0 ? Result.Ok(true) : Result.Err("Must be positive")),
  (val) =>
    val > 100 ? Result.Ok(true) : Result.Err("Must be greater than 100"),
]); // Result.Err(["Must be greater than 100"])

// all
const combined = Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3)); // Result.Ok([1, 2, 3])

const combinedErr = Result.all(
  Result.Ok(1),
  Result.Err("error1"),
  Result.Err("error2"),
); // Result.Err(["error1", "error2"])

// flip
const flippedSuccess = successValue.flip(); // Result.Err(42)
const flippedError = errorValue.flip(); // Result.Ok("Something went wrong")
```

## Implementation Notes

- **Hybrid Type Support**: The Result implementation supports both synchronous and asynchronous operations seamlessly
- **Error Composition**: Multiple errors can be combined using validation and aggregation methods
- **Type Safety**: TypeScript generics ensure type safety throughout the pipeline operations
- **Sentinel Values**: Internal implementation uses sentinel values to distinguish between absent values and legitimate values
- **Promise Chaining**: Asynchronous operations maintain proper promise chains without unnecessary wrapping
- **Context Propagation**: Error context is preserved throughout the operation chain for proper error handling

## Performance Considerations

- Avoid unnecessary promise wrapping when dealing with synchronous operations
- Lazy evaluation for zip and flatZip operations to prevent premature computation
- Efficient error propagation without intermediate object creation where possible
- Context reuse to minimize memory allocation during operation chaining

## Type System Integration

The Result type integrates seamlessly with:

- TypeScript's union types for error handling
- Generic constraints for type-safe operations
- Async/await patterns for asynchronous workflows
- Promise-based APIs and libraries
- Other functional programming constructs in the library (Option, Match, etc.)
