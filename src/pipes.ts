export const pipe = (value: any, ...fns: Function[]) =>
  fns.reduce((acc, fn) => fn(acc), value);