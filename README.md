# FP Utils

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

## Usage

```typescript
import { Option, matchOpt } from "@carbonteq/fp";

const safeDiv = (num: number, denom: number): Option<number> => {
  if (denom === 0) return Option.None;

  return Option.Some(num / denom);
};

const getFormatted = (opt: Option<number>): string => {
  return matchOpt(opt, {
    Some: (n) => `Result: ${n}`,
    None: () => "Cannot divide by zero",
  });
};

console.log(getFormatted(safeDiv(10, 2))); // Result: 5
console.log(getFormatted(safeDiv(10, 0))); // Cannot divide by zero
```
