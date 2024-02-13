type Fn = (...args: any[]) => any;

interface Pipe {
    <A>(value: A): A;
    <A, B>(value: A, fn1: (input: A) => B): B;
    <A, B, C>(value: A, fn1: (input: A) => B, fn2: (input: B) => C): C;
    <A, B, C, D>(
        value: A,
        fn1: (input: A) => B,
        fn2: (input: B) => C,
        fn3: (input: C) => D
    ): D;
    <A, B, C, D, E>(
        value: A,
        fn1: (input: A) => B,
        fn2: (input: B) => C,
        fn3: (input: C) => D,
        fn4: (input: D) => E
    ): E;
}

/**
 * Represents a function that pipes a value through a series of functions.
 * @param {any} value - The initial value to be processed.
 * @param {...Function} fns - Functions to be applied sequentially to the value.
 * @returns {unknown} The result after applying all functions to the initial value.
 * @typedef {Function} Pipe
 * 
 * @example
 * const addTwo = (x) => x + 2;
 * const multiplyByThree = (x) => x * 3;
 * const square = (x) => x * x;
 *
 * const result = pipe(
 *    2,
 *    addTwo, // 4
 *    multiplyByThree, // 12
 *    square // 144
 * );
 * 
 */
export const pipe: Pipe = (value: any, ...fns: Function[]): unknown => {
    return fns.reduce((acc, fn) => fn(acc), value);
};
  