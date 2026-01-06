# Option Design Spec

## Goal

Provide a typesafe construct for encoding presence and absence of a value.
All the mapping methods should allow both sync and async functions. In either case, the return type is still Option. This allows a fluent programming style even when some operations are async.

## Required API

### map

Takes a function that maps the contained value to another value.
If the Option is None, the function is not called and None is returned.

```ts
map<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<U>): Option<Promise<U>>;
map<U>(this: Option<Promise<U>>, fn: (val: T) => U): Option<Promise<U>>;
map<U>(this: Option<T>, fn: (val: T) => Promise<U>): Option<Promise<U>>;
map<U>(this: Option<T>, fn: (val: T) => U): Option<U>;
```

### flatMap

Takes a function that maps the contained value to another Option.
If the Option is None, the function is not called and None is returned.

```ts
flatMap<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<Option<U>>): Option<Promise<U>>;
flatMap<U>(this: Option<Promise<T>>, fn: (val: T) => Option<U>): Option<Promise<U>>;
flatMap<U>(this: Option<T>, fn: (val: T) => Promise<Option<U>>): Option<Promise<U>>;
flatMap<U>(this: Option<T>, fn: (val: T) => Option<U>): Option<U>;
```

### zip

Takes a function that maps the contained value to another value, and combines it with another Option.
If either Option is None, None is returned.

```ts
zip<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<U>): Option<Promise<[T, U]>>;
zip<U>(this: Option<Promise<T>>, fn: (val: T) => U): Option<Promise<[T, U]>>;
zip<U>(this: Option<T>, fn: (val: T) => Promise<U>): Option<Promise<[T, U]>>;
zip<U>(this: Option<T>, fn: (val: T) => U): Option<[T, U]>;
```

### flatZip

Takes a function that maps the contained value to another Option, and combines it with another Option.
If either Option is None, None is returned.

```ts
flatZip<U>(this: Option<Promise<T>>, fn: (val: T) => Promise<Option<U>>): Option<Promise<[T, U]>>;
flatZip<U>(this: Option<Promise<T>>, fn: (val: T) => Option<U>): Option<Promise<[T, U]>>;
flatZip<U>(this: Option<T>, fn: (val: T) => Promise<Option<U>>): Option<Promise<[T, U]>>;
flatZip<U>(this: Option<T>, fn: (val: T) => Option<U>): Option<[T, U]>;
```

## Additional Requirements

- The implementation should be generic and work with any type T.
- The implementation should be efficient and avoid unnecessary computations.
- The implementation should be well-documented and include examples of usage.

## Example Usage

```ts
const someValue: Option<number> = Option.Some(5);
const noneValue: Option<number> = Option.None();
const asyncSomeValue: Option<Promise<number>> = Option.Some(
  Promise.resolve(10),
);
const asyncNoneValue: Option<Promise<number>> = Option.None();
// map
const mappedValue = someValue.map((x) => x * 2); // Option.Some(10
const mappedNone = noneValue.map((x) => x * 2); // Option.None()
const asyncMappedValue = asyncSomeValue.map(async (x) => x * 3); // Option
const asyncMappedNone = asyncNoneValue.map(async (x) => x * 3); // Option.None()
// flatMap
const flatMappedValue = someValue.flatMap((x) => Option.Some(x + 1)); // Option.Some(6)
const flatMappedNone = noneValue.flatMap((x) => Option.Some(x + 1)); // Option.None()
const asyncFlatMappedValue = asyncSomeValue.flatMap(async (x) =>
  Option.Some(x + 2),
); // Option
const asyncFlatMappedNone = asyncNoneValue.flatMap(async (x) =>
  Option.Some(x + 2),
); // Option.None()
// zip
const zippedValue = someValue.zip((x) => x * 4); // Option.Some([5, 20])
const zippedNone = noneValue.zip((x) => x * 4); // Option.None()
const asyncZippedValue = asyncSomeValue.zip(async (x) => x * 5); // Option<Promise<[10, 50]>>
const asyncZippedNone = asyncNoneValue.zip(async (x) => x * 5); // Option.None()
// flatZip
const flatZippedValue = someValue.flatZip((x) => Option.Some(x + 3)); // Option.Some([5, 8])
const flatZippedNone = noneValue.flatZip((x) => Option.Some(x + 3)); // Option.None()
const asyncFlatZippedValue = asyncSomeValue.flatZip(async (x) =>
  Option.Some(x + 4),
); // Option<Promise<[10, 14]>>
const asyncFlatZippedNone = asyncNoneValue.flatZip(async (x) =>
  Option.Some(x + 4),
); // Option.None()
```

### Other methods

In addition to the required API, the Option type should also include the following methods for completeness:

- isSome(): boolean
- isNone(): boolean
- unwrap(): T | throws Error
- unwrapOr(defaultValue: T): T
- unwrapOrElse(fn: () => T): T
- safeUnwrap(): {success: true, value: T} | {success: false}

## Implementation Notes

- Consider using TypeScript's union types and generics to implement the Option type.
- Ensure that the mapping functions handle both synchronous and asynchronous cases correctly.
- Write unit tests to verify the correctness of the implementation.
