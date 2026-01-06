# Result Cheatsheet (WIP)

```typescript
class FooError extends Error {}
class BarError extends Error {}
class BazError extends Error {}
class SomeOtherError extends Error {}

const res1 = Result.Ok<string, FooError>(""); // Ok type is string, Err type is Foo
const res2 = Result.Ok<boolean, BarError>(false); // Ok type is boolean, Err type is BarError
const res3 = Result.Err<Array<number>, SomeOtherError>;

const mapper = (str: string) => new Date();

const anotherMapper = (b: boolean): Result<number, BazError> =>
  b ? Result.Ok(420) : new BazError("");
```

|                   | Mapper returns primitive | Mapper returns Result |
| ----------------- | ------------------------ | --------------------- |
| Replace Ok type   | `map`                    | `flatMap`             |
| Append to Ok type | `zip`                    | `flatZip`             |

## `map`

Used when you want to morph the internal `Ok` type from `T` to `U` using a function that accepts `T` and returns `U`.

```typescript
const mappedRes = res1.map(mapper);
//^ type is Result<Date, FooError>
```

### `flatMap` / `bind`

When the mapper function is fallible (can produce an expected Error). As the function shouldn't throw the expected error (keeping the promise of a pure core), it will return a Result, looking something like `(value: T) => Result<U, E2>`. But if we use `map`, we would get a `Result` of a `Result`, which is probably not what we want.

```typescript
const mappedRes = res2.map(anotherMapper); // the return type of this will be Result<Result<number, BazError>, BarError>, which is not really what we want

const flatMappedRes = res2.flatMap(anotherMapper); // or res2.bind(anotherMapper)
//^ type is Result<number, BarError | BazError>.
```

As you can see, the nested results have been `flattened` into one, hence the name.

### `zip`

Like map, but instead of replacing the Ok type, it creates a tuple containing the old and new value. Note that it is a two element tuple, and not an array, giving us better type safety at build time.

```typescript
const zippedRes = res1.zip(mapper); // type is Result<[string, Date], FooError>.
```

### `flatZip`

`flatZip` is to `zip` what `flatMap` is to `map`

```typescript
const flattenedZipped = res2.flatZip(anotherMapper); // type is Result<[boolean, number], BarError | BazError>
```

### `mapErr`

To map the `Err` value instead of the `Ok` value.

```typescript
const mapped = res1.mapErr((previousErr) => new SomeOtherError("")); // Result<string, SomeOtherError>
```

### `zipErr`

For composing the `Err` values while discarding the `Ok` value from the mapper result. Most useful when the mapper returns a unit result.

```typescript
const zippedErr = res2.zipErr(anotherMapper); // type is Result<boolean, BarError | BazError>
// flatMap would have returned Result<number, BarError | BazError>
// flatZip would have returned Result<[boolean, number], BarError | BazError>
```

### `innerMap`

When you have a `Result<Array<T>, E>` and you want to map on the inner array. This would prevent ugly code like `res.map(arr => arr.map(arrMapper))`.

### `Result.sequence`

To "combine" multiple results into a single one. Kind of like a variadic `flatZip`

```typescript
const res = Result.sequence(res1, res2, res3); // Type is Result<[string, boolean, Array<number>], FooError | BarError | SomeOtherError>
```

## Note

- All of these composition methods allow async mappers as well.
- Using `unwrap` or `unwrapErr` should happen outside of the pure core, either in the shell or the domain boundaries.
