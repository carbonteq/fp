/* oxlint-disable typescript-eslint/restrict-template-expressions */
/** biome-ignore-all lint/suspicious/noExplicitAny: custom inference */

import type { CustomMatcher } from "bun:test";
import { expect } from "bun:test";
import type { Option } from "@/option.js";
import { Result } from "@/result.js";

// Type helpers to constrain matchers to their intended types
// These ensure that the matchers can only be called with the correct types at compile time
type ExtendsResult<T, Def> =
  NonNullable<T> extends Result<any, any> ? Def : never;
type ExtendsOpt<T, Def> = NonNullable<T> extends Option<any> ? Def : never;

// Result matchers
// NOTE: Bun's expect.extend() requires CustomMatcher<unknown, []>
// Type safety is enforced by the Matchers<T> interface declaration below
const toBeOk: CustomMatcher<unknown, []> = (received) => {
  if (!(received instanceof Result)) {
    return {
      pass: false,
      message: () => `expected value to be a Result, but it was not`,
    };
  }

  const r = received;
  if (r.isOk()) {
    return {
      pass: true,
      message: () => `expected Result to be Err, but was Ok`,
    };
  }

  const err = r.unwrapErr();

  return {
    pass: false,
    message: () => `expected Result to be Ok, but was Err(${err})`,
  };
};

const toBeErr: CustomMatcher<unknown, []> = (received) => {
  const r = received as Result<unknown, unknown>;
  if (r.isErr()) {
    return {
      pass: true,
      message: () => `expected Result to be Ok, but was Err`,
    };
  }

  const val = r.unwrap();

  return {
    pass: false,
    message: () => `expected Result to be Err, but was Ok(${val})`,
  };
};

// Option matchers
const toBeSome: CustomMatcher<unknown, []> = (received) => {
  const o = received as Option<unknown>;
  if (o.isSome()) {
    return {
      pass: true,
      message: () => `expected Option to be None, but was Some`,
    };
  }

  return {
    pass: false,
    message: () => `expected Option to be Some, but was None`,
  };
};

const toBeNone: CustomMatcher<unknown, []> = (received) => {
  const o = received as Option<unknown>;
  if (o.isNone()) {
    return {
      pass: true,
      message: () => `expected Option to be Some, but was None`,
    };
  }

  const val = o.unwrap();

  return {
    pass: false,
    message: () => `expected Option to be None, but was Some(${val})`,
  };
};

// Register all matchers with expect
expect.extend({
  toBeOk,
  toBeErr,
  toBeSome,
  toBeNone,
});

// Module augmentation - extends Bun's Matchers interface
// This provides compile-time type safety: the matchers can only be called
// with Result<T, E> or Option<T> types respectively
declare module "bun:test" {
  interface Matchers<T> {
    toBeOk(): ExtendsResult<T, T>;
    toBeErr(): ExtendsResult<T, T>;
    toBeSome(): ExtendsOpt<T, T>;
    toBeNone(): ExtendsOpt<T, T>;
  }
}
