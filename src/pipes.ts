type Fn = (...args: any[]) => any;

type LastReturnType<L extends Fn[]> = L extends [...any, infer Last extends Fn]
  ? ReturnType<Last>
  : never;

const pipe = <Funcs extends Fn[]>(value: any, ...fns: Funcs) =>
  fns.reduce((acc, fn) => fn(acc), value) as LastReturnType<Funcs>;